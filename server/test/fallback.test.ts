import { describe, expect, it, vi } from 'vitest';
import { loadConfig, parseModels } from '../src/config';
import { createProvider } from '../src/providers';
import { FallbackProvider } from '../src/providers/fallback';
import { ProviderError, VisionProvider, VisionRequest } from '../src/providers/types';

const req: VisionRequest = { system: 's', prompt: 'p', image: { mimeType: 'image/jpeg', base64: 'AA' } };
const quiet = () => {};

function fake(model: string, impl: VisionProvider['describe']): VisionProvider {
  return { name: 'fake', model, describe: vi.fn(impl) };
}

describe('FallbackProvider', () => {
  it('uses the first provider when it works', async () => {
    const a = fake('a', async () => 'from a');
    const b = fake('b', async () => 'from b');
    expect(await new FallbackProvider([a, b], 1000, quiet).describe(req)).toBe('from a');
    expect(b.describe).not.toHaveBeenCalled();
  });

  it('falls back on overload/retired-model errors', async () => {
    const a = fake('a', async () => {
      throw new ProviderError('busy', 503);
    });
    const b = fake('b', async () => 'from b');
    expect(await new FallbackProvider([a, b], 1000, quiet).describe(req)).toBe('from b');
  });

  it('falls back when an attempt times out', async () => {
    const a = fake(
      'a',
      ({ signal }) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const b = fake('b', async () => 'from b');
    expect(await new FallbackProvider([a, b], 20, quiet).describe(req)).toBe('from b');
  });

  it('does not retry non-retryable errors', async () => {
    const a = fake('a', async () => {
      throw new ProviderError('bad key', 401);
    });
    const b = fake('b', async () => 'from b');
    await expect(new FallbackProvider([a, b], 1000, quiet).describe(req)).rejects.toMatchObject({ status: 401 });
    expect(b.describe).not.toHaveBeenCalled();
  });

  it('surfaces the last error when all fail', async () => {
    const fail = async () => {
      throw new ProviderError('busy', 429);
    };
    await expect(
      new FallbackProvider([fake('a', fail), fake('b', fail)], 1000, quiet).describe(req),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe('model configuration', () => {
  it('parses comma-separated model lists', () => {
    expect(parseModels(' x , y ,', ['d'])).toEqual(['x', 'y']);
    expect(parseModels('', ['d'])).toEqual(['d']);
  });

  it('builds a fallback chain for multiple models', () => {
    const provider = createProvider(loadConfig({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm1,m2' }));
    expect(provider).toBeInstanceOf(FallbackProvider);
    expect(provider.model).toBe('m1 → m2');
    expect(createProvider(loadConfig({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm1' })).model).toBe('m1');
  });
});
