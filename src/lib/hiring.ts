/**
 * Motore di selezione per competenze (LifeNetwork Lavoro). Modulo PURO, testabile.
 *
 * Cosa fa: corregge i test, calcola punteggio per competenza, tratti di atteggiamento e coerenza,
 * l'indice di affidabilità (da segnali verificabili nella rete) e l'adeguatezza a un ruolo.
 *
 * Cosa NON fa: non misura "che persona sei" in modo scientifico. I tratti vengono da risposte
 * a scenari (auto-dichiarati) e l'affidabilità dai segnali che la rete conosce; l'indice mostra
 * sempre da quali dati nasce e quanto è affidabile. Decide sempre una persona.
 */
import type { Question, Trait } from '../data/skillBank';

export type Answer = { qid: string; value: number | string | null; ms: number };
export type TestResult = {
  skillScores: Record<string, number | null>;
  traits: Partial<Record<Trait, number>>;
  consistency: number | null;
  pending: string[];
  answered: number;
  total: number;
  timeMs: number;
  flags: string[];
};

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** 0..100, oppure null se serve la valutazione di una persona (domanda aperta). */
export function gradeAnswer(q: Question, a: Answer | undefined, openScore?: number): number | null {
  if (q.kind === 'open') return openScore == null ? null : clamp(openScore);
  if (!a || a.value == null || a.value === '') return 0;
  if (q.kind === 'number') {
    const v = typeof a.value === 'number' ? a.value : Number(String(a.value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(v) || q.answer == null) return 0;
    const err = Math.abs(v - q.answer) / Math.max(Math.abs(q.answer), 1e-9);
    return err <= (q.tol ?? 0.01) ? 100 : 0;
  }
  const idx = Number(a.value);
  return q.options?.[idx]?.score ?? 0;
}

export function gradeTest(questions: Question[], answers: Answer[], openScores: Record<string, number> = {}): TestResult {
  const bySkill: Record<string, number[]> = {};
  const traitScores: Partial<Record<Trait, number[]>> = {};
  const pending: string[] = [];
  let answered = 0, timeMs = 0;
  questions.forEach((q) => {
    const a = answers.find((x) => x.qid === q.id);
    if (a && a.value != null && a.value !== '') answered++;
    if (a) timeMs += a.ms;
    const g = gradeAnswer(q, a, openScores[q.id]);
    if (g == null) { if (a && a.value) pending.push(q.id); else (bySkill[q.skill] ??= []).push(0); return; }
    (bySkill[q.skill] ??= []).push(g);
    if (q.trait) (traitScores[q.trait] ??= []).push(g);
  });
  const skillScores: Record<string, number | null> = {};
  questions.forEach((q) => { if (!(q.skill in skillScores)) skillScores[q.skill] = bySkill[q.skill]?.length ? Math.round(mean(bySkill[q.skill])) : null; });
  delete skillScores.atteggiamento;

  const traits: TestResult['traits'] = {};
  (Object.keys(traitScores) as Trait[]).forEach((t) => { traits[t] = Math.round(mean(traitScores[t]!)); });
  // coerenza: stessa qualità di risposta nelle domande dello stesso tratto
  const sds = (Object.values(traitScores) as number[][]).filter((v) => v.length >= 2).map((v) => std(v));
  const consistency = sds.length ? Math.round(clamp(100 - mean(sds) * 1.6)) : null;

  const flags: string[] = [];
  const asked = answers.filter((a) => a.value != null && a.value !== '');
  if (asked.length >= 5 && mean(asked.map((a) => a.ms)) < 2500) flags.push('Risposte molto veloci: il risultato potrebbe non riflettere un ragionamento attento.');
  if (answered < questions.length) flags.push(`${questions.length - answered} domande senza risposta.`);
  return { skillScores, traits, consistency, pending, answered, total: questions.length, timeMs, flags };
}

/* ---------- affidabilità ---------- */
export type TrustInput = {
  ratingSum: number; ratingCount: number; receivedLP: number; reports: number; identityVerified: boolean | null;
  traitScores: Partial<Record<Trait, number>>; consistency: number | null; streak: number;
};
export type TrustComponent = { id: string; label: string; weight: number; value: number | null; note: string };
export type Trust = { score: number | null; confidence: 'alta' | 'media' | 'bassa' | 'nessuna'; components: TrustComponent[]; penalty: number };

/** Media dei voti 1-5 "ammorbidita" verso 3.5 quando i voti sono pochi (5 voti di prior). */
export const shrunkRating = (sum: number, n: number) => (sum + 3.5 * 5) / (n + 5);

export function computeTrust(i: TrustInput): Trust {
  const tv = [i.traitScores.affidabilita, i.traitScores.onesta].filter((x): x is number => x != null);
  const comps: TrustComponent[] = [
    { id: 'voti', label: 'Voti ricevuti dalla community', weight: 35, value: i.ratingCount ? Math.round(((shrunkRating(i.ratingSum, i.ratingCount) - 1) / 4) * 100) : null, note: i.ratingCount ? `${(i.ratingSum / i.ratingCount).toFixed(1)}/5 su ${i.ratingCount} voti (pochi voti pesano meno)` : 'Nessun voto ricevuto' },
    { id: 'lp', label: 'Fiducia espressa con LifePoints', weight: 15, value: i.receivedLP > 0 ? Math.round(clamp(25 * Math.log10(1 + i.receivedLP / 10))) : null, note: i.receivedLP > 0 ? `${Math.round(i.receivedLP)} LP ricevuti` : 'Nessun LifePoint ricevuto' },
    { id: 'test', label: 'Affidabilità e onestà nei test', weight: 25, value: tv.length ? Math.round(mean(tv)) : null, note: tv.length ? 'Da risposte a scenari (auto-dichiarate)' : 'Nessun test di atteggiamento svolto' },
    { id: 'coerenza', label: 'Coerenza delle risposte', weight: 10, value: i.consistency, note: i.consistency == null ? 'Non ancora misurabile' : 'Risposte non contraddittorie' },
    { id: 'identita', label: 'Identità verificata', weight: 10, value: i.identityVerified == null ? null : i.identityVerified ? 100 : 0, note: i.identityVerified == null ? 'Dato non disponibile' : i.identityVerified ? 'Verificata' : 'Non verificata' },
    { id: 'costanza', label: 'Costanza nella rete', weight: 5, value: i.streak > 0 ? Math.round(clamp((i.streak / 7) * 100)) : null, note: i.streak > 0 ? `${i.streak} giorni consecutivi di attività` : 'Nessuna serie attiva' },
  ];
  const have = comps.filter((c) => c.value != null && c.id !== 'identita');
  const penalty = clamp(i.reports * 15, 0, 60);
  const w = comps.filter((c) => c.value != null).reduce((s, c) => s + c.weight, 0);
  const base = w ? comps.reduce((s, c) => s + (c.value != null ? c.value * c.weight : 0), 0) / w : null;
  const confidence: Trust['confidence'] = have.length >= 4 ? 'alta' : have.length >= 2 ? 'media' : have.length >= 1 ? 'bassa' : 'nessuna';
  return { score: base == null || confidence === 'nessuna' ? null : Math.round(clamp(base - penalty)), confidence, components: comps, penalty };
}

/* ---------- adeguatezza al ruolo ---------- */
export type SkillReq = { skill: string; weight: number; min: number };
export type Fit = { skillFit: number; overall: number; unmet: { skill: string; have: number | null; min: number }[]; missing: string[] };

export function computeFit(reqs: SkillReq[], scores: Record<string, number | null>, trust: number | null, trustWeight = 0.2): Fit {
  const totalW = reqs.reduce((s, r) => s + r.weight, 0) || 1;
  const skillFit = Math.round(reqs.reduce((s, r) => s + r.weight * (scores[r.skill] ?? 0), 0) / totalW);
  const unmet = reqs.filter((r) => (scores[r.skill] ?? 0) < r.min).map((r) => ({ skill: r.skill, have: scores[r.skill] ?? null, min: r.min }));
  const missing = reqs.filter((r) => scores[r.skill] == null).map((r) => r.skill);
  const overall = Math.round(trust == null ? skillFit : (1 - trustWeight) * skillFit + trustWeight * trust);
  return { skillFit, overall, unmet, missing };
}

export const levelOf = (v: number | null) => (v == null ? '—' : v >= 85 ? 'Eccellente' : v >= 70 ? 'Solido' : v >= 50 ? 'Base' : 'Da sviluppare');

/** Sceglie `n` domande per competenza in modo ripetibile (seed) senza ripetizioni. */
export function pickQuestions(pool: Question[], skills: string[], perSkill: number, seed = 1): Question[] {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out: Question[] = [];
  skills.forEach((sk) => {
    const list = pool.filter((q) => q.skill === sk).map((q) => ({ q, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, perSkill).map((x) => x.q);
    out.push(...list);
  });
  return out;
}
