// Web Audio によるメトロノーム。先読みスケジューラ(setIntervalで少し先までの
// クリックを予約する方式)で、タブが重くても揺れない正確な刻みを出す。
// 純粋なテンポ計算は tempo.ts に置き、ここは発音とスケジュールを受け持つ。

import { beatInterval } from './tempo';
import type { Settings } from './settings';

export interface ScheduledTick {
  time: number;
  beat: number;
  posInBar: number;
  accent: boolean;
  strong: boolean;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class Metronome {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private settings: Settings;
  private timer: number | null = null;
  private nextTime = 0;
  private index = 0;
  private queue: ScheduledTick[] = [];
  private beats: number[] = [];

  constructor(settings: Settings) {
    this.settings = settings;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  private build(): void {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.settings.volume;
    this.master.connect(ctx.destination);
  }

  async start(): Promise<void> {
    if (!this.ctx) this.build();
    const ctx = this.ctx as AudioContext;
    if (ctx.state !== 'running') await ctx.resume();
    if (this.timer !== null) return;
    this.index = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.queue = [];
  }

  toggle(): Promise<void> | void {
    return this.running ? this.stop() : this.start();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    if (this.ctx) this.master.gain.value = settings.volume;
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** 直近の拍頭の時刻列(タップ判定に使う) */
  recentBeats(): number[] {
    return this.beats;
  }

  /** now までに発音された刻みを取り出す(画面のアニメーション用) */
  drainDue(now: number): ScheduledTick[] {
    const due: ScheduledTick[] = [];
    while (this.queue.length > 0 && (this.queue[0] as ScheduledTick).time <= now) {
      due.push(this.queue.shift() as ScheduledTick);
    }
    return due;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.settings;
    const step = beatInterval(s.bpm) / s.subdivision;
    const perBar = s.beatsPerBar * s.subdivision;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const posInBar = this.index % perBar;
      const strong = posInBar % s.subdivision === 0;
      const accent = posInBar === 0 && s.accentFirst;
      const tick: ScheduledTick = {
        time: this.nextTime,
        beat: Math.floor(posInBar / s.subdivision),
        posInBar,
        accent,
        strong,
      };
      this.click(tick);
      this.queue.push(tick);
      if (strong) {
        this.beats.push(this.nextTime);
        if (this.beats.length > 32) this.beats.shift();
      }
      this.nextTime += step;
      this.index++;
    }
  }

  private click(tick: ScheduledTick): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const { sound } = this.settings;
    const tier = tick.accent ? 2 : tick.strong ? 1 : 0;

    let freq: number;
    let dur: number;
    if (sound === 'beep') {
      osc.type = 'sine';
      freq = [660, 880, 1320][tier] as number;
      dur = 0.05;
    } else if (sound === 'wood') {
      osc.type = 'triangle';
      freq = [150, 190, 280][tier] as number;
      dur = 0.045;
    } else {
      osc.type = 'square';
      freq = [1000, 1500, 2050][tier] as number;
      dur = 0.035;
    }
    const peak = (tick.accent ? 1 : tick.strong ? 0.7 : 0.42) * this.settings.volume;

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, tick.time);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), tick.time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, tick.time + dur);
    osc.connect(gain).connect(this.master);
    osc.start(tick.time);
    osc.stop(tick.time + dur + 0.02);
  }
}
