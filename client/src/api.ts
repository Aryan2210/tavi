import type { Mode } from './commands';

export interface DescribeRequest {
  image: string;
  mode: Mode;
  question?: string;
  previous?: string;
  history?: { q: string; a: string }[];
}

export interface DescribeResponse {
  text: string;
  unchanged: boolean;
  provider: string;
  latencyMs: number;
}

export class ApiError extends Error {}

export async function describe(body: DescribeRequest, signal?: AbortSignal): Promise<DescribeResponse> {
  let res: Response;
  try {
    res = await fetch('/api/describe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError("I can't reach the TAVI server. Check your internet connection.");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<DescribeResponse> & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Please try again.');
  return data as DescribeResponse;
}

export async function health(): Promise<{ provider: string; model: string } | null> {
  try {
    const res = await fetch('/api/health');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
