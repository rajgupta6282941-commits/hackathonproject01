import express, { type ErrorRequestHandler } from 'express';
import healthRouter from './routes/health.js';
import brandsRouter from './routes/brands.routes.js';
import detectionRouter from './routes/detection.routes.js';
import socialMonitoringRouter from './routes/social-monitoring.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import integrationsRouter from './routes/integrations.routes.js';
import appleRouter from './routes/apple.routes.js';
import blueskyRouter from './routes/bluesky.routes.js';
import { corsMiddleware } from './middleware/cors.js';
import { createRateLimiter } from './middleware/rate-limit.js';

const app = express();

app.disable('x-powered-by');
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'vikral-api',
    health: '/api/health',
  });
});

app.use('/api', healthRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/detection', createRateLimiter({ windowMs: 60_000, max: 60 }), detectionRouter);
app.use('/api/social-monitoring', socialMonitoringRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/integrations/apple', createRateLimiter({ windowMs: 60_000, max: 30 }), appleRouter);
app.use('/api/integrations/bluesky', createRateLimiter({ windowMs: 60_000, max: 30 }), blueskyRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: 'Not found',
  });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error('[vikral-api] Unhandled request error:', error);

  if (response.headersSent) return;

  response.status(500).json({
    error: 'Internal server error',
  });
};

app.use(errorHandler);

export default app;
