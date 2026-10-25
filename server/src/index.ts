import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createProvider } from './providers/index.js';

const config = loadConfig();
const provider = createProvider(config);
const here = path.dirname(fileURLToPath(import.meta.url));

const app = createApp({
  provider,
  rateLimitPerMinute: config.rateLimitPerMinute,
  requestTimeoutMs: config.requestTimeoutMs,
  staticDir: path.resolve(here, '../../dist/client'),
});
app.set('trust proxy', 1);

app.listen(config.port, () => {
  console.log(`[tavi] listening on http://localhost:${config.port} using ${provider.name} (${provider.model})`);
  if (provider.name === 'mock') {
    console.log('[tavi] no API key found: running in demo mode. Set OPENAI_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY.');
  }
});
