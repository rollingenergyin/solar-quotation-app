import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 8;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Public website ingest: API key + per-IP rate limit. */
export function publicLeadGuard(req: Request, res: Response, next: NextFunction) {
  const expected = config.websiteLeadApiKey;
  if (!expected) {
    return res.status(503).json({ error: 'Lead intake is not configured' });
  }

  const header = req.headers['x-website-lead-key'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided || !keysMatch(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const current = hits.get(ip);
  if (!current || current.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_HITS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  return next();
}
