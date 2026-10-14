import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import test from 'node:test';
import { validateBackendEnvironment } from '../src/config/environment.js';
import { corsMiddleware } from '../src/middleware/cors.js';
import healthRouter from '../src/routes/health.js';

test('production configuration requires Atlas persistence and explicit CORS origins', () => {
  const errors = validateBackendEnvironment({ NODE_ENV: 'production' });
  assert.deepEqual(errors, ['MONGODB_URI is required.', 'CORS_ALLOWED_ORIGINS is required in production.']);
  assert.deepEqual(validateBackendEnvironment({ NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://example' , CORS_ALLOWED_ORIGINS: 'https://vikral.vercel.app' }), []);
});

test('production CORS allows only configured origins', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOrigins = process.env.CORS_ALLOWED_ORIGINS;
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOWED_ORIGINS = 'https://vikral.vercel.app,https://preview.vikral.vercel.app';
  const app = express();
  app.use(corsMiddleware);
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  try {
    const allowed = await request(app).get('/health').set('Origin', 'https://vikral.vercel.app').expect(200);
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://vikral.vercel.app');
    await request(app).get('/health').set('Origin', 'https://unapproved.example').expect(403);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS; else process.env.CORS_ALLOWED_ORIGINS = previousOrigins;
  }
});

test('health endpoint reports degraded state before an Atlas connection is established', async () => {
  const app = express();
  app.use('/api', healthRouter);
  const result = await request(app).get('/api/health').expect(503);
  assert.deepEqual(result.body, { status: 'degraded', service: 'vikral-api', database: 'disconnected' });
});