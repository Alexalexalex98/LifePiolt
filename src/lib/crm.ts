/** Clienti, vendite e fornitori (modulo PURO, nessun alias '@/'): trattative, richiami, rinnovi, da incassare, preventivi con IVA italiana e svizzera, tempi di risposta. */
export type Currency = 'CHF' | 'EUR';
export type Kind = 'client' | 'supplier' | 'lead';
export type Contact = { id: string; team_id: string; kind: Kind; name: string; company: string; email: string; phone: string; address: string; country: 'IT' | 'CH' | null; vat: string; notes: string; owner: string | null; status: 'active' | 'archived' };
export type Interaction = { id: string; team_id: string; contact: string; kind: 'call' | 'email' | 'meeting' | 'visit' | 'note'; text: string; by: string; at: string; follow_up: string | null; follow_done: boolean };
export type Stage = 'lead' | 'contact' | 'quote' | 'negotiation' | 'won' | 'lost';
export type Deal = { id: string; team_id: string; contact: string; title: string; stage: Stage; amount: number; currency: Currency; expected_close: string | null; renewal: string | null; probability: number | null; owner: string | null; notes: string; lost_reason: string };
export type Ticket = { id: string; team_id: string; contact: string | null; title: string; text: string; priority: 'low' | 'normal' | 'high' | 'urgent'; status: 'open' | 'doing' | 'resolved'; assignee: string | null; created_at: string; resolved_at: string | null };
export type Receivable = { id: string; team_id: string; contact: string; label: string; amount: number; currency: Currency; due: string | null; paid: boolean };

export const KIND_LABEL: Record<Kind, string> = { client: 'Cliente', supplier: 'Fornitore', lead: 'Contatto nuovo' };
export const STAGES: { id: Stage; label: string; prob: number }[] = [
  { id: 'lead', label: 'Contatto', prob: 10 }, { id: 'contact', label: 'Primo incontro', prob: 25 }, { id: 'quote', label: 'Preventivo', prob: 50 },
  { id: 'negotiation', label: 'Trattativa', prob: 75 }, { id: 'won', label: 'Vinta', prob: 100 }, { id: 'lost', label: 'Persa', prob: 0 },
];
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)!.label;
export const probOf = (d: Pick<Deal, 'stage' | 'probability'>): number => d.probability ?? STAGES.find((x) => x.id === d.stage)!.prob;
export const nextStage = (s: Stage): Stage | null => { const o: Stage[] = ['lead', 'contact', 'quote', 'negotiation', 'won']; const i = o.indexOf(s); return i >= 0 && i < o.length - 1 ? o[i + 1]! : null; };
export const nameOfContact = (c: Pick<Contact, 'name' | 'company'>) => (c.company && c.company !== c.name ? `${c.name} · ${c.company}` : c.name);

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Per fase: quante trattative, quanto valgono, quanto valgono pesate con la probabilità. Solo le trattative aperte entrano nel «previsto». */
export function pipeline(deals: Deal[], currency: Currency): { stage: Stage; count: number; total: number; weighted: number }[] {
  return STAGES.map(({ id }) => {
    const l = deals.filter((d) => d.stage === id && d.currency === currency);
    return { stage: id, count: l.length, total: r2(sum(l.map((d) => d.amount))), weighted: id === 'won' || id === 'lost' ? 0 : r2(sum(l.map((d) => d.amount * probOf(d) / 100))) };
  });
}
/** Percentuale di trattative vinte su quelle chiuse. */
export function winRate(deals: Deal[]): number | null { const won = deals.filter((d) => d.stage === 'won').length, lost = deals.filter((d) => d.stage === 'lost').length; return won + lost ? Math.round((won / (won + lost)) * 100) : null; }

const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const followUpsDue = (list: Interaction[], today: string): Interaction[] => list.filter((i) => i.follow_up && !i.follow_done && i.follow_up <= today).sort((a, b) => (a.follow_up ?? '').localeCompare(b.follow_up ?? ''));
/** Rinnovi dei contratti vinti nei prossimi `days` giorni (o già scaduti). */
export const renewalsSoon = (deals: Deal[], today: string, days = 45): Deal[] => deals.filter((d) => d.stage === 'won' && d.renewal && d.renewal <= addDays(today, days)).sort((a, b) => (a.renewal ?? '').localeCompare(b.renewal ?? ''));
/** Trattative aperte che dovevano chiudersi e non l'hanno fatto. */
export const overdueDeals = (deals: Deal[], today: string): Deal[] => deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost' && d.expected_close && d.expected_close < today);

/** Quello che il cliente ti deve: per valuta, e quanto è già scaduto. */
export function owed(rec: Receivable[], today: string): Record<Currency, { open: number; late: number }> {
  const out: Record<Currency, { open: number; late: number }> = { CHF: { open: 0, late: 0 }, EUR: { open: 0, late: 0 } };
  for (const r of rec) if (!r.paid) { out[r.currency].open = r2(out[r.currency].open + r.amount); if (r.due && r.due < today) out[r.currency].late = r2(out[r.currency].late + r.amount); }
  return out;
}

/* ---------- preventivo ---------- */
export const VAT: Record<'IT' | 'CH', { rate: number; name: string }> = { IT: { rate: 22, name: 'IVA' }, CH: { rate: 8.1, name: 'IVA' } };
export type QuoteLine = { desc: string; qty: number; price: number };
export type Quote = { subtotal: number; discount: number; net: number; vatRate: number; vat: number; total: number };
/** Totali: sconto in percentuale, IVA del paese (Italia 22%, Svizzera 8,1%); in franchi il totale si arrotonda ai 5 centesimi. */
export function computeQuote(lines: QuoteLine[], country: 'IT' | 'CH', currency: Currency, discountPct = 0): Quote {
  const subtotal = r2(sum(lines.map((l) => l.qty * l.price)));
  const discount = r2(subtotal * Math.min(100, Math.max(0, discountPct)) / 100);
  const net = r2(subtotal - discount);
  const vatRate = VAT[country].rate; const vat = r2(net * vatRate / 100);
  let total = r2(net + vat); if (currency === 'CHF') total = Math.round(total * 20) / 20;
  return { subtotal, discount, net, vatRate, vat, total: r2(total) };
}
const money = (n: number, c: Currency) => `${n.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
/** Il testo del preventivo, pronto da inviare o da salvare. */
export function quoteText(o: { from: string; client: Contact; title: string; lines: QuoteLine[]; currency: Currency; discountPct?: number; validDays?: number; payment?: string; today: string; number?: string }): string {
  const country = o.client.country ?? 'IT';
  const q = computeQuote(o.lines, country, o.currency, o.discountPct ?? 0);
  const d = new Date(o.today + 'T12:00:00'); const fmt = (x: Date) => `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
  const until = new Date(d); until.setDate(until.getDate() + (o.validDays ?? 30));
  return [
    `Preventivo${o.number ? ` n. ${o.number}` : ''}: ${o.title}`, `${o.from}`, `Data: ${fmt(d)}`, '',
    `Spett.le ${nameOfContact(o.client)}`, ...(o.client.address ? [o.client.address] : []), ...(o.client.vat ? [`${country === 'CH' ? 'IDI' : 'P.IVA'} ${o.client.vat}`] : []), '',
    'Descrizione · Quantità · Prezzo · Importo', ...o.lines.map((l) => `- ${l.desc} · ${l.qty} · ${money(l.price, o.currency)} · ${money(r2(l.qty * l.price), o.currency)}`), '',
    `Imponibile: ${money(q.subtotal, o.currency)}`, ...(q.discount ? [`Sconto: -${money(q.discount, o.currency)}`] : []), `${VAT[country].name} ${q.vatRate}%: ${money(q.vat, o.currency)}`, `TOTALE: ${money(q.total, o.currency)}`, '',
    `Validità dell'offerta: fino al ${fmt(until)}.`, `Pagamento: ${o.payment ?? '30 giorni dalla data fattura'}.`, 'Restiamo a disposizione per qualsiasi chiarimento. Cordiali saluti',
  ].join('\n');
}

/* ---------- assistenza ---------- */
const SLA_H: Record<Ticket['priority'], number> = { urgent: 4, high: 24, normal: 72, low: 168 };
/** Ore trascorse e se è scaduto il tempo di risposta previsto per quella priorità. */
export function slaOf(t: Pick<Ticket, 'priority' | 'status' | 'created_at'>, nowMs: number): { hours: number; late: boolean; limit: number } {
  const hours = Math.max(0, Math.floor((nowMs - new Date(t.created_at).getTime()) / 3600000));
  return { hours, limit: SLA_H[t.priority], late: t.status !== 'resolved' && hours > SLA_H[t.priority] };
}
export const openTickets = (l: Ticket[]) => l.filter((t) => t.status !== 'resolved');

export const validEmail = (s: string) => s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
export const contactMatches = (c: Contact, q: string): boolean => { const n = q.trim().toLowerCase(); return !n || `${c.name} ${c.company} ${c.email} ${c.phone} ${c.vat}`.toLowerCase().includes(n); };
export const telUrl = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`;
