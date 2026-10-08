/** Sessioni di lavoro saltate: impegni 'Lavoro su: X' passati il cui task è ancora aperto. */
export type SkEv = { day: string; time: string; title: string; dur?: number };
export type SkTask = { id: string; t: string; done?: boolean };
export const WORK_PREFIX = 'Lavoro su: ';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function skippedWork(events: SkEv[], tasks: SkTask[], now: Date): { ev: SkEv; task: SkTask }[] {
  const today = key(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const out: { ev: SkEv; task: SkTask }[] = [];
  events.forEach((ev) => {
    if (!ev.title.startsWith(WORK_PREFIX)) return;
    const past = ev.day < today || (ev.day === today && toMin(ev.time) + (ev.dur || 60) <= nowMin);
    if (!past) return;
    const name = ev.title.slice(WORK_PREFIX.length).trim().toLowerCase();
    const task = tasks.find((t) => !t.done && t.t.trim().toLowerCase() === name);
    if (task) out.push({ ev, task });
  });
  return out.sort((a, b) => (a.ev.day + a.ev.time).localeCompare(b.ev.day + b.ev.time));
}
