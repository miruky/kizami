// UIの線画アイコン。24pxグリッド・stroke=currentColorで統一し、装飾(aria-hidden)
// として出力する。ボタンには別途テキストラベルかaria-labelを与える。

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  // 振り子に見立てたメトロノームの形
  logo: svg('<path d="M9 4h6l3 16H6z"/><path d="M12 20 17 7"/><circle cx="17" cy="7" r="1.4"/>'),
  play: svg('<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  tap: svg(
    '<path d="M9 11V6a2 2 0 0 1 4 0v5"/><path d="M13 11V8a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4 1.5-1.3a2 2 0 0 1 2.5 0L9 14"/>',
  ),
  reset: svg('<path d="M4 4v6h6"/><path d="M4 10a8 8 0 1 1-1 4"/>'),
  sun: svg(
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
  ),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>'),
  monitor: svg(
    '<rect x="3" y="4.5" width="18" height="12" rx="1.6"/><path d="M9 20h6M12 16.5V20"/>',
  ),
} as const;
