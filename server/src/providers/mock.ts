import { VisionProvider, VisionRequest } from './types.js';

/** Offline provider so the full app can be exercised without an API key. */
export class MockProvider implements VisionProvider {
  readonly name = 'mock';
  readonly model = 'mock';

  async describe({ prompt }: VisionRequest): Promise<string> {
    if (prompt.includes('reply with exactly NO_CHANGE')) return 'NO_CHANGE';
    if (prompt.includes('Read out the visible text')) {
      return 'Demo mode: I would read the visible text here. Add an API key on the server to enable real vision.';
    }
    if (prompt.includes('walk safely')) {
      return 'Demo mode: the path ahead looks clear for about five steps.';
    }
    return 'Demo mode: TAVI is running without a vision model. Add an API key on the server to hear real descriptions.';
  }
}
