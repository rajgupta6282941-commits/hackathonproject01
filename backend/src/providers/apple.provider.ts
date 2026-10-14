import { randomUUID } from 'node:crypto';
import type { AppleAppListing, ProviderAdapter, ProviderHealth } from '../types/provider.types.js';

export const APPLE_SEARCH_URL = 'https://itunes.apple.com/search';
const MAX_LIMIT = 10;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const MIN_REQUEST_INTERVAL_MS = 800;

export class AppleProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
  }
}

export interface AppleSearchInput {
  term: string;
  country: string;
  limit: number;
}

interface AppleSearchResponse {
  resultCount: number;
  results: Array<Record<string, unknown>>;
}

export class AppleAppStoreProvider implements ProviderAdapter {
  readonly id = 'apple-itunes-search';
  readonly displayName = 'Apple App Store Search';
  readonly capabilities = ['mobile_app'];
  private lastRequestAt = 0;
  private lastSuccessfulSync?: string;
  private lastError?: string;
  private lastStatus: ProviderHealth['status'] = 'not_configured';
  private readonly selections = new Map<string, { listing: AppleAppListing; expiresAt: number }>();

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly now = () => Date.now()) {}

  validateConfiguration() {
    return { configured: true };
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (this.lastSuccessfulSync || this.lastError) return this.health();
    try {
      await this.search({ term: 'Vikral', country: 'US', limit: 1 });
    } catch {
      // search records the sanitized provider outcome for the health response
    }
    return this.health();
  }

  async fetchRecords() {
    return [];
  }

  async search(input: AppleSearchInput): Promise<AppleAppListing[]> {
    const validated = validateAppleSearchInput(input);
    const elapsed = this.now() - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      const retryAfter = Math.max(1, Math.ceil((MIN_REQUEST_INTERVAL_MS - elapsed) / 1000));
      throw new AppleProviderError(`Apple request rate limit reached. Retry in ${retryAfter} second(s).`, 429);
    }
    this.lastRequestAt = this.now();
    const url = new URL(APPLE_SEARCH_URL);
    url.searchParams.set('term', validated.term);
    url.searchParams.set('country', validated.country);
    url.searchParams.set('entity', 'software');
    url.searchParams.set('limit', String(validated.limit));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new AppleProviderError('Apple App Store search returned an unavailable response.', 502);
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new AppleProviderError('Apple response exceeded the permitted size.', 502);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new AppleProviderError('Apple response exceeded the permitted size.', 502);
      let payload: AppleSearchResponse;
      try {
        payload = JSON.parse(new TextDecoder().decode(buffer)) as AppleSearchResponse;
      } catch {
        throw new AppleProviderError('Apple returned malformed JSON.', 502);
      }
      if (!Number.isInteger(payload.resultCount) || !Array.isArray(payload.results)) throw new AppleProviderError('Apple returned an invalid search response.', 502);
      const listings = payload.results.map((result) => normalizeAppleResult(result)).filter((listing): listing is AppleAppListing => listing !== undefined);
      this.lastSuccessfulSync = new Date(this.now()).toISOString();
      this.lastError = undefined;
      this.lastStatus = 'connected';
      for (const [key, value] of this.selections) if (value.expiresAt <= this.now()) this.selections.delete(key);
      listings.forEach((listing) => this.selections.set(listing.selectionId, { listing, expiresAt: this.now() + 10 * 60 * 1000 }));
      return listings;
    } catch (error) {
      if (error instanceof AppleProviderError) {
        this.lastError = error.message;
        this.lastStatus = error.statusCode === 429 ? 'unavailable' : 'error';
        throw error;
      }
      this.lastError = error instanceof Error && error.name === 'AbortError' ? 'Apple App Store request timed out.' : 'Apple App Store request failed.';
      this.lastStatus = 'unavailable';
      throw new AppleProviderError(this.lastError, 504);
    } finally {
      clearTimeout(timeout);
    }
  }

  getSelection(selectionId: string): AppleAppListing | undefined {
    const selection = this.selections.get(selectionId);
    if (!selection || selection.expiresAt <= this.now()) {
      this.selections.delete(selectionId);
      return undefined;
    }
    return selection.listing;
  }

  private health(): ProviderHealth {
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
}

export function validateAppleSearchInput(input: AppleSearchInput): AppleSearchInput {
  if (!input || typeof input.term !== 'string' || !input.term.trim() || input.term.trim().length > 100) throw new AppleProviderError('term must be between 1 and 100 characters.', 400);
  if (typeof input.country !== 'string' || !/^[A-Za-z]{2}$/.test(input.country.trim())) throw new AppleProviderError('country must be a two-letter storefront code.', 400);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) throw new AppleProviderError(`limit must be between 1 and ${MAX_LIMIT}.`, 400);
  return { term: input.term.trim(), country: input.country.trim().toUpperCase(), limit: input.limit };
}

function normalizeAppleResult(result: Record<string, unknown>): AppleAppListing | undefined {
  if (typeof result.trackId !== 'number' || typeof result.trackName !== 'string' || typeof result.artistName !== 'string') return undefined;
  const listing: AppleAppListing = {
    selectionId: randomUUID(),
    providerRecordId: String(result.trackId),
    appName: result.trackName.trim(),
    publisher: result.artistName.trim(),
    bundleId: typeof result.bundleId === 'string' ? result.bundleId.trim() : undefined,
    listingUrl: typeof result.trackViewUrl === 'string' ? result.trackViewUrl : undefined,
    platform: 'iOS',
    genre: typeof result.primaryGenreName === 'string' ? result.primaryGenreName.trim() : undefined,
    collectionTime: new Date().toISOString(),
    sourceProvider: 'apple_itunes_search',
  };
  return listing.appName && listing.publisher ? listing : undefined;
}

export const appleAppStoreProvider = new AppleAppStoreProvider();
