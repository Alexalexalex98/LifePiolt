/**
 * Analisi dell'umore rispetto al resto della vita: meteo, impegni, sonno, movimento, stress, spese...
 * Modulo PURO e testabile. Confronta l'umore medio tra gruppi di giorni (es. pioggia vs asciutto) con un test t di Welch
 * e segnala un legame solo se campione e differenza sono sufficienti. Indica un'associazione, MAI una causa.
 */
export type DayCtx = {
  day: string; mood: number; weekday: number;
  rain?: number; tmax?: number; sun?: number; events?: number; sleep?: number; steps?: number;
  stress?: number; exercise?: number; spend?: number; mindful?: number;
};

export type Group = { label: string; mean: number; n: number };
export type Factor = {
  id: string; label: string; a: Group; b: Group; diff: number; t: number; sig: boolean;
  strength: 'forte' | 'media' | 'lieve'; sentence: string; tip: string;
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

const defs: Def[] = [
  { id: 'rain', label: 'Pioggia', get: (d) => d.rain, a: { label: 'giorni di pioggia', test: (v) => v >= 1 }, b: { label: 'giorni asciutti', test: (v) => v < 0.2 }, tipUp: 'Nei giorni di pioggia sembra farti bene: tienila presente nel Plan.', tipDown: 'Quando piove il tuo umore scende: pianifica per quei giorni qualcosa che ti piace al chiuso e un contatto con una persona cara.' },
  { id: 'sun', label: 'Sole', get: (d) => d.sun, a: { label: 'giorni di sole (6 ore o più)', test: (v) => v >= 6 }, b: { label: 'giorni grigi (3 ore o meno)', test: (v) => v <= 3 }, tipUp: 'Il sole ti fa bene: nei giorni grigi esci comunque 15 minuti all’aperto nelle ore più chiare.', tipDown: 'Il sole non sembra aiutarti: non serve forzare la luce, guarda gli altri fattori.' },
  { id: 'events', label: 'Impegni', get: (d) => d.events, a: { label: 'giornate piene (4 impegni o più)', test: (v) => v >= 4 }, b: { label: 'giornate leggere (1 impegno o meno)', test: (v) => v <= 1 }, tipUp: 'Le giornate piene ti danno energia: puoi permettertele.', tipDown: 'Le giornate molto piene abbassano il tuo umore: lascia dei buchi nel Plan e non superare 3–4 impegni al giorno.' },
  { id: 'sleep', label: 'Sonno', get: (d) => d.sleep, a: { label: 'notti da 7,5 ore o più', test: (v) => v >= 7.5 }, b: { label: 'notti sotto le 7 ore', test: (v) => v < 7 }, tipUp: 'Quando dormi bene il tuo umore è migliore: proteggi l’orario di letto, è la leva più efficace.', tipDown: 'Il sonno lungo non migliora il tuo umore: guarda la regolarità degli orari.' },
  { id: 'steps', label: 'Passi', get: (d) => d.steps, a: { label: 'giorni con 8’000 passi o più', test: (v) => v >= 8000 }, b: { label: 'giorni con meno di 5’000 passi', test: (v) => v < 5000 }, tipUp: 'Muoverti alza il tuo umore: nei giorni difficili inizia da una camminata di 15 minuti.', tipDown: 'I passi non sembrano influire sul tuo umore.' },
  { id: 'exercise', label: 'Allenamento', get: (d) => d.exercise, a: { label: 'giorni con almeno 20 minuti di esercizio', test: (v) => v >= 20 }, b: { label: 'giorni senza esercizio', test: (v) => v < 5 }, tipUp: 'L’esercizio ti fa stare meglio: fissalo nel Plan come un impegno vero.', tipDown: 'L’esercizio non sembra cambiare il tuo umore del giorno.' },
  { id: 'mindful', label: 'Mindfulness', get: (d) => d.mindful, a: { label: 'giorni con mindfulness (5 minuti o più)', test: (v) => v >= 5 }, b: { label: 'giorni senza', test: (v) => v < 1 }, tipUp: 'La mindfulness ti aiuta: tienila come abitudine quotidiana.', tipDown: 'La mindfulness non sembra incidere sul tuo umore.' },
  { id: 'spend', label: 'Spese', get: (d) => d.spend, a: { label: 'giorni di spesa alta', test: () => false }, b: { label: 'giorni di spesa bassa', test: () => false }, tipUp: 'Nei giorni di spesa alta stai meglio: probabilmente sono giorni sociali.', tipDown: 'Nei giorni di spesa alta il tuo umore scende: può essere shopping d’impulso. Aspetta 24 ore prima degli acquisti non necessari.' },
  { id: 'weekend', label: 'Weekend', get: (d) => (d.weekday === 0 || d.weekday === 6 ? 1 : 0), a: { label: 'weekend', test: (v) => v === 1 }, b: { label: 'giorni lavorativi', test: (v) => v === 0 }, tipUp: 'Il weekend ti ricarica: lascia davvero libera quella parte della settimana.', tipDown: 'Il weekend abbassa il tuo umore: pianifica qualcosa di piacevole anche nei giorni liberi.' },
];

const strengthOf = (d: number): Factor['strength'] => (Math.abs(d) >= 0.8 ? 'forte' : Math.abs(d) >= 0.5 ? 'media' : 'lieve');

/** Soglia più severa quando si fanno molti confronti (correzione approssimata). */
const T_MIN = 2.4;

export function analyseMood(days: DayCtx[]): MoodReport {
  const n = days.length;
  const m = n ? mean(days.map((d) => d.mood)) : 0;
  const confidence: MoodReport['confidence'] = n < 14 ? 'insufficiente' : n < 30 ? 'bassa' : n < 60 ? 'media' : 'alta';
  const factors: Factor[] = [];
  if (n >= 14) {
    defs.forEach((def) => {
      let A: DayCtx[], B: DayCtx[];
      if (def.id === 'spend') {
        const vals = days.map((d) => def.get(d)).filter((v): v is number => v != null).sort((x, y) => x - y);
        if (vals.length < 15) return;
        const lo = vals[Math.floor(vals.length / 3)], hi = vals[Math.floor((vals.length * 2) / 3)];
        if (hi <= lo) return;
        A = days.filter((d) => (def.get(d) ?? -1) >= hi && (def.get(d) ?? 0) > 0);
        B = days.filter((d) => def.get(d) != null && (def.get(d) as number) <= lo);
      } else {
        A = days.filter((d) => { const v = def.get(d); return v != null && def.a.test(v); });
        B = days.filter((d) => { const v = def.get(d); return v != null && def.b.test(v); });
      }
      if (A.length < 5 || B.length < 5) return;
      const diff = mean(A.map((d) => d.mood)) - mean(B.map((d) => d.mood));
      const t = welch(A.map((d) => d.mood), B.map((d) => d.mood));
      const sig = Math.abs(t) >= T_MIN && Math.abs(diff) >= 0.3;
      const a: Group = { label: def.a.label, mean: mean(A.map((d) => d.mood)), n: A.length };
      const b: Group = { label: def.b.label, mean: mean(B.map((d) => d.mood)), n: B.length };
      factors.push({
        id: def.id, label: def.label, a, b, diff, t, sig, strength: strengthOf(diff),
        sentence: `Nei ${a.label} il tuo umore è in media ${fmt(a.mean)} su 5, contro ${fmt(b.mean)} nei ${b.label} (${sgn(diff)}), su ${a.n} e ${b.n} giorni.`,
        tip: diff > 0 ? def.tipUp : def.tipDown,
      });
    });
  }
  factors.sort((x, y) => Number(y.sig) - Number(x.sig) || Math.abs(y.t) - Math.abs(x.t));
  // giorno della settimana
  const byDay: Group[] = [];
  const names = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  for (let w = 0; w < 7; w++) { const v = days.filter((d) => d.weekday === w); if (v.length >= 4) byDay.push({ label: names[w], mean: mean(v.map((d) => d.mood)), n: v.length }); }
  byDay.sort((x, y) => y.mean - x.mean);
  return { n, mean: m, best: byDay[0] ?? null, worst: byDay.length > 1 ? byDay[byDay.length - 1] : null, factors, confidence };
}
