import { FetchLike, postJson, ProviderError, VisionProvider, VisionRequest } from './types.js';

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

export class OpenAIProvider implements VisionProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async describe({ system, prompt, image, signal }: VisionRequest): Promise<string> {
    const data = (await postJson(
      this.fetchImpl,
      this.name,
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        max_tokens: 400,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'auto' },
              },
            ],
          },
        ],
      },
      signal,
    )) as ChatResponse;

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError('openai returned an empty response');
    return text;
  }
}
