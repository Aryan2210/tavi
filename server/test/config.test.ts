import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('falls back to mock mode without keys', () => {
    expect(loadConfig({}).provider).toBe('mock');
  });

  it('auto-detects the first configured provider', () => {
    expect(loadConfig({ GEMINI_API_KEY: 'g' }).provider).toBe('gemini');
    expect(loadConfig({ OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a' }).provider).toBe('openai');
  });

  it('honours TAVI_PROVIDER and validates it', () => {
    expect(loadConfig({ TAVI_PROVIDER: 'Anthropic', OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a' }).provider).toBe(
      'anthropic',
    );
    expect(() => loadConfig({ TAVI_PROVIDER: 'gemini' })).toThrow(/no API key/);
    expect(() => loadConfig({ TAVI_PROVIDER: 'nope' })).toThrow(/must be one of/);
  });
});
