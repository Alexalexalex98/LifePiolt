/**
 * Testi dell'interfaccia generati dal router (spiegazioni, messaggi di limite...).
 * Il modulo e' puro: la traduzione vera viene iniettata da runtime.ts con setTranslate(t di '@/i18n/core').
 * Senza traduttore sostituisce solo i segnaposto {0},{1}.
 */
type Fn = (src: string, ...args: (string | number)[]) => string;

const plain: Fn = (src, ...args) => src.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
let current: Fn = plain;

export function setTranslate(fn: Fn | null) { current = fn ?? plain; }
/** Traduce (se possibile) un testo italiano con segnaposto. Da chiamare SOLO dentro funzioni. */
export const tx: Fn = (src, ...args) => current(src, ...args);
