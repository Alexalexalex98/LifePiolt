/**
 * Riconoscimento dei documenti di lavoro (modulo PURO, nessun alias '@/'): da testo e nome del file capisce di che documento si tratta
 * (CV, fattura, bolletta, busta paga, contratto, preventivo, verbale, documenti fiscali Italia e Svizzera...) e ne estrae i dati.
 * Tutto a regole, sul telefono: funziona senza AI e senza costi. Con l'AI collegata si può leggere anche ciò che le regole non vedono.
 */
export type DocKind = 'cv' | 'invoice' | 'bill' | 'payslip' | 'contract' | 'quote' | 'receipt' | 'minutes' | 'tax' | 'registry' | 'certificate' | 'other';
export type Access = 'team' | 'admin' | 'person';
export type DocInfo = { label: string; section: string; access: Access; icon: string };
/** Dove va ciascun tipo e chi lo vede (buste paga e documenti personali: amministratori e persona interessata; CV e fatture: amministratori). */
export const KINDS: Record<DocKind, DocInfo> = {
  cv: { label: 'Curriculum', section: 'Candidati', access: 'admin', icon: 'user' },
  invoice: { label: 'Fattura', section: 'Pagamenti', access: 'admin', icon: 'file' },
  bill: { label: 'Bolletta', section: 'Pagamenti', access: 'admin', icon: 'file' },
  payslip: { label: 'Busta paga', section: 'Buste paga', access: 'person', icon: 'file' },
  contract: { label: 'Contratto', section: 'Contratti', access: 'admin', icon: 'note' },
  quote: { label: 'Preventivo', section: 'Preventivi', access: 'team', icon: 'note' },
  receipt: { label: 'Ricevuta o nota spese', section: 'Spese', access: 'admin', icon: 'file' },
  minutes: { label: 'Verbale', section: 'Altri documenti', access: 'team', icon: 'note' },
  tax: { label: 'Documento fiscale', section: 'Fisco', access: 'admin', icon: 'file' },
  registry: { label: 'Visura o registro di commercio', section: 'Fisco', access: 'team', icon: 'file' },
  certificate: { label: 'Certificato', section: 'Altri documenti', access: 'team', icon: 'file' },
  other: { label: 'Altro documento', section: 'Altri documenti', access: 'team', icon: 'file' },
};
export const SECTIONS = ['Candidati', 'Pagamenti', 'Buste paga', 'Contratti', 'Preventivi', 'Spese', 'Fisco', 'Altri documenti'] as const;

export type DocResult = { kind: DocKind; confidence: number; country: 'IT' | 'CH' | null; tipo?: string; title: string; fields: Record<string, string>; amount?: number; currency?: 'CHF' | 'EUR'; due?: string };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Rule = [RegExp, number];
const RULES: Record<Exclude<DocKind, 'other'>, Rule[]> = {
  payslip: [[/busta paga|cedolino|lohnabrechnung|fiche de paie|decompte de salaire/, 5], [/retribuzione netta|netto in busta|stipendio netto|salario netto|netto a pagare|nettolohn/, 3], [/contributi inps|irpef|\btfr\b|ahv|lpp|bvg|quote sociali/, 2], [/\bmensilita\b|periodo di paga|competenze/, 2], [/certificazione unica|\bcu 20\d\d|certificato di salario|lohnausweis|certificat de salaire/, 6]],
  cv: [[/curriculum|lebenslauf|\bresume\b/, 5], [/(^|[\s_\-.])cv([\s_\-.]|$)/, 3], [/esperienza (?:lavorativa|professionale)|work experience|berufserfahrung/, 3], [/formazione|istruzione|competenze|skills|ausbildung/, 1], [/obiettivo professionale|profilo professionale|conoscenza delle lingue|lingue straniere/, 2]],
  invoice: [[/fattura|invoice|rechnung|facture/, 4], [/imponibile|partita iva|p\.iva|mwst|iva \d+%|\biva\b/, 2], [/fattura n|invoice (?:no|number)|rechnung nr|numero fattura/, 3], [/totale documento|totale fattura|total due|rechnungsbetrag/, 2]],
  bill: [[/bolletta|\bpod\b|\bpdr\b|\bkwh\b|\bsmc\b|consumo|utenza|fornitura (?:luce|gas|acqua|energia)/, 3], [/qr-fattura|zahlteil|polizza di versamento|ricevuta di versamento|empfangsschein|bulletin de versement/, 5], [/scadenza|entro il|zu zahlen bis/, 1]],
  contract: [[/contratto|arbeitsvertrag|vertrag\b|contrat de/, 4], [/le parti|tra le parti|zwischen den parteien|premesso che|si conviene|si stipula/, 3], [/recesso|rescissione|clausola|kundigung|durata del contratto|rinnovo tacito/, 2], [/\bart\. ?\d+/, 1], [/locazione|affitto|assunzione|incarico|collaborazione/, 1]],
  quote: [[/preventivo|offerta|quotation|offerte\b|kostenvoranschlag|devis/, 4], [/valida fino|validita dell'offerta|gultig bis|valable jusqu/, 3], [/stima dei costi|condizioni di pagamento|tempi di consegna/, 1]],
  receipt: [[/nota spese|spesenabrechnung|note de frais/, 5], [/scontrino|ricevuta fiscale|quittung|ticket de caisse/, 4], [/ricevuta|rimborso|receipt/, 2]],
  minutes: [[/verbale|protokoll|proces-verbal|minutes of/, 4], [/ordine del giorno|tagesordnung|traktanden/, 2], [/presenti:|decisioni|assenti:/, 1]],
  tax: [[/modello 730|dichiarazione dei redditi|\bf24\b|agenzia delle entrate|steuererklarung|dichiarazione fiscale|ufficio imposte|\bimu\b|iva trimestrale|dichiarazione iva|imposta/, 4], [/codice tributo|periodo di riferimento|steuerverwaltung/, 2]],
  registry: [[/visura camerale|camera di commercio|registro delle imprese|registro di commercio|handelsregister|registre du commerce/, 5], [/\bche-?\d{3}\.\d{3}\.\d{3}\b|\buid\b|codice ateco|\brea\b/, 2]],
  certificate: [[/\bdurc\b|documento unico di regolarita contributiva/, 6], [/certificato|attestato|zertifikat|attestation|certificate/, 2], [/iso ?9001|iso ?14001|soa\b/, 3]],
};
const IT_HINT = /codice fiscale|p\.? ?iva|\binps\b|irpef|agenzia delle entrate|durc|\bf24\b|camera di commercio|visura|iva 22|\bsrl\b|\bspa\b|\bsnc\b|\bs\.r\.l\b/;
const CH_HINT = /\bchf\b|\bavs\b|\bahv\b|\blpp\b|\bbvg\b|iban ch|\bmwst\b|svizzera|schweiz|zahlteil|qr-fattura|\bsagl?\b|\bgmbh\b|\bsa\b|\bag\b|che-?\d{3}|lohnausweis|certificato di salario/;

/** Tipo + paese. Il nome del file pesa il doppio del testo. */
export function classify(name: string, text: string): { kind: DocKind; confidence: number; country: 'IT' | 'CH' | null } {
  const body = norm(text).slice(0, 8000), file = norm(name.replace(/\.[a-z0-9]{2,5}$/i, ' ').replace(/[_\-.]+/g, ' '));
  const scores = new Map<DocKind, number>();
  for (const [k, rules] of Object.entries(RULES) as [Exclude<DocKind, 'other'>, Rule[]][]) {
    let s = 0;
    for (const [re, w] of rules) { if (re.test(body)) s += w; if (re.test(file)) s += w * 2; }
    if (s) scores.set(k, s);
  }
  // fattura e bolletta si somigliano: la bolletta vince se ci sono segni di utenza o di polizza di versamento
  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  const second = [...scores.entries()].sort((a, b) => b[1] - a[1])[1];
  const country = CH_HINT.test(body + ' ' + file) && !(IT_HINT.test(body) && !/\bchf\b|svizzera/.test(body)) ? 'CH' : IT_HINT.test(body + ' ' + file) ? 'IT' : null;
  if (!best || best[1] < 3) return { kind: 'other', confidence: 0.2, country };
  const conf = Math.min(0.98, 0.45 + best[1] * 0.06 - (second ? Math.min(0.25, second[1] * 0.03) : 0));
  return { kind: best[0], confidence: Math.max(0.3, conf), country };
}

/* ---------- estrazione ---------- */
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100 ? `${y}-${pad(m)}-${pad(d)}` : null);

/** Importo scritto all'italiana (1.234,50), alla svizzera (1'234.50) o all'inglese (1,234.50). */
export function parseAmount(s: string): number | null {
  let x = s.replace(/[^\d.,'’]/g, '').replace(/['’]/g, '');
  if (!x) return null;
  const lc = x.lastIndexOf(','), ld = x.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) x = lc > ld ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
  else if (lc >= 0) x = /,\d{1,2}$/.test(x) ? x.replace(',', '.') : x.replace(/,/g, '');
  else if (ld >= 0 && /\.\d{3}$/.test(x) && x.split('.').length > 2) x = x.replace(/\./g, '');
  const n = parseFloat(x);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const AMOUNT_RE = /(?:chf|eur|€|fr\.?)?\s*(\d{1,3}(?:[.'’ ]\d{3})*(?:[.,]\d{1,2})|\d+[.,]\d{1,2})\s*(?:chf|eur|€|fr\.?)?/gi;
function amountsIn(line: string): number[] { const out: number[] = []; for (const m of line.matchAll(AMOUNT_RE)) { const v = parseAmount(m[1]!); if (v != null && v > 0 && v < 1e9) out.push(v); } return out; }
const currencyOf = (t: string): 'CHF' | 'EUR' | undefined => { const n = t.toLowerCase(); const ch = (n.match(/\bchf\b|\bfr\.\s?\d/g) ?? []).length, eu = (n.match(/\beur\b|€|euro/g) ?? []).length; return ch === 0 && eu === 0 ? undefined : ch >= eu ? 'CHF' : 'EUR'; };

/** Tutte le date del testo (gg/mm/aaaa, gg.mm.aaaa, «15 marzo 2026») con la riga in cui compaiono. */
export function datesIn(text: string): { iso: string; line: string }[] {
  const out: { iso: string; line: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const m of line.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)) { const y = +m[3]! < 100 ? 2000 + +m[3]! : +m[3]!; const d = iso(y, +m[2]!, +m[1]!); if (d) out.push({ iso: d, line }); }
    for (const m of norm(line).matchAll(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/g)) { const d = iso(+m[3]!, MONTHS.indexOf(m[2]!) + 1, +m[1]!); if (d) out.push({ iso: d, line }); }
  }
  return out;
}
const dueDateOf = (text: string): string | undefined => datesIn(text).find((d) => /scadenza|entro il|da pagare entro|zahlbar bis|zu zahlen bis|valida fino|valido fino|gultig bis|scade il|termina il|fino al/i.test(norm(d.line)))?.iso;
const grab = (text: string, re: RegExp): string | undefined => { const m = re.exec(text); return m?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 120) || undefined; };
const IBAN = /\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?)\b/;
const firstLine = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 2 && l.length < 70 && !/fattura|invoice|rechnung|bolletta|preventivo|contratto/i.test(l));

/** Il totale da pagare: l'ultimo importo della riga «totale/importo», poi «da pagare»; altrimenti il più alto. */
export function totalOf(text: string): number | undefined {
  const noDate = (l: string) => l.replace(/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/g, ' ');
  const lines = text.split(/\r?\n/);
  for (const re of [/totale|total|betrag|importo/, /da pagare|zu zahlen|netto a pagare/]) {
    for (const l of lines.filter((x) => re.test(norm(x))).reverse()) { const a = amountsIn(noDate(l)); if (a.length) return a[a.length - 1]; }
  }
  const all = amountsIn(noDate(text)); return all.length ? Math.max(...all) : undefined;
}

const ROLES = ['sviluppatore', 'sviluppatrice', 'programmatore', 'grafico', 'grafica', 'designer', 'contabile', 'commercialista', 'segretaria', 'segretario', 'impiegato', 'impiegata', 'responsabile', 'project manager', 'ingegnere', 'architetto', 'avvocato', 'marketing', 'commerciale', 'amministrativo', 'amministrativa', 'infermiere', 'infermiera', 'elettricista', 'meccanico', 'cuoco', 'cameriere', 'magazziniere', 'autista', 'analista', 'consulente', 'insegnante', 'addetto', 'addetta'];
const LANGS: [string, RegExp][] = [['Italiano', /italiano|italian/i], ['Inglese', /inglese|english/i], ['Tedesco', /tedesco|german|deutsch/i], ['Francese', /francese|french|francais/i], ['Spagnolo', /spagnolo|spanish/i]];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function cvFields(name: string, text: string): Record<string, string> {
  const f: Record<string, string> = {};
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0]; if (email) f.email = email;
  const phone = /(?:\+|00)\d{2}[\s.]?\(?\d{1,3}\)?(?:[\s.\-]?\d{2,4}){2,4}|\b0\d{1,2}[\s.\-]?\d{3}[\s.\-]?\d{2,4}[\s.\-]?\d{0,4}\b|\b3\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}\b/.exec(text)?.[0]?.trim(); if (phone) f.telefono = phone;
  // nome: prima riga che sembra «Nome Cognome»; altrimenti dal nome del file
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => /^[A-ZÀ-Ý][a-zà-ÿ'’-]+(?: [A-ZÀ-Ý][a-zà-ÿ'’-]+){1,2}$/.test(l) && !/curriculum|vitae|europass|profilo/i.test(l));
  let parts = line ? line.split(' ') : [];
  if (!parts.length) parts = name.replace(/\.[a-z0-9]{2,5}$/i, '').split(/[_\-\s.]+/).filter((p) => /^[A-Za-zÀ-ÿ]{2,}$/.test(p) && !/^(cv|curriculum|vitae|resume|europass|lebenslauf|def|final|nuovo)$/i.test(p)).map(cap).slice(0, 2);
  if (parts.length >= 2) { f.nome = parts[0]!; f.cognome = parts.slice(1).join(' '); } else if (parts.length === 1) f.cognome = parts[0]!;
  const n = norm(text);
  const role = ROLES.find((r) => new RegExp(`\\b${r}\\b`).test(n)); if (role) f.ruolo = cap(role);
  const years = /(\d{1,2})\+?\s*anni\s*(?:di\s*)?(?:esperienza|nel settore|di lavoro)/.exec(n)?.[1]; if (years) f.esperienza = `${years} anni`;
  const langs = LANGS.filter(([, re]) => re.test(text)).map(([l]) => l); if (langs.length) f.lingue = langs.join(', ');
  return f;
}

function payslipFields(text: string): Record<string, string> {
  const f: Record<string, string> = {};
  const n = norm(text);
  const mm = MONTHS.find((m) => n.includes(m)); const yy = /\b(20\d{2})\b/.exec(n)?.[1];
  if (mm) f.periodo = `${cap(mm)}${yy ? ' ' + yy : ''}`; else { const m = /\b(\d{1,2})[/.](20\d{2})\b/.exec(n); if (m) f.periodo = `${pad(+m[1]!)}/${m[2]}`; }
  const nome = grab(text, /(?:dipendente|cognome e nome|nominativo|name|nome)\s*[:\-]\s*([^\n]{3,60})/i); if (nome) f.persona = nome;
  for (const l of text.split(/\r?\n/)) {
    if (/netto|nettolohn|net pay/i.test(norm(l))) { const a = amountsIn(l); if (a.length && !f.netto) f.netto = String(a[a.length - 1]); }
    if (/lordo|bruttolohn|brutto|gross/i.test(norm(l))) { const a = amountsIn(l); if (a.length && !f.lordo) f.lordo = String(a[a.length - 1]); }
  }
  return f;
}

/** Riconosce il documento e ne estrae i dati. */
export function analyze(name: string, text: string): DocResult {
  const c = classify(name, text);
  const f: Record<string, string> = {};
  const res: DocResult = { kind: c.kind, confidence: c.confidence, country: c.country, title: name.replace(/\.[a-z0-9]{2,5}$/i, ''), fields: f };
  const cur = currencyOf(text) ?? (c.country === 'CH' ? 'CHF' : c.country === 'IT' ? 'EUR' : undefined);
  if (c.kind === 'cv') Object.assign(f, cvFields(name, text));
  else if (c.kind === 'payslip') {
    Object.assign(f, payslipFields(text));
    const n = norm(`${name} ${text}`);
    res.tipo = /certificazione unica|\bcu 20/.test(n) ? 'Certificazione Unica' : /certificato di salario|lohnausweis|certificat de salaire/.test(n) ? 'Certificato di salario' : 'Busta paga';
    if (cur) res.currency = cur; if (f.netto) res.amount = parseFloat(f.netto);
  } else if (['invoice', 'bill', 'quote', 'receipt'].includes(c.kind)) {
    const num = grab(text, /(?:fattura|invoice|rechnung|preventivo|offerta|bolletta)\s*(?:n[°.o]?|nr\.?|num(?:ero)?)?\s*[:#]?\s*([A-Z0-9][\w\-/]{1,20})/i);
    if (num && /\d/.test(num)) f.numero = num;
    const forn = grab(text, /(?:fornitore|mittente|emessa da|emesso da|da:|lieferant|absender)\s*[:\-]?\s*([^\n]{3,70})/i) ?? firstLine(text); if (forn) f.fornitore = forn;
    const iban = IBAN.exec(text)?.[1]; if (iban) f.iban = iban.replace(/\s+/g, ' ');
    const tot = totalOf(text); if (tot != null) res.amount = tot;
    if (cur) res.currency = cur;
    const d = dueDateOf(text); if (d) res.due = d;
    if (/qr-fattura|zahlteil|polizza di versamento|empfangsschein/i.test(norm(text))) f.pagamento = 'Polizza di versamento svizzera (QR)';
  } else if (c.kind === 'contract') {
    const parti = grab(text, /tra\s+(.{5,90}?)\s+e\s+(.{5,90}?)(?:[,.\n]|$)/i); if (parti) f.parti = parti;
    const durata = /(\d{1,2})\s*(mesi|anni)/i.exec(text); if (durata) f.durata = `${durata[1]} ${durata[2]}`;
    if (/rinnovo tacito|si rinnova/i.test(norm(text))) f.rinnovo = 'tacito';
    const d = dueDateOf(text); if (d) res.due = d;
    const first = datesIn(text)[0]?.iso; if (first) f.data = first;
    const person = grab(text, /(?:dipendente|lavoratore|collaboratore|arbeitnehmer)\s*[:\-]?\s*([^\n]{3,60})/i); if (person) f.persona = person;
  } else if (c.kind === 'tax' || c.kind === 'registry' || c.kind === 'certificate') {
    const d = dueDateOf(text); if (d) res.due = d;
    const n = norm(`${name} ${text}`);
    res.tipo = /durc/.test(n) ? 'DURC' : /\bf24\b/.test(n) ? 'F24' : /modello 730/.test(n) ? 'Modello 730' : /visura camerale/.test(n) ? 'Visura camerale' : /registro di commercio|handelsregister/.test(n) ? 'Registro di commercio' : /steuererklarung|dichiarazione fiscale/.test(n) ? 'Dichiarazione fiscale' : undefined;
    const tot = c.kind === 'tax' ? totalOf(text) : undefined; if (tot != null) res.amount = tot; if (cur && res.amount != null) res.currency = cur;
  } else if (c.kind === 'minutes') { const d = datesIn(text)[0]?.iso; if (d) f.data = d; }
  // titolo leggibile
  const info = KINDS[c.kind]; const label = res.tipo ?? info.label;
  const who = f.cognome ? `${f.nome ? f.nome + ' ' : ''}${f.cognome}` : f.persona ?? f.fornitore;
  res.title = [label, who, f.periodo ?? f.numero].filter(Boolean).join(' · ').slice(0, 120) || res.title;
  return res;
}

/** Il testo a lettura facile dei campi, per le schede. */
export const FIELD_LABELS: Record<string, string> = { nome: 'Nome', cognome: 'Cognome', email: 'Email', telefono: 'Telefono', ruolo: 'Ruolo', esperienza: 'Esperienza', lingue: 'Lingue', numero: 'Numero', fornitore: 'Fornitore', iban: 'IBAN', pagamento: 'Pagamento', periodo: 'Periodo', persona: 'Persona', netto: 'Netto', lordo: 'Lordo', parti: 'Parti', durata: 'Durata', rinnovo: 'Rinnovo', data: 'Data' };
