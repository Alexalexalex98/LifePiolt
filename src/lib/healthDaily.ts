/** Calcoli puri sui dati di salute (provati dai test, senza dipendenze dall'app). */
export type Pt = { d: string; v: number };
const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Una voce al giorno: somma o media di valori datati (puro, provato dai test). */
export function perDay(items: { t: number | string; v: number }[], how: 'sum' | 'avg' | 'last'): Pt[] {
  const g = new Map<string, number[]>();
  [...items].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()).forEach((i) => { if (!Number.isFinite(i.v)) return; const k = dayKey(new Date(i.t)); g.set(k, [...(g.get(k) ?? []), i.v]); });
  return [...g.entries()].map(([d, a]) => ({ d, v: how === 'sum' ? a.reduce((x, y) => x + y, 0) : how === 'last' ? a[a.length - 1] : a.reduce((x, y) => x + y, 0) / a.length })).sort((a, b) => a.d.localeCompare(b.d));
}
/** Ore di sonno per notte (giorno del risveglio), unendo intervalli sovrapposti: orologio e telefono non si sommano due volte. */
export function sleepHours(sessions: { start: number; end: number }[]): Pt[] {
  const per = new Map<string, [number, number][]>();
  sessions.forEach((s) => { const k = dayKey(new Date(s.end)); per.set(k, [...(per.get(k) ?? []), [s.start, s.end]]); });
  const out: Pt[] = [];
  per.forEach((iv, d) => {
    iv.sort((a, b) => a[0] - b[0]);
    let tot = 0, cs = iv[0][0], ce = iv[0][1];
    for (let i = 1; i < iv.length; i++) { if (iv[i][0] <= ce) ce = Math.max(ce, iv[i][1]); else { tot += ce - cs; cs = iv[i][0]; ce = iv[i][1]; } }
    tot += ce - cs;
    const h = tot / 3600000;
    if (h >= 1 && h <= 16) out.push({ d, v: Math.round(h * 100) / 100 });
  });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

