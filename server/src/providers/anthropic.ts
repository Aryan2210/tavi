import { FetchLike, postJson, ProviderError, VisionProvider, VisionRequest } from './types.js';

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

export class AnthropicProvider implements VisionProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async describe({ system, prompt, image, signal }: VisionRequest): Promise<string> {
    const data = (await postJson(
      this.fetchImpl,
      this.name,
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: this.model,
        max_tokens: 400,
        temperature: 0.2,
        system,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      signal,
    )) as MessagesResponse;

    const text = data.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    if (!text) throw new ProviderError('anthropic returned an empty response');
    return text;
  }
}
