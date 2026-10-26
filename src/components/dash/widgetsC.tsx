import { useState } from 'react';

import { Tile } from '@/components/dash/Tile';
import type { WProps } from '@/components/dash/widgetsA';
import { shortcutW } from '@/components/dash/widgetsB';
import { WaterSheet } from '@/components/fitness/WaterSheet';
import { Mascot } from '@/components/mascot/Mascot';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { daysToNextPhotos } from '@/lib/fitness/bodyCheck';
import { dayInfo } from '@/lib/fitness/dayPlan';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTarget, sumMacros } from '@/lib/fitness/nutrition';
import { lowStock } from '@/lib/fitness/pantry';
import { programById } from '@/lib/fitness/programsExtra';
import { dayKey } from '@/lib/format';
import { go } from '@/lib/nav';
import { useBodyCheck } from '@/store/bodyCheck';
import { useFitness } from '@/store/fitness';
import { useLife } from '@/store/life';
import { usePantry } from '@/store/pantry';
import { View } from 'react-native';
import { Chrome } from '@/components/dash/Tile';

const base = (p: WProps) => ({ w: p.w, h: p.h, pw: p.pw, ph: p.ph });
const FIT = '#ff9d6e', FOOD = '#5fd39a', WATER = '#6aa8ff', MIND = '#c9b6ff', PLAN = '#8fb3ff';
const L = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/** Il recap fitness di oggi in un solo widget: allenamento, cibo e acqua, ognuno si tocca e apre la sua pagina. */
export function FitTodayW(p: WProps) {
  const fit = useFitness();
  const now = Date.now(), key = dayOf(now);
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const info = dayInfo(dayKey(), { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() });
  const prog = info.programId ? programById(info.programId) : null;
  const name = prog && info.session != null ? prog.sessions[info.session].name : null;
  const s = sumMacros(fit.meals.filter((m) => dayOf(m.ts) === key).map((m) => m.macros));
  const target = fit.body ? dailyTarget(fit.body) : null;
  const water = (fit.water ?? {})[key] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  return <Tile {...base(p)} icon="lifefitness" label={tl('Il tuo oggi')} color={FIT} value={info.done ? tl('Fatto') : name ? tl('Oggi') : tl('Riposo')} sub={`${s.kcal} kcal · ${L(water)}`}
    rows={[
      { label: tl('Allenamento'), value: info.done ? tl('Fatto') : name ?? tl('Riposo'), done: info.done, onPress: () => go('fitnessPlanDay', { date: key }) },
      { label: tl('Cibo'), value: target ? `${s.kcal} / ${target} kcal` : `${s.kcal} kcal`, color: FOOD, onPress: () => go('fitnessDay', { day: key }) },
      { label: tl('Acqua'), value: `${L(water)} / ${L(goal)}`, color: WATER, onPress: () => go('fitnessWater') },
    ]}
    progress={target ? s.kcal / target : undefined} onPress={() => go('lifefitness')} />;
}

/** Acqua: un tocco apre la scheda per segnare quanta ne hai bevuta (anche altre bevande). */
export function WaterQuickW(p: WProps) {
  const fit = useFitness();
  const [open, setOpen] = useState(false);
  const water = (fit.water ?? {})[dayOf(Date.now())] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  return (
    <>
      <Tile {...base(p)} icon="drop" label={tl('Segna acqua')} color={WATER} value={L(water)} sub={`${tl('su')} ${L(goal)}`} progress={water / goal} onPress={() => setOpen(true)} />
      <WaterSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PantryW(p: WProps) {
  const items = usePantry((s) => s.items);
  const shop = usePantry((s) => s.shop);
  const low = lowStock(items);
  return <Tile {...base(p)} icon="orders" label={tl('Frigo e spesa')} color={FOOD} value={String(low.length)} unit={p.w * p.h > 1 ? tl('in esaurimento') : undefined} sub={`${items.length} ${tl('alimenti')} · ${shop.length} ${tl('in lista')}`}
    rows={low.slice(0, 4).map((x) => ({ label: x.name, value: `${x.qty}` }))} empty={tl('Tutto a posto.')} onPress={() => go('fitnessFridge')} />;
}

export function BodyCheckW(p: WProps) {
  const rep = useBodyCheck((s) => s.reports);
  const skip = useBodyCheck((s) => s.skip);
  const d = daysToNextPhotos(rep[0]?.ts);
  if (skip) return <Tile {...base(p)} icon="camera" label={tl('Foto del corpo')} color={MIND} value={tl('Spente')} sub={tl('Le riattivi quando vuoi')} onPress={() => go('fitnessBody')} />;
  return <Tile {...base(p)} icon="camera" label={tl('Foto del corpo')} color={MIND} value={d == null ? tl('Inizia') : d <= 0 ? tl('È ora') : `${d} ${tl('giorni')}`} sub={d == null ? tl('Quattro foto, un parere sul tuo allenamento') : d <= 0 ? tl('È ora di nuove foto') : tl('alle prossime foto')} onPress={() => go('fitnessBody')} />;
}

export function DriveW(p: WProps) {
  const drive = useLife((s) => s.drive);
  const last = drive[drive.length - 1];
  return <Tile {...base(p)} icon="lifedrive" label="LifeDrive" color="#b96bff" value={String(drive.length)} unit={p.w * p.h > 1 ? tl('file e foto') : undefined} sub={last ? last.n : tl('Ancora nessun file')} onPress={() => go('lifedrive')} />;
}

/** Theia, la mascotte: tocchi e vai a trovarla nella sua casa. */
export function PetW(p: WProps) {
  const t = useTheme();
  const size = Math.max(40, Math.min(p.pw, p.ph) - 28);
  return (
    <Chrome pw={p.pw} ph={p.ph} color={t.accent} label="Theia" pad={8} onPress={() => go('theiaPet')}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Mascot size={size} color={t.accent} expression="happy" /></View>
    </Chrome>
  );
}

const sc = (icon: string, label: string, page: string, color: string, params?: Record<string, string>) => shortcutW({ icon, label, page, color, params });
export const ScFridgeW = sc('orders', 'Frigo e spesa', 'fitnessFridge', FOOD);
export const ScMealPlanW = sc('meal', 'Piano alimentare', 'fitnessMealPlan', FOOD);
export const ScBodyW = sc('camera', 'Foto del corpo', 'fitnessBody', MIND);
export const ScDriveW = sc('lifedrive', 'LifeDrive', 'lifedrive', '#b96bff');
export const ScPetW = sc('sparkle', 'Theia, la mascotte', 'theiaPet', '#8fa4ff');
export const ScVacationW = sc('lifetravel', 'Piano vacanze', 'vacationPlanner', '#e0c97b');
export const ScMonthW = sc('calendar', 'Piano del mese', 'monthPlan', PLAN);
export const ScProjectsW = sc('projects', 'Progetti', 'projects', PLAN);
export const ScPassW = sc('lifefitness', 'LifePass', 'fitnessPass', FIT);
export const ScLockW = sc('lock', 'Blocco schermo', 'lockScreenSettings', '#8fa4ff');
export const ScWaterPageW = sc('drop', 'Acqua', 'fitnessWater', WATER);
export const ScDiaryW = sc('meal', 'Storico dei pasti', 'fitnessDiary', FOOD);
