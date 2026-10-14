import { Router } from 'express';
import mongoose from 'mongoose';

const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    service: 'vikral-api',
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

export default healthRouter;
