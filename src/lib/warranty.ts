/** Garanzie (modulo PURO, nessun alias '@/'): scadenza e conto alla rovescia, stato, titolo della scheda, lettura sicura della risposta dell'AI.
 *  Le date sono quelle scritte sul documento: se manca la durata si propone 24 mesi (garanzia legale tipica per i beni di consumo nuovi) e si chiede di controllare. */
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (day: string) => new Date(day + 'T12:00:00Z');
export const DEFAULT_MONTHS = 24; // garanzia legale tipica per i beni di consumo nuovi (Italia e Svizzera)
export const MAX_MONTHS = 120;
export const addDays = (day: string, n: number): string => { const d = dateOf(day); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
export const daysBetween = (a: string, b: string): number => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86400000);
export function addMonths(day: string, n: number): string {
  const d = dateOf(day); const dd = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dd, last)); return isoOf(d);
}
export const validDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOf(s).getTime()) && isoOf(dateOf(s)) === s;

/** `months` è la durata TOTALE della garanzia (legale + eventuale estensione). `legal` è la parte di legge (di solito 24 mesi); il resto è l'estensione.
 *  `assumed`: sul documento non c'è una durata e vale la garanzia legale. */
export type Insurance = { name: string; by?: string; cost?: number; kind: 'furto' | 'danni' | 'furto e danni' | 'altro'; months?: number; text?: string };
export const INSURANCE_KINDS: Insurance['kind'][] = ['furto', 'danni', 'furto e danni', 'altro'];
export type WProduct = { id: string; name: string; brand?: string; model?: string; serial?: string; price?: number; months: number; legal?: number; ext?: { by?: string; name?: string; cost?: number }; /** assicurazione trovata sullo scontrino: è un'altra cosa rispetto alla garanzia */ ins?: Insurance; assumed?: boolean; note?: string };
export type Purchase = { id: string; store: string; date: string; currency: 'EUR' | 'CHF'; total?: number; products: WProduct[]; pdf?: string; pages: string[]; source: 'scan' | 'foto' | 'file' | 'manuale'; createdAt: string; note?: string };
export const expiryOf = (date: string, months: number): string => addMonths(date, months);
/** La garanzia divisa: la parte di legge e l'estensione, con le due scadenze. */
export function coverage(x: Pick<WProduct, 'months' | 'legal' | 'ext'>): { legal: number; extra: number; total: number; extended: boolean; by?: string } {
  const legal = Math.min(x.months, x.legal ?? Math.min(x.months, DEFAULT_MONTHS)); const extra = Math.max(0, x.months - legal);
  return { legal, extra, total: x.months, extended: extra > 0, ...(x.ext?.by ? { by: x.ext.by } : {}) };
}
export const legalExpiry = (date: string, x: Pick<WProduct, 'months' | 'legal' | 'ext'>): string => expiryOf(date, coverage(x).legal);
/** Imposta legale ed estensione insieme: il totale è la somma. */
export const withCoverage = <T extends { months: number; legal?: number; assumed?: boolean }>(x: T, legal: number, extra: number): T => ({ ...x, legal, months: Math.max(1, Math.min(MAX_MONTHS, legal + extra)), assumed: false });

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
export const WARRANTY_PROMPT = 'Questa è la foto o la scansione di una fattura, di uno scontrino o di un certificato di garanzia. Leggi TUTTO il documento, anche le righe piccole, i timbri, il retro e le condizioni in fondo, e rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"negozio":"nome del venditore","data":"YYYY-MM-DD data di acquisto","valuta":"EUR oppure CHF","totale":0,"garanzia_generale_mesi":null,"prodotti":[{"nome":"","marca":"","modello":"","seriale":"","prezzo":0,"garanzia_mesi":null,"garanzia_legale_mesi":null,"estensione_mesi":null,"estensione_fornitore":"","estensione_nome":"","estensione_costo":null}],"estensioni":[{"prodotto":"nome del prodotto a cui si riferisce","mesi":0,"fornitore":"","nome":"","costo":0}],"assicurazioni":[{"prodotto":"","nome":"","fornitore":"","costo":0,"copertura":"furto oppure danni oppure furto e danni oppure altro","mesi":null,"testo":"riga letta"}],"voci_incerte":[{"testo":"riga letta","prodotto":"","mesi":null,"costo":null}]}. Regole: 1) "prodotti" contiene solo i prodotti veri (non spedizione, sconti, imballaggi, servizi, e NON estensioni di garanzia né assicurazioni). 2) La garanzia legale di conformità dei beni di consumo nuovi è di 24 mesi: se il documento la scrive mettila in "garanzia_legale_mesi". 3) "garanzia_mesi" è la durata TOTALE finale che il documento dà al prodotto, estensione compresa (per esempio "garanzia 3 anni" = 36, "garanzia produttore 5 anni" = 60). 4) Una ESTENSIONE o PROLUNGAMENTO di garanzia (per esempio "Estensione garanzia 24 mesi", "Extra garanzia", "Garanzia convenzionale", "Warranty extension") prolunga la copertura dei guasti: mettila in "estensione_mesi" del prodotto (mesi AGGIUNTIVI oltre alla garanzia legale) con fornitore, nome commerciale e costo; se è una riga a parte nella fattura mettila in "estensioni". 5) Una ASSICURAZIONE copre furto, danni accidentali, rottura, caduta o liquidi (per esempio "Assicurazione furto e danni", "Protezione danni", "Polizza"): mettila in "assicurazioni", MAI tra le estensioni, e non mescolare i mesi dell\'una con l\'altra. 6) Se non sei sicuro se una riga è un\'estensione di garanzia o un\'assicurazione (per esempio "Care", "Protezione", "Piano assistenza", "Servizio"), mettila in "voci_incerte" con il testo esatto che leggi. 7) Se una frase vale per tutti i prodotti (per esempio "tutti i prodotti hanno 24 mesi di garanzia") scrivila in "garanzia_generale_mesi". 8) Converti sempre gli anni in mesi. Se un dato non c\'è usa null o una stringa vuota. Non inventare nulla.';
const num = (v: unknown): number | undefined => { const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN; return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined; };
const mon = (v: unknown): number | undefined => { const n = num(v); return n != null && n >= 1 && n <= MAX_MONTHS ? Math.round(n) : undefined; };
const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const monthsInText = (s: string): number | undefined => { const m = s.match(/(\d{1,2})\s*(anni|anno|years?|mesi|mese|months?)/i); if (!m) return undefined; const n = parseInt(m[1]!, 10); return /^(a|y)/i.test(m[2]!) ? n * 12 : n; };
const EXT_ROW = /^(estensione|prolungamento|extra ?garanzia|garanzia (estesa|convenzionale|aggiuntiva)|warranty extension|extended warranty)/i;
const INS_ROW = /^(assicurazion|polizza|insurance|protezione (furto|danni)|furto|danni)/i;
const AMBIG_ROW = /^(care\b|protezione|protection|piano|plan\b|assistenza|servizio|garanzia\b|warranty|pacchetto|pack\b)/i;
export const insuranceKindOf = (s: string): Insurance['kind'] => { const t = s.toLowerCase(); const f = /furt|theft|stolen|diebstahl/.test(t); const d = /dann|rottur|cadut|liquid|accident|damage|schaden|bruch/.test(t); return f && d ? 'furto e danni' : f ? 'furto' : d ? 'danni' : 'altro'; };

/** Una voce trovata sul documento che non è un prodotto: estensione di garanzia, assicurazione o dubbia. */
export type Item = { kind: 'estensione' | 'assicurazione' | 'incerta'; months?: number; by?: string; name?: string; cost?: number; cover?: Insurance['kind']; text?: string; productName?: string };
export type Question = { id: string; ask: 'prodotto' | 'tipo' | 'durata'; text: string; line?: string; options: { id: string; label: string }[]; item: Item; product?: number };
type PLike = Pick<WProduct, 'name' | 'months' | 'legal' | 'ext' | 'ins' | 'assumed'>;
export const TYPE_OPTIONS = [{ id: 'estensione', label: 'Estensione di garanzia' }, { id: 'assicurazione', label: 'Assicurazione (furto o danni)' }, { id: 'altro', label: 'Altro: non è una garanzia' }];
export const MONTH_OPTIONS = [12, 24, 36, 48].map((m) => ({ id: `m${m}`, label: durationLabel(m) })).concat([{ id: 'nessuno', label: 'Non lo so' }]);
const itemName = (it: Item) => it.name || it.text || (it.kind === 'assicurazione' ? 'Assicurazione' : 'Estensione di garanzia');
let qn = 0; const qid = () => `q${Date.now().toString(36)}${(qn++).toString(36)}`;

/** Mette una voce sul prodotto giusto. Se non è chiaro a quale prodotto, quanto dura o che cosa sia, aggiunge una domanda per l'utente invece di indovinare. */
export function settle<T extends PLike>(items: T[], qs: Question[], it: Item, pi?: number): void {
  if (pi === undefined && items.length === 1) pi = 0;
  const line = it.text ?? it.name;
  if (pi === undefined || !items[pi]) {
    if (!items.length) return;
    qs.push({ id: qid(), ask: 'prodotto', text: `A quale prodotto si riferisce «${itemName(it)}»?`, ...(line ? { line } : {}), options: [...items.map((p, i) => ({ id: `p${i}`, label: p.name })), { id: 'nessuno', label: 'A nessun prodotto' }], item: it }); return;
  }
  const x = items[pi]!;
  if (it.kind === 'estensione') {
    if (!it.months) { qs.push({ id: qid(), ask: 'durata', text: `Per quanti mesi in più vale «${itemName(it)}»?`, ...(line ? { line } : {}), options: MONTH_OPTIONS, item: it, product: pi }); return; }
    const legal = x.legal ?? Math.min(x.months, DEFAULT_MONTHS); const total = Math.min(MAX_MONTHS, x.months > legal && !x.assumed ? Math.max(x.months, legal + it.months) : legal + it.months);
    x.legal = legal; x.months = total; x.assumed = false; x.ext = { ...(it.by ? { by: it.by } : {}), ...(it.name ? { name: it.name } : {}), ...(it.cost != null ? { cost: it.cost } : {}) };
  } else if (it.kind === 'assicurazione') {
    x.ins = { name: itemName(it), kind: it.cover ?? insuranceKindOf(`${it.name ?? ''} ${it.text ?? ''}`), ...(it.by ? { by: it.by } : {}), ...(it.cost != null ? { cost: it.cost } : {}), ...(it.months ? { months: it.months } : {}), ...(it.text ? { text: it.text } : {}) };
  } else qs.push({ id: qid(), ask: 'tipo', text: `«${itemName(it)}» è un'estensione di garanzia o un'assicurazione?`, ...(line ? { line } : {}), options: TYPE_OPTIONS, item: it, product: pi });
}
/** Applica la risposta dell'utente a una domanda. `spiega` = ha scritto lui cosa è: resta come nota e non si indovina niente. */
export function answer<T extends PLike>(items: T[], qs: Question[], id: string, opt: string, explain?: string): { items: T[]; qs: Question[]; note?: string } {
  const q = qs.find((x) => x.id === id); if (!q) return { items, qs };
  const next = items.map((x) => ({ ...x })); const rest = qs.filter((x) => x.id !== id); const line = q.item.text ?? q.item.name ?? '';
  const drop = (why: string) => ({ items: next, qs: rest, note: `${why}${line ? `: «${line}»` : ''}` });
  if (opt === 'spiega') return { items: next, qs: rest, note: `Chiarimento${line ? ` su «${line}»` : ''}: ${(explain ?? '').trim() || 'nessuno'}` };
  if (q.ask === 'prodotto') { const m = opt.match(/^p(\d+)$/); if (!m) return drop('Voce non collegata a un prodotto'); settle(next, rest, q.item, parseInt(m[1]!, 10)); return { items: next, qs: rest }; }
  if (q.ask === 'tipo') {
    if (opt === 'estensione') { settle(next, rest, { ...q.item, kind: 'estensione' }, q.product); return { items: next, qs: rest }; }
    if (opt === 'assicurazione') { settle(next, rest, { ...q.item, kind: 'assicurazione' }, q.product); return { items: next, qs: rest }; }
    return drop('Voce che non è una garanzia');
  }
  const m = opt.match(/^m(\d+)$/); if (!m) return drop('Durata non nota'); settle(next, rest, { ...q.item, months: parseInt(m[1]!, 10) }, q.product); return { items: next, qs: rest };
}

export type Read = { store: string; date: string | null; currency: 'EUR' | 'CHF'; total?: number; products: Omit<WProduct, 'id'>[]; extensionsFound: number; insurancesFound: number; questions: Question[] };
type Ext = { product: string; months: number; by: string; name: string; cost?: number };

/** Legge la risposta dell'AI senza fidarsi. Garanzia legale, estensioni e assicurazioni restano separate. Se qualcosa è ambiguo (che cosa è, a quale prodotto, quanto dura) non indovina: fa una domanda. */
export function parseWarranty(text: string, today: string): Read | null {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
  let j: Record<string, unknown>; try { j = JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const general = mon(j.garanzia_generale_mesi);
  const exts: Ext[] = []; const extUnknown: Item[] = []; const loose: Item[] = [];
  for (const r of (Array.isArray(j.estensioni) ? j.estensioni : []).slice(0, 12)) { const o = (r ?? {}) as Record<string, unknown>; const e = { product: norm(txt(o.prodotto, 80)), months: mon(o.mesi) ?? 0, by: txt(o.fornitore, 60), name: txt(o.nome, 80), ...(num(o.costo) != null ? { cost: num(o.costo) } : {}) }; if (e.months > 0) exts.push(e); else if (e.name || e.by) extUnknown.push({ kind: 'estensione', by: e.by, name: e.name, ...(e.cost != null ? { cost: e.cost } : {}), text: e.name, productName: e.product }); }
  for (const r of (Array.isArray(j.assicurazioni) ? j.assicurazioni : []).slice(0, 8)) { const o = (r ?? {}) as Record<string, unknown>; const name = txt(o.nome, 80) || txt(o.testo, 80); if (!name) continue; loose.push({ kind: 'assicurazione', name, ...(txt(o.fornitore, 60) ? { by: txt(o.fornitore, 60) } : {}), ...(num(o.costo) != null ? { cost: num(o.costo) } : {}), cover: insuranceKindOf(`${txt(o.copertura, 40)} ${name} ${txt(o.testo, 120)}`), ...(mon(o.mesi) ? { months: mon(o.mesi) } : {}), ...(txt(o.testo, 120) ? { text: txt(o.testo, 120) } : {}), productName: norm(txt(o.prodotto, 80)) }); }
  for (const r of (Array.isArray(j.voci_incerte) ? j.voci_incerte : []).slice(0, 8)) { const o = (r ?? {}) as Record<string, unknown>; const t = txt(o.testo, 120); if (!t) continue; loose.push({ kind: 'incerta', name: t, text: t, ...(mon(o.mesi) ?? monthsInText(t) ? { months: mon(o.mesi) ?? monthsInText(t) } : {}), ...(num(o.costo) != null ? { cost: num(o.costo) } : {}), productName: norm(txt(o.prodotto, 80)) }); }
  const raw = Array.isArray(j.prodotti) ? j.prodotti : []; const seen = new Set<string>(); const rows: Record<string, unknown>[] = [];
  for (const r of raw.slice(0, 16)) {
    const o = (r ?? {}) as Record<string, unknown>; const name = txt(o.nome, 80); if (!name) continue; const bare = !txt(o.marca, 40) && !txt(o.modello, 40);
    if (bare && EXT_ROW.test(name)) { const mm = monthsInText(name) ?? mon(o.estensione_mesi) ?? mon(o.garanzia_mesi); if (mm) exts.push({ product: '', months: mm, by: txt(o.estensione_fornitore, 60), name, ...(num(o.prezzo) != null ? { cost: num(o.prezzo) } : {}) }); else extUnknown.push({ kind: 'estensione', name, text: name, ...(num(o.prezzo) != null ? { cost: num(o.prezzo) } : {}) }); continue; }
    if (bare && INS_ROW.test(name)) { loose.push({ kind: 'assicurazione', name, text: name, cover: insuranceKindOf(name), ...(monthsInText(name) ? { months: monthsInText(name) } : {}), ...(num(o.prezzo) != null ? { cost: num(o.prezzo) } : {}) }); continue; }
    if (bare && AMBIG_ROW.test(name)) { loose.push({ kind: 'incerta', name, text: name, ...(monthsInText(name) ? { months: monthsInText(name) } : {}), ...(num(o.prezzo) != null ? { cost: num(o.prezzo) } : {}) }); continue; }
    if (seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase()); rows.push(o);
  }
  const used = new Set<Ext>(); const products: Read['products'] = [];
  for (const o of rows.slice(0, 12)) {
    const name = txt(o.nome, 80); const key = norm(name);
    const own: Ext | undefined = mon(o.estensione_mesi) ? { product: key, months: mon(o.estensione_mesi)!, by: txt(o.estensione_fornitore, 60), name: txt(o.estensione_nome, 80), ...(num(o.estensione_costo) != null ? { cost: num(o.estensione_costo) } : {}) } : undefined;
    const link = own ?? exts.find((e) => !used.has(e) && e.product && (key.includes(e.product) || e.product.includes(key))) ?? (rows.length === 1 ? exts.find((e) => !used.has(e)) : undefined);
    if (link) used.add(link);
    const stated = mon(o.garanzia_mesi); const legalStated = mon(o.garanzia_legale_mesi); const extra = link?.months;
    const legal = legalStated ?? (stated && stated < DEFAULT_MONTHS && !extra ? stated : DEFAULT_MONTHS);
    let total = stated ?? (extra ? legal + extra : general ?? legal); if (extra && stated && stated < legal + extra) total = legal + extra;
    const assumed = !stated && !extra && !general;
    const ext = link && total > legal ? { ...(link.by ? { by: link.by } : {}), ...(link.name ? { name: link.name } : {}), ...(link.cost != null ? { cost: link.cost } : {}) } : undefined;
    products.push({ name, months: Math.min(MAX_MONTHS, total), legal: Math.min(legal, total), ...(ext ? { ext } : {}), ...(assumed ? { assumed: true } : {}), ...(txt(o.marca, 40) ? { brand: txt(o.marca, 40) } : {}), ...(txt(o.modello, 40) ? { model: txt(o.modello, 40) } : {}), ...(txt(o.seriale, 40) ? { serial: txt(o.seriale, 40) } : {}), ...(num(o.prezzo) != null ? { price: num(o.prezzo) } : {}) });
  }
  const questions: Question[] = []; const match = (n?: string): number | undefined => { if (!n) return undefined; const i = products.findIndex((p) => { const k = norm(p.name); return k.includes(n) || n.includes(k); }); return i >= 0 ? i : undefined; };
  for (const e of exts.filter((x) => !used.has(x))) settle(products, questions, { kind: 'estensione', months: e.months, by: e.by, name: e.name, cost: e.cost, text: e.name }, match(e.product));
  for (const it of extUnknown) settle(products, questions, it, match(it.productName));
  for (const it of loose) settle(products, questions, it, match(it.productName));
  const day = validDay(j.data) && j.data <= addDays(today, 1) && j.data >= '2000-01-01' ? j.data : null;
  const cur = String(j.valuta ?? '').toUpperCase() === 'CHF' ? 'CHF' : 'EUR';
  if (!products.length && !day && !txt(j.negozio, 60)) return null;
  return { store: txt(j.negozio, 60), date: day, currency: cur, ...(num(j.totale) != null ? { total: num(j.totale) } : {}), products, extensionsFound: products.filter((p) => (p.months - (p.legal ?? DEFAULT_MONTHS)) > 0).length, insurancesFound: products.filter((p) => p.ins).length, questions };
}
