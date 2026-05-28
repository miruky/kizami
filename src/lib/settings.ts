// メトロノームの設定の型・既定値と、その検証・永続化。発音は engine.ts に分離する。

export type ClickSound = 'click' | 'wood' | 'beep';

export interface Settings {
  /** テンポ(1分あたりの拍数) */
  bpm: number;
  /** 1小節の拍数 */
  beatsPerBar: number;
  /** 1拍の分割数(1=四分、2=八分、3=三連、4=十六分) */
  subdivision: number;
  /** 小節頭にアクセントを付けるか */
  accentFirst: boolean;
  /** 音量(0..1) */
  volume: number;
  sound: ClickSound;
}

export const SOUNDS: readonly ClickSound[] = ['click', 'wood', 'beep'];
export const SUBDIVISIONS: readonly number[] = [1, 2, 3, 4];

export const RANGE = {
  bpm: { min: 30, max: 300 },
  beatsPerBar: { min: 1, max: 12 },
  volume: { min: 0, max: 1 },
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function clampBpm(bpm: number): number {
  return Math.round(clamp(bpm, RANGE.bpm.min, RANGE.bpm.max));
}

export function defaultSettings(): Settings {
  return {
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accentFirst: true,
    volume: 0.8,
    sound: 'click',
  };
}

export function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.bpm === 'number' &&
    Number.isFinite(s.bpm) &&
    typeof s.beatsPerBar === 'number' &&
    Number.isFinite(s.beatsPerBar) &&
    typeof s.subdivision === 'number' &&
    (SUBDIVISIONS as readonly number[]).includes(s.subdivision) &&
    typeof s.accentFirst === 'boolean' &&
    typeof s.volume === 'number' &&
    Number.isFinite(s.volume) &&
    typeof s.sound === 'string' &&
    (SOUNDS as readonly string[]).includes(s.sound)
  );
}

export function normalizeSettings(s: Settings): Settings {
  return {
    ...s,
    bpm: clampBpm(s.bpm),
    beatsPerBar: Math.round(clamp(s.beatsPerBar, RANGE.beatsPerBar.min, RANGE.beatsPerBar.max)),
    volume: clamp(s.volume, RANGE.volume.min, RANGE.volume.max),
  };
}

export function deserializeSettings(json: string): Settings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isSettings(parsed) ? normalizeSettings(parsed) : null;
}

export interface SettingsStore {
  load(): Settings | null;
  save(settings: Settings): void;
}

const STORAGE_KEY = 'kizami.settings.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createStore(storage: StorageLike): SettingsStore {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? null : deserializeSettings(raw);
    },
    save(settings) {
      storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    },
  };
}
