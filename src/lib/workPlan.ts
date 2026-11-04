/** Un solo Plan: gli impegni di lavoro ci stanno dentro con `team` (id del workspace) e si riconoscono dall'etichetta e dal colore. Modulo PURO. */
export type PlanFilter = 'all' | 'personal' | 'work';
export type WorkLike = { team?: string };
export const WORK_COLOR_ID = 'teal';
export const isWork = (e: WorkLike): boolean => !!e.team;
/** Il filtro del Plan; `team` limita il lavoro a un solo workspace (nel Workspace si vede solo quello). */
export const matchesFilter = (e: WorkLike, f: PlanFilter, team?: string): boolean =>
  f === 'all' ? true : f === 'personal' ? !e.team : !!e.team && (!team || e.team === team);

export type WireEvent = { id: string; team_id: string; title: string; day: string; time: string; dur: number; project?: string | null; kind?: string; place?: string | null; attendees: string[]; created_by: string; deleted?: boolean };
export type CalLike = { time: string; title: string; dur?: number; place?: string; color?: string; team?: string; wid?: string; with?: string[]; by?: string };

export const newEventId = (): string => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Impegno locale -> riga del server. */
export function toWireEvent(day: string, e: CalLike, me: string): WireEvent {
  return { id: e.wid ?? newEventId(), team_id: e.team!, title: e.title.trim().slice(0, 200) || '-', day, time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : '09:00', dur: Math.min(1440, Math.max(5, e.dur ?? 60)), place: e.place ?? null, attendees: (e.with ?? []).filter((x) => x !== me), created_by: me, kind: 'event', deleted: false };
}
/** Riga del server -> impegno locale (con i dati per riconoscerlo e aggiornarlo). */
export function fromWireEvent(w: WireEvent, me: string): { day: string; ev: CalLike } {
  return { day: w.day, ev: { time: w.time, title: w.title, dur: w.dur, ...(w.place ? { place: w.place } : {}), color: WORK_COLOR_ID, team: w.team_id, wid: w.id, with: [...new Set([w.created_by, ...w.attendees])].filter((x) => x !== me), by: w.created_by } };
}

/** Unisce gli impegni di lavoro del server in quelli locali di un team: aggiunge, aggiorna, toglie quelli cancellati. Non tocca i personali. */
export function mergeWork<T extends CalLike>(local: Record<string, T[]>, rows: WireEvent[], team: string, me: string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  const alive = new Map(rows.filter((r) => !r.deleted).map((r) => [r.id, r]));
  for (const [day, list] of Object.entries(local)) {
    const keep = list.filter((e) => e.team !== team || !e.wid || (alive.has(e.wid) && alive.get(e.wid)!.day === day));
    const upd = keep.map((e) => (e.team === team && e.wid && alive.has(e.wid) ? { ...e, ...fromWireEvent(alive.get(e.wid)!, me).ev } as T : e));
    if (upd.length) out[day] = upd;
  }
  for (const r of alive.values()) {
    const has = (out[r.day] ?? []).some((e) => e.wid === r.id);
    if (!has) out[r.day] = [...(out[r.day] ?? []), fromWireEvent(r, me).ev as T];
  }
  return out;
}
