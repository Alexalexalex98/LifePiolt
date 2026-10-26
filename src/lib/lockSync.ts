import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { programById } from '@/lib/fitness/programsExtra';
import { weekView } from '@/lib/fitness/plan';
import { activeShift, lockItems, lockTimeline, type LockSources } from '@/lib/lockScreen';
import { useFitness } from '@/store/fitness';
import { useLife } from '@/store/life';
import { useLockScreen } from '@/store/lockScreen';
import { useShifts } from '@/store/shifts';

/** I widget e le Live Activity sono nativi: in Expo Go e sul web non ci sono. Ogni errore qui resta silenzioso, l'app funziona lo stesso. */
type Mod = typeof import('@/widgets/now');
let mod: Mod | null | undefined;
const widgets = (): Mod | null => {
  if (mod !== undefined) return mod;
  if (Platform.OS !== 'ios') return (mod = null);
  /* senza il modulo nativo (build vecchia) non si prova nemmeno a caricarlo */
  if (!requireOptionalNativeModule('ExpoWidgets')) return (mod = null);
  try { mod = require('@/widgets/now') as Mod; } catch { mod = null; }
  return mod;
};

function sources(now: number): LockSources {
  const fit = useFitness.getState();
  const key = dayOf(now);
  let workout: LockSources['workout'] = null;
  try {
    const active = fit.activeProgram ? programById(fit.activeProgram) : null;
    const day = active && fit.profile ? weekView(active, fit.profile, fit.history, new Date(now)).find((d) => d.date === key) : null;
    if (active && day?.planned && day.session != null) workout = { name: active.sessions[day.session].name, done: day.done };
  } catch { /* nessun piano */ }
  const life = useLife.getState();
  return { shifts: useShifts.getState().shifts, events: life.events, tasks: life.tasks, waterMl: (fit.water ?? {})[key] ?? 0, waterGoalMl: waterGoal(fit.body?.weightKg), workout };
}

let lastJson = '';
let live: { key: string; end: () => Promise<void> } | null = null;

/** Riscrive ciò che si vede sul blocco schermo: il widget (con le prossime ore già pronte) e la Live Activity del turno in corso. */
export async function syncLockScreen(): Promise<void> {
  const w = widgets();
  if (!w) return;
  try {
    const now = Date.now();
    const prefs = useLockScreen.getState();
    const src = sources(now);
    if (!prefs.on) {
      w.NowWidget.updateSnapshot({ updatedAt: now, items: [] });
      if (live) { await live.end(); live = null; }
      return;
    }
    const p = { cats: prefs.cats, hideTitles: prefs.hideTitles };
    const tl = lockTimeline(src, p, now);
    const json = JSON.stringify(tl.map((e, i) => [i ? e.at : 0, e.data.items]));
    if (json !== lastJson) { lastJson = json; w.NowWidget.updateTimeline(tl.map((e) => ({ date: new Date(e.at), props: e.data }))); }
    /* la Live Activity parte solo se i turni sono attivi e un turno è in corso o inizia a breve */
    const shift = prefs.cats.turni ? activeShift(src.shifts, now) : null;
    if (!shift) { if (live) { await live.end(); live = null; } return; }
    const key = `${shift.shift.id}:${shift.startTs}`;
    if (live?.key === key) return;
    if (live) { await live.end(); live = null; }
    for (const i of w.ShiftLive.getInstances()) await i.end('immediate');
    const act = w.ShiftLive.start({ name: prefs.hideTitles ? 'Turno di lavoro' : shift.shift.name, startTs: shift.startTs, endTs: shift.endTs, color: shift.shift.color ?? '#8fb3ff' }, 'lifepilot://shifts', new Date(shift.endTs));
    live = { key, end: () => act.end({ after: new Date(shift.endTs + 60000) } as never) };
  } catch { /* widget non disponibili in questa versione dell'app */ }
}

/** Aggiorna all'avvio e ogni volta che cambia qualcosa che compare sul blocco schermo. */
export function startLockScreenSync(): () => void {
  if (Platform.OS !== 'ios') return () => {};
  let t: ReturnType<typeof setTimeout> | undefined;
  const later = () => { clearTimeout(t); t = setTimeout(() => { void syncLockScreen(); }, 1500); };
  later();
  const un = [useShifts.subscribe(later), useLife.subscribe(later), useLockScreen.subscribe(later), useFitness.subscribe(later)];
  return () => { clearTimeout(t); un.forEach((u) => u()); };
}

export const previewItems = () => { const p = useLockScreen.getState(); return lockItems(sources(Date.now()), { cats: p.cats, hideTitles: p.hideTitles }, Date.now()); };
