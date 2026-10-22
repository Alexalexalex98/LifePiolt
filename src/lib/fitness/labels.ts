import { t as tl } from '@/i18n/core';

/** Nomi dei muscoli e degli attrezzi nella lingua dell'app (chiamate esplicite, così finiscono nei cataloghi di traduzione). */
export function muscleLabel(m: string): string {
  switch (m) {
    case 'gambe': return tl('Gambe'); case 'glutei': return tl('Glutei'); case 'petto': return tl('Petto'); case 'schiena': return tl('Schiena');
    case 'spalle': return tl('Spalle'); case 'braccia': return tl('Braccia'); case 'core': return tl('Core'); case 'corpo intero': return tl('Corpo intero');
    case 'cardio': return tl('Cardio'); case 'mobilità': return tl('Mobilità'); case 'tutti': return tl('Tutti'); default: return m;
  }
}
export function equipLabel(e: string): string {
  switch (e) {
    case 'nessuno': return tl('Nessuno'); case 'manubri': return tl('Manubri'); case 'elastico': return tl('Elastico'); case 'palestra': return tl('Palestra'); case 'piscina': return tl('Piscina');
    case 'tutti': return tl('Ogni attrezzo'); default: return e;
  }
}
