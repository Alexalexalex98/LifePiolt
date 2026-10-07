export function formatCHF(n: number): string {
  const neg = n < 0;
  const r = Math.round(Math.abs(n));
  return (neg ? '-' : '') + r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "dd/mm" di oggi (o di N giorni fa) */
export function shortDate(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
export const weekdayShortDate = () => shortDate(0);
export const pastDateStr = (daysAgo: number) => shortDate(daysAgo);

/** "YYYY-MM-DD" in ora locale */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function monthLabelOf(d: Date): string {
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genSeries(seed: string, base: number, n: number, vol: number): number[] {
  const rng = mulberry32(hashStr(seed));
  const pts = [base];
  for (let i = 1; i < n; i++) {
    const drift = (rng() - 0.48) * base * vol;
    pts.push(Math.max(0, pts[i - 1] + drift));
  }
  return pts;
}

export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function timeToMinutes(t: string): number {
  const p = t.split(':').map(Number);
  return (p[0] || 0) * 60 + (p[1] || 0);
}
export function minutesToTime(m: number): string {
  m = ((m % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
