/** La biblioteca completa di esercizi (quelli originali + i nuovi), con categoria e livello, e il copione per ascoltarli con la voce. Modulo PURO. */
import { EXERCISES, type Exercise } from './mindExercises.ts';
import { SCRIPTS } from './mindScripts.ts';
import { CATS, LEVEL_LABEL, META as MORE_META, MORE, type Cat, type Level, type Meta } from './mindExercisesMore.ts';

export { CATS, LEVEL_LABEL };
export type { Cat, Level };

const ORIGINAL_META: Record<string, Meta> = {
  name: { cat: 'emozioni', level: 'base' }, thought: { cat: 'mente', level: 'medio' }, breath: { cat: 'respiro', level: 'base' }, senses: { cat: 'ansia', level: 'base' },
  loop: { cat: 'mente', level: 'medio' }, step: { cat: 'stress', level: 'base' }, good: { cat: 'gratitudine', level: 'base' }, abc: { cat: 'mente', level: 'medio' },
  evidence: { cat: 'mente', level: 'avanzato' }, ladder: { cat: 'ansia', level: 'avanzato' }, schedule: { cat: 'stress', level: 'medio' }, rate: { cat: 'emozioni', level: 'base' },
};

export const ALL_EXERCISES: Exercise[] = [...EXERCISES, ...MORE];
export const metaOf = (id: string): Meta => MORE_META[id] ?? ORIGINAL_META[id] ?? { cat: 'mente', level: 'base' };
export const exerciseById = (id: string): Exercise | undefined => ALL_EXERCISES.find((e) => e.id === id);

export function filterExercises(o: { cat?: Cat | 'tutti'; level?: Level | 'tutti'; q?: string }): Exercise[] {
  const q = (o.q ?? '').trim().toLowerCase();
  return ALL_EXERCISES.filter((e) => {
    const m = metaOf(e.id);
    return (!o.cat || o.cat === 'tutti' || m.cat === o.cat) && (!o.level || o.level === 'tutti' || m.level === o.level) && (!q || e.title.toLowerCase().includes(q) || e.why.toLowerCase().includes(q));
  });
}

export type NarrationPart = { kind: 'say'; text: string } | { kind: 'pause'; ms: number };

const SPEAK_CPS = 14; // caratteri al secondo, a voce calma
/**
 * Il copione per ascoltare un esercizio: Theia legge i passi guidati e lascia pause lunghe perché la durata dichiarata sia vera.
 * I passi che chiedono di scrivere o scegliere non si leggono (si fanno con «Fai»), tranne i respiri, che hanno una pausa.
 */
export function narrationPlan(ex: Exercise, open?: string): NarrationPart[] {
  const script = SCRIPTS[ex.id];
  const guided = script ? script.map((prompt) => ({ kind: 'info' as const, prompt })) : ex.steps.filter((s) => s.kind === 'info' || s.kind === 'breath');
  const parts: NarrationPart[] = [];
  if (open) parts.push({ kind: 'say', text: open }, { kind: 'pause', ms: 3000 });
  const total = Math.max(20, ex.minutes * 60);
  const speaking = guided.reduce((a, s) => a + s.prompt.length / SPEAK_CPS, 0) + (ex.closing.length / SPEAK_CPS);
  const free = Math.max(guided.length * 4, total - speaking - 6);
  const weights = guided.map((s) => (s.kind === 'breath' ? 2.2 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  guided.forEach((s, i) => {
    parts.push({ kind: 'say', text: s.prompt });
    parts.push({ kind: 'pause', ms: Math.round(Math.min(150, (free * weights[i]!) / wsum) * 1000) });
  });
  parts.push({ kind: 'say', text: ex.closing });
  return parts;
}
