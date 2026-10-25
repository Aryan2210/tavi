export interface Settings {
  handsFree: boolean;
  speechRate: number;
  guideIntervalSec: number;
  voiceOutput: boolean;
}

const KEY = 'tavi.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  handsFree: true,
  speechRate: 1.05,
  guideIntervalSec: 6,
  voiceOutput: true,
};

export function loadSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw = storage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(settings));
}
