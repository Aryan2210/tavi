import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '../src/providers/anthropic';
import { GeminiProvider } from '../src/providers/gemini';
import { OpenAIProvider } from '../src/providers/openai';
import { FetchLike, ProviderError, VisionRequest } from '../src/providers/types';

const req: VisionRequest = { system: 'sys', prompt: 'describe', image: { mimeType: 'image/jpeg', base64: 'AAAA' } };

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as FetchLike & {
    mock: { calls: [string, RequestInit][] };
  };
}

describe('providers', () => {
  it('OpenAI sends an image_url message and returns the text', async () => {
    const f = fakeFetch({ choices: [{ message: { content: ' A door ahead. ' } }] });
    const text = await new OpenAIProvider('key', 'gpt-4o-mini', f).describe(req);
    expect(text).toBe('A door ahead.');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer key');
    const body = JSON.parse(init.body as string);
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });

  it('Gemini sends inlineData and joins parts', async () => {
    const f = fakeFetch({ candidates: [{ content: { parts: [{ text: 'Two ' }, { text: 'chairs.' }] } }] });
    const text = await new GeminiProvider('key', 'gemini-2.0-flash', f).describe(req);
    expect(text).toBe('Two chairs.');
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/models/gemini-2.0-flash:generateContent');
    expect(JSON.parse(init.body as string).contents[0].parts[1].inlineData.data).toBe('AAAA');
  });

  it('Anthropic sends a base64 image block', async () => {
    const f = fakeFetch({ content: [{ type: 'text', text: 'A cup.' }] });
    const text = await new AnthropicProvider('key', 'claude', f).describe(req);
    expect(text).toBe('A cup.');
    const [, init] = f.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key');
    expect(JSON.parse(init.body as string).messages[0].content[0].source.data).toBe('AAAA');
  });

  it('raises ProviderError with status on HTTP failure', async () => {
    const f = fakeFetch({ error: 'rate limited' }, 429);
    await expect(new OpenAIProvider('key', 'm', f).describe(req)).rejects.toMatchObject({
      name: 'ProviderError',
      status: 429,
    });
  });

  it('raises on empty responses', async () => {
    const f = fakeFetch({ choices: [] });
    await expect(new OpenAIProvider('key', 'm', f).describe(req)).rejects.toBeInstanceOf(ProviderError);
  });
});
