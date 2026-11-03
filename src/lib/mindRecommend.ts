/**
 * Consigli personalizzati di benessere mentale: dagli stessi dati del Life Score (sonno, umore, tensione, schermi, movimento…), dall'ora e da cosa hai già fatto.
 * Ogni consiglio dice PERCHÉ (i dati che lo motivano). Sono proposte, mai obblighi. Modulo PURO.
 */
import { ALL_EXERCISES, metaOf, type Cat } from './mindLibrary.ts';

export type Signals = {
  /** punti deboli del Life Score: id del fattore e motivo breve */
  weak: { id: string; why: string }[];
  /** media ore di sonno delle ultime notti */
  sleepAvg?: number;
  /** umore di oggi o ultimo: 1 (giù) – 5 (bene) */
  mood?: number;
  hour: number;
  /** ultimi esercizi fatti (id) */
  recent: string[];
  /** giorno per variare i consigli nella stessa giornata (stabili) */
  seed: number;
};
export type Reco = { exId: string; reason: string; cat: Cat };

const FACTOR_CATS: Record<string, Cat[]> = {
  sonno: ['sonno', 'corpo'], tensione: ['respiro', 'stress', 'corpo'], umore: ['emozioni', 'gratitudine', 'mente'], energia: ['movimento', 'respiro'],
  schermi: ['corpo', 'focus', 'movimento'], relazioni: ['relazioni', 'gratitudine'], movimento: ['movimento'], funzionamento: ['mente', 'stress', 'focus'], cibo: ['stress', 'corpo'], alcol: ['sonno', 'stress'],
};

const hash = (s: string, seed: number) => { let h = seed | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761); return (h >>> 0) / 4294967296; };

export function recommend(sig: Signals, n = 3): Reco[] {
  const out: Reco[] = [];
  const used = new Set<string>(sig.recent.slice(0, 6));
  const pick = (cats: Cat[], reason: string, prefer: 'base' | 'any' = 'base') => {
    const pool = ALL_EXERCISES.filter((e) => cats.includes(metaOf(e.id).cat) && !used.has(e.id) && !out.some((o) => o.exId === e.id) && (prefer === 'any' || metaOf(e.id).level !== 'avanzato'))
      .sort((a, b) => hash(a.id, sig.seed) - hash(b.id, sig.seed));
    const e = pool[0];
    if (e) { out.push({ exId: e.id, reason, cat: metaOf(e.id).cat }); used.add(e.id); }
  };
  const evening = sig.hour >= 21 || sig.hour < 5;
  const morning = sig.hour >= 5 && sig.hour < 10;
  if (evening) { out.push({ exId: 's-winddown', reason: 'È sera: una routine lenta aiuta a prepararti a dormire.', cat: 'sonno' }); used.add('s-winddown'); }
  if (sig.mood != null && sig.mood <= 2) pick(['emozioni', 'gratitudine'], `Oggi ti sei segnato giù di umore: un esercizio gentile può aiutare.`);
  if (sig.sleepAvg != null && sig.sleepAvg < 6.5 && !evening) pick(['sonno', 'respiro'], `Nelle ultime notti hai dormito in media ${String(Math.round(sig.sleepAvg * 10) / 10).replace('.', ',')} ore.`);
  for (const w of sig.weak) {
    if (out.length >= n) break;
    const cats = FACTOR_CATS[w.id]; if (cats) pick(cats, w.why);
  }
  if (morning && out.length < n) pick(['focus', 'respiro'], 'Buongiorno: un inizio di giornata con più intenzione.');
  if (out.length < n) pick(['respiro', 'corpo', 'gratitudine'], 'Un esercizio breve per ricaricarti, se ti va.');
  while (out.length < n) {
    const before = out.length; pick(['respiro', 'corpo', 'mente', 'gratitudine', 'emozioni', 'stress'], 'Per variare un po\'.');
    if (out.length === before) break;
  }
  return out.slice(0, n);
}
