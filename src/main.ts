import './style.css';
import { createApp } from './app';
import { Metronome } from './lib/engine';
import { createStore, defaultSettings } from './lib/settings';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);

// 一度でも保存があればその設定から、なければ既定の設定で始める
const initial = store.load() ?? defaultSettings();
store.save(initial);

const metro = new Metronome(initial);

createApp({ root, store, metro, initial });
