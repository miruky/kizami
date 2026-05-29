// テンポを上げる練習の純粋ロジック。小節をまたぐたびに開始テンポへ加算し、
// 目標に達したらそこで止める。発音や時間に依存しないのでテストしやすい。

export interface RampConfig {
  /** 何小節ごとに変えるか */
  everyBars: number;
  /** 1回あたりの増分(負なら減速) */
  step: number;
  /** 到達したら止める目標BPM */
  target: number;
}

/** 開始BPMから barsCompleted 小節後のBPMを求める。目標を越えない。 */
export function rampBpm(start: number, barsCompleted: number, cfg: RampConfig): number {
  if (cfg.everyBars <= 0 || cfg.step === 0) return start;
  const changes = Math.floor(barsCompleted / cfg.everyBars);
  const raw = start + changes * cfg.step;
  return cfg.step > 0 ? Math.min(raw, cfg.target) : Math.max(raw, cfg.target);
}

/** 目標に到達したか。 */
export function rampDone(start: number, barsCompleted: number, cfg: RampConfig): boolean {
  return rampBpm(start, barsCompleted, cfg) === cfg.target;
}
