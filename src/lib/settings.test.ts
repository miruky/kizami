import { describe, expect, it } from 'vitest';
import {
  clampBpm,
  createStore,
  defaultSettings,
  deserializeSettings,
  isSettings,
  normalizeSettings,
} from './settings';

describe('clampBpm', () => {
  it('範囲に丸めて整数にする', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(120.6)).toBe(121);
  });
});

describe('isSettings / deserialize', () => {
  it('既定値は正しい形', () => {
    expect(isSettings(defaultSettings())).toBe(true);
  });

  it('保存して読み戻せる', () => {
    expect(deserializeSettings(JSON.stringify(defaultSettings()))).toEqual(defaultSettings());
  });

  it('不正な分割や音色は弾く', () => {
    expect(deserializeSettings('{')).toBeNull();
    expect(
      deserializeSettings(JSON.stringify({ ...defaultSettings(), subdivision: 5 })),
    ).toBeNull();
    expect(deserializeSettings(JSON.stringify({ ...defaultSettings(), sound: 'gong' }))).toBeNull();
  });

  it('六連・三十二分の分割を受け付ける', () => {
    for (const subdivision of [6, 8]) {
      expect(isSettings({ ...defaultSettings(), subdivision })).toBe(true);
    }
  });
});

describe('normalizeSettings', () => {
  it('範囲外を収める', () => {
    const n = normalizeSettings({ ...defaultSettings(), bpm: 1000, beatsPerBar: 99, volume: 5 });
    expect(n.bpm).toBe(300);
    expect(n.beatsPerBar).toBe(12);
    expect(n.volume).toBe(1);
  });
});

describe('createStore', () => {
  it('localStorage越しに往復する', () => {
    const map = new Map<string, string>();
    const store = createStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    expect(store.load()).toBeNull();
    store.save(defaultSettings());
    expect(store.load()).toEqual(defaultSettings());
  });
});
