import { randomUUID } from 'node:crypto';
import type { ProviderAdapter, ProviderHealth } from '../types/provider.types.js';

export const BLUESKY_API_URL = 'https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors';
const MAX_LIMIT = 10;
const MAX_RESPONSE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const MIN_REQUEST_INTERVAL_MS = 300;

export class BlueskyProviderError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
  }
}

export interface BlueskySearchInput {
  query: string;
  limit: number;
}

export interface BlueskyProfile {
  selectionId: string;
  providerRecordId: string;
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  indexedAt?: string;
  profileUrl: string;
  platform: 'Bluesky';
  collectionTime: string;
  sourceProvider: 'bluesky_public_api';
}

interface BlueskySearchResponse {
  actors: Array<Record<string, unknown>>;
}

export class BlueskyProvider implements ProviderAdapter {
  readonly id = 'bluesky-public-api';
  readonly displayName = 'Bluesky public profiles';
  readonly capabilities = ['social_profile'];
  private lastRequestAt = 0;
  private lastSuccessfulSync?: string;
  private lastError?: string;
  private lastStatus: ProviderHealth['status'] = 'connected';
  private readonly selections = new Map<string, { profile: BlueskyProfile; expiresAt: number }>();

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly now = () => Date.now()) {}

  validateConfiguration() {
    return { configured: true };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      capabilities: this.capabilities,
      status: this.lastStatus,
      configurationRequired: false,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastError: this.lastError,
    };
  }

  async fetchRecords() {
    return [];
  }

  async search(input: BlueskySearchInput): Promise<BlueskyProfile[]> {
    const validated = validateBlueskySearchInput(input);
    const elapsed = this.now() - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      throw new BlueskyProviderError('Bluesky search is being rate limited locally. Retry shortly.', 429);
    }
    this.lastRequestAt = this.now();
    const url = new URL(BLUESKY_API_URL);
    url.searchParams.set('q', validated.query);
    url.searchParams.set('limit', String(validated.limit));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
      if (response.status === 429) throw new BlueskyProviderError('Bluesky search rate limit reached. Retry shortly.', 429);
      if (!response.ok) throw new BlueskyProviderError('Bluesky public profile search returned an unavailable response.', 502);
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new BlueskyProviderError('Bluesky response exceeded the permitted size.', 502);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new BlueskyProviderError('Bluesky response exceeded the permitted size.', 502);
      let payload: BlueskySearchResponse;
      try {
        payload = JSON.parse(new TextDecoder().decode(buffer)) as BlueskySearchResponse;
      } catch {
        throw new BlueskyProviderError('Bluesky returned malformed JSON.', 502);
      }
      if (!Array.isArray(payload.actors)) throw new BlueskyProviderError('Bluesky returned an invalid search response.', 502);
      const profiles = payload.actors.map((actor) => normalizeBlueskyProfile(actor, this.now())).filter((profile): profile is BlueskyProfile => profile !== undefined);
      this.lastSuccessfulSync = new Date(this.now()).toISOString();
      this.lastError = undefined;
      this.lastStatus = 'connected';
      for (const [key, value] of this.selections) if (value.expiresAt <= this.now()) this.selections.delete(key);
      profiles.forEach((profile) => this.selections.set(profile.selectionId, { profile, expiresAt: this.now() + 10 * 60 * 1000 }));
      return profiles;
    } catch (error) {
      if (error instanceof BlueskyProviderError) {
        this.lastError = error.message;
        this.lastStatus = error.statusCode === 429 ? 'unavailable' : 'error';
        throw error;
      }
      this.lastError = error instanceof Error && error.name === 'AbortError' ? 'Bluesky public API request timed out.' : 'Bluesky public API request failed.';
      this.lastStatus = 'unavailable';
      throw new BlueskyProviderError(this.lastError, 504);
    } finally {
      clearTimeout(timeout);
    }
  }

  getSelection(selectionId: string): BlueskyProfile | undefined {
    const selection = this.selections.get(selectionId);
    if (!selection || selection.expiresAt <= this.now()) {
      this.selections.delete(selectionId);
      return undefined;
    }
    return selection.profile;
  }
}

export function validateBlueskySearchInput(input: BlueskySearchInput): BlueskySearchInput {
  if (!input || typeof input.query !== 'string' || !input.query.trim() || input.query.trim().length > 100) throw new BlueskyProviderError('query must be between 1 and 100 characters.', 400);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) throw new BlueskyProviderError(`limit must be between 1 and ${MAX_LIMIT}.`, 400);
  return { query: input.query.trim(), limit: input.limit };
}

function normalizeBlueskyProfile(actor: Record<string, unknown>, now: number): BlueskyProfile | undefined {
  if (typeof actor.did !== 'string' || typeof actor.handle !== 'string' || !actor.did || !actor.handle) return undefined;
  const handle = actor.handle.trim();
  if (!handle || handle === 'handle.invalid') return undefined;
  return {
    selectionId: randomUUID(),
    providerRecordId: actor.did,
    did: actor.did,
    handle,
    displayName: typeof actor.displayName === 'string' ? actor.displayName.trim() || undefined : undefined,
    description: typeof actor.description === 'string' ? actor.description.trim() || undefined : undefined,
    avatarUrl: typeof actor.avatar === 'string' ? actor.avatar : undefined,
    indexedAt: typeof actor.indexedAt === 'string' ? actor.indexedAt : undefined,
    profileUrl: `https://bsky.app/profile/${encodeURIComponent(handle)}`,
    platform: 'Bluesky',
    collectionTime: new Date(now).toISOString(),
    sourceProvider: 'bluesky_public_api',
  };
}

export const blueskyProvider = new BlueskyProvider();