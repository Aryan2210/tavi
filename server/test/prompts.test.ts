import { describe, expect, it } from 'vitest';
import { buildUserPrompt, NO_CHANGE } from '../src/prompts';

describe('buildUserPrompt', () => {
  it('uses mode-specific instructions', () => {
    expect(buildUserPrompt({ mode: 'read' })).toMatch(/Read out the visible text/);
    expect(buildUserPrompt({ mode: 'navigate' })).toMatch(/walk safely/);
  });

  it('embeds the question for ask mode', () => {
    expect(buildUserPrompt({ mode: 'ask', question: 'What colour is this shirt?' })).toContain(
      '"What colour is this shirt?"',
    );
  });

  it('asks for NO_CHANGE when a previous answer is given', () => {
    const prompt = buildUserPrompt({ mode: 'navigate', previous: 'Path is clear.' });
    expect(prompt).toContain(`reply with exactly ${NO_CHANGE}`);
    expect(prompt).toContain('Path is clear.');
  });

  it('includes only the last three exchanges of history', () => {
    const history = [1, 2, 3, 4].map((n) => ({ q: `q${n}`, a: `a${n}` }));
    const prompt = buildUserPrompt({ mode: 'ask', question: 'x', history });
    expect(prompt).not.toContain('q1');
    expect(prompt).toContain('User: q4\nTAVI: a4');
  });
});
