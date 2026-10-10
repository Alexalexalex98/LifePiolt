/** Confronto di parole chiave: inizio di parola per le scritture con spazi, presenza semplice per CJK/arabo/hindi. */
export const normalize = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const NON_SPACED = /[぀-ヿ㐀-鿿؀-ۿऀ-ॿ]/;
const isLetter = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Posizione della prima occorrenza di `w` in `text` (entrambi gia' normalizzati), -1 se assente.
 * Parole brevi (<=3 lettere ASCII) o terminate da '$' devono coincidere con una parola intera.
 */
export function indexOfWord(text: string, w: string): number {
  let whole = false;
  if (w.endsWith('$')) { w = w.slice(0, -1); whole = true; }
  if (!w) return -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(w, from);
    if (i < 0) return -1;
    let ok = true;
    if (!NON_SPACED.test(w)) {
      if (isLetter(text[i - 1])) ok = false;
      if (ok && (whole || (w.length <= 3 && /^[a-z]+$/.test(w))) && isLetter(text[i + w.length])) ok = false;
    }
    if (ok) return i;
    from = i + 1;
  }
}
