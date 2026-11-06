/** Garanzie (modulo PURO, nessun alias '@/'): scadenza e conto alla rovescia, stato, titolo della scheda, lettura sicura della risposta dell'AI.
 *  Le date sono quelle scritte sul documento: se manca la durata si propone 24 mesi (garanzia legale tipica per i beni di consumo nuovi) e si chiede di controllare. */
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (day: string) => new Date(day + 'T12:00:00Z');
export const DEFAULT_MONTHS = 24;
export const addDays = (day: string, n: number): string => { const d = dateOf(day); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
export const daysBetween = (a: string, b: string): number => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86400000);
export function addMonths(day: string, n: number): string {
  const d = dateOf(day); const dd = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dd, last)); return isoOf(d);
}
export const validDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOf(s).getTime()) && isoOf(dateOf(s)) === s;

export type WProduct = { id: string; name: string; brand?: string; model?: string; serial?: string; price?: number; months: number; assumed?: boolean; note?: string };
export type Purchase = { id: string; store: string; date: string; currency: 'EUR' | 'CHF'; total?: number; products: WProduct[]; pdf?: string; pages: string[]; source: 'scan' | 'foto' | 'file' | 'manuale'; createdAt: string; note?: string };
export const expiryOf = (date: string, months: number): string => addMonths(date, months);

/** La scadenza è l'ultimo giorno di garanzia: dal giorno dopo non è più coperta. */
export type Remaining = { expired: boolean; years: number; months: number; days: number; totalDays: number; label: string };
export function remaining(today: string, expiry: string): Remaining {
  const total = daysBetween(today, expiry); const expired = total < 0;
  const [a, b] = expired ? [expiry, today] : [today, expiry];
  let tm = (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
  if (addMonths(a, tm) > b) tm -= 1;
  const y = Math.floor(tm / 12); const m = tm % 12; const d = daysBetween(addMonths(a, tm), b);
  const parts: string[] = []; if (y) parts.push(`${y} ${y === 1 ? 'anno' : 'anni'}`); if (m) parts.push(`${m} ${m === 1 ? 'mese' : 'mesi'}`); if (d || !parts.length) parts.push(`${d} ${d === 1 ? 'giorno' : 'giorni'}`);
  const txt = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0]!;
  return { expired, years: y, months: m, days: d, totalDays: Math.abs(total), label: total === 0 ? 'Scade oggi' : expired ? `Scaduta da ${txt}` : `Mancano ${txt}` };
}
/** Quanta parte della garanzia è passata (0–1), dal giorno di acquisto alla scadenza. */
export function progress(purchaseDate: string, expiry: string, today: string): number { const span = daysBetween(purchaseDate, expiry); if (span <= 0) return 1; return Math.max(0, Math.min(1, daysBetween(purchaseDate, today) / span)); }
export type Status = 'attiva' | 'in scadenza' | 'scaduta';
export const statusOf = (expiry: string, today: string, soon = 60): Status => (expiry < today ? 'scaduta' : daysBetween(today, expiry) <= soon ? 'in scadenza' : 'attiva');
export const durationLabel = (months: number): string => { const y = Math.floor(months / 12); const m = months % 12; const a = y ? `${y} ${y === 1 ? 'anno' : 'anni'}` : ''; const b = m ? `${m} ${m === 1 ? 'mese' : 'mesi'}` : ''; return [a, b].filter(Boolean).join(' e '); };

/** «Lavatrice», «Lavatrice e Aspirapolvere», «Tv, Soundbar e Staffa»: tutti i nomi dei prodotti della scheda. */
export function purchaseTitle(p: Pick<Purchase, 'products' | 'store'>): string {
  const names = p.products.map((x) => x.name.trim()).filter(Boolean);
  if (!names.length) return p.store || 'Acquisto';
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
export const productExpiry = (p: Pick<Purchase, 'date'>, x: Pick<WProduct, 'months'>): string => expiryOf(p.date, x.months);
/** La prima scadenza tra i prodotti ancora coperti (o l'ultima già passata). */
export function nextExpiry(p: Purchase, today: string): string {
  const ex = p.products.map((x) => productExpiry(p, x)).sort(); const live = ex.filter((e) => e >= today);
  return live[0] ?? ex[ex.length - 1] ?? p.date;
}
/** Prima le garanzie che scadono prima; quelle scadute in fondo. */
export function sortPurchases(list: Purchase[], today: string): Purchase[] {
  return [...list].sort((a, b) => { const ea = nextExpiry(a, today); const eb = nextExpiry(b, today); const xa = ea < today ? 1 : 0; const xb = eb < today ? 1 : 0; return xa - xb || (xa ? eb.localeCompare(ea) : ea.localeCompare(eb)); });
}
export function summary(list: Purchase[], today: string): { products: number; active: number; soon: number; expired: number } {
  let active = 0; let soon = 0; let expired = 0; let products = 0;
  for (const p of list) for (const x of p.products) { products++; const s = statusOf(productExpiry(p, x), today); if (s === 'scaduta') expired++; else { active++; if (s === 'in scadenza') soon++; } }
  return { products, active, soon, expired };
}
/** Promemoria nel Plan, 30 giorni prima della scadenza, solo se è ancora nel futuro. */
export function reminders(p: Purchase, today: string, lead = 30): { day: string; title: string }[] {
  return p.products.map((x) => ({ x, e: productExpiry(p, x) })).map(({ x, e }) => ({ day: addDays(e, -lead), title: `Garanzia in scadenza: ${x.name}`.slice(0, 190), e })).filter((r) => r.e >= today).map((r) => ({ day: r.day < today ? today : r.day, title: r.title }));
}

/* ---------- lettura del documento ---------- */
export const WARRANTY_PROMPT = 'Questa è la foto o la scansione di una fattura, uno scontrino o un certificato di garanzia. Leggi i dati e rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"negozio":"nome del venditore","data":"YYYY-MM-DD data di acquisto","valuta":"EUR oppure CHF","totale":0,"prodotti":[{"nome":"nome del prodotto","marca":"","modello":"","seriale":"","prezzo":0,"garanzia_mesi":24}]}. Elenca solo i prodotti veri e propri (non spedizione, sconti, imballaggi, servizi). Metti "garanzia_mesi" SOLO se la durata della garanzia è scritta sul documento (per esempio "2 anni" = 24, "36 mesi" = 36); se non è scritta usa null. Se un dato non c\'è usa null o una stringa vuota. Non inventare nulla.';
const num = (v: unknown): number | undefined => { const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN; return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined; };
const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export type Read = { store: string; date: string | null; currency: 'EUR' | 'CHF'; total?: number; products: Omit<WProduct, 'id'>[] };
/** Legge la risposta dell'AI senza fidarsi: scarta date impossibili o future, durate assurde, prodotti senza nome. Se manca la durata propone 24 mesi e lo segnala. */
export function parseWarranty(text: string, today: string): Read | null {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
  let j: Record<string, unknown>; try { j = JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const raw = Array.isArray(j.prodotti) ? j.prodotti : []; const seen = new Set<string>(); const products: Read['products'] = [];
  for (const r of raw.slice(0, 12)) {
    const o = (r ?? {}) as Record<string, unknown>; const name = txt(o.nome, 80); if (!name || seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase());
    const mm = num(o.garanzia_mesi); const months = mm && mm >= 1 && mm <= 120 ? Math.round(mm) : DEFAULT_MONTHS;
    products.push({ name, months, ...(mm && mm >= 1 && mm <= 120 ? {} : { assumed: true }), ...(txt(o.marca, 40) ? { brand: txt(o.marca, 40) } : {}), ...(txt(o.modello, 40) ? { model: txt(o.modello, 40) } : {}), ...(txt(o.seriale, 40) ? { serial: txt(o.seriale, 40) } : {}), ...(num(o.prezzo) != null ? { price: num(o.prezzo) } : {}) });
  }
  const day = validDay(j.data) && j.data <= addDays(today, 1) && j.data >= '2000-01-01' ? j.data : null;
  const cur = String(j.valuta ?? '').toUpperCase() === 'CHF' ? 'CHF' : 'EUR';
  if (!products.length && !day && !txt(j.negozio, 60)) return null;
  return { store: txt(j.negozio, 60), date: day, currency: cur, ...(num(j.totale) != null ? { total: num(j.totale) } : {}), products };
}
