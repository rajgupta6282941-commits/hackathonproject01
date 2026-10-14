import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppleAppStoreProvider, AppleProviderError, APPLE_SEARCH_URL } from '../src/providers/apple.provider.js';
import { createProviderEvidence } from '../src/validation/evidence.validation.js';
import { analyzeAndPersist } from '../src/routes/detection.routes.js';
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

function providerWith(fetchImpl: typeof fetch, now = () => 1_000_000) {
  return new AppleAppStoreProvider(fetchImpl, now);
}

describe('Apple App Store provider', () => {
  it('requests the fixed Apple endpoint and normalizes real listing fields', async () => {
    let requested = '';
    const provider = providerWith(async (input) => {
      requested = String(input);
      return response({ resultCount: 1, results: [{ trackId: 123, trackName: 'Vikral Mobile', artistName: 'Vikral Labs', bundleId: 'com.vikral.mobile', trackViewUrl: 'https://apps.apple.com/us/app/vikral-mobile/id123', primaryGenreName: 'Utilities' }] });
    });
    const listings = await provider.search({ term: 'Vikral', country: 'us', limit: 5 });
    assert.match(requested, new RegExp(`^${APPLE_SEARCH_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(requested, /entity=software/);
    assert.equal(listings[0]?.appName, 'Vikral Mobile');
    assert.equal(listings[0]?.publisher, 'Vikral Labs');
    assert.equal(listings[0]?.bundleId, 'com.vikral.mobile');
    assert.equal(listings[0]?.sourceProvider, 'apple_itunes_search');
  });

  it('returns empty results and ignores malformed individual records', async () => {
    const provider = providerWith(async () => response({ resultCount: 2, results: [{ trackId: 1 }, { trackId: 2, trackName: 'Complete', artistName: 'Publisher' }] }));
    const listings = await provider.search({ term: 'complete', country: 'US', limit: 2 });
    assert.equal(listings.length, 1);
    const emptyProvider = providerWith(async () => response({ resultCount: 0, results: [] }), () => 2_000_000);
    assert.deepEqual(await emptyProvider.search({ term: 'none', country: 'US', limit: 1 }), []);
  });

  it('rejects invalid search input, provider JSON, and handles timeout and rate limiting', async () => {
    const provider = providerWith(async () => response({ nope: true }));
    await assert.rejects(provider.search({ term: '', country: 'US', limit: 1 }), (error: AppleProviderError) => error.statusCode === 400);
    await assert.rejects(provider.search({ term: 'x', country: 'USA', limit: 1 }), (error: AppleProviderError) => error.statusCode === 400);
    await assert.rejects(provider.search({ term: 'x', country: 'US', limit: 11 }), (error: AppleProviderError) => error.statusCode === 400);
    await assert.rejects(provider.search({ term: 'x', country: 'US', limit: 1 }), /invalid search response/);
    const rateLimited = providerWith(async () => response({ resultCount: 0, results: [] }));
    await rateLimited.search({ term: 'x', country: 'US', limit: 1 });
    await assert.rejects(rateLimited.search({ term: 'x', country: 'US', limit: 1 }), (error: AppleProviderError) => error.statusCode === 429);
    const timeout = providerWith(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal) init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await assert.rejects(timeout.search({ term: 'x', country: 'US', limit: 1 }), (error: AppleProviderError) => error.statusCode === 504);
  });

  it('assigns provider provenance and reuses the existing detection workflow', async () => {
    const candidate = { sourceType: 'mobile_app' as const, candidateName: 'Vikral Mobile', platform: 'iOS', publisher: 'Vikral Labs', bundleId: 'com.vikral.mobile', url: 'https://apps.apple.com/us/app/vikral-mobile/id123' };
    const stored: any[] = [];
    const histories = new Map<string, any>();
    const history: AnalysisRepository = { list: async () => [], findById: async (analysisId) => histories.get(analysisId) ?? null, create: async (result) => { histories.set(result.analysisId, { result }); return result as never; } };
    const evidence: EvidenceRepository = { findDuplicate: async (_brandId, fingerprint) => stored.find((item) => item.contentFingerprint === fingerprint) ?? null, create: async (record) => { stored.push({ ...record, analysisId: record.analysisId }); return record as never; } };
    const first = await analyzeAndPersist(brand as never, candidate, { analyze: async () => ({ status: 'disabled', contextualFindings: [], missingEvidence: [] }) }, history, evidence, (brandId, item, analysisId) => createProviderEvidence(brandId, item, analysisId, 'apple_itunes_search', '123', new Date()));
    assert.deepEqual(first.evidence?.provenance, ['provider_retrieved', 'normalized']);
    assert.equal(first.evidence?.sourceType, 'authorized_api');
    assert.equal(first.evidence?.sourceProvider, 'apple_itunes_search');
    const duplicate = await analyzeAndPersist(brand as never, candidate, { analyze: async () => ({ status: 'disabled', contextualFindings: [], missingEvidence: [] }) }, history, evidence, (brandId, item, analysisId) => createProviderEvidence(brandId, item, analysisId, 'apple_itunes_search', '123', new Date()));
    assert.equal(duplicate.duplicateEvidence, true);
    assert.equal(stored.length, 1);
  });
});
