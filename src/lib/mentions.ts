/**
 * Menzioni con @ (modulo PURO). Si scrive «@» e il nome: compaiono i suggerimenti; il nome resta nel testo come «@Marco T.».
 * Per riconoscerle dopo, si cerca tra i nomi noti (anche quelli con spazi o punti).
 */
export type MentionQuery = { query: string; start: number };

/** La menzione che si sta scrivendo adesso (in fondo al testo): «ciao @mar» -> { query: 'mar', start: 5 }. */
export function activeMention(text: string): MentionQuery | null {
  const m = /(?:^|\s)@([^\s@]{0,24}(?: [^\s@]{0,12})?)$/u.exec(text);
  if (!m) return null;
  const query = m[1];
  const start = m.index + (m[0].startsWith('@') ? 0 : 1);
  return { query, start };
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Nomi che iniziano (o hanno una parola che inizia) con quello che scrivi. Prima chi inizia per intero. */
export function suggestNames(query: string, names: string[], limit = 6): string[] {
  const q = fold(query.trim());
  const uniq = [...new Set(names.filter(Boolean))];
  if (!q) return uniq.slice(0, limit);
  const starts = uniq.filter((n) => fold(n).startsWith(q));
  const words = uniq.filter((n) => !fold(n).startsWith(q) && fold(n).split(/\s+/).some((w) => w.startsWith(q)));
  return [...starts, ...words].slice(0, limit);
}

/** Mette il nome scelto al posto di «@qualcosa» in fondo al testo. */
export function applyMention(text: string, name: string): string {
  const a = activeMention(text);
  if (!a) return text;
  return `${text.slice(0, a.start)}@${name} `;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Segment = { text: string; mention?: string };
/** Divide il testo in pezzi normali e menzioni di nomi noti (il più lungo vince: «Marco T.» prima di «Marco»). */
export function splitMentions(text: string, names: string[]): Segment[] {
  const list = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text.includes('@') || !list.length) return [{ text }];
  const re = new RegExp(`@(${list.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > 0 && !/\s|[(\[{"'«]/u.test(text[i - 1])) continue; // «mail@marco» non è una menzione
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], mention: m[1] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

/** Chi è menzionato nel testo (senza doppioni). */
export const mentionedIn = (text: string, names: string[]): string[] => [...new Set(splitMentions(text, names).flatMap((s) => (s.mention ? [s.mention] : [])))];
