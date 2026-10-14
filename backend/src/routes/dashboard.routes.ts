import { Router } from 'express';
import { dashboardRepository, type DashboardRepository } from '../repositories/dashboard.repository.js';

export function createDashboardRouter(repository: DashboardRepository = dashboardRepository) {
  const router = Router();
  router.get('/overview', async (request, response) => {
    const days = Number(request.query.days ?? 30);
    const limit = Number(request.query.limit ?? 10);
    if (!Number.isInteger(days) || days < 1 || days > 90) return response.status(400).json({ error: 'days must be an integer between 1 and 90.' });
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return response.status(400).json({ error: 'limit must be an integer between 1 and 50.' });
    try {
      return response.status(200).json({ overview: await repository.overview(days, limit) });
    } catch (error) {
      console.error('[vikral-api] Dashboard overview failed:', error);
      return response.status(503).json({ error: 'Dashboard data is unavailable.' });
    }
  });
  return router;
}

export default createDashboardRouter();
