import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { describe, it } from 'node:test';
import { BlueskyProvider, BlueskyProviderError, BLUESKY_API_URL } from '../src/providers/bluesky.provider.js';
import { createBlueskyRouter } from '../src/routes/bluesky.routes.js';
import { disabledAIProvider } from '../src/services/detection.service.js';
import type { AnalysisRepository } from '../src/repositories/analysis.repository.js';
import type { EvidenceRepository } from '../src/repositories/evidence.repository.js';

const id = '507f1f77bcf86cd799439011';
const brand = {
  _id: { toString: () => id }, name: 'Vikral', aliases: ['Vikral'], trustedDomains: [],
  socialAccounts: [], mobileApps: [], description: 'Digital protection', createdAt: new Date(), updatedAt: new Date(),
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

describe('Bluesky public profile provider', () => {
  it('requests the public actor search endpoint and normalizes profile fields', async () => {
    let requested = '';
    const provider = new BlueskyProvider(async (input) => {
      requested = String(input);
      return response({ actors: [{ did: 'did:plc:123', handle: 'vikral.bsky.social', displayName: 'Vikral', description: 'Digital protection', indexedAt: '2026-10-14T00:00:00.000Z' }] });
    }, () => 1_000_000);
    const profiles = await provider.search({ query: 'Vikral', limit: 5 });
    assert.match(requested, new RegExp(`^${BLUESKY_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(requested, /q=Vikral/);
    assert.equal(profiles[0]?.handle, 'vikral.bsky.social');
    assert.equal(profiles[0]?.profileUrl, 'https://bsky.app/profile/vikral.bsky.social');
    assert.equal(profiles[0]?.sourceProvider, 'bluesky_public_api');
  });

  it('rejects invalid input and maps upstream throttling and timeouts', async () => {
    const provider = new BlueskyProvider(async () => response({ actors: [] }));
    await assert.rejects(provider.search({ query: '', limit: 1 }), (error: BlueskyProviderError) => error.statusCode === 400);
    const rateLimited = new BlueskyProvider(async () => response({}, 429));
    await assert.rejects(rateLimited.search({ query: 'x', limit: 1 }), (error: BlueskyProviderError) => error.statusCode === 429);
    const timeout = new BlueskyProvider(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal) init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await assert.rejects(timeout.search({ query: 'x', limit: 1 }), (error: BlueskyProviderError) => error.statusCode === 504);
  });

  it('routes a selected public profile into detection with provider provenance', async () => {
    const provider = new BlueskyProvider(async () => response({ actors: [{ did: 'did:plc:123', handle: 'vikral-copy.bsky.social', displayName: 'Vikral Copy' }] }));
    const stored: any[] = [];
    const histories = new Map<string, any>();
    const history: AnalysisRepository = { list: async () => [], findById: async (analysisId) => histories.get(analysisId) ?? null, create: async (result) => { histories.set(result.analysisId, result); return result; } };
    const evidence: EvidenceRepository = { findDuplicate: async (_brandId, fingerprint) => stored.find((item) => item.contentFingerprint === fingerprint) ?? null, create: async (record) => { stored.push(record); return record; } };
    const app = express();
    app.use(express.json());
    app.use('/api/integrations/bluesky', createBlueskyRouter(provider, { findById: async () => brand as never } as never, history, evidence, disabledAIProvider));
    const search = await request(app).post('/api/integrations/bluesky/search').send({ query: 'Vikral', limit: 1 }).expect(200);
    const analysis = await request(app).post('/api/integrations/bluesky/analyze').send({ brandId: id, selectionId: search.body.profiles[0].selectionId }).expect(200);
    assert.equal(analysis.body.analysis.sourceType, 'social');
    assert.equal(analysis.body.analysis.evidence.sourceType, 'authorized_api');
    assert.equal(analysis.body.analysis.evidence.sourceProvider, 'bluesky_public_api');
    assert.deepEqual(analysis.body.analysis.evidence.provenance, ['provider_retrieved', 'normalized']);
  });
});