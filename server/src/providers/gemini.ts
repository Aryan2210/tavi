import { FetchLike, postJson, ProviderError, VisionProvider, VisionRequest } from './types.js';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GeminiProvider implements VisionProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async describe({ system, prompt, image, signal }: VisionRequest): Promise<string> {
    const data = (await postJson(
      this.fetchImpl,
      this.name,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      { 'x-goog-api-key': this.apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      },
      signal,
    )) as GeminiResponse;

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new ProviderError('gemini returned an empty response');
    return text;
  }
}
