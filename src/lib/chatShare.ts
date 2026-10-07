import { dayKey, pad2 } from '@/lib/format';
import { noteTitle } from '@/lib/notes';
import type { AgendaShare, ChatMessage, SlotsShare, TaskShare } from '@/store/chat';
import { taskIsDone, useLife } from '@/store/life';

const wd = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
/** "mer 14/10" da una chiave YYYY-MM-DD */
export function dayLabelOf(key: string): string {
  const d = new Date(key + 'T00:00:00');
  return `${wd[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };

export type AgendaRange = 'oggi' | 'domani' | '7 giorni';

/** I tuoi impegni nel periodo scelto, ordinati. */
export function buildAgenda(range: AgendaRange): AgendaShare | null {
  const days = range === 'oggi' ? [addDays(0)] : range === 'domani' ? [addDays(1)] : Array.from({ length: 7 }, (_, i) => addDays(i));
  const ev = useLife.getState().events;
  const items = days.flatMap((d) => (ev[d] ?? []).map((e) => ({ day: d, time: e.time, title: e.title }))).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  if (!items.length) return null;
  return { title: range === 'oggi' ? 'I miei impegni di oggi' : range === 'domani' ? 'I miei impegni di domani' : 'I miei impegni della settimana', range, items };
}

export function buildTasks(ids: string[]): TaskShare | null {
  const tasks = useLife.getState().tasks.filter((t) => ids.includes(t.id));
  if (!tasks.length) return null;
  return { title: tasks.length === 1 ? tasks[0].t : `${tasks.length} task`, items: tasks.map((t) => ({ t: t.t, done: taskIsDone(t) })) };
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** Miei impegni che si sovrappongono a un orario (durata in minuti, default 60). */
export function myConflicts(day: string, time: string, durationMin = 60): string[] {
  const ev = useLife.getState().events[day] ?? [];
  const s = toMin(time), e = s + durationMin;
  return ev.filter((x) => { const a = toMin(x.time); return a < e && a + 30 > s; }).map((x) => `${x.time} ${x.title}`);
}

/** Aggiunge al piano di chi riceve gli impegni di una scheda agenda (senza duplicati). Ritorna quanti ne ha aggiunti. */
export function importAgenda(a: AgendaShare, from: string): number {
  const life = useLife.getState();
  let n = 0;
  a.items.forEach((it) => {
    const cur = life.events[it.day] ?? [];
    if (cur.some((c) => c.time === it.time && c.title === it.title)) return;
    life.addEvent(it.day, { time: it.time, title: it.title });
    n++;
  });
  void from;
  return n;
}

export function importTasks(t: TaskShare): number {
  const life = useLife.getState();
  let n = 0;
  t.items.forEach((x) => { if (life.tasks.some((y) => y.t === x.t)) return; life.addTask({ t: x.t, done: x.done }); n++; });
  return n;
}

export function noteShareOf(id: string) {
  const n = useLife.getState().notes.find((x) => x.id === id);
  return n ? { title: noteTitle(n.text), text: n.text } : null;
}

export function addSlotToPlan(s: SlotsShare, optId: string) {
  const o = s.options.find((x) => x.id === optId);
  if (!o) return false;
  useLife.getState().addEvent(o.day, { time: o.time, title: s.title });
  return true;
}

export const sharedKinds: ChatMessage['kind'][] = ['agenda', 'tasks', 'note', 'slots'];
