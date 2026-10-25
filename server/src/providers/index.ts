import { Config } from '../config.js';
import { AnthropicProvider } from './anthropic.js';
import { FallbackProvider } from './fallback.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import { OpenAIProvider } from './openai.js';
import { VisionProvider } from './types.js';

export function createProvider(config: Config): VisionProvider {
  const chain = (providers: VisionProvider[]) =>
    providers.length === 1
      ? providers[0]
      : new FallbackProvider(providers, Math.floor(config.requestTimeoutMs / providers.length));

  switch (config.provider) {
    case 'openai':
      return chain(config.openaiModels.map((m) => new OpenAIProvider(config.openaiApiKey!, m)));
    case 'gemini':
      return chain(config.geminiModels.map((m) => new GeminiProvider(config.geminiApiKey!, m)));
    case 'anthropic':
      return chain(config.anthropicModels.map((m) => new AnthropicProvider(config.anthropicApiKey!, m)));
    case 'mock':
      return new MockProvider();
  }
}

export * from './types.js';
