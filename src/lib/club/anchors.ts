import type { Anchor } from './types.ts';

/** 3:42 oppure 1:03:07 */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** Legge "3:42", "1:03:07" o "222" -> secondi (null se non valido). */
export function parseClock(s: string): number | null {
  const t = s.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  return parts.reduce((a, p) => a * 60 + p, 0);
}

export function anchorLabel(a?: Anchor): string {
  if (!a) return '';
  if (a.kind === 'time') return fmtClock(a.sec);
  if (a.kind === 'page') return `pag. ${a.page}`;
  return `par. ${a.para}`;
}

/** Testo della domanda instradata nella chat: Domanda su «Lezione 3 · 3:42» */
export function questionLabel(lessonTitle: string, a?: Anchor): string {
  return a ? `${lessonTitle} · ${anchorLabel(a)}` : lessonTitle;
}

/** Commenti da mostrare in sovraimpressione: quelli con ancora temporale compresa in [pos-1, pos+window) */
export function bubblesAt<T extends { anchor?: Anchor }>(list: T[], posSec: number, windowSec = 6): T[] {
  return list.filter((c) => c.anchor?.kind === 'time' && c.anchor.sec <= posSec + 0.5 && c.anchor.sec > posSec - windowSec);
}

/** Ordina per ancora (poi per tempo di scrittura). I commenti senza ancora vanno in fondo. */
export function sortByAnchor<T extends { anchor?: Anchor; ts: number }>(list: T[]): T[] {
  const key = (c: T) => (!c.anchor ? Infinity : c.anchor.kind === 'time' ? c.anchor.sec : c.anchor.kind === 'page' ? c.anchor.page : c.anchor.para);
  return [...list].sort((a, b) => key(a) - key(b) || a.ts - b.ts);
}
