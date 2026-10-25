import { Pressable, View } from 'react-native';

import { Tile, type TileRow } from '@/components/dash/Tile';
import { useDashData } from '@/components/dash/data';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { fmtVal, todayStr } from '@/lib/analytics';
import { addDays, dayInfo } from '@/lib/fitness/dayPlan';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTarget, sumMacros } from '@/lib/fitness/nutrition';
import { programById } from '@/lib/fitness/programsExtra';
import { GLASS_ML } from '@/lib/fitness/waterBanner';
import { dayKey } from '@/lib/format';
import { go } from '@/lib/nav';
import { moodOptions, useHealth } from '@/store/health';
import { useFitness } from '@/store/fitness';
import { countdown, upcoming, whenText } from '@/lib/shifts';
import { useLife } from '@/store/life';
import { useShifts } from '@/store/shifts';
import { toast } from '@/store/toast';

export type WProps = { w: number; h: number; pw: number; ph: number; cfg?: Record<string, string> };
const base = (p: WProps) => ({ w: p.w, h: p.h, pw: p.pw, ph: p.ph });
const C = { oggi: '#8fa4ff', fit: '#ff9d6e', cibo: '#5fd39a', salute: '#6ec9dd', mente: '#c9b6ff', plan: '#8fb3ff', soldi: '#7be0b0' };

/* ---------------- Oggi ---------------- */
export function MoodW(p: WProps) {
  const t = useTheme();
  const moods = useHealth((s) => s.moods);
  const setTodayMood = useHealth((s) => s.setTodayMood);
  const done = moods.find((m) => m.day === todayStr());
  const chips = p.w >= 2 && !done ? (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: p.w >= 4 ? p.pw * 0.7 : p.pw - 24 }}>
      {moodOptions.map(([m, c]) => (
        <Pressable key={m} accessibilityRole="button" accessibilityLabel={tl(`Mi sento ${m}`)} hitSlop={4} onPress={() => { setTodayMood(m); toast(tl('Umore registrato: {0}', m)); }} style={{ width: p.w >= 4 ? 26 : 21, height: p.w >= 4 ? 26 : 21, borderRadius: 13, backgroundColor: c, borderWidth: 2, borderColor: t.border }} />
      ))}
    </View>
  ) : undefined;
  return <Tile {...base(p)} icon="smile" label={tl('Umore')} color={C.mente} value={done ? done.mood : p.w >= 2 ? undefined : '?'} sub={done ? undefined : tl('Come ti senti oggi?')} extra={chips} empty={tl('Tocca un colore: un secondo.')} onPress={() => go('mood')} />;
}

export function LifeScoreW(p: WProps) {
  const { dash, openScore } = useDashData();
  const total = dash.scores.total;
  const d = dash.lifeDelta;
  return <Tile {...base(p)} icon="activity" label="Life Score" color={C.oggi} value={total == null ? undefined : String(Math.round(total))} unit={p.w * p.h > 1 ? '/100' : undefined} delta={d == null ? undefined : { text: `${d > 0 ? '+' : ''}${Math.round(d)} ${tl('in una settimana')}`, good: d === 0 ? null : d > 0 }} series={dash.lifeSeries.map((x) => x.v)} progress={total == null ? undefined : total / 100}
    rows={[{ label: tl('Salute'), value: dash.scores.salute == null ? '–' : String(Math.round(dash.scores.salute)), color: C.salute }, { label: tl('Mente'), value: dash.scores.mente == null ? '–' : String(Math.round(dash.scores.mente)), color: C.mente }, { label: tl('Finanza'), value: dash.scores.finanza == null ? '–' : String(Math.round(dash.scores.finanza)), color: C.soldi }, { label: tl('Crescita'), value: dash.scores.crescita == null ? '–' : String(Math.round(dash.scores.crescita)), color: C.plan }]}
    empty={tl('Servono alcuni dati.')} onPress={openScore} />;
}

export function MissingW(p: WProps) {
  const fit = useFitness();
  const moods = useHealth((s) => s.moods);
  const tasks = useLife((s) => s.tasks);
  const now = Date.now();
  const today = dayKey();
  const waterMl = (fit.water ?? {})[dayOf(now)] ?? 0;
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const info = dayInfo(today, { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() });
  const openToday = tasks.filter((x) => !x.done && (x.due === today || x.urgent)).length;
  type R = TileRow & { go: string; params?: Record<string, string> };
  const raw: R[] = [
    { label: tl('Umore'), done: moods.some((m) => m.day === todayStr()), go: 'mood' },
    { label: tl('Acqua'), value: `${(waterMl / 1000).toFixed(1).replace('.', ',')} L`, done: waterMl >= waterGoal(fit.body?.weightKg) * 0.8, go: 'fitnessDay', params: { focus: 'water', day: dayOf(now) } },
    { label: tl('Pasti segnati'), done: fit.meals.some((m) => dayOf(m.ts) === dayOf(now)), go: 'fitnessDay', params: { day: dayOf(now) } },
    ...(info.planned ? [{ label: tl('Allenamento'), done: info.done, go: 'fitnessPlanDay', params: { date: today } }] : []),
    { label: tl('Task di oggi'), value: openToday ? String(openToday) : undefined, done: openToday === 0, go: 'plan' },
  ];
  const rows: TileRow[] = raw.map((r) => ({ ...r, onPress: () => go(r.go, r.params) }));
  const left = rows.filter((r) => !r.done).length;
  return <Tile {...base(p)} icon="checksquare" label={tl('Cosa ti manca oggi')} color={C.oggi} value={left === 0 ? tl('Tutto fatto') : `${left} ${tl('da fare')}`} progress={(rows.length - left) / rows.length} rows={rows} onPress={rows.find((r) => !r.done)?.onPress} />;
}

/* ---------------- Plan ---------------- */
export function AgendaW(p: WProps) {
  const events = useLife((s) => s.events);
  const day = dayKey();
  const list = [...(events[day] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const hhmm = new Date().toTimeString().slice(0, 5);
  const next = list.find((e) => e.time >= hhmm) ?? null;
  const rows = list.map((e) => ({ label: e.title, value: e.time, onPress: () => go('plan', { day, idx: String((events[day] ?? []).indexOf(e)), at: String(Date.now()) }) }));
  return <Tile {...base(p)} icon="calendar" label={tl('Agenda di oggi')} color={C.plan} value={next ? next.time : list.length ? tl('Finito') : undefined} sub={next ? next.title : list.length ? tl('Per oggi hai finito') : tl('Nessun impegno oggi')} rows={rows} unit={undefined} empty={tl('Nessun impegno oggi')} onPress={() => go('plan', { day, ...(next ? { idx: String((events[day] ?? []).indexOf(next)), at: String(Date.now()) } : {}) })} />;
}

export function TasksW(p: WProps) {
  const tasks = useLife((s) => s.tasks);
  const today = dayKey();
  const open = tasks.filter((x) => !x.done);
  const due = open.filter((x) => x.urgent || (x.due && x.due <= today));
  const rows = (due.length ? due : open).slice(0, 8).map((x) => ({ label: x.t, done: false, value: x.due && x.due <= today ? tl('oggi') : undefined, onPress: () => go('plan', { task: x.id, at: String(Date.now()) }) }));
  return <Tile {...base(p)} icon="tasks" label="Task" color={C.plan} value={String(open.length)} sub={due.length ? `${due.length} ${tl('in scadenza o urgenti')}` : tl('Nessuna scadenza')} rows={rows} progress={tasks.length ? 1 - open.length / tasks.length : undefined} onPress={() => { const first = (due.length ? due : open)[0]; go('plan', first ? { task: first.id, at: String(Date.now()) } : undefined); }} />;
}

/* ---------------- Benessere: cibo e acqua ---------------- */
export function WaterW(p: WProps) {
  const t = useTheme();
  const fit = useFitness();
  const ml = (fit.water ?? {})[dayOf(Date.now())] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  const add = (
    <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un bicchiere')} hitSlop={6} onPress={() => { fit.addWater(GLASS_ML); toast(tl('Segnato: 1 bicchiere')); }} style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: C.salute, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#07090d', fontWeight: '800', fontSize: 12 }}>+ 1</Text>
    </Pressable>
  );
  void t;
  return <Tile {...base(p)} icon="drop" label={tl('Acqua')} color={C.salute} value={`${(ml / 1000).toFixed(1).replace('.', ',')} L`} sub={p.w >= 3 || p.h >= 2 ? `${tl('su')} ${(goal / 1000).toFixed(1).replace('.', ',')} L` : undefined} progress={ml / goal} extra={p.w * p.h > 1 ? add : undefined} onPress={() => go('fitnessDay', { day: dayOf(Date.now()), focus: 'water' })} />;
}

export function KcalW(p: WProps) {
  const fit = useFitness();
  const today = fit.meals.filter((m) => dayOf(m.ts) === dayOf(Date.now()));
  const s = sumMacros(today.map((m) => m.macros));
  const target = fit.body ? dailyTarget(fit.body) : null;
  return <Tile {...base(p)} icon="meal" label={tl('Calorie')} color={C.cibo} value={String(s.kcal)} unit={p.w * p.h > 1 ? 'kcal' : undefined} sub={target ? `${tl('su')} ${target} kcal` : tl('Imposta il tuo obiettivo')} progress={target ? s.kcal / target : undefined}
    rows={[{ label: tl('Proteine'), value: `${s.p} g`, color: '#ff9d9d' }, { label: tl('Carboidrati'), value: `${s.c} g`, color: '#e0c97b' }, { label: tl('Grassi'), value: `${s.f} g`, color: '#7bb8e0' }, { label: tl('Pasti oggi'), value: String(today.length) }]} onPress={() => go('fitnessDay', { day: dayOf(Date.now()) })} />;
}

/* ---------------- Benessere: allenamento ---------------- */
export function TrainW(p: WProps) {
  const fit = useFitness();
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const today = dayKey();
  const info = dayInfo(today, { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() });
  const prog = info.programId ? programById(info.programId) : null;
  const name = prog && info.session != null ? prog.sessions[info.session].name : null;
  const ex = fit.exDone?.[today]?.idx.length ?? 0;
  return <Tile {...base(p)} icon="lifefitness" label={tl('Allenamento')} color={C.fit} value={info.done ? tl('Fatto') : name ? (p.w * p.h > 1 ? name : tl('Oggi')) : tl('Riposo')} sub={info.done ? tl('Bel lavoro') : name ? (ex ? `${ex} ${tl('esercizi fatti')}` : tl('Da fare oggi')) : tl('Giorno di recupero')} onPress={() => go('fitnessPlanDay', { date: today })} />;
}

export function WeekW(p: WProps) {
  const t = useTheme();
  const fit = useFitness();
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const mk = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(mk, i));
  const ctx = { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now };
  const infos = days.map((d) => dayInfo(d, ctx));
  const done = infos.filter((i) => i.done).length;
  const L = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const extra = (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {infos.map((i, k) => (
        <Pressable key={days[k]} accessibilityRole="button" accessibilityLabel={days[k]} onPress={() => go('fitnessPlanDay', { date: days[k] })} style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ color: t.muted, fontSize: 9, fontWeight: '800' }}>{L[k]}</Text>
          <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: i.done ? C.fit : i.planned ? C.fit + '40' : t.chip }} />
        </Pressable>
      ))}
    </View>
  );
  return <Tile {...base(p)} icon="lifefitness" label={tl('Settimana')} color={C.fit} value={p.h === 1 ? undefined : `${done}`} sub={`${done} ${tl('allenamenti fatti')}`} extra={extra} onPress={() => go('lifefitness')} />;
}

/* ---------------- metriche calcolate (salute, mente, soldi) ---------------- */
type MetricOpts = { id: string; label: string; icon: string; color?: string; page: string };
export const metricW = (o: MetricOpts) => function MetricWidget(p: WProps) {
  const { dash, openMetric } = useDashData();
  const a = dash.byId[o.id];
  const d = a?.deltaPct ?? null;
  return <Tile {...base(p)} icon={o.icon} label={tl(o.label)} color={o.color ?? a?.def.color ?? C.oggi} value={a ? fmtVal(a.latest.v, a.def).replace(/\s.*$/, '') : undefined} unit={a && p.w * p.h > 1 ? (fmtVal(a.latest.v, a.def).split(' ').slice(1).join(' ') || undefined) : undefined}
    delta={d == null ? undefined : { text: `${d > 0 ? '+' : ''}${Math.round(d)}%`, good: a?.def.better === 'none' || Math.abs(d) < 1 ? null : (a?.def.better === 'down' ? d < 0 : d > 0) }} series={a?.pts.map((x) => x.v)} sub={a ? `${tl('Media 7 giorni')}: ${fmtVal(a.avg7, a.def)}` : undefined} empty={tl('Nessun dato ancora')} onPress={() => { if (!openMetric(o.id)) go(o.page); }} />;
};

/* ---------------- Turni di lavoro e prossimi impegni ---------------- */
export function ShiftW(p: WProps) {
  const shifts = useShifts((s) => s.shifts);
  const now = Date.now();
  const list = upcoming(shifts, now, 60);
  const n = list[0];
  const short = (t: string) => (p.pw < 250 ? t.replace(/ \d{1,2} [a-z]{3} /, ' ') : t);
  const rows: TileRow[] = list.slice(1, 9).map((o) => ({ label: o.shift.name, value: short(whenText(o, now)), color: o.shift.color, onPress: () => go('shifts') }));
  const startTxt = n ? `${String(new Date(n.startTs).getHours()).padStart(2, '0')}:${String(new Date(n.startTs).getMinutes()).padStart(2, '0')}` : undefined;
  return <Tile {...base(p)} icon="briefcase" label={tl('Prossimo turno')} color={C.plan} value={n ? (n.startTs <= now ? tl('In corso') : startTxt) : undefined} sub={n ? (p.w * p.h >= 4 ? `${n.shift.name} · ${whenText(n, now)}${n.startTs > now ? ` · ${countdown(n.startTs, now)}` : ''}` : `${n.shift.name} · ${whenText(n, now).replace(/ \d\d:\d\d$/, '')}`) : tl('Aggiungi i tuoi turni')} rows={rows} empty={tl('Aggiungi i tuoi turni')} onPress={() => go('shifts')} />;
}

export function UpcomingW(p: WProps) {
  const events = useLife((s) => s.events);
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const today = dayKey(now);
  const list: { day: string; i: number; e: { time: string; title: string } }[] = [];
  for (let k = 0; k < 14; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    const key = dayKey(d);
    (events[key] ?? []).forEach((e, i) => { if (k > 0 || e.time >= hhmm) list.push({ day: key, i, e }); });
  }
  list.sort((a, b) => (a.day + a.e.time).localeCompare(b.day + b.e.time));
  const label = (day: string, time: string) => (day === today ? time : `${new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} ${time}`);
  const first = list[0];
  const rows: TileRow[] = list.slice(1, 11).map((x) => ({ label: x.e.title, value: label(x.day, x.e.time), onPress: () => go('plan', { day: x.day, idx: String(x.i), at: String(Date.now()) }) }));
  return <Tile {...base(p)} icon="calendar" label={tl('Prossimi impegni')} color={C.plan} value={first ? label(first.day, first.e.time) : undefined} sub={first ? first.e.title : tl('Nessun impegno nei prossimi giorni')} rows={rows} empty={tl('Nessun impegno nei prossimi giorni')} onPress={first ? () => go('plan', { day: first.day, idx: String(first.i), at: String(Date.now()) }) : () => go('plan')} />;
}
