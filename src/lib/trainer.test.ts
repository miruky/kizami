import { describe, expect, it } from 'vitest';
import { rampBpm, rampDone, type RampConfig } from './trainer';

const cfg: RampConfig = { everyBars: 2, step: 4, target: 132 };

describe('rampBpm', () => {
  it('小節がeveryBarsに満たない間は開始テンポのまま', () => {
    expect(rampBpm(120, 0, cfg)).toBe(120);
    expect(rampBpm(120, 1, cfg)).toBe(120);
  });

  it('everyBars小節ごとにstepずつ上げる', () => {
    expect(rampBpm(120, 2, cfg)).toBe(124);
    expect(rampBpm(120, 4, cfg)).toBe(128);
    expect(rampBpm(120, 6, cfg)).toBe(132);
  });

  it('目標を越えない', () => {
    expect(rampBpm(120, 100, cfg)).toBe(132);
  });

  it('減速にも対応する', () => {
    expect(rampBpm(120, 4, { everyBars: 2, step: -10, target: 90 })).toBe(100);
    expect(rampBpm(120, 100, { everyBars: 2, step: -10, target: 90 })).toBe(90);
  });

  it('stepが0やeveryBarsが0なら変化しない', () => {
    expect(rampBpm(120, 10, { everyBars: 0, step: 4, target: 200 })).toBe(120);
    expect(rampBpm(120, 10, { everyBars: 2, step: 0, target: 200 })).toBe(120);
  });
});

describe('rampDone', () => {
  it('目標に到達したらtrue', () => {
    expect(rampDone(120, 4, cfg)).toBe(false);
    expect(rampDone(120, 6, cfg)).toBe(true);
  });
});
