/** Notifica «fissa» con gli urgenti di oggi (modulo puro): impegni segnati importanti non ancora finiti + task urgenti da fare. */
export type PinEvent = { time: string; title: string; important?: boolean; dur?: number };
export type PinTask = { t: string; done?: boolean; urgent?: boolean; subtasks?: { done?: boolean }[] };
export type Pin = { title: string; body: string; count: number };

const startMin = (time: string): number | null => { const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export function urgentPin(events: PinEvent[] | undefined, tasks: PinTask[] | undefined, nowMin: number): Pin | null {
  const evs = (events ?? []).filter((e) => e.important).filter((e) => { const s = startMin(e.time); return s == null ? true : s + (e.dur || 60) > nowMin; })
    .sort((a, b) => (startMin(a.time) ?? -1) - (startMin(b.time) ?? -1));
  const tks = (tasks ?? []).filter((x) => x.urgent && !(x.subtasks?.length ? x.subtasks.every((s) => s.done) : x.done));
  const lines = [...evs.map((e) => (e.time ? `${e.time}  ${e.title}` : e.title)), ...tks.map((x) => `Da fare: ${x.t}`)];
  if (!lines.length) return null;
  const count = lines.length;
  return { title: count === 1 ? 'Urgente oggi' : `${count} urgenti oggi`, body: lines.slice(0, 6).join('\n') + (count > 6 ? `\n+${count - 6}` : ''), count };
}
