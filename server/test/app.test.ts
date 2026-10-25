import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, parseDataUrl } from '../src/app';
import { MockProvider } from '../src/providers/mock';
import { ProviderError, VisionProvider } from '../src/providers/types';

const IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('parseDataUrl', () => {
  it('accepts jpeg/png/webp data URLs', () => {
    expect(parseDataUrl(IMAGE)).toEqual({ mimeType: 'image/jpeg', base64: '/9j/4AAQSkZJRg==' });
  });
  it('rejects other input', () => {
    expect(parseDataUrl('data:text/plain;base64,AAAA')).toBeNull();
    expect(parseDataUrl('https://example.com/a.jpg')).toBeNull();
  });
});

describe('API', () => {
  it('reports health', async () => {
    const res = await request(createApp({ provider: new MockProvider() })).get('/api/health');
    expect(res.body).toEqual({ ok: true, provider: 'mock', model: 'mock' });
  });

  it('describes an image end to end with the mock provider', async () => {
    const res = await request(createApp({ provider: new MockProvider() }))
      .post('/api/describe')
      .send({ image: IMAGE, mode: 'navigate' });
    expect(res.status).toBe(200);
    expect(res.body.text).toMatch(/path ahead/);
    expect(res.body.unchanged).toBe(false);
  });

  it('flags unchanged guide updates', async () => {
    const res = await request(createApp({ provider: new MockProvider() }))
      .post('/api/describe')
      .send({ image: IMAGE, mode: 'navigate', previous: 'Clear.' });
    expect(res.body).toMatchObject({ text: 'NO_CHANGE', unchanged: true });
  });

  it('validates input', async () => {
    const app = createApp({ provider: new MockProvider() });
    expect((await request(app).post('/api/describe').send({ mode: 'describe' })).status).toBe(400);
    expect((await request(app).post('/api/describe').send({ image: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/describe').send({ image: IMAGE, mode: 'dance' })).status).toBe(400);
  });

  it('passes the built prompt to the provider and maps failures', async () => {
    const describeFn = vi.fn().mockRejectedValue(new ProviderError('boom', 429));
    const provider: VisionProvider = { name: 'fake', model: 'x', describe: describeFn };
    const res = await request(createApp({ provider }))
      .post('/api/describe')
      .send({ image: IMAGE, mode: 'ask', question: 'Is the light green?' });
    expect(res.status).toBe(429);
    expect(describeFn.mock.calls[0][0].prompt).toContain('Is the light green?');
  });

  it('times out slow providers', async () => {
    const provider: VisionProvider = {
      name: 'slow',
      model: 'x',
      describe: ({ signal }) =>
        new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    };
    const res = await request(createApp({ provider, requestTimeoutMs: 50 }))
      .post('/api/describe')
      .send({ image: IMAGE });
    expect(res.status).toBe(504);
  });

  it('rate limits per client', async () => {
    const app = createApp({ provider: new MockProvider(), rateLimitPerMinute: 2 });
    for (let i = 0; i < 2; i++) await request(app).post('/api/describe').send({ image: IMAGE });
    const res = await request(app).post('/api/describe').send({ image: IMAGE });
    expect(res.status).toBe(429);
  });
});
