/**
 * Analisi dell'umore rispetto al resto della vita: meteo, impegni, sonno, movimento, stress, spese...
 * Modulo PURO e testabile. Confronta l'umore medio tra gruppi di giorni (es. pioggia vs asciutto) con un test t di Welch
 * e segnala un legame solo se campione e differenza sono sufficienti. Indica un'associazione, MAI una causa.
 */
import { t } from '../i18n/core.ts';

export type DayCtx = {
  day: string; mood: number; weekday: number;
  rain?: number; tmax?: number; sun?: number; events?: number; sleep?: number; steps?: number;
  stress?: number; exercise?: number; spend?: number; mindful?: number;
};

export type Group = { label: string; mean: number; n: number };
export type Factor = {
  id: string; label: string; a: Group; b: Group; diff: number; t: number; sig: boolean;
  strength: 'forte' | 'media' | 'lieve'; sentence: string; tip: string;
  /** si ripete nel tempo? (prima vs seconda metà dei dati) */
  confirmation?: Confirmation;
};
export type MoodReport = { n: number; mean: number; best: Group | null; worst: Group | null; factors: Factor[]; confidence: 'alta' | 'media' | 'bassa' | 'insufficiente' };

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const variance = (a: number[]) => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1); };
export function welch(a: number[], b: number[]): number {
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  return se === 0 ? 0 : (mean(a) - mean(b)) / se;
}
const r1 = (v: number) => Math.round(v * 10) / 10;
const sgn = (v: number) => (v > 0 ? '+' : '') + r1(v).toString().replace('.', ',');
const fmt = (v: number) => r1(v).toString().replace('.', ',');

type Def = {
  id: string; label: string; get: (d: DayCtx) => number | undefined;
  /** come dividere i giorni: due condizioni (a = "più intensa", b = "opposta") */
  a: { label: string; test: (v: number) => boolean }; b: { label: string; test: (v: number) => boolean };
  tipUp: string; tipDown: string; // consiglio se il gruppo a alza / abbassa l'umore
};

const getDefs = (): Def[] => [
  { id: 'rain', label: t('Pioggia'), get: (d) => d.rain, a: { label: t('giorni di pioggia'), test: (v) => v >= 1 }, b: { label: t('giorni asciutti'), test: (v) => v < 0.2 }, tipUp: t('Nei giorni di pioggia sembra farti bene: tienila presente nel Plan.'), tipDown: t('Quando piove il tuo umore scende: pianifica per quei giorni qualcosa che ti piace al chiuso e un contatto con una persona cara.') },
  { id: 'sun', label: t('Sole'), get: (d) => d.sun, a: { label: t('giorni di sole (6 ore o più)'), test: (v) => v >= 6 }, b: { label: t('giorni grigi (3 ore o meno)'), test: (v) => v <= 3 }, tipUp: t('Il sole ti fa bene: nei giorni grigi esci comunque 15 minuti all’aperto nelle ore più chiare.'), tipDown: t('Il sole non sembra aiutarti: non serve forzare la luce, guarda gli altri fattori.') },
  { id: 'events', label: t('Impegni'), get: (d) => d.events, a: { label: t('giornate piene (4 impegni o più)'), test: (v) => v >= 4 }, b: { label: t('giornate leggere (1 impegno o meno)'), test: (v) => v <= 1 }, tipUp: t('Le giornate piene ti danno energia: puoi permettertele.'), tipDown: t('Le giornate molto piene abbassano il tuo umore: lascia dei buchi nel Plan e non superare 3–4 impegni al giorno.') },
  { id: 'sleep', label: t('Sonno'), get: (d) => d.sleep, a: { label: t('notti da 7,5 ore o più'), test: (v) => v >= 7.5 }, b: { label: t('notti sotto le 7 ore'), test: (v) => v < 7 }, tipUp: t('Quando dormi bene il tuo umore è migliore: proteggi l’orario di letto, è la leva più efficace.'), tipDown: t('Il sonno lungo non migliora il tuo umore: guarda la regolarità degli orari.') },
  { id: 'steps', label: t('Passi'), get: (d) => d.steps, a: { label: t('giorni con 8’000 passi o più'), test: (v) => v >= 8000 }, b: { label: t('giorni con meno di 5’000 passi'), test: (v) => v < 5000 }, tipUp: t('Muoverti alza il tuo umore: nei giorni difficili inizia da una camminata di 15 minuti.'), tipDown: t('I passi non sembrano influire sul tuo umore.') },
  { id: 'exercise', label: t('Allenamento'), get: (d) => d.exercise, a: { label: t('giorni con almeno 20 minuti di esercizio'), test: (v) => v >= 20 }, b: { label: t('giorni senza esercizio'), test: (v) => v < 5 }, tipUp: t('L’esercizio ti fa stare meglio: fissalo nel Plan come un impegno vero.'), tipDown: t('L’esercizio non sembra cambiare il tuo umore del giorno.') },
  { id: 'mindful', label: t('Mindfulness'), get: (d) => d.mindful, a: { label: t('giorni con mindfulness (5 minuti o più)'), test: (v) => v >= 5 }, b: { label: t('giorni senza'), test: (v) => v < 1 }, tipUp: t('La mindfulness ti aiuta: tienila come abitudine quotidiana.'), tipDown: t('La mindfulness non sembra incidere sul tuo umore.') },
  { id: 'spend', label: t('Spese'), get: (d) => d.spend, a: { label: t('giorni di spesa alta'), test: () => false }, b: { label: t('giorni di spesa bassa'), test: () => false }, tipUp: t('Nei giorni di spesa alta stai meglio: probabilmente sono giorni sociali.'), tipDown: t('Nei giorni di spesa alta il tuo umore scende: può essere shopping d’impulso. Aspetta 24 ore prima degli acquisti non necessari.') },
  { id: 'weekend', label: t('Weekend'), get: (d) => (d.weekday === 0 || d.weekday === 6 ? 1 : 0), a: { label: t('weekend'), test: (v) => v === 1 }, b: { label: t('giorni lavorativi'), test: (v) => v === 0 }, tipUp: t('Il weekend ti ricarica: lascia davvero libera quella parte della settimana.'), tipDown: t('Il weekend abbassa il tuo umore: pianifica qualcosa di piacevole anche nei giorni liberi.') },
];


/** Divide i giorni nei due gruppi da confrontare per un fattore (null se i dati non bastano). */
function groupsFor(def: Def, days: DayCtx[]): [DayCtx[], DayCtx[]] | null {
  if (def.id === 'spend') {
    const vals = days.map((d) => def.get(d)).filter((v): v is number => v != null).sort((x, y) => x - y);
    if (vals.length < 15) return null;
    const lo = vals[Math.floor(vals.length / 3)], hi = vals[Math.floor((vals.length * 2) / 3)];
    if (hi <= lo) return null;
    return [days.filter((d) => (def.get(d) ?? -1) >= hi && (def.get(d) ?? 0) > 0), days.filter((d) => def.get(d) != null && (def.get(d) as number) <= lo)];
  }
  return [
    days.filter((d) => { const v = def.get(d); return v != null && def.a.test(v); }),
    days.filter((d) => { const v = def.get(d); return v != null && def.b.test(v); }),
  ];
}

/* ---------- conferma nel tempo ---------- */
export type Confirmation = {
  status: 'confermata' | 'incerta' | 'non si ripete';
  /** differenza di umore (gruppo a meno gruppo b) nella prima e nella seconda metà dei dati; null se la metà non ha abbastanza giorni */
  first: number | null; second: number | null; nFirst: number; nSecond: number;
  text: string;
};
const MIN_HALF_GROUP = 3;
const SHOW = (v: number | null) => (v == null ? t('dati insufficienti') : `${v > 0 ? '+' : ''}${fmt(v)}`);

/** Giudica se un legame si ripete: stesso confronto sulla prima e sulla seconda metà cronologica dei dati. */
export function confirmationOf(first: number | null, second: number | null, nFirst: number, nSecond: number, minEffect = 0.25): Confirmation {
  const mk = (status: Confirmation['status'], text: string): Confirmation => ({ status, first, second, nFirst, nSecond, text });
  if (first == null || second == null) return mk('incerta', t('Troppo pochi giorni in una delle due metà per sapere se si ripete.'));
  const sameSign = Math.sign(first) === Math.sign(second);
  if (sameSign && Math.abs(first) >= minEffect && Math.abs(second) >= minEffect) return mk('confermata', t('Si ripete in entrambe le metà del periodo ({0} e {1}).', SHOW(first), SHOW(second)));
  if (!sameSign && Math.max(Math.abs(first), Math.abs(second)) >= minEffect && Math.min(Math.abs(first), Math.abs(second)) >= minEffect * 0.5) return mk('non si ripete', t('Nelle due metà del periodo va in direzioni opposte ({0} e {1}): probabilmente è un caso.', SHOW(first), SHOW(second)));
  if (Math.min(Math.abs(first), Math.abs(second)) < minEffect * 0.5 && Math.max(Math.abs(first), Math.abs(second)) >= minEffect) return mk('non si ripete', t('C’è in una sola metà del periodo ({0} e {1}): non si ripete.', SHOW(first), SHOW(second)));
  return mk('incerta', t('Differenza piccola in almeno una metà ({0} e {1}): servono più giorni.', SHOW(first), SHOW(second)));
}

/** Per un fattore dell'umore: confronta prima e seconda metà dei giorni (ordinati per data). */
export function confirmFactor(days: DayCtx[], factorId: string): Confirmation {
  const def = getDefs().find((d) => d.id === factorId);
  const sorted = days.slice().sort((a, b) => a.day.localeCompare(b.day));
  const h = Math.floor(sorted.length / 2);
  const halves = [sorted.slice(0, h), sorted.slice(h)];
  const diffs = halves.map((half) => {
    if (!def) return { d: null as number | null, n: half.length };
    const g = groupsFor(def, half);
    if (!g || g[0].length < MIN_HALF_GROUP || g[1].length < MIN_HALF_GROUP) return { d: null, n: half.length };
    return { d: mean(g[0].map((x) => x.mood)) - mean(g[1].map((x) => x.mood)), n: half.length };
  });
  return confirmationOf(diffs[0].d, diffs[1].d, diffs[0].n, diffs[1].n);
}

const strengthOf = (d: number): Factor['strength'] => (Math.abs(d) >= 0.8 ? 'forte' : Math.abs(d) >= 0.5 ? 'media' : 'lieve');

/** Soglia più severa quando si fanno molti confronti (correzione approssimata). */
const T_MIN = 2.4;

export function analyseMood(days: DayCtx[]): MoodReport {
  const n = days.length;
  const m = n ? mean(days.map((d) => d.mood)) : 0;
  const confidence: MoodReport['confidence'] = n < 14 ? 'insufficiente' : n < 30 ? 'bassa' : n < 60 ? 'media' : 'alta';
  const factors: Factor[] = [];
  if (n >= 14) {
    getDefs().forEach((def) => {
      const g = groupsFor(def, days);
      if (!g) return;
      const [A, B] = g;
      if (A.length < 5 || B.length < 5) return;
      const diff = mean(A.map((d) => d.mood)) - mean(B.map((d) => d.mood));
      const tv = welch(A.map((d) => d.mood), B.map((d) => d.mood));
      const sig = Math.abs(tv) >= T_MIN && Math.abs(diff) >= 0.3;
      const a: Group = { label: def.a.label, mean: mean(A.map((d) => d.mood)), n: A.length };
      const b: Group = { label: def.b.label, mean: mean(B.map((d) => d.mood)), n: B.length };
      factors.push({
        id: def.id, label: def.label, a, b, diff, t: tv, sig, strength: strengthOf(diff),
        sentence: t('Nei {0} il tuo umore è in media {1} su 5, contro {2} nei {3} ({4}), su {5} e {6} giorni.', a.label, fmt(a.mean), fmt(b.mean), b.label, sgn(diff), a.n, b.n),
        tip: diff > 0 ? def.tipUp : def.tipDown,
        confirmation: confirmFactor(days, def.id),
      });
    });
  }
  factors.sort((x, y) => Number(y.sig) - Number(x.sig) || Math.abs(y.t) - Math.abs(x.t));
  // giorno della settimana
  const byDay: Group[] = [];
  const names = [t('domenica'), t('lunedì'), t('martedì'), t('mercoledì'), t('giovedì'), t('venerdì'), t('sabato')];
  for (let w = 0; w < 7; w++) { const v = days.filter((d) => d.weekday === w); if (v.length >= 4) byDay.push({ label: names[w], mean: mean(v.map((d) => d.mood)), n: v.length }); }
  byDay.sort((x, y) => y.mean - x.mean);
  return { n, mean: m, best: byDay[0] ?? null, worst: byDay.length > 1 ? byDay[byDay.length - 1] : null, factors, confidence };
}
