import { dayKey } from '@/lib/format';
import { eveningText, morningText, type Brief } from '@/lib/briefingCore';
import { freeSlots } from '@/lib/availability';
import { joinReasons, nextActionText, rankTasks, type PEvent } from '@/lib/priority';
import { skippedWork } from '@/lib/reschedule';
import { useApp } from '@/store/app';
import { useContext } from '@/store/context';
import { useHealth } from '@/store/health';
import { useLife, taskIsDone } from '@/store/life';

function snapshot(now = new Date()) {
  const life = useLife.getState();
  const today = dayKey(now);
  const tm = new Date(now); tm.setDate(tm.getDate() + 1);
  const events = Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, dur: e.dur, important: e.important })));
  const open = life.tasks.filter((t) => !taskIsDone(t));
  const ranked = rankTasks(open.map((t) => ({ id: t.id, t: t.t, urgent: t.urgent, due: t.due })), events as PEvent[], now);
  const top = ranked[0] ? { t: ranked[0].task.t, why: joinReasons(ranked[0].reasons) } : undefined;
  const wh = useApp.getState().workHours;
  const free = freeSlots(life.events[today] ?? [], wh.start, wh.end, 30, 60, now.getHours() * 60 + now.getMinutes()).reduce((s, x) => s + x.to - x.from, 0);
  const moodLogged = useHealth.getState().moods.some((m) => m.day === today);
  const skipped = skippedWork(events, open.map((t) => ({ id: t.id, t: t.t })), now).length;
  return { life, today, tomorrow: dayKey(tm), events, open, top, free, moodLogged, skipped, ranked };
}

export function buildMorning(now = new Date()): Brief {
  const s = snapshot(now);
  const wx = useContext.getState().days?.[s.today];
  return morningText({ name: useApp.getState().account.name, events: (s.life.events[s.today] ?? []).map((e) => ({ time: e.time, title: e.title })), topTask: s.top, freeMin: s.free, moodLogged: s.moodLogged, rainMm: wx?.rain, tmax: wx?.tmax, skipped: s.skipped, hour: now.getHours() });
}

export function buildEvening(now = new Date()): Brief {
  const s = snapshot(now);
  const doneToday = s.life.tasks.filter((t) => taskIsDone(t) && t.doneAt && t.doneAt.slice(0, 10) === s.today).length;
  return eveningText({ name: useApp.getState().account.name, doneToday, openCount: s.open.length, tomorrow: (s.life.events[s.tomorrow] ?? []).map((e) => ({ time: e.time, title: e.title })), topTask: s.top, moodLogged: s.moodLogged, skipped: s.skipped });
}

export const briefingFor = (now = new Date()): Brief => (now.getHours() >= 17 ? buildEvening(now) : buildMorning(now));
void nextActionText;
