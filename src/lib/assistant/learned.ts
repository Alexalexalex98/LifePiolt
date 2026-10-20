/**
 * Comandi che Theia ha imparato dall'utente (modulo PURO). Quando non conosce una frase, l'utente le mostra cosa fare
 * (una pagina da aprire o un comando che già conosce) e lei se lo ricorda: la volta dopo lo fa da sola, senza AI esterna.
 * I numeri nella frase diventano un segnaposto «{n}»: «imposta l'affitto a 1430» e «... a 1500» sono la stessa frase.
 */
export type Learned = { id: string; /** la frase com'è stata detta, con i numeri sostituiti da {n} */ pattern: string; kind: 'page' | 'cmd'; target: string; uses: number; ts: number };

const NUM = /\d+(?:[.,]\d+)?/g;
/** Parole che non cambiano il senso: articoli e preposizioni. */
const FILLER = new Set(['il', 'lo', 'la', 'l', 'i', 'gli', 'le', 'un', 'uno', 'una', 'al', 'allo', 'alla', 'alle', 'agli', 'ai', 'nel', 'nella', 'nelle', 'sul', 'sulla', 'dal', 'dalla', 'delle', 'degli', 'del', 'dello', 'della', 'dei', 'di', 'a', 'da', 'in', 'su', 'per', 'mi', 'ti', 'che', 'e', 'my', 'the', 'to']);

export const numbersIn = (text: string): string[] => (text.match(NUM) ?? []).map((n) => n.replace(',', '.'));
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Frase «normalizzata»: minuscole, senza accenti né punteggiatura, numeri come {n}. */
export function toPattern(text: string): string {
  return fold(text).replace(NUM, ' {n} ').replace(/[^a-z0-9{}\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const tokens = (pattern: string): string[] => pattern.split(' ').filter((w) => w && !FILLER.has(w));

/** La frase assomiglia a un ordine («imposta», «metti», «apri», «aggiungi»…): in quel caso conviene insegnarla invece di chiederla a un'AI. */
export const looksLikeCommand = (text: string): boolean => /^(imposta|impostami|metti|mettimi|cambia|cambiami|modifica|porta|portami|apri|aprimi|mostra|mostrami|vai|aggiungi|aggiungimi|crea|creami|segna|segnami|elimina|cancella|togli|rimuovi|ricorda|ricordami|attiva|disattiva|spegni|accendi|invia|manda|scrivi|prenota|ordina|paga|cerca|trova|salva|sposta|rinomina|set|change|open|add|create|delete|remove|show|turn)\b/.test(fold(text).trim());

export type LearnedHit = { item: Learned; nums: string[] };
/** La frase detta coincide con una imparata? Stesse parole (a meno di articoli) e stesso numero di numeri. */
export function matchLearned(text: string, list: Learned[]): LearnedHit | null {
  const p = toPattern(text);
  const a = tokens(p);
  if (!a.length) return null;
  let best: { item: Learned; score: number } | null = null;
  for (const item of list) {
    const b = tokens(item.pattern);
    if (a.filter((w) => w === '{n}').length !== b.filter((w) => w === '{n}').length) continue;
    const setB = new Set(b);
    const inter = a.filter((w) => setB.has(w)).length;
    const score = inter / (new Set([...a, ...b]).size || 1);
    if (score >= 0.85 && (!best || score > best.score)) best = { item, score };
  }
  return best ? { item: best.item, nums: numbersIn(text) } : null;
}
/** Mette i numeri detti al posto dei segnaposto del comando imparato. */
export function fillTarget(target: string, nums: string[]): string { let i = 0; return target.replace(/\{n\}/g, () => nums[i++] ?? ''); }

/**
 * Dalla frase e dal comando di esempio ricava il comando da ricordare: i numeri che compaiono in tutti e due, nello stesso
 * ordine, diventano {n} (così il comando funziona con qualsiasi cifra).
 */
export function generalize(phrase: string, example: string): string {
  const pn = numbersIn(phrase);
  if (!pn.length) return example;
  let i = 0;
  return example.replace(NUM, (m) => (i < pn.length && m.replace(',', '.') === pn[i] ? (i++, '{n}') : m));
}
