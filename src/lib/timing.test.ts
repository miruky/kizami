import { describe, expect, it } from 'vitest';
import {
  evaluateTap,
  judgeOffset,
  nearestBeat,
  summarize,
  tapTempo,
  type TapResult,
} from './timing';

describe('nearestBeat', () => {
  it('最も近い拍と符号つきのずれを返す', () => {
    const beats = [0, 0.5, 1, 1.5];
    expect(nearestBeat(beats, 0.52)).toMatchObject({ beatTime: 0.5 });
    expect(nearestBeat(beats, 0.52)?.offset).toBeCloseTo(0.02, 6);
    expect(nearestBeat(beats, 0.97)?.offset).toBeCloseTo(-0.03, 6);
  });

  it('空なら null', () => {
    expect(nearestBeat([], 1)).toBeNull();
  });
});

describe('judgeOffset', () => {
  it('ずれの大きさで段階を分ける', () => {
    expect(judgeOffset(0.01)).toBe('perfect');
    expect(judgeOffset(-0.04)).toBe('good');
    expect(judgeOffset(0.1)).toBe('off');
    expect(judgeOffset(0.3)).toBe('miss');
  });
});

describe('evaluateTap', () => {
  it('最寄りの拍に対して判定する', () => {
    const result = evaluateTap([0, 0.5, 1], 0.5 + 0.01);
    expect(result).toMatchObject({ judge: 'perfect' });
    expect(result?.offset).toBeCloseTo(0.01, 6);
  });
});

describe('tapTempo', () => {
  it('等間隔のタップからBPMを出す', () => {
    expect(tapTempo([0, 0.5, 1, 1.5])).toBeCloseTo(120, 6);
  });

  it('中央値を使うので単発の乱れに強い', () => {
    // 0.5秒間隔(120BPM)に1つだけ大きく外したタップが混じる
    expect(tapTempo([0, 0.5, 1, 3, 3.5])).toBeCloseTo(120, 0);
  });

  it('2回未満は null', () => {
    expect(tapTempo([1])).toBeNull();
  });
});

describe('summarize', () => {
  it('件数・命中率・平均ずれ・標準偏差を集計する', () => {
    const results: TapResult[] = [
      { offset: 0.01, judge: 'perfect' },
      { offset: -0.03, judge: 'good' },
      { offset: 0.2, judge: 'miss' },
    ];
    const s = summarize(results);
    expect(s.count).toBe(3);
    expect(s.perfect).toBe(1);
    expect(s.good).toBe(1);
    expect(s.miss).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3, 6);
    expect(s.meanOffsetMs).toBeCloseTo((10 - 30 + 200) / 3, 4);
    expect(s.stdevMs).toBeGreaterThan(0);
  });

  it('空ならゼロで返す', () => {
    expect(summarize([])).toMatchObject({ count: 0, hitRate: 0, meanOffsetMs: 0, stdevMs: 0 });
  });
});
