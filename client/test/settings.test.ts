import { describe, expect, it } from 'vitest';
import { averageBrightness } from '../src/camera';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/settings';

describe('settings', () => {
  it('round-trips and merges with defaults', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, speechRate: 1.5 }, storage);
    expect(loadSettings(storage).speechRate).toBe(1.5);
    store.set('tavi.settings.v1', '{bad json');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('averageBrightness', () => {
  it('computes luma', () => {
    const white = new Uint8ClampedArray(4 * 64).fill(255);
    const black = new Uint8ClampedArray(4 * 64);
    expect(averageBrightness(white)).toBeCloseTo(255);
    expect(averageBrightness(black)).toBe(0);
  });
});
