import { Router } from 'express';
import mongoose from 'mongoose';
import { analysisRepository, type AnalysisRepository } from '../repositories/analysis.repository.js';
import { brandRepository, type BrandRepository } from '../repositories/brand.repository.js';
import { evidenceRepository, type EvidenceRepository } from '../repositories/evidence.repository.js';
import { analyzeAndPersist } from './detection.routes.js';
import { blueskyProvider, BlueskyProviderError } from '../providers/bluesky.provider.js';
import { createProviderEvidence } from '../validation/evidence.validation.js';
import { CandidateValidationError, validateCandidateInput } from '../validation/detection.validation.js';
import { type DisabledAIProvider } from '../services/detection.service.js';
import { configuredLLMProvider } from '../services/llm.provider.js';

export function createBlueskyRouter(
  provider = blueskyProvider,
  brands: BrandRepository = brandRepository,
  history: AnalysisRepository = analysisRepository,
  evidence: EvidenceRepository = evidenceRepository,
  aiProvider: DisabledAIProvider = configuredLLMProvider,
) {
  const router = Router();

  router.post('/search', async (request, response) => {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return response.status(400).json({ error: 'A search request object is required.' });
      const profiles = await provider.search({ query: body.query as string, limit: body.limit as number });
      return response.status(200).json({ provider: provider.id, profiles });
    } catch (error) {
      if (error instanceof BlueskyProviderError) return response.status(error.statusCode).json({ error: error.message });
      console.error('[vikral-api] Bluesky profile search failed:', error);
      return response.status(502).json({ error: 'Bluesky public profile search is unavailable.' });
    }
  });

  router.post('/analyze', async (request, response) => {
    try {
      const body = request.body as Record<string, unknown>;
      if (!mongoose.isValidObjectId(body.brandId)) return response.status(400).json({ error: 'A valid brandId is required.' });
      if (typeof body.selectionId !== 'string' || !body.selectionId.trim()) return response.status(400).json({ error: 'A valid Bluesky profile selection is required.' });
      const brand = await brands.findById(String(body.brandId));
      if (!brand) return response.status(404).json({ error: 'Brand profile not found.' });
      const profile = provider.getSelection(body.selectionId);
      if (!profile) return response.status(404).json({ error: 'Bluesky profile selection expired or was not found. Search again.' });
      const candidate = validateCandidateInput({
        sourceType: 'social',
        candidateName: profile.displayName || profile.handle,
        handle: `@${profile.handle}`,
        url: profile.profileUrl,
        description: profile.description,
        platform: profile.platform,
        observedAt: profile.indexedAt || profile.collectionTime,
      });
      const analysis = await analyzeAndPersist(
        brand,
        candidate,
        aiProvider,
        history,
        evidence,
        (_brandId, normalizedCandidate, analysisId) => createProviderEvidence(
          _brandId,
          normalizedCandidate,
          analysisId,
          profile.sourceProvider,
          profile.providerRecordId,
          new Date(profile.collectionTime),
        ),
      );
      return response.status(200).json({ analysis });
    } catch (error) {
      if (error instanceof CandidateValidationError) return response.status(400).json({ error: error.message, issues: error.issues });
      if (error instanceof BlueskyProviderError) return response.status(error.statusCode).json({ error: error.message });
      console.error('[vikral-api] Bluesky profile analysis failed:', error);
      return response.status(503).json({ error: 'Bluesky profile analysis is unavailable.' });
    }
  });

  return router;
}

export default createBlueskyRouter();