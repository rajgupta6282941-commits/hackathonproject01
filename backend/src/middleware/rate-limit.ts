import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = { windowMs: number; max: number };

export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  const requests = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = requests.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    requests.set(key, bucket);
    if (bucket.count > max) {
      response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return response.status(429).json({ error: 'Too many requests. Please retry later.' });
    }
    return next();
  };
}