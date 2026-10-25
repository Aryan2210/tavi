import { describe, expect, it } from 'vitest';
import { classifyCommand, parseUtterance } from '../src/commands';

describe('parseUtterance', () => {
  it.each([
    ['Hey Tavi what is in front of me', 'what is in front of me'],
    ['hey tabby, read this', 'read this'],
    ['OK Tavi.', ''],
    ['hey davey is the path clear', 'is the path clear'],
  ])('detects the wake word in %j', (input, command) => {
    expect(parseUtterance(input)).toEqual({ wake: true, command });
  });

  it('returns the raw text when there is no wake word', () => {
    expect(parseUtterance(' what colour is this ')).toEqual({ wake: false, command: 'what colour is this' });
    expect(parseUtterance('I watched TV yesterday').wake).toBe(false);
  });
});

describe('classifyCommand', () => {
  it.each([
    ["what's in front of me", { type: 'query', mode: 'describe' }],
    ['where am I', { type: 'query', mode: 'describe' }],
    ['', { type: 'query', mode: 'describe' }],
    ['read this', { type: 'query', mode: 'read' }],
    ['what does it say', { type: 'query', mode: 'read' }],
    ['is the path clear', { type: 'query', mode: 'navigate' }],
    ['guide me', { type: 'guide', on: true }],
    ['stop guiding', { type: 'guide', on: false }],
    ['stop', { type: 'stop' }],
    ['say that again', { type: 'repeat' }],
    ['help', { type: 'help' }],
  ])('%j', (input, expected) => {
    expect(classifyCommand(input)).toEqual(expected);
  });

  it('treats anything else as a free question', () => {
    expect(classifyCommand('What colour is this shirt?')).toEqual({
      type: 'query',
      mode: 'ask',
      question: 'What colour is this shirt?',
    });
  });
});
