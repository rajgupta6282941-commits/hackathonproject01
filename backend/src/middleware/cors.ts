import type { NextFunction, Request, Response } from 'express';

const localOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function configuredOrigins() {
  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return new Set(process.env.NODE_ENV === 'production' ? origins : [...localOrigins, ...origins]);
}

export function corsMiddleware(request: Request, response: Response, next: NextFunction) {
  const origin = request.header('origin');
  if (origin) {
    if (!configuredOrigins().has(origin)) return response.status(403).json({ error: 'Origin is not allowed.' });
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  return next();
}