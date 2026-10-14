import { Router } from 'express';
import { providerStatuses } from '../providers/registry.js';

const router = Router();

router.get('/status', async (_request, response) => {
  try {
    return response.status(200).json({ providers: await providerStatuses() });
  } catch (error) {
    console.error('[vikral-api] Provider status check failed:', error);
    return response.status(503).json({ error: 'Integration status is unavailable.' });
  }
});

export default router;
