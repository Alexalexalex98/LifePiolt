/**
 * Disponibilità: da un elenco di impegni (solo ora di inizio) ricava i blocchi occupati e gli slot liberi.
 * Modulo PURO e testabile. Un impegno senza durata si considera lungo `assumeMin` minuti (default 60).
 * Chi condivide la disponibilità invia solo questi intervalli: i titoli degli impegni non partono mai.
 */
export type Span = { from: number; to: number };
export type Ev = { time: string };

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Blocchi occupati, ordinati e uniti quando si toccano o si sovrappongono. */
export function busyBlocks(events: Ev[], assumeMin = 60): Span[] {
  const spans = events.map((e) => ({ from: toMin(e.time), to: toMin(e.time) + assumeMin })).sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  spans.forEach((s) => {
    const last = out[out.length - 1];
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  });
  return out;
}

/** Slot liberi dentro l'orario di lavoro [ws, we], lunghi almeno `minSlot`. `from` esclude il passato (es. adesso). */
export function freeSlots(events: Ev[], ws: string, we: string, minSlot = 30, assumeMin = 60, from = 0): Span[] {
  const start = Math.max(toMin(ws), from), end = toMin(we);
  if (end <= start) return [];
  const out: Span[] = [];
  let cur = start;
  busyBlocks(events, assumeMin).forEach((b) => {
    if (b.to <= cur) return;
    if (b.from > cur) out.push({ from: cur, to: Math.min(b.from, end) });
    cur = Math.max(cur, b.to);
  });
  if (cur < end) out.push({ from: cur, to: end });
  return out.filter((s) => s.to - s.from >= minSlot);
}
