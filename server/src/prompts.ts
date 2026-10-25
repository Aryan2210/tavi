export const MODES = ['describe', 'read', 'navigate', 'ask'] as const;
export type Mode = (typeof MODES)[number];

export const NO_CHANGE = 'NO_CHANGE';

export const SYSTEM_PROMPT = `You are TAVI ("Talkative Vision"), a calm, friendly guide speaking privately into the earbuds of a person who is blind or visually impaired. You see what their camera sees, held at chest height and pointing forward.

Rules:
- Safety first: mention hazards (steps, curbs, traffic, obstacles at head or foot level, wet floors, moving people or vehicles) before anything else.
- Be brief: one to three short sentences unless you are asked to read text. Everything you say is spoken aloud.
- Use directions relative to the user: "ahead", "on your left", "at two o'clock", with rough distances in steps or meters.
- Never use visual-only phrases such as "as you can see" or "highlighted".
- If the image is blurry, dark, or you are unsure, say so plainly and suggest how to aim the camera, for example "tilt up a little".
- Plain spoken sentences only: no markdown, bullet points, or emoji.
- Do not identify people by name or guess sensitive traits. Describe expressions, clothing, and actions instead.`;

const MODE_INSTRUCTIONS: Record<Exclude<Mode, 'ask'>, string> = {
  describe:
    'Briefly describe the scene: where the user seems to be, the most important objects and where they are, and any people or hazards.',
  read:
    'Read out the visible text exactly, most important first (signs, labels, headings, prices). If it is a document or screen, say what kind it is, then read the main content. If there is no readable text, say so and suggest how to aim the camera.',
  navigate:
    'Help the user walk safely. Say whether the path straight ahead is clear, then mention obstacles, steps, doors, or turns with direction and approximate distance. One or two sentences.',
};

export interface Exchange {
  q: string;
  a: string;
}

export interface PromptInput {
  mode: Mode;
  question?: string;
  previous?: string;
  history?: Exchange[];
}

export function buildUserPrompt({ mode, question, previous, history }: PromptInput): string {
  const parts: string[] = [];

  if (history && history.length > 0) {
    const recent = history
      .slice(-3)
      .map((h) => `User: ${h.q}\nTAVI: ${h.a}`)
      .join('\n');
    parts.push(`Recent conversation (for context only):\n${recent}`);
  }

  if (mode === 'ask') {
    const q = question?.trim() || 'What is in front of me?';
    parts.push(
      `Answer the user's question using what the camera sees: "${q}". If it cannot be answered from the image, say so briefly.`,
    );
  } else {
    parts.push(MODE_INSTRUCTIONS[mode]);
  }

  if (previous) {
    parts.push(
      `Last time you told the user: "${previous}". If nothing important or safety-relevant has changed since then, reply with exactly ${NO_CHANGE} and nothing else.`,
    );
  }

  return parts.join('\n\n');
}
