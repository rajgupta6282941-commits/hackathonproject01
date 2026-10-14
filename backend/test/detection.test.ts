import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import type { BrandRepository } from '../src/repositories/brand.repository.js';
import type { AnalysisRepository } from '../src/repositories/analysis.repository.js';
import { createDetectionRouter } from '../src/routes/detection.routes.js';
import { analyzeCandidate } from '../src/services/detection.service.js';
import { validateCandidateInput, CandidateValidationError } from '../src/validation/detection.validation.js';
import { normalizeComparable } from '../src/detection/normalize.js';
import { normalizedSimilarity } from '../src/detection/similarity.js';

const id = '507f1f77bcf86cd799439011';
const brand = {
  _id: { toString: () => id }, name: 'Acme Security', aliases: ['Acme'],
  trustedDomains: ['acme.example'], socialAccounts: [{ platform: 'LinkedIn', handle: 'acmesecurity', verificationStatus: 'verified' }],
  mobileApps: [], description: 'Security monitoring', createdAt: new Date(), updatedAt: new Date(),
};

const appBrand = {
  ...brand,
  name: 'Vikral',
  mobileApps: [{
    platform: 'Google Play',
    appName: 'Vikral Mobile',
    packageId: 'com.vikral.mobile',
    publisher: 'Vikral',
    verificationStatus: 'verified',
  }],
};

function appWithBrand(aiProvider?: { analyze: () => Promise<any> }) {
  const repository: BrandRepository = {
    list: async () => [], findById: async (brandId) => brandId === id ? brand as never : null,
    create: async () => brand as never, update: async () => brand as never, delete: async () => false,
  };
  const historyRepository: AnalysisRepository = {
    list: async () => [],
    findById: async () => null,
    create: async (result) => result as never,
  };
  const app = express(); app.use(express.json()); app.use('/api/detection', createDetectionRouter(repository, aiProvider, historyRepository)); return app;
}

function appWithMobileBrand() {
  const repository: BrandRepository = {
    list: async () => [], findById: async (brandId) => brandId === id ? appBrand as never : null,
    create: async () => appBrand as never, update: async () => appBrand as never, delete: async () => false,
  };
  const historyRepository: AnalysisRepository = { list: async () => [], findById: async () => null, create: async (result) => result as never };
  const app = express(); app.use(express.json()); app.use('/api/detection', createDetectionRouter(repository, undefined, historyRepository)); return app;
}

describe('candidate validation', () => {
  it('normalizes bounded input and rejects incomplete source-specific candidates', () => {
    assert.equal(validateCandidateInput({ sourceType: 'social', candidateName: '  Acme  ', handle: ' @acme-copy ' }).candidateName, 'Acme');
    assert.throws(() => validateCandidateInput({ sourceType: 'social', candidateName: 'Acme' }), CandidateValidationError);
    assert.throws(() => validateCandidateInput({ sourceType: 'website', candidateName: 'Acme', url: 'javascript:bad' }), CandidateValidationError);
  });

  it('normalizes Unicode and selected look-alike characters for comparison', () => {
    assert.equal(normalizeComparable('  Víkral-0  '), 'vikralo');
    assert.equal(normalizedSimilarity('Vikral', 'V1kral') > 0.8, true);
  });
});

describe('detection route', () => {
  it('returns deterministic signals and disabled AI output', async () => {
    const response = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Acme Security', handle: '@acme-copy', url: 'https://fake.example/acme' },
    }).expect(200);
    assert.equal(response.body.analysis.aiAnalysis.status, 'disabled');
    assert.equal(response.body.analysis.deterministicScore > 0, true);
    assert.ok(response.body.analysis.deterministicSignals.some((signal: { code: string }) => signal.code === 'UNTRUSTED_DOMAIN'));
  });

  it('excludes an exact verified asset from risk scoring', async () => {
    const response = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Acme Security', handle: 'acmesecurity' },
    }).expect(200);
    assert.equal(response.body.analysis.trustedAssetExclusion.excluded, true);
    assert.equal(response.body.analysis.finalPriorityScore, 0);
  });

  it('detects look-alike names and does not flag unrelated names', async () => {
    const lookAlike = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Acme Secur1ty', handle: '@acme-copy' },
    }).expect(200);
    const unrelated = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Completely Unrelated', handle: '@ordinary-account' },
    }).expect(200);
    assert.equal(lookAlike.body.analysis.deterministicScore > unrelated.body.analysis.deterministicScore, true);
    assert.match(lookAlike.body.analysis.finalReasons.join(' '), /similar/i);
    assert.equal(unrelated.body.analysis.deterministicSignals.length, 0);
    assert.equal(unrelated.body.analysis.deterministicScore, 0);
  });

  it('returns the same deterministic score for the same input', async () => {
    const candidate = { sourceType: 'social', candidateName: 'Acme Secur1ty', handle: '@acme-copy' };
    const first = await request(appWithBrand()).post('/api/detection/analyze').send({ brandId: id, candidate }).expect(200);
    const second = await request(appWithBrand()).post('/api/detection/analyze').send({ brandId: id, candidate }).expect(200);
    assert.equal(first.body.analysis.deterministicScore, second.body.analysis.deterministicScore);
    assert.deepEqual(first.body.analysis.deterministicSignals, second.body.analysis.deterministicSignals);
  });

  it('rejects an invalid brand identifier', async () => {
    const response = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: 'not-an-id',
      candidate: { sourceType: 'social', candidateName: 'Acme', handle: '@acme' },
    }).expect(400);
    assert.equal(response.body.error, 'A valid brandId is required.');
  });

  it('keeps deterministic detection available when the optional AI provider fails', async () => {
    const failingProvider = { analyze: async () => { throw new Error('provider unavailable'); } };
    const response = await request(appWithBrand(failingProvider)).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Acme Secur1ty', handle: '@acme-copy' },
    }).expect(200);
    assert.equal(response.body.analysis.aiAnalysis.status, 'failed');
    assert.equal(response.body.analysis.deterministicScore > 0, true);
  });

  it('reports an exact verified official account as excluded', async () => {
    const response = await request(appWithBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'social', candidateName: 'Acme Security', handle: '@acmesecurity' },
    }).expect(200);
    assert.equal(response.body.analysis.trustedAssetExclusion.excluded, true);
    assert.equal(response.body.analysis.finalPriorityScore, 0);
  });

  it('excludes an exact verified app identifier and reports mismatches without overclaiming', async () => {
    const trusted = await request(appWithMobileBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'mobile_app', candidateName: 'Vikral Mobile', platform: 'Android', packageId: 'com.vikral.mobile', publisher: 'Vikral' },
    }).expect(200);
    assert.equal(trusted.body.analysis.trustedAssetExclusion.excluded, true);
    assert.equal(trusted.body.analysis.finalPriorityScore, 0);

    const mismatch = await request(appWithMobileBrand()).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'mobile_app', candidateName: 'V1kral Mobile', platform: 'Android', packageId: 'com.other.app', publisher: 'Other Developer' },
    }).expect(200);
    assert.equal(mismatch.body.analysis.trustedAssetExclusion.excluded, false);
    assert.ok(mismatch.body.analysis.deterministicSignals.some((signal: { code: string }) => signal.code === 'APP_IDENTIFIER_MISMATCH'));
    assert.ok(mismatch.body.analysis.deterministicSignals.some((signal: { code: string }) => signal.code === 'APP_PUBLISHER_MISMATCH'));
    assert.equal(mismatch.body.analysis.finalPriorityScore < 100, true);
  });

  it('does not automatically exclude an unverified app record', async () => {
    const repository: BrandRepository = {
      list: async () => [], findById: async (brandId) => brandId === id ? { ...appBrand, mobileApps: [{ ...appBrand.mobileApps[0], verificationStatus: 'unverified' }] } as never : null,
      create: async () => appBrand as never, update: async () => appBrand as never, delete: async () => false,
    };
    const historyRepository: AnalysisRepository = { list: async () => [], findById: async () => null, create: async (result) => result as never };
    const app = express(); app.use(express.json()); app.use('/api/detection', createDetectionRouter(repository, undefined, historyRepository));
    const response = await request(app).post('/api/detection/analyze').send({
      brandId: id,
      candidate: { sourceType: 'mobile_app', candidateName: 'Vikral Mobile', platform: 'Android', packageId: 'com.vikral.mobile' },
    }).expect(200);
    assert.equal(response.body.analysis.trustedAssetExclusion.excluded, false);
  });
});
