import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildUserPrompt, MODES, NO_CHANGE, SYSTEM_PROMPT } from './prompts.js';
import { ProviderError, VisionImage, VisionProvider } from './providers/index.js';
import { createRateLimiter } from './rateLimit.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const describeSchema = z.object({
  image: z.string().min(1),
  mode: z.enum(MODES).default('describe'),
  question: z.string().max(500).optional(),
  previous: z.string().max(2000).optional(),
  history: z
    .array(z.object({ q: z.string().max(500), a: z.string().max(2000) }))
    .max(10)
    .optional(),
});

export function parseDataUrl(dataUrl: string): VisionImage | null {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, base64] = match;
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  return { mimeType, base64 };
}

export interface AppOptions {
  provider: VisionProvider;
  rateLimitPerMinute?: number;
  requestTimeoutMs?: number;
  staticDir?: string;
}

export function createApp({
  provider,
  rateLimitPerMinute = 30,
  requestTimeoutMs = 20000,
  staticDir,
}: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: provider.name, model: provider.model });
  });

  app.post('/api/describe', createRateLimiter(rateLimitPerMinute), async (req, res) => {
    const parsed = describeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { image, mode, question, previous, history } = parsed.data;
    const visionImage = parseDataUrl(image);
    if (!visionImage) {
      res.status(400).json({ error: 'image must be a base64 JPEG, PNG or WebP data URL under 4 MB' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    const started = Date.now();
    try {
      const text = await provider.describe({
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt({ mode, question, previous, history }),
        image: visionImage,
        signal: controller.signal,
      });
      res.json({
        text,
        unchanged: text.trim() === NO_CHANGE,
        provider: provider.name,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        res.status(504).json({ error: 'The vision service took too long to respond.' });
        return;
      }
      console.error('[tavi] describe failed:', err instanceof Error ? err.message : err);
      const status = err instanceof ProviderError && err.status === 429 ? 429 : 502;
      res.status(status).json({ error: 'The vision service is unavailable right now.' });
    } finally {
      clearTimeout(timer);
    }
  });

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: 'index.html' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: status === 413 ? 'Image too large' : 'Unexpected error' });
  });

  return app;
}
