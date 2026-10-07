import { dayKey, pad2 } from '@/lib/format';
import { noteTitle } from '@/lib/notes';
import { busyBlocks, fmtMin, freeSlots } from '@/lib/availability';
import { useApp } from '@/store/app';
import type { AgendaMode, AgendaShare, ChatMessage, SlotsShare, TaskShare } from '@/store/chat';
import { taskIsDone, useLife } from '@/store/life';

const wd = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
/** "mer 14/10" da una chiave YYYY-MM-DD */
export function dayLabelOf(key: string): string {
  const d = new Date(key + 'T00:00:00');
  return `${wd[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };

export type AgendaRange = 'oggi' | 'domani' | '7 giorni';

/**
 * I tuoi impegni nel periodo scelto.
 * - 'dettagli': titolo, giorno e ora
 * - 'occupato': solo i blocchi in cui sei occupato (nessun titolo)
 * - 'liberi': solo gli slot liberi nell'orario di lavoro (nessun titolo, nessun blocco occupato)
 */
export function buildAgenda(range: AgendaRange, mode: AgendaMode = 'dettagli', opts: { ws?: string; we?: string; minSlot?: number; weekend?: boolean; windows?: { from: string; to: string }[] } = {}): AgendaShare | null {
  let days = range === 'oggi' ? [addDays(0)] : range === 'domani' ? [addDays(1)] : Array.from({ length: 7 }, (_, i) => addDays(i));
  // la disponibilità di lavoro salta il weekend, salvo richiesta esplicita
  if (mode !== 'dettagli' && !opts.weekend && range === '7 giorni') days = days.filter((d) => { const w = new Date(d + 'T00:00:00').getDay(); return w !== 0 && w !== 6; });
  const ev = useLife.getState().events;
  const wh = useApp.getState().workHours;
  const ws = opts.ws ?? wh.start, we = opts.we ?? wh.end, minSlot = opts.minSlot ?? 30;
  // fasce scelte da chi condivide (es. niente mattina, niente sera): se mancano vale l'orario di lavoro
  const wins = opts.windows?.length ? opts.windows : [{ from: ws, to: we }];
  const inWins = (time: string) => !opts.windows?.length || opts.windows.some((w) => time >= w.from && time < w.to);
  const rangeTitle = range === 'oggi' ? 'di oggi' : range === 'domani' ? 'di domani' : 'della settimana';
  if (mode === 'dettagli') {
    const items = days.flatMap((d) => (ev[d] ?? []).filter((e) => inWins(e.time)).map((e) => ({ day: d, time: e.time, title: e.title }))).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
    if (!items.length) return null;
    return { title: `I miei impegni ${rangeTitle}`, range, mode, items };
  }
  const nowMin = new Date().getHours() * 60 + Math.ceil(new Date().getMinutes() / 15) * 15;
  const busy: NonNullable<AgendaShare['busy']> = [], free: NonNullable<AgendaShare['free']> = [];
  days.forEach((d) => {
    const events = ev[d] ?? [];
    busyBlocks(events).filter((b) => !opts.windows?.length || opts.windows.some((w) => fmtMin(b.from) < w.to && fmtMin(b.to) > w.from)).forEach((b) => busy.push({ day: d, from: fmtMin(b.from), to: fmtMin(b.to) }));
    wins.forEach((w) => freeSlots(events, w.from, w.to, minSlot, 60, d === addDays(0) ? nowMin : 0).forEach((f) => free.push({ day: d, from: fmtMin(f.from), to: fmtMin(f.to) })));
  });
  return { title: mode === 'liberi' ? `Quando sono libero ${rangeTitle}` : `La mia disponibilità ${rangeTitle}`, range, mode, items: [], busy: mode === 'occupato' ? busy : undefined, free, hours: { from: wins[0].from, to: wins[wins.length - 1].to, minSlot } };
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
