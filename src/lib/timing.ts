// タップの精度判定と、タップからのテンポ推定、成績の集計。すべて純粋計算。

export type Judge = 'perfect' | 'good' | 'off' | 'miss';

/** 判定の許容幅(秒)。これ以内なら perfect / good / off、超えると miss */
export const WINDOWS: Readonly<Record<Exclude<Judge, 'miss'>, number>> = {
  perfect: 0.025,
  good: 0.05,
  off: 0.12,
};

export interface TapResult {
  /** タップ時刻 - 最寄りの拍(秒)。負なら走り気味、正ならもたり気味 */
  offset: number;
  judge: Judge;
}

/** 拍の時刻列のうちタップに最も近いものを返す。offset は符号つき(タップ - 拍) */
export function nearestBeat(
  beatTimes: readonly number[],
  tapTime: number,
): { beatTime: number; offset: number } | null {
  if (beatTimes.length === 0) return null;
  let best = beatTimes[0] as number;
  let bestAbs = Math.abs(tapTime - best);
  for (const t of beatTimes) {
    const abs = Math.abs(tapTime - t);
    if (abs < bestAbs) {
      bestAbs = abs;
      best = t;
    }
  }
  return { beatTime: best, offset: tapTime - best };
}

export function judgeOffset(offset: number): Judge {
  const a = Math.abs(offset);
  if (a <= WINDOWS.perfect) return 'perfect';
  if (a <= WINDOWS.good) return 'good';
  if (a <= WINDOWS.off) return 'off';
  return 'miss';
}

export function evaluateTap(beatTimes: readonly number[], tapTime: number): TapResult | null {
  const near = nearestBeat(beatTimes, tapTime);
  if (near === null) return null;
  return { offset: near.offset, judge: judgeOffset(near.offset) };
}

/**
 * タップ時刻の列からテンポ(BPM)を推定する。隣り合う間隔の中央値を使い、
 * 単発の乱れに引きずられにくくする。2回未満の入力では null。
 */
export function tapTempo(times: readonly number[]): number | null {
  if (times.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const g = (times[i] as number) - (times[i - 1] as number);
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0
      ? ((gaps[mid - 1] as number) + (gaps[mid] as number)) / 2
      : (gaps[mid] as number);
  return 60 / median;
}

export interface TapStats {
  count: number;
  perfect: number;
  good: number;
  off: number;
  miss: number;
  /** 命中(perfect+good)の割合(0..1) */
  hitRate: number;
  /** 平均のずれ(ミリ秒、符号つき) */
  meanOffsetMs: number;
  /** ずれの標準偏差(ミリ秒) */
  stdevMs: number;
}

export function summarize(results: readonly TapResult[]): TapStats {
  const count = results.length;
  const base: TapStats = {
    count,
    perfect: 0,
    good: 0,
    off: 0,
    miss: 0,
    hitRate: 0,
    meanOffsetMs: 0,
    stdevMs: 0,
  };
  if (count === 0) return base;

  for (const r of results) base[r.judge]++;
  const offsets = results.map((r) => r.offset * 1000);
  const mean = offsets.reduce((a, b) => a + b, 0) / count;
  const variance = offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  base.hitRate = (base.perfect + base.good) / count;
  base.meanOffsetMs = mean;
  base.stdevMs = Math.sqrt(variance);
  return base;
}
