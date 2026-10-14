import { Router } from 'express';
import mongoose from 'mongoose';
import { analysisRepository, serializeAnalysis, type AnalysisRepository } from '../repositories/analysis.repository.js';

export function createSocialMonitoringRouter(repository: AnalysisRepository = analysisRepository) {
  const router = Router();

  router.get('/analyses', async (_request, response) => {
    try {
      const analyses = await repository.list();
      return response.status(200).json({ analyses: analyses.map(serializeAnalysis) });
    } catch (error) {
      console.error('[vikral-api] Social analysis history failed:', error);
      return response.status(503).json({ error: 'Analysis history is unavailable.' });
    }
  });

  router.get('/analyses/:id', async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.id) && request.params.id.length < 10) {
      return response.status(400).json({ error: 'A valid analysis ID is required.' });
    }

    try {
      const analysis = await repository.findById(request.params.id);
      if (!analysis) return response.status(404).json({ error: 'Analysis not found.' });
      return response.status(200).json({ analysis: serializeAnalysis(analysis) });
    } catch (error) {
      console.error('[vikral-api] Social analysis lookup failed:', error);
      return response.status(503).json({ error: 'Analysis lookup is unavailable.' });
    }
  });

  return router;
}

export default createSocialMonitoringRouter();
