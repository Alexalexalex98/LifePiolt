/**
 * Piano di risparmio per una spesa con scadenza, per esempio una vacanza (modulo PURO, tutto calcolato, niente AI).
 * Risponde a: «mi servono 2000 per dicembre: quanto metto da parte ogni mese, e da quale stipendio?».
 * Margine mensile = entrate ricorrenti (stipendi riconosciuti dall'estratto) − spese fisse − spese variabili medie. Sono medie dell'estratto, non certezze.
 */
export type IncomeSource = { name: string; monthly: number };
export type VacInput = {
  now: Date;
  /** importo che serve */
  goal: number;
  /** mese della vacanza, AAAA-MM */
  target: string;
  /** già messo da parte per questo scopo */
  saved?: number;
  /** stipendi/entrate che tornano ogni mese (uno o più) */
  incomes: IncomeSource[];
  /** spese fisse e variabili medie al mese */
  fixed: number;
  variable: number;
};
export type VacRow = { ym: string; label: string; amount: number; cumulative: number };
export type VacPlan = {
  status: 'ok' | 'stretto' | 'non-basta' | 'senza-dati' | 'scaduta';
  need: number;
  months: number;
  perMonth: number;
  income: number;
  margin: number;
  /** quota del margine usata dal risparmio, in % */
  sharePct: number;
  perSource: { name: string; monthly: number; amount: number }[];
  schedule: VacRow[];
  /** mesi che servirebbero con il margine di cui disponi */
  monthsNeeded: number | null;
  /** importo che raggiungi davvero entro la data con il margine che hai */
  reachable: number;
  notes: string[];
};

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ''} ${ym.slice(0, 4)}`;
export const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const idx = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const ymFrom = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const r0 = (n: number) => Math.round(n);

/** «dicembre» o «2026-12» -> AAAA-MM: il primo dicembre da adesso in poi (se il mese è questo, resta questo). */
export function parseTarget(v: unknown, now: Date): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  const iso = /^(\d{4})-(\d{2})$/.exec(s);
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return s;
  const m = MONTHS.findIndex((x) => s.includes(x) || (s.length >= 3 && s.startsWith(x.slice(0, 3))));
  if (m < 0) return null;
  const y = /\b(20\d{2})\b/.exec(s)?.[1];
  if (y) return `${y}-${String(m + 1).padStart(2, '0')}`;
  const cur = now.getFullYear() * 12 + now.getMonth();
  const i = Math.floor(cur / 12) * 12 + m;
  return ymFrom(i >= cur ? i : i + 12);
}

export function vacationPlan(i: VacInput): VacPlan {
  const income = i.incomes.reduce((s, x) => s + Math.max(0, x.monthly), 0);
  const margin = Math.max(0, income - Math.max(0, i.fixed) - Math.max(0, i.variable));
  const need = Math.max(0, i.goal - Math.max(0, i.saved ?? 0));
  const notes: string[] = [];
  const start = idx(ymOf(i.now));
  // si mette da parte dallo stipendio di questo mese fino a quello del mese prima della partenza (almeno un mese)
  const months = Math.max(1, idx(i.target) - start);
  const base = { need, months, income: r0(income), margin: r0(margin), perSource: [], schedule: [], monthsNeeded: null, reachable: 0 };
  if (idx(i.target) < start) return { ...base, status: 'scaduta', perMonth: 0, sharePct: 0, notes: ['Il mese scelto è già passato.'] };
  if (need <= 0) return { ...base, status: 'ok', perMonth: 0, sharePct: 0, notes: ['Hai già messo da parte tutto quello che serve.'] };
  if (income <= 0) return { ...base, status: 'senza-dati', perMonth: r0(need / months), sharePct: 0, notes: ['Non riconosco stipendi dall\'estratto, quindi non posso dire se il margine basta. Questa è solo la divisione in parti uguali.'] };
  const perMonth = Math.ceil(need / months);
  const sharePct = margin > 0 ? r0((perMonth / margin) * 100) : 100;
  const perSource = i.incomes.filter((x) => x.monthly > 0).map((x) => ({ name: x.name, monthly: r0(x.monthly), amount: Math.round((perMonth * x.monthly) / income) }));
  // l'arrotondamento non deve far sparire franchi: la differenza va allo stipendio più alto
  const diff = perMonth - perSource.reduce((s, x) => s + x.amount, 0);
  if (perSource.length && diff) { const top = perSource.reduce((a, b) => (b.monthly > a.monthly ? b : a)); top.amount += diff; }
  let cum = Math.max(0, i.saved ?? 0);
  const schedule: VacRow[] = Array.from({ length: months }, (_, k) => { const ym = ymFrom(start + k); const amount = k === months - 1 ? Math.max(0, i.goal - cum) : perMonth; cum += amount; return { ym, label: monthName(ym), amount, cumulative: r0(cum) }; });
  const reachable = r0(Math.max(0, i.saved ?? 0) + margin * months);
  const monthsNeeded = margin > 0 ? Math.ceil(need / margin) : null;
  let status: VacPlan['status'] = 'ok';
  if (perMonth > margin) { status = 'non-basta'; notes.push(`Con il margine di ${r0(margin)} al mese entro la data arrivi a ${reachable}, non a ${i.goal}.`); }
  else if (sharePct > 70) { status = 'stretto'; notes.push('Ti resterebbe poco margine per gli imprevisti: considera di spostare la data o di ridurre l\'importo.'); }
  if (perSource.length > 1) notes.push(`Ho riconosciuto ${perSource.length} entrate che tornano ogni mese: ho diviso il risparmio in proporzione a quanto portano.`);
  notes.push('Le entrate e le spese sono medie dell\'estratto conto: se cambiano, il piano va rifatto.');
  return { status, need, months, perMonth, income: r0(income), margin: r0(margin), sharePct, perSource, schedule, monthsNeeded, reachable, notes };
}
