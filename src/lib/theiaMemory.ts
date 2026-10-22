/**
 * Memoria di Theia: le risposte dell'AI a domande di conoscenza generale (non personali, non legate all'ora) si ricordano sul telefono,
 * così la prossima volta una domanda simile trova risposta da sola, senza AI. Modulo PURO. L'utente può sempre dire «non è giusta» e la risposta si dimentica.
 */
export type KbEntry = { id: string; q: string; tokens: string[]; a: string; ts: number; uses: number };

const STOP = new Set('il lo la i gli le un uno una di a da in con su per tra fra e o ma che chi cui non mi ti ci vi si e è sono sei era come cosa quale quali quanto quanta quando dove perché perche del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle me te ne mio mia tuo tua puoi può potresti pu dimmi spiegami dammi fammi vorrei voglio sapere the a an of to is are what how'.split(' '));

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const tokensOf = (q: string): string[] => [...new Set(norm(q).split(' ').filter((w) => w.length > 2 && !STOP.has(w)))];

/** Domande che parlano di te o dell'ora di adesso: la risposta cambia, quindi NON si impara. */
const PERSONAL = /\b(mio|mia|miei|mie|nostro|nostra|mi|me stess|io|ho|sono|devo|voglio|posso|nel mio caso|il mio|la mia)\b/i;
const TIMELY = /\b(oggi|ieri|domani|adesso|ora|stasera|stamattina|questo mese|questa settimana|settimana prossima|prossim[oa]|meteo|notizie|prezzo|quotazione|borsa|risultat|classifica|ultim[oa]|attual|quest'anno|2026|2025)\b/i;
const ANAPHORA = /\b(quello|quella|questo|questa|quelli|quelle|sopra|prima|stesso|ancora|invece|poi|anche|continua|prosegui)\b/i;

/** Si può imparare questa coppia domanda/risposta? */
export function isLearnable(question: string, reply: string): boolean {
  const toks = tokensOf(question);
  if (toks.length < 3 || question.length > 300 || question.includes('\n')) return false;
  if (PERSONAL.test(question) || TIMELY.test(question) || ANAPHORA.test(question)) return false;
  if (!reply.trim() || reply.length < 40 || reply.length > 2500 || /\[\[AZIONE/i.test(reply)) return false;
  if (/non (lo )?so|non ho (questo )?dato|non posso|errore|riprova/i.test(reply.slice(0, 160))) return false;
  return true;
}

const dice = (a: string[], b: string[]) => { const B = new Set(b); const inter = a.filter((x) => B.has(x)).length; return a.length + b.length ? (2 * inter) / (a.length + b.length) : 0; };

/** La risposta ricordata più simile alla domanda (somiglianza ≥ 0,8 e almeno 3 parole in comune), se c'è. */
export function recall(entries: KbEntry[], question: string, now = Date.now(), maxAgeDays = 365): KbEntry | null {
  const t = tokensOf(question);
  if (t.length < 3 || PERSONAL.test(question) || TIMELY.test(question) || ANAPHORA.test(question)) return null;
  let best: { e: KbEntry; s: number } | null = null;
  for (const e of entries) {
    if (now - e.ts > maxAgeDays * 86400000) continue;
    const common = t.filter((x) => e.tokens.includes(x)).length;
    const s = dice(t, e.tokens);
    if (common >= 3 && s >= 0.8 && (!best || s > best.s)) best = { e, s };
  }
  return best?.e ?? null;
}

export const makeEntry = (question: string, reply: string, now = Date.now()): KbEntry => ({ id: `${now}-${Math.random().toString(36).slice(2, 7)}`, q: question.trim(), tokens: tokensOf(question), a: reply.trim(), ts: now, uses: 0 });

/** Aggiunge una voce (se la stessa domanda c'è già, la sostituisce) e tiene al massimo 300 voci. */
export function addEntry(entries: KbEntry[], e: KbEntry): KbEntry[] {
  const same = entries.filter((x) => dice(x.tokens, e.tokens) < 0.95);
  return [...same, e].slice(-300);
}
