import { describe, expect, it } from 'vitest';
import { barDuration, beatInterval, tempoMarking, tickPlan } from './tempo';

describe('beatInterval / barDuration', () => {
  it('120 BPMは1拍0.5秒', () => {
    expect(beatInterval(120)).toBeCloseTo(0.5, 6);
    expect(barDuration(120, 4)).toBeCloseTo(2, 6);
  });
});

describe('tempoMarking', () => {
  it('BPMの帯に対応する速度標語を返す', () => {
    expect(tempoMarking(50)).toBe('Largo');
    expect(tempoMarking(90)).toBe('Andante');
    expect(tempoMarking(120)).toBe('Moderato');
    expect(tempoMarking(140)).toBe('Allegro');
  });

  it('境界値は下側の標語に含める', () => {
    expect(tempoMarking(60)).toBe('Largo');
    expect(tempoMarking(61)).toBe('Larghetto');
  });

  it('最速域はPrestissimo', () => {
    expect(tempoMarking(240)).toBe('Prestissimo');
  });
});

describe('tickPlan', () => {
  it('指定数を等間隔に並べる', () => {
    const ticks = tickPlan(120, 4, 1, 10, 4);
    expect(ticks).toHaveLength(4);
    expect(ticks.map((t) => t.time)).toEqual([10, 10.5, 11, 11.5]);
  });

  it('小節頭だけアクセント、四分音符はすべて拍頭', () => {
    const ticks = tickPlan(120, 4, 1, 0, 8);
    expect(ticks.map((t) => t.accent)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(ticks.every((t) => t.strong)).toBe(true);
  });

  it('分割すると拍頭だけstrong、間隔は割られる', () => {
    const ticks = tickPlan(120, 2, 2, 0, 4);
    expect(ticks.map((t) => t.strong)).toEqual([true, false, true, false]);
    expect(ticks[1]!.time).toBeCloseTo(0.25, 6);
    expect(ticks.map((t) => t.beat)).toEqual([0, 0, 1, 1]);
  });

  it('startIndexで小節内の位置が続く', () => {
    const ticks = tickPlan(120, 4, 1, 0, 1, 4);
    expect(ticks[0]).toMatchObject({ posInBar: 0, accent: true });
  });

  it('六連(分割6)は拍頭だけstrongで、6刻みで1拍進む', () => {
    const ticks = tickPlan(60, 2, 6, 0, 12); // 60BPM・1拍1秒・6分割
    expect(ticks.filter((t) => t.strong).map((t) => t.index)).toEqual([0, 6]);
    expect(ticks[1]!.time).toBeCloseTo(1 / 6, 6);
    expect(ticks.map((t) => t.beat)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(ticks[0]!.accent).toBe(true);
  });
});
