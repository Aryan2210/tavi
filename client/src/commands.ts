export type Mode = 'describe' | 'read' | 'navigate' | 'ask';

export type Action =
  | { type: 'query'; mode: Mode; question?: string }
  | { type: 'guide'; on: boolean }
  | { type: 'stop' }
  | { type: 'repeat' }
  | { type: 'help' };

// Speech engines rarely transcribe "Tavi" exactly, so accept common mishearings.
const WAKE_RE =
  /\b(?:hey|hi|hello|okay|ok|a)[\s,.!-]*(?:tavi|tavvy|tavy|tahvi|tabby|tabi|davy|davey|tavey|taffy|tv|t\.?\s?v\.?)\b[\s,.!?-]*/i;

export interface Utterance {
  wake: boolean;
  command: string;
}

export function parseUtterance(transcript: string): Utterance {
  const match = WAKE_RE.exec(transcript);
  if (!match) return { wake: false, command: transcript.trim() };
  const command = transcript
    .slice(match.index + match[0].length)
    .trim()
    .replace(/^[,.!?-]+\s*/, '');
  return { wake: true, command };
}

const has = (text: string, ...patterns: RegExp[]) => patterns.some((p) => p.test(text));

export function classifyCommand(raw: string): Action {
  const text = raw.toLowerCase().trim();

  if (has(text, /\b(stop|end|turn off|pause) (guiding|guide|guidance|navigation|navigating)\b/))
    return { type: 'guide', on: false };
  if (has(text, /^(stop|quiet|shush|cancel|be quiet|silence)\b/)) return { type: 'stop' };
  if (has(text, /\b(guide me|start guiding|start guidance|start navigation|navigation mode|walk with me|keep watching)\b/))
    return { type: 'guide', on: true };
  if (has(text, /\b(repeat|say (that|it) again|what did you say|come again)\b/)) return { type: 'repeat' };
  if (has(text, /^(help|what can you do|commands)\b/)) return { type: 'help' };

  if (has(text, /\b(read|what does (it|this|that) say|what('s| is) written|text|sign say|label)\b/))
    return { type: 'query', mode: 'read' };
  if (has(text, /\b(path|clear|safe to walk|obstacle|obstacles|navigate|can i walk|in my way|step|stairs ahead)\b/))
    return { type: 'query', mode: 'navigate' };
  if (
    !text ||
    has(
      text,
      /^(describe|look)\b/,
      /\b(what('s| is) (around|in front of me|ahead|here|there|this)|what do you see|where am i|describe( the)?( scene| this| it)?|look around)\b/,
    )
  )
    return { type: 'query', mode: 'describe' };

  return { type: 'query', mode: 'ask', question: raw.trim() };
}

export const HELP_TEXT =
  'Say "Hey Tavi" and then: what\'s in front of me, read this, is the path clear, guide me, stop guiding, repeat, or ask any question. You can also tap the big buttons.';
