/** Piani scritti da Theia (alimentare e allenamento): si tolgono dalla risposta, si controllano, si salvano e si consegnano in chat come file. */
import { t } from '@/i18n/core';
import { go } from '@/lib/nav';
import { extractMealPlan, mergePlan, parseAiPlan } from '@/lib/fitness/aiPlan';
import { extractWorkout, parseAiWorkout } from '@/lib/fitness/aiWorkout';
import { dayKcal } from '@/lib/fitness/mealPlan';
import { useFitness } from '@/store/fitness';
import { usePantry } from '@/store/pantry';
import type { TheiaAction, TheiaExt } from './theiaExt';

export type HeldPlans = { text: string; meal: unknown | null; mealBroken: boolean; workout: unknown | null; workoutBroken: boolean };
type Push = (text: string, extra?: { ext?: TheiaExt }) => unknown;

const BLOCK = /\[\[\s*(?:PIANO|ALLENAMENTO)\b[\s\S]*?\}\s*\]\]/gi;
/** Toglie i blocchi dei piani dal testo (vanno protetti dal ripulire/tradurre) e li legge. */
export function takePlans(reply: string): HeldPlans {
  const m = extractMealPlan(reply); const w = extractWorkout(m.text);
  return { text: w.text, meal: m.json, mealBroken: m.broken, workout: w.json, workoutBroken: w.broken };
}
/** Separa i blocchi grezzi dal testo, per ripulire solo il testo e rimetterli dopo. */
export function holdBlocks(raw: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = raw.replace(BLOCK, (b) => { blocks.push(b); return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  return { text, blocks };
}
export const releaseBlocks = (text: string, blocks: string[]): string => (blocks.length ? `${text}\n${blocks.join('\n')}` : text);

const WD = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const retry = (what: string, text: string): TheiaAction[] => [{ kind: 'say', label: t('Riprova'), text }, { kind: 'dismiss', label: what }];

/** Salva e consegna i piani trovati nella risposta. */
export function deliverPlans(h: HeldPlans, push: Push): void {
  if (h.meal || h.mealBroken) deliverMeal(h.meal, push);
  if (h.workout || h.workoutBroken) deliverWorkout(h.workout, push);
}

export type MealApplied = { ok: false } | { ok: true; days: number[]; avg: number; had: boolean; title: string; skipped: number };
/** Imposta il piano alimentare nella sezione. `replaceAll` = un piano intero sostituisce quello di prima (PDF del nutrizionista). */
export function applyMealPlan(json: unknown, by: 'theia' | 'nutrizionista', replaceAll = false): MealApplied {
  const r = json ? parseAiPlan(json) : null;
  if (!r || !r.days.size) return { ok: false };
  const fit = useFitness.getState(); const pantry = usePantry.getState();
  if (r.custom.length) fit.set({ aiFoods: [...r.custom, ...fit.aiFoods.filter((f) => !r.custom.some((c) => c.id === f.id))].slice(0, 300) });
  const had = !replaceAll && !!pantry.plan && r.days.size < 7;
  const merged = mergePlan(replaceAll ? null : pantry.plan, r.days);
  pantry.setPlan(merged);
  if (r.meta.kcal) pantry.setPrefs({ kcal: r.meta.kcal, kcalOverride: r.meta.kcal });
  const prev = pantry.planMeta;
  const title = r.meta.title ?? (replaceAll ? undefined : prev?.title) ?? (by === 'nutrizionista' ? t('Piano del nutrizionista') : t('Il tuo piano alimentare'));
  pantry.setPlanMeta({ title, notes: r.meta.notes ?? (replaceAll ? undefined : prev?.notes), by, at: Date.now() });
  const avg = Math.round(merged.reduce((s, d) => s + dayKcal(d), 0) / Math.max(1, merged.filter((d) => d.length).length));
  return { ok: true, days: [...r.days.keys()].sort((a, b) => a - b), avg, had, title, skipped: r.warnings.length };
}

function deliverMeal(json: unknown, push: Push) {
  const r = applyMealPlan(json, 'theia');
  if (!r.ok) { push(t('Non sono riuscita a scrivere il piano nel formato giusto. Dimmi di rifarlo e lo riscrivo.'), { ext: { actions: retry(t('Ok'), 'rifai il piano alimentare') } }); return; }
  const changed = r.days.map((i) => WD[i]).join(', ');
  /* il piano lo scrive Theia direttamente nella sezione: in chat solo una conferma breve; un piano nuovo si apre da solo */
  push(r.had ? t('Fatto, ho cambiato il piano nella sezione: {0}.', changed) : t('Ho impostato il tuo piano alimentare nella sezione Piano alimentare: 7 giorni, circa {0} kcal al giorno. Se qualcosa non ti piace dimmelo qui e lo cambio direttamente lì.', r.avg), {
    ext: { actions: [{ kind: 'open', label: t('Apri il piano'), page: 'fitnessMealPlan' }, { kind: 'say', label: t('Lista della spesa'), text: 'preparami la lista della spesa del piano' }] },
  });
  if (!r.had) go('fitnessMealPlan');
}

function deliverWorkout(json: unknown, push: Push) {
  const fit = useFitness.getState();
  const r = json ? parseAiWorkout(json, fit.customEx) : null;
  if (!r || !r.program) { push(t('Non sono riuscita a scrivere il programma nel formato giusto. Dimmi di rifarlo e lo riscrivo.'), { ext: { actions: retry(t('Ok'), 'rifai il programma di allenamento') } }); return; }
  const existing = fit.aiPrograms[0];
  const update = !!existing && !r.fresh;
  const program = update ? { ...r.program, id: existing.id } : r.program;
  r.custom.forEach((e) => fit.addCustomEx(e));
  fit.set({ aiPrograms: [program, ...fit.aiPrograms.filter((p) => p.id !== program.id)].slice(0, 20), activeProgram: program.id });
  push(update ? t('Fatto, ho cambiato il programma nella sezione.') : t('Ho impostato il tuo programma di allenamento nella sezione Programmi: {0} sessioni, {1} giorni a settimana. Se qualcosa non va dimmelo qui e lo cambio direttamente lì.', program.sessions.length, program.days), {
    ext: { actions: [{ kind: 'open', label: t('Apri il programma'), page: 'fitnessProgram', params: { id: program.id } }] },
  });
  if (!update) go('fitnessProgram', { id: program.id });
}
