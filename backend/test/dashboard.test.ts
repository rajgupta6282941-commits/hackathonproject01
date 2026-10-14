import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import type { DashboardRepository } from '../src/repositories/dashboard.repository.js';
import { createDashboardRouter } from '../src/routes/dashboard.routes.js';

const overview = {
  metrics: {
    totalBrands: { value: 2, definition: 'Saved brand profiles.' },
    totalAnalyses: { value: 3, definition: 'Persisted analysis results, not confirmed incidents.' },
    highPriorityFindings: { value: 1, definition: 'Recorded analyses rated high or critical.' },
    criticalPriorityFindings: { value: 1, definition: 'Recorded analyses rated critical.' },
    socialAnalyses: { value: 2, definition: 'Recorded social-source analyses.' },
    mobileAppAnalyses: { value: 1, definition: 'Recorded mobile-app analyses.' },
  },
  riskDistribution: { low: 1, medium: 1, high: 0, critical: 1 },
  sourceDistribution: [{ sourceType: 'social' as const, count: 2 }, { sourceType: 'mobile_app' as const, count: 1 }],
  recentAnalyses: [],
  trend: { available: false, windowDays: 30, points: [], message: 'More recorded analyses are needed to show a reliable trend.' },
};

function appWithDashboard() {
  const repository: DashboardRepository = { overview: async () => overview };
  const app = express();
  app.use('/api/dashboard', createDashboardRouter(repository));
  return app;
}

describe('dashboard overview', () => {
  it('returns backend-derived overview data', async () => {
    const response = await request(appWithDashboard()).get('/api/dashboard/overview').expect(200);
    assert.equal(response.body.overview.metrics.totalAnalyses.value, 3);
    assert.equal(response.body.overview.riskDistribution.critical, 1);
  });

  it('rejects invalid dashboard bounds', async () => {
    await request(appWithDashboard()).get('/api/dashboard/overview?days=0').expect(400);
    await request(appWithDashboard()).get('/api/dashboard/overview?limit=51').expect(400);
  });
});
