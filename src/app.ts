// 画面の描画と操作。設定を1つ持ち、つまみを動かすたびにメトロノームへ反映する。
// 再生中は先読みスケジューラが鳴らした刻みを毎フレーム受け取り、振り子と拍ランプ、
// テンポ漸増の練習、タップ練習の判定を更新する。

import {
  RANGE,
  SOUNDS,
  SUBDIVISIONS,
  clampBpm,
  type ClickSound,
  type Settings,
  type SettingsStore,
} from './lib/settings';
import { Metronome } from './lib/engine';
import { beatInterval, tempoMarking } from './lib/tempo';
import { rampBpm } from './lib/trainer';
import {
  evaluateTap,
  summarize,
  tapTempo,
  WINDOWS,
  type Judge,
  type TapResult,
} from './lib/timing';
import { icons } from './icons';

const SUBDIVISION_LABEL: Record<number, string> = {
  1: '四分',
  2: '八分',
  3: '三連',
  4: '十六分',
  6: '六連',
  8: '三十二分',
};
const SOUND_LABEL: Record<ClickSound, string> = {
  click: 'クリック',
  wood: '木',
  beep: '電子音',
};
const JUDGE_LABEL: Record<Judge, string> = {
  perfect: 'ぴったり',
  good: 'おしい',
  off: 'ずれ',
  miss: '見逃し',
};

const MAX_RESULTS = 48;
type ThemeMode = 'light' | 'dark' | 'auto';

export interface AppDeps {
  root: HTMLElement;
  store: SettingsStore;
  metro: Metronome;
  initial: Settings;
}

export function createApp({ root, store, metro, initial }: AppDeps): void {
  const settings = initial;
  let results: TapResult[] = [];
  let tapTimes: number[] = [];
  let swing = false;

  // テンポ漸増の練習(セッション内の状態)
  const ramp = { on: false, target: 160, step: 4, every: 2 };
  let rampStartBpm = settings.bpm;
  let downbeats = 0;

  function commit(): void {
    store.save(settings);
    metro.setSettings(settings);
  }

  function seg(name: string, value: string, choices: { v: string; label: string }[]): string {
    return `<div class="segmented" role="radiogroup" aria-label="${name}">${choices
      .map(
        (c) =>
          `<button type="button" role="radio" aria-checked="${c.v === value}" class="seg ${
            c.v === value ? 'active' : ''
          }" data-seg="${name}" data-value="${c.v}">${c.label}</button>`,
      )
      .join('')}</div>`;
  }

  function dots(): string {
    return Array.from(
      { length: settings.beatsPerBar },
      (_, i) =>
        `<span class="dot ${i === 0 ? 'accent' : ''}" data-dot="${i}" aria-hidden="true"></span>`,
    ).join('');
  }

  function render(): void {
    root.innerHTML = `
      <div class="wrap">
        <header class="masthead">
          <div class="masthead__brand">
            <p class="kicker"><span class="logo">${icons.logo}</span>metronome / リズム練習</p>
            <h1 class="wordmark">kizami</h1>
            <p class="lede">正確なクリックと、タップのタイミング精度判定。</p>
          </div>
          <div class="segmented theme" role="group" aria-label="配色テーマ">
            <button type="button" class="seg" data-theme-opt="light" aria-label="明るい配色" title="明るい配色">${icons.sun}</button>
            <button type="button" class="seg" data-theme-opt="auto" aria-label="OSの設定に従う" title="OSの設定に従う">${icons.monitor}</button>
            <button type="button" class="seg" data-theme-opt="dark" aria-label="暗い配色" title="暗い配色">${icons.moon}</button>
          </div>
        </header>

        <main>
          <section class="stage">
            <svg viewBox="0 0 200 150" class="pendulum" aria-hidden="true">
              <line class="frame" x1="100" y1="22" x2="40" y2="140"/>
              <line class="frame" x1="100" y1="22" x2="160" y2="140"/>
              <g id="arm" style="transform-origin:100px 130px">
                <line class="rod" x1="100" y1="130" x2="100" y2="34"/>
                <circle class="bob" cx="100" cy="40" r="11"/>
              </g>
              <circle class="pivot" cx="100" cy="130" r="5"/>
            </svg>
            <div class="tempo">
              <div class="marking" id="marking">${tempoMarking(settings.bpm)}</div>
              <div class="bpm"><span id="bpm-value">${settings.bpm}</span><span class="bpm-unit">BPM</span></div>
              <div class="tempo-row">
                <button type="button" class="round" id="bpm-down" aria-label="テンポを下げる">${icons.minus}</button>
                <input type="range" id="bpm-slider" min="${RANGE.bpm.min}" max="${RANGE.bpm.max}" value="${settings.bpm}" aria-label="テンポ"/>
                <button type="button" class="round" id="bpm-up" aria-label="テンポを上げる">${icons.plus}</button>
              </div>
              <button type="button" class="button ghost tap-tempo" id="tap-tempo">${icons.tap}<span>タップでテンポ</span></button>
            </div>
            <div class="beats" id="beats">${dots()}</div>
            <button type="button" class="button primary transport" id="transport">
              ${metro.running ? icons.stop : icons.play}<span id="transport-label">${metro.running ? '停止' : '再生'}</span>
            </button>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>設定</h2></div>
            <div class="controls">
              <div class="control">
                <span class="control-label">拍子(1小節の拍数)</span>
                <div class="stepper">
                  <button type="button" class="round" id="beats-down" aria-label="拍数を減らす">${icons.minus}</button>
                  <span id="beats-value">${settings.beatsPerBar}</span>
                  <button type="button" class="round" id="beats-up" aria-label="拍数を増やす">${icons.plus}</button>
                </div>
              </div>
              <div class="control">
                <span class="control-label">分割</span>
                ${seg(
                  'subdivision',
                  String(settings.subdivision),
                  SUBDIVISIONS.map((n) => ({
                    v: String(n),
                    label: SUBDIVISION_LABEL[n] ?? String(n),
                  })),
                )}
              </div>
              <div class="control">
                <span class="control-label">音色</span>
                ${seg(
                  'sound',
                  settings.sound,
                  SOUNDS.map((s) => ({ v: s, label: SOUND_LABEL[s] })),
                )}
              </div>
              <div class="control row-control">
                <label class="toggle"><input type="checkbox" id="accent" ${
                  settings.accentFirst ? 'checked' : ''
                }/><span>小節頭にアクセント</span></label>
                <label class="vol"><span>音量</span><input type="range" id="volume" min="0" max="1" step="0.01" value="${settings.volume}" aria-label="音量"/></label>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>テンポを上げる練習</h2>
              <label class="toggle"><input type="checkbox" id="ramp-on" ${ramp.on ? 'checked' : ''}/><span>有効にする</span></label>
            </div>
            <div class="trainer">
              <div class="trainer-row">
                <label class="field"><input type="number" id="ramp-step" min="1" max="30" value="${ramp.step}"/> BPMずつ</label>
                <label class="field"><input type="number" id="ramp-every" min="1" max="16" value="${ramp.every}"/> 小節ごとに上げ</label>
                <label class="field">目標 <input type="number" id="ramp-target" min="${RANGE.bpm.min}" max="${RANGE.bpm.max}" value="${ramp.target}"/> BPM</label>
              </div>
              <p class="trainer-note">再生すると今のテンポから始め、設定した刻みで目標まで自動で上げていきます。</p>
            </div>
          </section>

          <section class="panel practice">
            <div class="practice-head">
              <h2>タップ練習</h2>
              <button type="button" class="button ghost small" id="reset-stats">${icons.reset}<span>成績をリセット</span></button>
            </div>
            <button type="button" class="tap-pad" id="tap-pad">
              <span class="tap-judge" id="tap-judge">再生して拍に合わせてタップ</span>
              <span class="tap-offset" id="tap-offset"></span>
            </button>
            <p class="hint">タップパッドを押すか、<kbd>F</kbd> / <kbd>J</kbd> キーで拍に合わせてタップ。<kbd>Space</kbd> で再生・停止、<kbd>↑</kbd> <kbd>↓</kbd> でテンポ。</p>
            <svg viewBox="0 0 300 64" class="scatter" id="scatter" role="img" aria-label="タップのずれの分布">
              <rect class="zone off" x="0" y="20" width="300" height="24"/>
              <rect class="zone good" id="zone-good" x="0" y="20" width="300" height="24"/>
              <rect class="zone perfect" id="zone-perfect" x="0" y="20" width="300" height="24"/>
              <line class="center" x1="150" y1="14" x2="150" y2="50"/>
              <g id="marks"></g>
              <text class="axis" x="6" y="60">走り</text>
              <text class="axis end" x="294" y="60">もたり</text>
            </svg>
            <div class="stats" id="stats"></div>
          </section>
        </main>

        <footer class="site-footer">
          <p>kizami — ブラウザの中で動くメトロノームとリズム練習。設定はこの端末に保存され、外部には送りません。</p>
        </footer>
      </div>
      <p class="sr-only" id="live" aria-live="polite"></p>`;
    bindEvents();
    updateThemeButtons();
    layoutScatter();
    renderStats();
  }

  function bindEvents(): void {
    root.querySelector('#transport')?.addEventListener('click', () => void toggleTransport());
    root.querySelector('#bpm-slider')?.addEventListener('input', (e) => {
      setBpm(Number((e.target as HTMLInputElement).value));
    });
    root.querySelector('#bpm-down')?.addEventListener('click', () => setBpm(settings.bpm - 1));
    root.querySelector('#bpm-up')?.addEventListener('click', () => setBpm(settings.bpm + 1));
    root.querySelector('#tap-tempo')?.addEventListener('click', () => onTapTempo());

    root.querySelector('#beats-down')?.addEventListener('click', () => {
      settings.beatsPerBar = Math.max(RANGE.beatsPerBar.min, settings.beatsPerBar - 1);
      commit();
      render();
    });
    root.querySelector('#beats-up')?.addEventListener('click', () => {
      settings.beatsPerBar = Math.min(RANGE.beatsPerBar.max, settings.beatsPerBar + 1);
      commit();
      render();
    });

    for (const el of root.querySelectorAll<HTMLButtonElement>('.seg[data-seg]')) {
      el.addEventListener('click', () => {
        const name = el.dataset.seg as string;
        const value = el.dataset.value as string;
        if (name === 'subdivision') settings.subdivision = Number(value);
        if (name === 'sound') settings.sound = value as ClickSound;
        commit();
        render();
      });
    }

    for (const el of root.querySelectorAll<HTMLButtonElement>('[data-theme-opt]')) {
      el.addEventListener('click', () => setTheme(el.dataset.themeOpt as ThemeMode));
    }

    root.querySelector('#accent')?.addEventListener('change', (e) => {
      settings.accentFirst = (e.target as HTMLInputElement).checked;
      commit();
    });
    root.querySelector('#volume')?.addEventListener('input', (e) => {
      settings.volume = Number((e.target as HTMLInputElement).value);
      commit();
    });

    root.querySelector('#ramp-on')?.addEventListener('change', (e) => {
      ramp.on = (e.target as HTMLInputElement).checked;
      resetRamp();
    });
    bindNumber('#ramp-step', (n) => (ramp.step = clampInt(n, 1, 30)));
    bindNumber('#ramp-every', (n) => (ramp.every = clampInt(n, 1, 16)));
    bindNumber('#ramp-target', (n) => (ramp.target = clampBpm(n)));

    const pad = root.querySelector('#tap-pad');
    pad?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      practiceTap();
    });
    root.querySelector('#reset-stats')?.addEventListener('click', () => {
      results = [];
      layoutScatter();
      renderStats();
      setJudge(null);
    });
  }

  function bindNumber(selector: string, set: (n: number) => void): void {
    root.querySelector(selector)?.addEventListener('change', (e) => {
      const n = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(n)) {
        set(n);
        resetRamp();
      }
    });
  }

  function clampInt(v: number, lo: number, hi: number): number {
    return Math.round(Math.min(hi, Math.max(lo, v)));
  }

  function resetRamp(): void {
    rampStartBpm = settings.bpm;
    downbeats = 0;
  }

  async function toggleTransport(): Promise<void> {
    await metro.toggle();
    if (metro.running) resetRamp();
    const btn = root.querySelector('#transport');
    if (btn)
      btn.innerHTML = `${metro.running ? icons.stop : icons.play}<span id="transport-label">${metro.running ? '停止' : '再生'}</span>`;
    if (!metro.running) clearDots();
  }

  function setBpm(bpm: number): void {
    settings.bpm = clampBpm(bpm);
    const value = root.querySelector('#bpm-value');
    if (value) value.textContent = String(settings.bpm);
    const marking = root.querySelector('#marking');
    if (marking) marking.textContent = tempoMarking(settings.bpm);
    const slider = root.querySelector<HTMLInputElement>('#bpm-slider');
    if (slider) slider.value = String(settings.bpm);
    commit();
  }

  function onTapTempo(): void {
    const now = performance.now() / 1000;
    if (tapTimes.length > 0 && now - (tapTimes[tapTimes.length - 1] as number) > 2) tapTimes = [];
    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift();
    const bpm = tapTempo(tapTimes);
    if (bpm !== null) {
      setBpm(Math.round(bpm));
      resetRamp();
    }
  }

  function practiceTap(): void {
    if (!metro.running) return;
    const result = evaluateTap(metro.recentBeats(), metro.now());
    if (!result) return;
    results.push(result);
    if (results.length > MAX_RESULTS) results.shift();
    setJudge(result);
    layoutScatter();
    renderStats();
  }

  function setJudge(result: TapResult | null): void {
    const judgeEl = root.querySelector('#tap-judge');
    const offsetEl = root.querySelector('#tap-offset');
    const pad = root.querySelector('#tap-pad');
    if (!judgeEl || !offsetEl || !pad) return;
    pad.classList.remove('perfect', 'good', 'off', 'miss');
    if (result === null) {
      judgeEl.textContent = '再生して拍に合わせてタップ';
      offsetEl.textContent = '';
      return;
    }
    pad.classList.add(result.judge);
    judgeEl.textContent = JUDGE_LABEL[result.judge];
    const ms = Math.round(Math.abs(result.offset) * 1000);
    offsetEl.textContent =
      result.judge === 'perfect' ? `${ms} ms` : `${result.offset < 0 ? '走り' : 'もたり'} ${ms} ms`;
  }

  function layoutScatter(): void {
    const half = 150;
    const scale = half / WINDOWS.off; // off窓を端に合わせる
    root.querySelector('#zone-good')?.setAttribute('x', String(150 - WINDOWS.good * scale));
    root.querySelector('#zone-good')?.setAttribute('width', String(WINDOWS.good * scale * 2));
    root.querySelector('#zone-perfect')?.setAttribute('x', String(150 - WINDOWS.perfect * scale));
    root.querySelector('#zone-perfect')?.setAttribute('width', String(WINDOWS.perfect * scale * 2));
    const marks = root.querySelector('#marks');
    if (!marks) return;
    marks.innerHTML = results
      .slice(-MAX_RESULTS)
      .map((r, i, arr) => {
        const x = Math.max(2, Math.min(298, 150 + r.offset * scale));
        const opacity = 0.25 + (0.75 * (i + 1)) / arr.length;
        return `<line class="mark ${r.judge}" x1="${x.toFixed(1)}" y1="18" x2="${x.toFixed(
          1,
        )}" y2="46" opacity="${opacity.toFixed(2)}"/>`;
      })
      .join('');
  }

  function renderStats(): void {
    const el = root.querySelector('#stats');
    if (!el) return;
    const s = summarize(results);
    if (s.count === 0) {
      el.innerHTML = `<span class="stat"><b>0</b><small>タップ</small></span>`;
      return;
    }
    const dir = s.meanOffsetMs < 0 ? '走り' : 'もたり';
    el.innerHTML =
      `<span class="stat"><b>${Math.round(s.hitRate * 100)}%</b><small>命中(ぴったり+おしい)</small></span>` +
      `<span class="stat"><b>${dir} ${Math.abs(Math.round(s.meanOffsetMs))} ms</b><small>平均のずれ</small></span>` +
      `<span class="stat"><b>±${Math.round(s.stdevMs)} ms</b><small>ばらつき</small></span>` +
      `<span class="stat"><b>${s.count}</b><small>タップ</small></span>`;
  }

  function clearDots(): void {
    for (const d of root.querySelectorAll('.dot')) d.classList.remove('lit');
  }

  function lightBeat(beat: number): void {
    for (const d of root.querySelectorAll<HTMLElement>('.dot')) {
      d.classList.toggle('lit', Number(d.dataset.dot) === beat);
    }
  }

  function swingArm(): void {
    const arm = root.querySelector<SVGGElement>('#arm');
    if (!arm) return;
    swing = !swing;
    arm.style.transition = `transform ${beatInterval(settings.bpm).toFixed(3)}s ease-in-out`;
    arm.style.transform = `rotate(${swing ? 14 : -14}deg)`;
  }

  // 小節頭ごとにテンポ漸増を適用する
  function onBarStart(): void {
    downbeats += 1;
    if (!ramp.on) return;
    const barsCompleted = downbeats - 1;
    const next = rampBpm(rampStartBpm, barsCompleted, {
      everyBars: ramp.every,
      step: ramp.step,
      target: ramp.target,
    });
    if (next !== settings.bpm) setBpm(next);
  }

  // 毎フレーム、鳴った刻みを受け取って画面を動かす
  function frame(): void {
    for (const tick of metro.drainDue(metro.now())) {
      if (tick.posInBar === 0) onBarStart();
      if (tick.strong) {
        lightBeat(tick.beat);
        swingArm();
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- テーマ ----
  function currentTheme(): ThemeMode {
    const set = document.documentElement.dataset.theme;
    return set === 'light' || set === 'dark' ? set : 'auto';
  }

  function setTheme(mode: ThemeMode): void {
    try {
      if (mode === 'auto') {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem('kizami-theme');
      } else {
        document.documentElement.dataset.theme = mode;
        localStorage.setItem('kizami-theme', mode);
      }
    } catch {
      /* 保存できなくてもテーマは切り替わる */
    }
    updateThemeButtons();
  }

  function updateThemeButtons(): void {
    const active = currentTheme();
    for (const el of root.querySelectorAll<HTMLElement>('[data-theme-opt]')) {
      el.setAttribute('aria-pressed', String(el.dataset.themeOpt === active));
      el.classList.toggle('active', el.dataset.themeOpt === active);
    }
  }

  // キーボード操作(全体で受ける)
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.code === 'Space') {
      if (editing || tag === 'BUTTON') return; // ボタンやフィールド上では本来の動作に任せる
      e.preventDefault();
      void toggleTransport();
    } else if (e.key === 'f' || e.key === 'j') {
      if (editing) return;
      e.preventDefault();
      practiceTap();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (editing) return;
      e.preventDefault();
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      setBpm(settings.bpm + delta);
    }
  });

  render();
  requestAnimationFrame(frame);
}
