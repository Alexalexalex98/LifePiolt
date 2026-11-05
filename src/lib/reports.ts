/**
 * Report e dati di lavoro (modulo PURO, nessun alias '@/'): indicatori di task, ore, vendite, assistenza, assenze e riunioni per periodo,
 * confronto con il periodo prima, tendenza e giorni anomali, testo del report scritto a regole, CSV, HTML per il PDF e risposte alle domande sui dati.
 */
import type { Deal, Receivable, Ticket } from './crm.ts';
import type { WTask } from './workTasks.ts';

export type PeriodKind = 'week' | 'month' | 'quarter';
export type Period = { kind: PeriodKind; from: string; to: string; label: string };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const dm = (day: string) => { const d = new Date(day + 'T12:00:00'); return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`; };

/** Il periodo (settimana da lunedì, mese o trimestre di calendario) di `today` spostato di `offset` periodi (0 = questo, -1 = il precedente). */
export function periodOf(kind: PeriodKind, offset: number, today: string): Period {
  const d = new Date(today + 'T12:00:00');
  if (kind === 'week') {
    const start = new Date(d); start.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    const from = iso(start), to = addDays(from, 6); return { kind, from, to, label: `${dm(from)} – ${dm(to)}` };
  }
  if (kind === 'month') {
    const s = new Date(d.getFullYear(), d.getMonth() + offset, 1, 12); const e = new Date(s.getFullYear(), s.getMonth() + 1, 0, 12);
    return { kind, from: iso(s), to: iso(e), label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}` };
  }
  const q = Math.floor(d.getMonth() / 3) + offset; const s = new Date(d.getFullYear(), q * 3, 1, 12); const e = new Date(s.getFullYear(), s.getMonth() + 3, 0, 12);
  return { kind, from: iso(s), to: iso(e), label: `${Math.floor(s.getMonth() / 3) + 1}° trimestre ${s.getFullYear()}` };
}
export const inPeriod = (day: string | null | undefined, p: Period): boolean => !!day && day.slice(0, 10) >= p.from && day.slice(0, 10) <= p.to;
const days = (p: Period) => Math.round((new Date(p.to + 'T12:00:00').getTime() - new Date(p.from + 'T12:00:00').getTime()) / 86400000) + 1;

export type TimeRow = { task: string; user_id: string; day: string; minutes: number };
export type Absence = { user_id: string; from_day: string; to_day: string; status: string };
export type MeetingRow = { day: string; dur: number; status: string };
export type ReportInput = { tasks: WTask[]; time: TimeRow[]; deals: Deal[]; receivables: Receivable[]; tickets: Ticket[]; absences: Absence[]; meetings: MeetingRow[] };
export const EMPTY_INPUT: ReportInput = { tasks: [], time: [], deals: [], receivables: [], tickets: [], absences: [], meetings: [] };

export type Kpi = { id: string; label: string; value: number; unit: string; prev: number | null; better: 'up' | 'down' | 'none'; section: 'Task' | 'Ore' | 'Vendite' | 'Assistenza' | 'Persone' };
const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Indicatori di un periodo. `scope` limita ai task di un progetto o di una persona. */
export function kpisFor(inp: ReportInput, p: Period, today: string, scope: { project?: string | null; user?: string | null } = {}): Omit<Kpi, 'prev'>[] {
  const tasks = inp.tasks.filter((t) => !t.deleted && !t.parent && (!scope.project || t.project === scope.project) && (!scope.user || t.assignee === scope.user));
  const ids = new Set(tasks.map((t) => t.id));
  const done = tasks.filter((t) => t.status === 'done' && inPeriod(t.done_at, p));
  const created = tasks.filter((t) => inPeriod(t.created_at, p));
  const asOf = p.to < today ? p.to : today;
  const late = tasks.filter((t) => t.status !== 'done' && t.due && t.due < asOf && (!t.created_at || t.created_at.slice(0, 10) <= asOf));
  const withDue = done.filter((t) => t.due);
  const onTime = withDue.length ? Math.round((withDue.filter((t) => (t.done_at ?? '').slice(0, 10) <= t.due!).length / withDue.length) * 100) : 0;
  const cycle = done.filter((t) => t.created_at && t.done_at).map((t) => (new Date(t.done_at!).getTime() - new Date(t.created_at!).getTime()) / 86400000);
  const tm = inp.time.filter((x) => inPeriod(x.day, p) && (!scope.project && !scope.user ? true : ids.has(x.task)) && (!scope.user || x.user_id === scope.user));
  const won = inp.deals.filter((d) => d.stage === 'won' && inPeriod(d.updated_at, p)), lost = inp.deals.filter((d) => d.stage === 'lost' && inPeriod(d.updated_at, p));
  const openDeals = inp.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const opened = inp.tickets.filter((t) => inPeriod(t.created_at, p)), solved = inp.tickets.filter((t) => t.status === 'resolved' && inPeriod(t.resolved_at, p));
  const abs = inp.absences.filter((a) => a.status === 'approved').reduce((acc, a) => { const s = a.from_day < p.from ? p.from : a.from_day, e = a.to_day > p.to ? p.to : a.to_day; return s <= e ? acc + Math.round((new Date(e + 'T12:00:00').getTime() - new Date(s + 'T12:00:00').getTime()) / 86400000) + 1 : acc; }, 0);
  const mt = inp.meetings.filter((m) => inPeriod(m.day, p) && m.status !== 'scheduled');
  const k = (id: string, label: string, value: number, unit: string, better: Kpi['better'], section: Kpi['section']) => ({ id, label, value, unit, better, section });
  return [
    k('done', 'Task chiusi', done.length, '', 'up', 'Task'), k('created', 'Task nuovi', created.length, '', 'none', 'Task'), k('late', 'Task in ritardo', late.length, '', 'down', 'Task'),
    k('ontime', 'Chiusi nei tempi', onTime, '%', 'up', 'Task'), k('cycle', 'Giorni medi per chiudere', r1(mean(cycle)), 'giorni', 'down', 'Task'),
    k('hours', 'Ore lavorate', r1(tm.reduce((a, x) => a + x.minutes, 0) / 60), 'h', 'none', 'Ore'),
    k('won', 'Vendite vinte', won.reduce((a, d) => a + d.amount, 0), '', 'up', 'Vendite'), k('wonN', 'Trattative vinte', won.length, '', 'up', 'Vendite'), k('lostN', 'Trattative perse', lost.length, '', 'down', 'Vendite'),
    k('forecast', 'Previsto dalle trattative aperte', Math.round(openDeals.reduce((a, d) => a + d.amount * (d.probability ?? { lead: 10, contact: 25, quote: 50, negotiation: 75 }[d.stage as 'lead'] ?? 0) / 100, 0)), '', 'up', 'Vendite'),
    k('owed', 'Da incassare', Math.round(inp.receivables.filter((r) => !r.paid).reduce((a, r) => a + r.amount, 0)), '', 'down', 'Vendite'),
    k('tOpened', 'Reclami aperti nel periodo', opened.length, '', 'down', 'Assistenza'), k('tSolved', 'Reclami risolti', solved.length, '', 'up', 'Assistenza'),
    k('tHours', 'Ore medie per risolvere', r1(mean(solved.filter((t) => t.resolved_at).map((t) => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000))), 'h', 'down', 'Assistenza'),
    k('absDays', 'Giorni di assenza', abs, 'giorni', 'none', 'Persone'), k('meetN', 'Riunioni', mt.length, '', 'none', 'Persone'), k('meetH', 'Ore di riunione', r1(mt.reduce((a, m) => a + m.dur, 0) / 60), 'h', 'down', 'Persone'),
  ];
}

export type Delta = { abs: number; pct: number | null; dir: 'up' | 'down' | 'same'; good: boolean | null };
export function delta(k: Pick<Kpi, 'value' | 'prev' | 'better'>): Delta | null {
  if (k.prev == null) return null;
  const abs = r1(k.value - k.prev); const pct = k.prev === 0 ? null : Math.round(((k.value - k.prev) / Math.abs(k.prev)) * 100);
  const dir = abs > 0 ? 'up' : abs < 0 ? 'down' : 'same';
  return { abs, pct, dir, good: k.better === 'none' || dir === 'same' ? null : (dir === 'up') === (k.better === 'up') };
}
/** Indicatori del periodo con il confronto sul periodo prima (`prev`). */
export function compare(inp: ReportInput, kind: PeriodKind, offset: number, today: string, scope: { project?: string | null; user?: string | null } = {}): { period: Period; before: Period; kpis: Kpi[] } {
  const period = periodOf(kind, offset, today), before = periodOf(kind, offset - 1, today);
  const prev = new Map(kpisFor(inp, before, today, scope).map((k) => [k.id, k.value]));
  const noPrev = new Set(['owed', 'forecast']); // sono fotografie di oggi, non hanno un «prima» affidabile
  return { period, before, kpis: kpisFor(inp, period, today, scope).map((k) => ({ ...k, prev: noPrev.has(k.id) ? null : prev.get(k.id) ?? null })) };
}

/* ---------- serie, tendenza, anomalie ---------- */
/** Quanti task sono stati chiusi in ogni giorno del periodo. */
export function doneSeries(tasks: WTask[], p: Period): { day: string; v: number }[] {
  const out: { day: string; v: number }[] = [];
  for (let i = 0; i < days(p); i++) { const d = addDays(p.from, i); out.push({ day: d, v: tasks.filter((t) => !t.deleted && t.status === 'done' && (t.done_at ?? '').slice(0, 10) === d).length }); }
  return out;
}
export function trend(values: number[]): { slope: number; dir: 'su' | 'giù' | 'stabile' } {
  const n = values.length; if (n < 3) return { slope: 0, dir: 'stabile' };
  const mx = (n - 1) / 2, my = mean(values); let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  const slope = den ? num / den : 0; const rel = my ? Math.abs(slope) * n / (Math.abs(my) || 1) : Math.abs(slope);
  return { slope: Math.round(slope * 100) / 100, dir: rel < 0.25 ? 'stabile' : slope > 0 ? 'su' : 'giù' };
}
/** Indici dei valori che si staccano molto dagli altri (più di 2 deviazioni standard; servono almeno 7 giorni e un minimo di variazione). */
export function anomalies(values: number[]): number[] {
  if (values.length < 7) return [];
  const m = mean(values); const sd = Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
  if (sd < 0.5) return [];
  return values.map((v, i) => (Math.abs(v - m) > 2 * sd ? i : -1)).filter((i) => i >= 0);
}
/** Previsione lineare dei prossimi `n` valori, mai sotto zero. */
export function forecastNext(values: number[], n: number): number[] {
  const t = trend(values); const m = mean(values); const mid = (values.length - 1) / 2;
  return Array.from({ length: n }, (_, i) => Math.max(0, Math.round((m + t.slope * (values.length + i - mid)) * 10) / 10));
}

/* ---------- chi ha quanto lavoro ---------- */
export function workload(tasks: WTask[], nameOf: (id: string) => string): { who: string; open: number; late: number; minutes: number }[] {
  const t0 = new Date(); const today = iso(t0); const by = new Map<string, { open: number; late: number; minutes: number }>();
  for (const t of tasks) { if (t.deleted || t.status === 'done' || t.parent || !t.assignee) continue; const w = by.get(t.assignee) ?? { open: 0, late: 0, minutes: 0 }; w.open++; w.minutes += t.est_min ?? 0; if (t.due && t.due < today) w.late++; by.set(t.assignee, w); }
  return [...by.entries()].map(([id, w]) => ({ who: nameOf(id), ...w })).sort((a, b) => b.open - a.open);
}

/* ---------- il testo del report ---------- */
const fmt = (k: Pick<Kpi, 'value' | 'unit'>, cur?: string) => `${k.value.toLocaleString('it-CH', { maximumFractionDigits: 1 })}${k.unit ? (k.unit === '%' ? '%' : ' ' + k.unit) : cur ? ' ' + cur : ''}`;
const dText = (k: Kpi): string => { const d = delta(k); if (!d || d.dir === 'same') return d ? 'invariato' : ''; return `${d.dir === 'up' ? '+' : '−'}${Math.abs(d.pct ?? d.abs)}${d.pct == null ? '' : '%'} rispetto al periodo prima`; };
/** Il report scritto, in italiano, con quello che va bene, quello che preoccupa e che cosa fare. Si può rifinire con l'AI. */
export function reportText(o: { title: string; period: Period; kpis: Kpi[]; currency: string; workload: { who: string; open: number; late: number }[]; anomalyDays?: string[] }): string {
  const K = (id: string) => o.kpis.find((k) => k.id === id)!;
  const good: string[] = [], bad: string[] = [], todo: string[] = [];
  const done = K('done'), late = K('late'), ont = K('ontime'), won = K('won'), lost = K('lostN'), tOp = K('tOpened'), tSo = K('tSolved');
  if (done.value) good.push(`Chiusi ${done.value} task${dText(done) ? ` (${dText(done)})` : ''}.`);
  if (ont.value >= 80) good.push(`${ont.value}% dei task è stato chiuso entro la scadenza.`); else if (ont.value && ont.value < 60) bad.push(`Solo il ${ont.value}% dei task è stato chiuso entro la scadenza.`);
  if (late.value) { bad.push(`${late.value} task in ritardo${dText(late) ? ` (${dText(late)})` : ''}.`); todo.push('Rivedere le scadenze dei task in ritardo e avvisare le persone coinvolte.'); }
  if (won.value) good.push(`Vendite vinte per ${won.value.toLocaleString('it-CH')} ${o.currency}${dText(won) ? ` (${dText(won)})` : ''}.`);
  if (lost.value) bad.push(`${lost.value} trattative perse: capire il motivo e correggere l'offerta.`);
  if (K('owed').value) { bad.push(`Da incassare ${K('owed').value.toLocaleString('it-CH')} ${o.currency}.`); todo.push('Sollecitare i pagamenti scaduti.'); }
  if (tOp.value > tSo.value) { bad.push(`I reclami aperti (${tOp.value}) superano quelli risolti (${tSo.value}).`); todo.push('Dedicare tempo all\'assistenza per smaltire i reclami.'); } else if (tSo.value) good.push(`Risolti ${tSo.value} reclami.`);
  const busiest = o.workload[0]; if (busiest && busiest.open >= 8) { bad.push(`${busiest.who} ha ${busiest.open} task aperti: il carico è alto.`); todo.push(`Ridistribuire parte del lavoro di ${busiest.who}.`); }
  if (o.anomalyDays?.length) bad.push(`Giorni fuori dall'ordinario: ${o.anomalyDays.join(', ')}.`);
  const hrs = K('hours'); const lines = [`Report: ${o.title}`, `Periodo: ${o.period.label}`, ''];
  lines.push(`In sintesi: ${done.value} task chiusi, ${late.value} in ritardo${hrs.value ? `, ${hrs.value} ore lavorate` : ''}${won.value ? `, vendite per ${won.value.toLocaleString('it-CH')} ${o.currency}` : ''}.`, '');
  if (good.length) lines.push('Cosa va bene', ...good.map((x) => `- ${x}`), '');
  if (bad.length) lines.push('Cosa preoccupa', ...bad.map((x) => `- ${x}`), '');
  if (todo.length) lines.push('Che cosa fare', ...todo.map((x) => `- ${x}`), '');
  if (!good.length && !bad.length) lines.push('In questo periodo non ci sono ancora abbastanza dati.');
  return lines.join('\n').trim();
}
export function reportCsv(o: { period: Period; kpis: Kpi[] }): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return ['﻿Indicatore;Valore;Unità;Periodo prima;Variazione', ...o.kpis.map((k) => { const d = delta(k); return [q(k.label), String(k.value).replace('.', ','), q(k.unit), k.prev == null ? '' : String(k.prev).replace('.', ','), d ? (d.pct == null ? String(d.abs) : `${d.pct}%`) : ''].join(';'); })].join('\r\n');
}
export const tasksCsv = (tasks: WTask[], nameOf: (id: string) => string, projectName: (id: string | null) => string): string => {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return ['﻿Task;Progetto;Responsabile;Stato;Priorità;Scadenza;Ore previste', ...tasks.filter((t) => !t.deleted).map((t) => [q(t.title), q(projectName(t.project)), q(t.assignee ? nameOf(t.assignee) : ''), t.status, t.priority, t.due ?? '', t.est_min ? String(Math.round(t.est_min / 6) / 10).replace('.', ',') : ''].join(';'))].join('\r\n');
};

/* ---------- domande sui dati, in italiano ---------- */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Risposte immediate alle domande più comuni, dai numeri che l'app ha già. null = non so: si può chiedere all'AI. */
export function answer(q: string, o: { kpis: Kpi[]; workload: { who: string; open: number; late: number }[]; currency: string; period: Period }): string | null {
  const n = norm(q); const K = (id: string) => o.kpis.find((k) => k.id === id)!;
  if (/ritard/.test(n) && /task|attivit|lavor/.test(n)) return `${K('late').value} task in ritardo.`;
  if (/chi/.test(n) && /(piu|troppo|carico|aperti)/.test(n)) { const w = o.workload[0]; return w ? `${w.who} ha il carico maggiore: ${w.open} task aperti${w.late ? `, ${w.late} in ritardo` : ''}.` : 'Nessun task assegnato.'; }
  if (/(quanti|quante)/.test(n) && /task|attivit/.test(n) && /(chius|fatt|complet)/.test(n)) return `${K('done').value} task chiusi in ${o.period.label}.`;
  if (/ore/.test(n) && /(lavorat|registrat|totali|quante)/.test(n)) return `${K('hours').value} ore lavorate in ${o.period.label}.`;
  if (/(incass|devono|deve)/.test(n) || /da incassare/.test(n)) return `Da incassare ${K('owed').value.toLocaleString('it-CH')} ${o.currency}.`;
  if (/(previst|forecast|pipeline|trattative)/.test(n)) return `Previsto dalle trattative aperte: ${K('forecast').value.toLocaleString('it-CH')} ${o.currency}.`;
  if (/(vendite|vint|fatturato)/.test(n)) return `Vendite vinte in ${o.period.label}: ${K('won').value.toLocaleString('it-CH')} ${o.currency} (${K('wonN').value} trattative).`;
  if (/(reclam|assistenza|ticket)/.test(n)) return `Reclami: ${K('tOpened').value} aperti e ${K('tSolved').value} risolti in ${o.period.label}.`;
  if (/(assenz|ferie)/.test(n)) return `${K('absDays').value} giorni di assenza in ${o.period.label}.`;
  if (/riunion/.test(n)) return `${K('meetN').value} riunioni per ${K('meetH').value} ore in ${o.period.label}.`;
  if (/(tempo|giorni).*(chiud|complet)/.test(n) || /ciclo/.test(n)) return `In media ${K('cycle').value} giorni per chiudere un task.`;
  return null;
}

/* ---------- PDF ---------- */
export type Brand = { company: string; address: string; email: string; phone: string; vat: string; footer: string; color: string; logo?: string | null };
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** Intestazione con logo e dati aziendali, e piè di pagina: si usa in tutti i PDF (report, lettere, offerte, presentazioni). */
export function brandHeader(b: Brand): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#0F766E';
  return `<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid ${color};padding-bottom:10px;margin-bottom:18px">${b.logo ? `<img src="${esc(b.logo)}" style="height:48px;max-width:140px;object-fit:contain"/>` : ''}<div><div style="font-size:18px;font-weight:700;color:${color}">${esc(b.company)}</div><div style="font-size:11px;color:#555">${esc([b.address, b.phone, b.email, b.vat].filter(Boolean).join(' · '))}</div></div></div>`;
}
export const brandFooter = (b: Brand): string => (b.footer ? `<div style="margin-top:28px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#777">${esc(b.footer)}</div>` : '');
export function textToHtml(text: string): string {
  return text.split('\n').map((l) => (l.startsWith('- ') ? `<li>${esc(l.slice(2))}</li>` : l.trim() === '' ? '<br/>' : /^(Cosa va bene|Cosa preoccupa|Che cosa fare|Decisioni|Da fare|Ordine del giorno|Domande aperte)$/.test(l) ? `<h3>${esc(l)}</h3>` : `<p>${esc(l)}</p>`)).join('\n').replace(/(<li>.*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
}
export function reportHtml(o: { title: string; period: Period; kpis: Kpi[]; text: string; brand: Brand }): string {
  const rows = o.kpis.map((k) => { const d = delta(k); return `<tr><td>${esc(k.label)}</td><td style="text-align:right"><b>${esc(fmt(k))}</b></td><td style="text-align:right;color:#666">${k.prev == null ? '' : esc(fmt({ value: k.prev, unit: k.unit }))}</td><td style="text-align:right;color:${d?.good === true ? '#1a7a3e' : d?.good === false ? '#c02f2f' : '#666'}">${d ? (d.dir === 'same' ? '=' : `${d.dir === 'up' ? '▲' : '▼'} ${d.pct == null ? d.abs : d.pct + '%'}`) : ''}</td></tr>`; }).join('');
  return `<html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;padding:28px;font-size:13px}h1{font-size:22px;margin:0 0 4px}h3{margin:16px 0 4px;font-size:14px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border-bottom:1px solid #e5e5e5;padding:6px 4px;text-align:left}ul{margin:4px 0 4px 18px;padding:0}p{margin:2px 0}</style></head><body>${brandHeader(o.brand)}<h1>${esc(o.title)}</h1><div style="color:#666;margin-bottom:10px">${esc(o.period.label)}</div><table><tr><th>Indicatore</th><th style="text-align:right">Valore</th><th style="text-align:right">Prima</th><th style="text-align:right">Variazione</th></tr>${rows}</table>${textToHtml(o.text)}${brandFooter(o.brand)}</body></html>`;
}
