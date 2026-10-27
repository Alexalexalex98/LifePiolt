/**
 * «Inizia a lavorare» sui progetti: stima di quanti minuti serve per una task, dal testo (verbo e lunghezza) e da quanto ci hai messo in passato
 * per task simili. È una stima: la puoi cambiare con +5/−5 mentre lavori. Modulo PURO.
 */
export type WorkHistory = { verb: string; est: number; actual: number };

const QUICK = /^(chiam\w+|telefon\w+|invi\w+|mand\w+|prenot\w+|control\w+|verific\w+|avvis\w+|ringrazi\w+|scegli\w+|scegl\w+|fiss\w+|segn\w+|elenc\w+|comunic\w+|rispond\w+|firm\w+|pag\w+|cancell\w+|elimin\w+|salv\w+|archivi\w+)/i;
const LONG = /^(scriv\w+|redig\w+|svilupp\w+|analizz\w+|progett\w+|disegn\w+|calcol\w+|realizz\w+|costru\w+|impagin\w+|stud\w+|svolg\w+|completa\w*|prepar\w+ (il|la|lo) (documento|presentazione|piano|report|bilancio)|creare|crea|produc\w+|montar\w+|test\w+|provare)/i;
const BIG = /\b(tutto|tutti|completo|completa|finale|intero|intera|documento|piano|report|bilancio|presentazione|bozza|capitol\w+|relazione|preventiv\w+)\b/i;

export const verbOf = (title: string): string => (String(title ?? '').trim().toLowerCase().match(/^[a-zàèéìòù']+/)?.[0] ?? '').slice(0, 5);

/** Minuti stimati (multipli di 5, tra 5 e 120). */
export function estimateMinutes(title: string, history: WorkHistory[] = []): number {
  const t = String(title ?? '').trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  let m = QUICK.test(t) ? 10 : LONG.test(t) ? 45 : 25;
  if (words >= 9) m += 10; else if (words >= 6) m += 5;
  if (BIG.test(t)) m += 15;
  const v = verbOf(t);
  const same = history.filter((h) => h.verb === v && h.actual > 0).slice(-6);
  if (same.length >= 2) {
    const avg = same.reduce((x, h) => x + h.actual, 0) / same.length;
    m = 0.4 * m + 0.6 * avg;
  }
  return Math.max(5, Math.min(120, Math.round(m / 5) * 5));
}

/** «25 min», «1 h 15 min». */
export const fmtMin = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

/** Una frase breve di incoraggiamento in base a come va (gentile, mai punitiva). `ratio` = tempo passato / tempo stimato. */
export function nudge(ratio: number, running: boolean): string {
  if (!running) return 'In pausa. Quando sei pronto, riparti: va bene anche un minuto alla volta.';
  if (ratio < 0.15) return 'Solo questo, niente altro. Inizia dal pezzo più piccolo.';
  if (ratio < 0.5) return 'Stai andando bene. Una cosa alla volta.';
  if (ratio < 0.85) return 'Più di metà fatta. Continua così.';
  if (ratio < 1) return 'Quasi alla fine: l\'ultimo sforzo.';
  if (ratio < 1.5) return 'Il tempo stimato è finito. Hai ancora energia? Aggiungi 5 minuti o segna fatto.';
  return 'Ci sta mettendo più del previsto, succede. Fai una pausa o spezza la task in pezzi più piccoli.';
}
