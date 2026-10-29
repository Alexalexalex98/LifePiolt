/**
 * La baseline personale: dopo 2-3 settimane di dati, segnala le DEVIAZIONI dal solito dell'utente (sonno che cala, pasti saltati, meno impegni sociali, umore in discesa)
 * più che le soglie assolute. Più segnali insieme contano molto più di uno solo. Non è una diagnosi. Modulo PURO.
 */
export type Pt = { d: string; v: number };
export type Sig = { id: string; label: string; /** quale direzione è «peggio» */ bad: 'down' | 'up'; pts: Pt[] };
export type Dev = { id: string; label: string; recent: number; base: number; z: number };
export type Level = 'nessuno' | 'lieve' | 'attenzione' | 'forte';
export type Report = { ready: boolean; days: number; devs: Dev[]; level: Level };

const day = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };

export const BASE_MIN_DAYS = 14;
export const RECENT_DAYS = 5;

/** Confronta gli ultimi 5 giorni con il solito (da 35 a 6 giorni fa). Serve almeno 14 giorni di baseline e 3 recenti per segnale. */
export function deviations(sigs: Sig[], today: string): Report {
  const t = day(today);
  const devs: Dev[] = [];
  let days = 0;
  for (const s of sigs) {
    const base = s.pts.filter((p) => { const k = t - day(p.d); return k >= RECENT_DAYS + 1 && k <= 35; }).map((p) => p.v);
    const rec = s.pts.filter((p) => { const k = t - day(p.d); return k >= 0 && k < RECENT_DAYS; }).map((p) => p.v);
    days = Math.max(days, base.length);
    if (base.length < BASE_MIN_DAYS || rec.length < 3) continue;
    const m = mean(base), r = mean(rec);
    const spread = Math.max(sd(base), Math.abs(m) * 0.06, 0.05);
    const z = (r - m) / spread;
    if ((s.bad === 'down' && z <= -1.2) || (s.bad === 'up' && z >= 1.2)) devs.push({ id: s.id, label: s.label, recent: r, base: m, z });
  }
  const ready = days >= BASE_MIN_DAYS;
  const core = devs.filter((x) => ['mood', 'sleep', 'mealRhythm', 'social', 'energy', 'functioning'].includes(x.id)).length;
  const level: Level = devs.length >= 3 && core >= 2 ? 'forte' : devs.length >= 2 ? 'attenzione' : devs.length === 1 ? 'lieve' : 'nessuno';
  return { ready, days, devs, level };
}

/** Frase per l'utente, senza allarmismo e senza diagnosi. Solo da «attenzione» in su si fa avanti. */
export function describeDeviations(r: Report): string {
  if (!r.ready || r.devs.length < 2) return '';
  const names = r.devs.map((d) => d.label.toLowerCase());
  const list = names.length > 2 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names.join(' e ');
  return list;
}
