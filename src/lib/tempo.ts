// テンポと拍の時間計算。1拍・1刻みの間隔と、ある時刻から先の刻みの並びを求める。
// 純粋関数なので、発音なしでスケジュールの正しさをテストできる。

/** 1拍の長さ(秒) */
export function beatInterval(bpm: number): number {
  return 60 / bpm;
}

/** 1小節の長さ(秒) */
export function barDuration(bpm: number, beatsPerBar: number): number {
  return beatInterval(bpm) * beatsPerBar;
}

export interface Tick {
  /** 連番(0始まり) */
  index: number;
  /** 発音時刻(秒) */
  time: number;
  /** 小節内の刻み位置(0始まり) */
  posInBar: number;
  /** 拍の頭(分割の境界)か */
  strong: boolean;
  /** 小節頭のアクセントか */
  accent: boolean;
  /** 何拍目か(0始まり) */
  beat: number;
}

/**
 * fromTime から count 個の刻みを並べる。刻みの間隔は1拍を subdivision で割った長さ。
 * startIndex を与えると連番とアクセント位置をその続きから数える。
 */
export function tickPlan(
  bpm: number,
  beatsPerBar: number,
  subdivision: number,
  fromTime: number,
  count: number,
  startIndex = 0,
): Tick[] {
  const step = beatInterval(bpm) / subdivision;
  const perBar = beatsPerBar * subdivision;
  const ticks: Tick[] = [];
  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const posInBar = ((index % perBar) + perBar) % perBar;
    ticks.push({
      index,
      time: fromTime + i * step,
      posInBar,
      strong: posInBar % subdivision === 0,
      accent: posInBar === 0,
      beat: Math.floor(posInBar / subdivision),
    });
  }
  return ticks;
}
