/** «Imposta l'affitto a 1430»: legge nome e importo da una frase (modulo PURO). */
export type FixedEdit = { word: string; amount: number; undo: boolean };
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function parseFixedEdit(text: string): FixedEdit | null {
  const s = fold(text).replace(/\s+/g, ' ').trim();
  const undo = s.match(/^(ripristina|rimetti|togli la modifica (?:a|di|dell|della|dello)|annulla la modifica (?:a|di|dell|della|dello))\s+(?:(?:la|lo|le|il|gli|i|l)\b)?\s*'?\s*(.+)$/);
  if (undo) return { word: undo[2].replace(/^[' ]+/, '').trim(), amount: 0, undo: true };
  const m = s.match(/^(?:imposta|impostami|metti|mettimi|cambia|cambiami|modifica|porta|portami|aggiorna|correggi|setta)\s+(?:(?:le spese di|la|lo|le|il|gli|i|l)\b)?\s*'?\s*(.+?)\s+(?:a|su|in|con|a circa|a un importo di)\s+(?:chf\s*)?(\d+(?:[.,]\d+)?)\s*(?:chf|franchi|lp)?\b/);
  if (!m) return null;
  const amount = Number(m[2].replace(',', '.'));
  const word = m[1].replace(/\b(mensile|al mese|mensili)\b/g, '').replace(/^[' ]+/, '').trim();
  return word && Number.isFinite(amount) && amount > 0 ? { word, amount, undo: false } : null;
}
/** Trova la voce fissa che l'utente intende: contiene la parola detta (o il contrario). */
export function findFixed<T extends { name: string; key: string }>(word: string, items: T[]): T | null {
  const w = fold(word).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!w) return null;
  const hay = (i: T) => fold(`${i.name} ${i.key}`).replace(/[^a-z0-9 ]/g, ' ');
  return items.find((i) => hay(i).includes(w)) ?? items.find((i) => w.split(' ').every((x) => hay(i).includes(x))) ?? null;
}
