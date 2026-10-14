import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import type { AnalysisRepository } from '../src/repositories/analysis.repository.js';
import { createSocialMonitoringRouter } from '../src/routes/social-monitoring.routes.js';

const result = {
  analysisId: 'analysis-123',
  brandId: '507f1f77bcf86cd799439011',
  sourceType: 'social' as const,
  candidate: { sourceType: 'social' as const, candidateName: 'Vikral', platform: 'LinkedIn' },
  matchedBrand: { id: '507f1f77bcf86cd799439011', name: 'Vikral' },
  deterministicSignals: [],
  deterministicScore: 0,
  finalPriorityScore: 0,
  priority: 'low' as const,
  trustedAssetExclusion: { excluded: false },
  aiAnalysis: { status: 'disabled' as const, contextualFindings: [], missingEvidence: [] },
  finalReasons: [],
  limitations: ['Submitted information was not independently verified.'],
  analyzedAt: new Date().toISOString(),
};

function appWithHistory() {
  const document = { result } as never;
  const repository: AnalysisRepository = {
    list: async () => [document],
    findById: async (id) => id === result.analysisId ? document : null,
    create: async () => document,
  };
  const app = express();
  app.use('/api/social-monitoring', createSocialMonitoringRouter(repository));
  return app;
}

describe('social monitoring history', () => {
  it('lists persisted analyses and retrieves a selected analysis', async () => {
    const app = appWithHistory();
    const list = await request(app).get('/api/social-monitoring/analyses').expect(200);
    assert.equal(list.body.analyses[0].analysisId, result.analysisId);
    const detail = await request(app).get(`/api/social-monitoring/analyses/${result.analysisId}`).expect(200);
    assert.equal(detail.body.analysis.matchedBrand.name, 'Vikral');
  });

  it('returns not found for an unknown analysis', async () => {
    await request(appWithHistory()).get('/api/social-monitoring/analyses/missing-analysis').expect(404);
  });
});
