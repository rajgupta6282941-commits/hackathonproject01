import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { describe, it } from 'node:test';
import { AppleAppStoreProvider } from '../src/providers/apple.provider.js';
import { createAppleRouter } from '../src/routes/apple.routes.js';
import type { AnalysisRepository } from '../src/repositories/analysis.repository.js';
import type { BrandRepository } from '../src/repositories/brand.repository.js';
import type { EvidenceRepository } from '../src/repositories/evidence.repository.js';
import { disabledAIProvider, type DisabledAIProvider } from '../src/services/detection.service.js';

const id = '507f1f77bcf86cd799439011';
const brand = {
  _id: { toString: () => id }, name: 'Vikral', aliases: ['Vikral'], trustedDomains: [],
  socialAccounts: [], mobileApps: [], description: 'Digital protection', createdAt: new Date(), updatedAt: new Date(),
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

function createRouteApp(aiProvider: DisabledAIProvider = disabledAIProvider) {
  const provider = new AppleAppStoreProvider(async () => response({ resultCount: 1, results: [{ trackId: 987, trackName: 'Vikral Mobile', artistName: 'Vikral Labs', bundleId: 'com.vikral.mobile', trackViewUrl: 'https://apps.apple.com/us/app/vikral-mobile/id987' }] }));
  const storedEvidence: any[] = [];
  const storedAnalyses = new Map<string, any>();
  const brands: BrandRepository = { list: async () => [], findById: async () => brand as never, create: async () => brand as never, update: async () => brand as never, delete: async () => false };
  const history: AnalysisRepository = { list: async () => [], findById: async (analysisId) => storedAnalyses.get(analysisId) ?? null, create: async (result) => { const document = { result }; storedAnalyses.set(result.analysisId, document); return document as never; } };
  const evidence: EvidenceRepository = { findDuplicate: async (_brandId, fingerprint) => storedEvidence.find((record) => record.contentFingerprint === fingerprint) ?? null, create: async (record) => { storedEvidence.push(record); return record as never; } };
  const app = express();
  app.use(express.json());
  app.use('/api/integrations/apple', createAppleRouter(provider, brands, history, evidence, aiProvider));
  return { app, storedEvidence };
}

describe('Apple integration routes', () => {
  it('searches and returns normalized listings from the provider', async () => {
    const { app } = createRouteApp();
    const result = await request(app).post('/api/integrations/apple/search').send({ term: 'Vikral', country: 'US', limit: 1 }).expect(200);
    assert.equal(result.body.provider, 'apple-itunes-search');
    assert.equal(result.body.listings[0].appName, 'Vikral Mobile');
    assert.equal(result.body.listings[0].providerRecordId, '987');
    assert.equal(result.body.listings[0].sourceProvider, 'apple_itunes_search');
  });

  it('analyzes a selected listing, preserves deterministic scoring on AI failure, and deduplicates evidence', async () => {
    const failingAI: DisabledAIProvider = { analyze: async () => { throw new Error('provider unavailable'); } };
    const { app, storedEvidence } = createRouteApp(failingAI);
    const search = await request(app).post('/api/integrations/apple/search').send({ term: 'Vikral', country: 'US', limit: 1 }).expect(200);
    const selectionId = search.body.listings[0].selectionId;
    const first = await request(app).post('/api/integrations/apple/analyze').send({ brandId: id, selectionId }).expect(200);
    assert.equal(first.body.analysis.candidate.sourceType, 'mobile_app');
    assert.equal(first.body.analysis.candidate.candidateName, 'Vikral Mobile');
    assert.equal(first.body.analysis.aiAnalysis.status, 'failed');
    assert.equal(first.body.analysis.finalPriorityScore, first.body.analysis.deterministicScore);
    assert.equal(first.body.analysis.evidence.sourceType, 'authorized_api');
    assert.equal(first.body.analysis.evidence.sourceProvider, 'apple_itunes_search');
    assert.deepEqual(first.body.analysis.evidence.provenance, ['provider_retrieved', 'normalized']);
    assert.equal(storedEvidence.length, 1);

    const duplicate = await request(app).post('/api/integrations/apple/analyze').send({ brandId: id, selectionId }).expect(200);
    assert.equal(duplicate.body.analysis.duplicateEvidence, true);
    assert.equal(duplicate.body.analysis.analysisId, first.body.analysis.analysisId);
    assert.equal(storedEvidence.length, 1);
  });
});