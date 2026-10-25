import { NextFunction, Request, Response } from 'express';

/** Minimal fixed-window, per-IP limiter to protect the paid vision API. */
export function createRateLimiter(limitPerMinute: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const t = now();
    const current = windows.get(key);
    if (!current || t - current.start >= 60_000) {
      windows.set(key, { start: t, count: 1 });
      if (windows.size > 10_000) windows.clear();
      return next();
    }
    if (current.count >= limitPerMinute) {
      res.setHeader('retry-after', Math.ceil((current.start + 60_000 - t) / 1000));
      res.status(429).json({ error: 'Too many requests, slow down a little.' });
      return;
    }
    current.count += 1;
    next();
  };
}
