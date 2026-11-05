/**
 * Scrittura di lavoro (modulo PURO, nessun alias '@/'): modelli di documenti (email, lettere, offerte, relazioni, comunicati, moduli),
 * correzione di refusi e punteggiatura, cambio di tono, presentazioni da un testo o da un progetto, PDF con l'intestazione dell'azienda.
 * Tutto a regole, sul telefono: funziona senza AI. Con l'AI collegata si scrive e si rilegge meglio.
 */
import { brandFooter, brandHeader, esc, textToHtml, type Brand } from './reports.ts';

export type Tone = 'formale' | 'cordiale' | 'diretto';
export const TONE_LABEL: Record<Tone, string> = { formale: 'Formale', cordiale: 'Cordiale', diretto: 'Diretto' };
export type Field = { k: string; label: string; hint?: string; long?: boolean };
export type DocType = { id: string; name: string; group: 'Comunicazione' | 'Documenti' | 'Moduli'; fields: Field[]; build: (f: Record<string, string>, o: { tone: Tone; today: string; from: string }) => string };

const v = (f: Record<string, string>, k: string, fallback = `[${k}]`) => (f[k]?.trim() ? f[k]!.trim() : fallback);
const date = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
const hello = (tone: Tone, to: string) => (tone === 'formale' ? `Gentile ${to},` : tone === 'cordiale' ? `Buongiorno ${to},` : `Ciao ${to},`);
const bye = (tone: Tone, from: string) => (tone === 'formale' ? `Cordiali saluti\n${from}` : tone === 'cordiale' ? `Un cordiale saluto\n${from}` : `Grazie e a presto\n${from}`);

export const DOC_TYPES: DocType[] = [
  { id: 'email', name: 'Email', group: 'Comunicazione', fields: [{ k: 'a', label: 'A chi (nome)' }, { k: 'oggetto', label: 'Oggetto' }, { k: 'testo', label: 'Che cosa vuoi dire', long: true }],
    build: (f, o) => `Oggetto: ${v(f, 'oggetto')}\n\n${hello(o.tone, v(f, 'a'))}\n\n${v(f, 'testo')}\n\n${bye(o.tone, o.from)}` },
  { id: 'offerta', name: 'Lettera di offerta', group: 'Comunicazione', fields: [{ k: 'a', label: 'Cliente' }, { k: 'prodotto', label: 'Che cosa offri' }, { k: 'prezzo', label: 'Prezzo' }, { k: 'validita', label: 'Valida fino al (2026-12-31)' }],
    build: (f, o) => `${hello(o.tone === 'diretto' ? 'cordiale' : o.tone, v(f, 'a'))}\n\nCon piacere le propongo ${v(f, 'prodotto')}, al prezzo di ${v(f, 'prezzo')}.\n${f.validita ? `L'offerta è valida fino al ${date(f.validita)}.\n` : ''}Resto a disposizione per qualsiasi chiarimento e per organizzare un incontro.\n\n${bye(o.tone === 'diretto' ? 'cordiale' : o.tone, o.from)}` },
  { id: 'sollecito', name: 'Sollecito di pagamento', group: 'Comunicazione', fields: [{ k: 'a', label: 'Cliente' }, { k: 'fattura', label: 'Fattura n.' }, { k: 'importo', label: 'Importo' }, { k: 'scadenza', label: 'Scaduta il (2026-10-30)' }],
    build: (f, o) => `${hello(o.tone === 'diretto' ? 'cordiale' : o.tone, v(f, 'a'))}\n\nle ricordiamo che la fattura n. ${v(f, 'fattura')} di ${v(f, 'importo')}${f.scadenza ? `, scaduta il ${date(f.scadenza)},` : ''} risulta ancora da saldare. Se ha già provveduto al pagamento, ignori questo messaggio.\n\n${bye(o.tone === 'diretto' ? 'cordiale' : o.tone, o.from)}` },
  { id: 'annuncio', name: 'Annuncio ai colleghi', group: 'Comunicazione', fields: [{ k: 'titolo', label: 'Titolo' }, { k: 'testo', label: 'Messaggio', long: true }, { k: 'data', label: 'Data (2026-12-31)' }],
    build: (f, o) => `${v(f, 'titolo')}\n\nCari colleghi,\n${v(f, 'testo')}${f.data ? `\nData: ${date(f.data)}.` : ''}\n\n${o.from}` },
  { id: 'comunicato', name: 'Comunicato stampa', group: 'Comunicazione', fields: [{ k: 'titolo', label: 'Titolo' }, { k: 'luogo', label: 'Città' }, { k: 'testo', label: 'La notizia', long: true }, { k: 'contatto', label: 'Contatto per la stampa' }],
    build: (f, o) => `COMUNICATO STAMPA\n\n${v(f, 'titolo')}\n\n${v(f, 'luogo')}, ${date(o.today)} – ${v(f, 'testo')}\n\nPer informazioni: ${v(f, 'contatto')}\n${o.from}` },
  { id: 'lettera', name: 'Lettera formale', group: 'Documenti', fields: [{ k: 'a', label: 'Destinatario' }, { k: 'oggetto', label: 'Oggetto' }, { k: 'testo', label: 'Testo', long: true }],
    build: (f, o) => `${date(o.today)}\n\nSpett.le ${v(f, 'a')}\n\nOggetto: ${v(f, 'oggetto')}\n\n${v(f, 'testo')}\n\nIn attesa di un cortese riscontro, porgiamo distinti saluti.\n${o.from}` },
  { id: 'relazione', name: 'Relazione', group: 'Documenti', fields: [{ k: 'titolo', label: 'Titolo' }, { k: 'sintesi', label: 'In sintesi', long: true }, { k: 'fatti', label: 'Che cosa è successo', long: true }, { k: 'prossimi', label: 'Prossimi passi', long: true }],
    build: (f, o) => `Relazione: ${v(f, 'titolo')}\n${date(o.today)} · ${o.from}\n\nIn sintesi\n${v(f, 'sintesi')}\n\nSviluppo\n${v(f, 'fatti')}\n\nProssimi passi\n${v(f, 'prossimi')}` },
  { id: 'nota', name: 'Nota interna', group: 'Documenti', fields: [{ k: 'a', label: 'A (persone o reparto)' }, { k: 'oggetto', label: 'Oggetto' }, { k: 'testo', label: 'Testo', long: true }],
    build: (f, o) => `NOTA INTERNA · ${date(o.today)}\nA: ${v(f, 'a')}\nDa: ${o.from}\nOggetto: ${v(f, 'oggetto')}\n\n${v(f, 'testo')}` },
  { id: 'ferie', name: 'Richiesta di ferie', group: 'Moduli', fields: [{ k: 'a', label: 'Al responsabile' }, { k: 'dal', label: 'Dal (2026-12-24)' }, { k: 'al', label: 'Al (2026-12-31)' }, { k: 'note', label: 'Note' }],
    build: (f, o) => `${hello('formale', v(f, 'a'))}\n\nvorrei richiedere un periodo di ferie dal ${f.dal ? date(f.dal) : '[dal]'} al ${f.al ? date(f.al) : '[al]'}.${f.note ? `\n${f.note}` : ''}\n\nRingrazio per l'attenzione.\n${o.from}\n${date(o.today)}` },
  { id: 'spese', name: 'Nota spese', group: 'Moduli', fields: [{ k: 'motivo', label: 'Motivo della spesa' }, { k: 'voci', label: 'Voci (una per riga: descrizione - importo)', long: true }, { k: 'valuta', label: 'Valuta (CHF o EUR)' }],
    build: (f, o) => { const rows = (f.voci ?? '').split('\n').map((l) => l.trim()).filter(Boolean); const tot = rows.reduce((a, l) => { const m = /(-?\d+(?:[.,]\d+)?)\s*$/.exec(l); return a + (m ? parseFloat(m[1]!.replace(',', '.')) : 0); }, 0); return `NOTA SPESE\nDipendente: ${o.from}\nData: ${date(o.today)}\nMotivo: ${v(f, 'motivo')}\n\nVoci\n${rows.length ? rows.map((r) => `- ${r}`).join('\n') : '- [voci]'}\n\nTotale: ${(Math.round(tot * 100) / 100).toLocaleString('it-CH', { minimumFractionDigits: 2 })} ${(f.valuta || 'CHF').toUpperCase()}\nAllegare le ricevute.`; } },
  { id: 'assenza', name: 'Giustificazione di assenza', group: 'Moduli', fields: [{ k: 'a', label: 'Al responsabile' }, { k: 'giorno', label: 'Giorno (2026-11-05)' }, { k: 'motivo', label: 'Motivo' }],
    build: (f, o) => `${hello('formale', v(f, 'a'))}\n\ncomunico che il giorno ${f.giorno ? date(f.giorno) : '[giorno]'} sono stato assente per ${v(f, 'motivo')}.\nRimango a disposizione per qualsiasi chiarimento.\n\n${bye('formale', o.from)}` },
];
export const docType = (id: string) => DOC_TYPES.find((d) => d.id === id);

/* ---------- correzione ---------- */
const L = '(?<![A-Za-zÀ-ÿ])', R = '(?![A-Za-zÀ-ÿ])';
const FIXES: [RegExp, string, string][] = ([
  ["qual'è", 'qual è', '«qual è» si scrive senza apostrofo'], ['un pò', "un po'", "«un po'» vuole l'apostrofo"], ['perchè', 'perché', 'accento di «perché»'], ['poichè', 'poiché', 'accento di «poiché»'],
  ['sopratutto', 'soprattutto', '«soprattutto» con due t'], ['propio', 'proprio', 'refuso: «proprio»'], ['affinche', 'affinché', 'accento di «affinché»'], ['daccordo', "d'accordo", "«d'accordo»"],
  ['gia', 'già', 'accento di «già»'], ['piu', 'più', 'accento di «più»'], ['cosi', 'così', 'accento di «così»'], ['pultroppo', 'purtroppo', 'refuso: «purtroppo»'], ['qundo', 'quando', 'refuso: «quando»'],
] as [string, string, string][]).map(([a, to, why]) => [new RegExp(L + a.replace(/'/g, "['’]") + R, 'gi'), to, why]);
FIXES.push([/(?<![A-Za-zÀ-ÿ])E'(?![A-Za-zÀ-ÿ])/g, 'È', 'la «È» maiuscola con accento']);
/** Corregge refusi frequenti, spazi doppi, spazi prima della punteggiatura e maiuscole a inizio frase. Restituisce il testo e l'elenco di che cosa ha cambiato. */
export function proofread(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = []; let t = text;
  for (const [re, to, why] of FIXES) { if (!why) continue; const before = t; t = t.replace(re, (m) => (m[0] === m[0]!.toUpperCase() && m[0] !== m[0]!.toLowerCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to)); if (t !== before) fixes.push(why); }
  const rules: [RegExp, string, string][] = [[/[ \t]{2,}/g, ' ', 'spazi doppi tolti'], [/ +([,.;:!?])/g, '$1', 'spazio prima della punteggiatura tolto'], [/([,;:!?])(?=[A-Za-zÀ-ÿ])/g, '$1 ', 'spazio dopo la punteggiatura aggiunto'], [/([.])(?=[A-ZÀ-Ý][a-zà-ÿ])/g, '$1 ', 'spazio dopo il punto aggiunto'], [/\.{4,}/g, '...', 'puntini ridotti']];
  for (const [re, to, why] of rules) { const before = t; t = t.replace(re, to); if (t !== before) fixes.push(why); }
  const cap = t.replace(/(^|[.!?]\s+|\n)([a-zà-ÿ])/g, (_, a: string, b: string) => a + b.toUpperCase()); if (cap !== t) { fixes.push('maiuscola a inizio frase'); t = cap; }
  return { text: t, fixes: [...new Set(fixes)] };
}

/* ---------- tono ---------- */
const TONE_MAP: Record<Tone, [RegExp, string][]> = {
  formale: [[/\bCiao ([^,\n]+),/g, 'Gentile $1,'], [/\bBuongiorno ([^,\n]+),/g, 'Gentile $1,'], [/\bA presto\b/g, 'Cordiali saluti'], [/\bGrazie e a presto\b/g, 'Cordiali saluti'], [/\bUn cordiale saluto\b/g, 'Cordiali saluti'], [/\bgrazie mille\b/gi, 'la ringrazio'], [/\bfammi sapere\b/gi, 'mi faccia sapere'], [/\bti scrivo\b/gi, 'le scrivo'], [/\bti mando\b/gi, 'le invio'], [/\bpuoi\b/gi, 'può'], [/\bhai\b/gi, 'ha']],
  cordiale: [[/\bGentile ([^,\n]+),/g, 'Buongiorno $1,'], [/\bCiao ([^,\n]+),/g, 'Buongiorno $1,'], [/\bCordiali saluti\b/g, 'Un cordiale saluto'], [/\bDistinti saluti\b/g, 'Un cordiale saluto'], [/\bGrazie e a presto\b/g, 'Un cordiale saluto']],
  diretto: [[/\bGentile ([^,\n]+),/g, 'Ciao $1,'], [/\bBuongiorno ([^,\n]+),/g, 'Ciao $1,'], [/\bCordiali saluti\b/g, 'Grazie e a presto'], [/\bUn cordiale saluto\b/g, 'Grazie e a presto'], [/\bDistinti saluti\b/g, 'Grazie e a presto'], [/\bLa ringrazio\b/g, 'Grazie'], [/\bvoglia\b/gi, 'puoi'], [/\bmi faccia sapere\b/gi, 'fammi sapere']],
};
/** Cambia saluti, chiusure e le forme più comuni del tono. Per riscrivere tutto il testo serve l'AI. */
export function changeTone(text: string, tone: Tone): string { let t = text; for (const [re, to] of TONE_MAP[tone]) t = t.replace(re, to); return t; }

/* ---------- presentazioni ---------- */
export type Slide = { title: string; bullets: string[] };
/** Un testo diventa diapositive: ogni titolo («# Titolo», «Titolo:» o riga breve in maiuscolo) apre una diapositiva, le righe sotto diventano punti. */
export function slidesFromText(text: string, maxBullets = 6): Slide[] {
  const slides: Slide[] = []; let cur: Slide | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    const head = /^#{1,3}\s+(.+)$/.exec(l)?.[1] ?? (/^[^.!?]{3,60}:$/.test(l) ? l.slice(0, -1) : /^[A-ZÀ-Ý0-9 '’·\-]{4,60}$/.test(l) && !/^[-•*]/.test(l) ? l[0] + l.slice(1).toLowerCase() : null);
    if (head) { cur = { title: head.trim(), bullets: [] }; slides.push(cur); continue; }
    const b = l.replace(/^[-•*]\s*/, ''); if (!cur) { cur = { title: 'Introduzione', bullets: [] }; slides.push(cur); }
    for (const s of b.length > 140 ? b.split(/(?<=[.!?])\s+/) : [b]) { if (cur.bullets.length >= maxBullets) { cur = { title: `${cur.title} (segue)`, bullets: [] }; slides.push(cur); } cur.bullets.push(s.trim()); }
  }
  return slides.filter((s) => s.bullets.length || s.title);
}
export type ProjectSummary = { title: string; goal: string; progress: number; due: string | null; done: string[]; late: string[]; next: string[]; hours?: number };
/** Le diapositive per un progetto: dove siamo, che cosa è fatto, che cosa è in ritardo, prossimi passi. */
export function slidesFromProject(p: ProjectSummary): Slide[] {
  const s: Slide[] = [{ title: p.title, bullets: [p.goal || 'Stato del progetto', `Avanzamento: ${p.progress}%${p.due ? ` · scadenza ${date(p.due)}` : ''}`, ...(p.hours ? [`Ore lavorate: ${p.hours}`] : [])] }];
  if (p.done.length) s.push({ title: 'Cosa è stato fatto', bullets: p.done.slice(0, 6) });
  if (p.late.length) s.push({ title: 'Cosa è in ritardo', bullets: p.late.slice(0, 6) });
  s.push({ title: 'Prossimi passi', bullets: p.next.length ? p.next.slice(0, 6) : ['Da definire'] });
  return s;
}
export function slidesHtml(slides: Slide[], brand: Brand, title: string): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(brand.color) ? brand.color : '#0F766E';
  const pages = slides.map((s, i) => `<section style="page-break-after:always;height:92vh;display:flex;flex-direction:column;justify-content:${i === 0 ? 'center' : 'flex-start'};padding:36px 48px;box-sizing:border-box;${i === 0 ? `background:${color};color:#fff` : ''}">${i === 0 ? '' : `<div style="font-size:11px;color:#888;margin-bottom:6px">${esc(brand.company)}</div>`}<h1 style="font-size:${i === 0 ? 40 : 28}px;margin:0 0 18px;${i === 0 ? '' : `color:${color}`}">${esc(s.title)}</h1>${s.bullets.length ? `<ul style="font-size:${i === 0 ? 18 : 20}px;line-height:1.5;margin:0;padding-left:22px">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${brand.logo && i === 0 ? `<img src="${esc(brand.logo)}" style="height:56px;margin-top:30px;object-fit:contain;align-self:flex-start"/>` : ''}</section>`).join('');
  return `<html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0}</style></head><body>${pages}</body></html>`;
}
/** Una lettera o un documento con intestazione, logo e piè di pagina dell'azienda. */
export function docHtml(text: string, brand: Brand): string {
  return `<html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;padding:36px;font-size:14px;line-height:1.5}h3{margin:14px 0 4px}p{margin:2px 0}ul{margin:4px 0 4px 18px;padding:0}</style></head><body>${brandHeader(brand)}${textToHtml(text)}${brandFooter(brand)}</body></html>`;
}
