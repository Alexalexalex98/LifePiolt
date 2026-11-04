/** Comunicazione di lavoro (modulo PURO, nessun alias '@/'): priorità, riassunti, risposte pronte, modelli, assenza. Tutto a regole, funziona senza AI e senza costi. */
export type Priority = 'urgent' | 'todo' | 'info' | 'ignore';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const URGENT = /\b(urgent\w*|subito|asap|al piu presto|entro oggi|emergenza|bloccat\w*|critic\w*|scade oggi|immediatamente|appena possibile|in ritardo)\b/;
const REQUEST = /\b(puoi|potresti|puoi per favore|mi serve|ho bisogno|per favore|per piacere|ricordati|ricordatevi|devi|dovresti|dovete|inviami|mandami|mi mandi|mi invii|controlla|verifica|prepara|aggiorna|conferma|confermi|entro (?:domani|venerdi|lunedi|martedi|mercoledi|giovedi|fine)|da fare)\b/;
const CHATTER = /^(ok+|okay|grazie( mille)?|prego|perfetto|ottimo|bene|va bene|certo|ricevuto|capito|buongiorno|buonasera|buon lavoro|ciao|a dopo|ci sentiamo|top|super|fatto)[ .!]*$/;

/** Quanto è importante un messaggio per me: urgente, da fare (mi chiedono qualcosa), informativo, da ignorare (cortesie). */
export function priorityOf(text: string, o: { mentionsMe?: boolean; announcement?: boolean } = {}): Priority {
  const n = norm(text);
  if (CHATTER.test(n) || (n.length < 4 && !/\?/.test(n))) return 'ignore';
  if (URGENT.test(n)) return o.mentionsMe || o.announcement ? 'urgent' : 'todo';
  if (o.mentionsMe && (/\?/.test(n) || REQUEST.test(n))) return 'todo';
  if (REQUEST.test(n) && o.mentionsMe !== false) return o.mentionsMe ? 'todo' : 'info';
  return 'info';
}

const sentences = (t: string) => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
const KEY = /\b(deciso|decisione|entro|scadenza|\d+\s?(?:%|chf|eur|euro|ore|giorni)|\d{1,2}[/:.]\d{2}|lunedi|martedi|mercoledi|giovedi|venerdi|domani|oggi|importante|attenzione|obiettivo|budget|consegna|riunione)\b/;
/** Riassunto estrattivo: le frasi con date, numeri, scadenze e decisioni, nell'ordine originale. Con AI si può fare di meglio. */
export function summarize(texts: string[], max = 4): string[] {
  const all = texts.flatMap(sentences);
  if (all.length <= max) return all;
  const scored = all.map((s, i) => ({ s, i, score: (KEY.test(norm(s)) ? 3 : 0) + (s.length > 40 ? 1 : 0) + (i === 0 ? 2 : 0) + (/\?$/.test(s) ? 1 : 0) }));
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.s);
}

/** Tre risposte pronte da approvare (si possono modificare prima di inviare). */
export function draftReplies(text: string, o: { due?: string | null } = {}): string[] {
  const n = norm(text);
  if (CHATTER.test(n)) return ['Prego!', 'Grazie a te.', 'A presto.'];
  if (/\b(riunione|incontro|appuntamento|call|chiamata)\b/.test(n) && /\b(\d{1,2}[:.]\d{2}|domani|lunedi|martedi|mercoledi|giovedi|venerdi|alle \d)/.test(n)) return ['Per me va bene, ci sono.', 'Purtroppo a quell\'ora non riesco: possiamo spostare?', 'Confermo, grazie.'];
  if (/\?/.test(n) || /\b(puoi|potresti|mi serve|inviami|mandami|controlla|verifica)\b/.test(n)) return [`Sì, ci penso io${o.due ? ` e te lo mando entro ${o.due}` : ''}.`, 'Ti rispondo entro oggi.', 'Mi servono più dettagli: puoi specificare cosa ti serve?'];
  if (URGENT.test(n)) return ['Ricevuto, me ne occupo subito.', 'Lo vedo adesso e ti aggiorno.', 'Sono in riunione: ti rispondo appena esco.'];
  return ['Ricevuto, grazie.', 'Ok, ne prendo nota.', 'Ne parliamo nella prossima riunione?'];
}

export type Template = { id: string; name: string; text: string };
/** Modelli pronti, con segnaposto {nome} {data} {importo} {progetto}. */
export const TEMPLATES: Template[] = [
  { id: 'conferma', name: 'Conferma appuntamento', text: 'Buongiorno {nome}, le confermo l\'appuntamento del {data}. Resto a disposizione per qualsiasi necessità. Cordiali saluti' },
  { id: 'sollecito', name: 'Sollecito di pagamento', text: 'Buongiorno {nome}, le ricordo che la fattura di {importo} risulta ancora da saldare. Se ha già provveduto, ignori questo messaggio. Grazie e cordiali saluti' },
  { id: 'preventivo', name: 'Richiesta di preventivo', text: 'Buongiorno {nome}, vorrei ricevere un preventivo per {progetto}. Può indicarmi tempi e costi? Grazie e cordiali saluti' },
  { id: 'followup', name: 'Follow-up dopo la riunione', text: 'Ciao {nome}, grazie per la riunione di oggi. Ti riassumo cosa abbiamo deciso: {progetto}. Fammi sapere se ho dimenticato qualcosa.' },
  { id: 'ritardo', name: 'Ritardo e scuse', text: 'Buongiorno {nome}, mi scuso per il ritardo: consegnerò {progetto} entro {data}. Grazie per la pazienza.' },
  { id: 'ringraziamento', name: 'Ringraziamento', text: 'Ciao {nome}, grazie per il tuo aiuto con {progetto}: è stato prezioso.' },
  { id: 'assenza', name: 'Avviso di assenza', text: 'Buongiorno, sono assente fino al {data}. Per urgenze si rivolga a un collega del team. Risponderò al mio rientro.' },
];
/** Sostituisce i segnaposto; quelli senza valore restano visibili tra parentesi quadre da compilare. */
export const fillTemplate = (text: string, vars: Record<string, string | undefined>): string => text.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] ? vars[k]! : `[${k}]`));

/** Le menzioni «@Nome» -> id delle persone (confronto senza accenti, prima parola o nome completo). */
export function mentionIds(text: string, people: { id: string; name: string }[]): string[] {
  const n = norm(text); const out: string[] = [];
  for (const p of people) { const full = norm(p.name); const first = full.split(' ')[0]; if (!full) continue; if (n.includes('@' + full) || (first && new RegExp(`@${first}(?![a-z])`).test(n))) out.push(p.id); }
  return [...new Set(out)];
}

/** Risposta automatica se la persona è assente (until = ultimo giorno di assenza, YYYY-MM-DD). */
export function autoReply(away: { until: string; message: string } | undefined, today: string, name: string): string | null {
  if (!away || away.until < today) return null;
  const d = new Date(away.until + 'T12:00:00'); const until = `${d.getDate()}/${d.getMonth() + 1}`;
  return `${name} è assente fino al ${until}. ${away.message.trim() || 'Risponderà al rientro.'}`;
}
