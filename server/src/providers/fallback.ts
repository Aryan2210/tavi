import { ProviderError, VisionProvider, VisionRequest } from './types.js';

const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);

/**
 * Tries each provider in order, moving on when one is overloaded, retired, or too slow.
 * Each attempt gets its own time budget so one hanging model can't use up the whole request.
 */
export class FallbackProvider implements VisionProvider {
  readonly name: string;
  readonly model: string;

  constructor(
    private readonly providers: VisionProvider[],
    private readonly attemptTimeoutMs: number,
    private readonly log: (msg: string) => void = (msg) => console.warn(msg),
  ) {
    if (providers.length === 0) throw new Error('FallbackProvider needs at least one provider');
    this.name = providers[0].name;
    this.model = providers.map((p) => p.model).join(' → ');
  }

  async describe(req: VisionRequest): Promise<string> {
    let lastError: unknown;
    for (const [i, provider] of this.providers.entries()) {
      if (req.signal?.aborted) break;
      const attempt = new AbortController();
      const onAbort = () => attempt.abort();
      req.signal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => attempt.abort(), this.attemptTimeoutMs);
      try {
        return await provider.describe({ ...req, signal: attempt.signal });
      } catch (err) {
        lastError = err;
        const timedOut = attempt.signal.aborted && !req.signal?.aborted;
        const retryable = timedOut || (err instanceof ProviderError && RETRYABLE_STATUS.has(err.status ?? 0));
        if (!retryable || i === this.providers.length - 1) throw timedOut ? new ProviderError(`${provider.model} timed out`, 504) : err;
        this.log(`[tavi] ${provider.model} failed (${timedOut ? 'timeout' : (err as ProviderError).status}); trying ${this.providers[i + 1].model}`);
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onAbort);
      }
    }
    throw lastError ?? new ProviderError('request aborted');
  }
}
