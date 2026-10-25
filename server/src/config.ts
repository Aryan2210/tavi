export const PROVIDERS = ['openai', 'gemini', 'anthropic', 'mock'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export interface Config {
  port: number;
  provider: ProviderName;
  openaiApiKey?: string;
  openaiModels: string[];
  geminiApiKey?: string;
  geminiModels: string[];
  anthropicApiKey?: string;
  anthropicModels: string[];
  rateLimitPerMinute: number;
  requestTimeoutMs: number;
}

function isProvider(value: string | undefined): value is ProviderName {
  return !!value && (PROVIDERS as readonly string[]).includes(value);
}

/** Comma-separated list: the first model is used, later ones are fallbacks if it fails or is overloaded. */
export function parseModels(value: string | undefined, defaults: string[]): string[] {
  const models = (value ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return models.length ? models : defaults;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const keys: Record<Exclude<ProviderName, 'mock'>, string | undefined> = {
    openai: env.OPENAI_API_KEY || undefined,
    gemini: env.GEMINI_API_KEY || undefined,
    anthropic: env.ANTHROPIC_API_KEY || undefined,
  };

  const requested = env.TAVI_PROVIDER?.trim().toLowerCase();
  let provider: ProviderName;
  if (requested) {
    if (!isProvider(requested)) {
      throw new Error(`TAVI_PROVIDER must be one of ${PROVIDERS.join(', ')} (got "${requested}")`);
    }
    if (requested !== 'mock' && !keys[requested]) {
      throw new Error(`TAVI_PROVIDER=${requested} but no API key is set for it`);
    }
    provider = requested;
  } else {
    provider = (Object.keys(keys) as (keyof typeof keys)[]).find((name) => keys[name]) ?? 'mock';
  }

  return {
    port: Number(env.PORT) || 8787,
    provider,
    openaiApiKey: keys.openai,
    openaiModels: parseModels(env.OPENAI_MODEL, ['gpt-4o-mini']),
    geminiApiKey: keys.gemini,
    geminiModels: parseModels(env.GEMINI_MODEL, ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest']),
    anthropicApiKey: keys.anthropic,
    anthropicModels: parseModels(env.ANTHROPIC_MODEL, ['claude-3-5-sonnet-latest']),
    rateLimitPerMinute: Number(env.TAVI_RATE_LIMIT_PER_MINUTE) || 30,
    requestTimeoutMs: Number(env.TAVI_REQUEST_TIMEOUT_MS) || 20000,
  };
}
