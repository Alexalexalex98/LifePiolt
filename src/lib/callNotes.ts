/**
 * Appunti di una chiamata (modulo PURO, nessun alias '@/'): da una trascrizione a righe «chi ha detto cosa» estrae le cose importanti
 * con regole semplici, senza AI esterna: decisioni, cose da fare (con chi e quando), domande rimaste aperte, date e numeri.
 * Ogni persona trascrive solo la propria voce sul proprio telefono (con il suo consenso): le righe si uniscono in ordine di tempo.
 */
export type TLine = { at: number; speaker: string; text: string };
export type ActionItem = { text: string; owner: string; due?: string; at: number };
export type CallNotes = { decisions: { text: string; speaker: string; at: number }[]; actions: ActionItem[]; questions: { text: string; speaker: string; at: number }[]; facts: { text: string; speaker: string; at: number }[] };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const DECISION = /\b(abbiamo deciso|decidiamo|decido|si decide|e deciso|facciamo cosi|va bene cosi|confermo|confermiamo|approvato|approviamo|siamo d accordo|d accordo allora|allora e deciso|scegliamo|chiudiamo cosi)\b/;
const ACTION = /\b(devo|dobbiamo|dovro|dovremo|dovrei|ricordati di|ricordiamoci di|ricordami di|mi occupo|ci penso io|me ne occupo|me ne occupero|prepar\w+|ti mando|ti invio|ti scrivo|vi mando|vi invio|ti chiamo|prenoto|prenotiamo|organizzo|organizziamo|da fare|facciamo entro|consegn\w+ entro|entro )\b/;
const WEEKDAY = '(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)';
const DUE = new RegExp(`\\b(entro (?:oggi|domani|dopodomani|fine settimana|fine mese|${WEEKDAY}|il \\d{1,2}(?: [a-z]+)?|\\d{1,2}[/.]\\d{1,2})|${WEEKDAY}(?: prossimo| mattina| pomeriggio)?|domani(?: mattina| pomeriggio)?|dopodomani|settimana prossima|la prossima settimana|fra \\d+ giorni|tra \\d+ giorni|alle \\d{1,2}(?:[:.]\\d{2})?)\\b`);
const QUESTION_START = /^(come|quando|perche|chi|cosa|che cosa|quanto|quanti|dove|quale|quali|puoi|potete|riesci|riuscite|c e|ci sono)\b/;
const FACT = /(\d+(?:[.,]\d+)?\s?(?:%|chf|lp|euro|franchi|ore|giorni|persone|km|mila)|\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}[/]\d{1,2}\b|\bil \d{1,2} (?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b)/;
const CHATTER = /^(ciao|buongiorno|buonasera|grazie|prego|ok|okay|si|no|certo|perfetto|bene|ottimo|allora|ehm|ah|eh|mhm|a dopo|ci sentiamo|arrivederci)[ .!?]*$/;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Estrae gli appunti. Righe troppo corte o di semplice cortesia si ignorano; la stessa frase non compare due volte. */
export function buildNotes(lines: TLine[]): CallNotes {
  const out: CallNotes = { decisions: [], actions: [], questions: [], facts: [] };
  const seen = new Set<string>();
  for (const l of [...lines].sort((a, b) => a.at - b.at)) {
    const raw = clean(l.text), n = norm(raw);
    if (n.length < 12 || n.split(' ').length < 3 || CHATTER.test(n)) continue;
    const key = n.replace(/[^a-z0-9 ]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const base = { text: cap(raw.replace(/[ .]+$/, '')), speaker: l.speaker, at: l.at };
    if (DECISION.test(n)) { out.decisions.push(base); continue; }
    if (ACTION.test(n) && !/\?$/.test(raw)) {
      const due = n.match(DUE)?.[0];
      // «io ci penso», «mi occupo»: lo fa chi parla; «dobbiamo»: tutti; «ti mando»: chi parla
      const owner = /\b(dobbiamo|dovremo|facciamo|prenotiamo|organizziamo|ricordiamoci|prepariamo)\b/.test(n) ? 'Tutti' : l.speaker;
      out.actions.push({ ...base, owner, ...(due ? { due } : {}) });
      continue;
    }
    if (/\?$/.test(raw) || QUESTION_START.test(n)) { out.questions.push(base); continue; }
    if (FACT.test(n)) out.facts.push(base);
  }
  return out;
}

export const hasNotes = (n: CallNotes) => n.decisions.length + n.actions.length + n.questions.length + n.facts.length > 0;
const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Gli appunti come testo (per una nota o per la chat). */
export function notesToText(o: { title: string; date: string; participants: string[]; notes: CallNotes }): string {
  const { notes: n } = o;
  const sec = (head: string, rows: string[]) => (rows.length ? [`${head}`, ...rows.map((r) => `- ${r}`), ''] : []);
  const body = [
    ...sec('Decisioni', n.decisions.map((d) => `${d.text} (${d.speaker}, ${mmss(d.at)})`)),
    ...sec('Da fare', n.actions.map((a) => `${a.text} · ${a.owner}${a.due ? ` · ${a.due}` : ''}`)),
    ...sec('Domande aperte', n.questions.map((q) => `${q.text} (${q.speaker})`)),
    ...sec('Date e numeri', n.facts.map((f) => f.text)),
  ];
  return [`Appunti della call «${o.title}»`, `${o.date} · ${o.participants.join(', ')}`, '', ...(body.length ? body : ['Nessun punto importante rilevato.'])].join('\n').trim();
}

/** Righe di trascrizione leggibili, con il nome di chi parla. */
export const transcriptText = (lines: TLine[]): string => [...lines].sort((a, b) => a.at - b.at).map((l) => `[${mmss(l.at)}] ${l.speaker}: ${l.text}`).join('\n');
