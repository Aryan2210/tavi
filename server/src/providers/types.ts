export interface VisionImage {
  mimeType: string;
  base64: string;
}

export interface VisionRequest {
  system: string;
  prompt: string;
  image: VisionImage;
  signal?: AbortSignal;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;
  describe(req: VisionRequest): Promise<string>;
}

export type FetchLike = typeof fetch;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export async function postJson(
  fetchImpl: FetchLike,
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new ProviderError(`${provider} request failed (${res.status}): ${detail}`, res.status);
  }
  return res.json();
}
