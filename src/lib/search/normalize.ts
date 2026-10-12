/** Normalizzazione per la ricerca: minuscole, senza accenti, spazi singoli. */
const FALLBACK: Record<string, string> = { à: 'a', á: 'a', â: 'a', ä: 'a', è: 'e', é: 'e', ê: 'e', ë: 'e', ì: 'i', í: 'i', î: 'i', ï: 'i', ò: 'o', ó: 'o', ô: 'o', ö: 'o', ù: 'u', ú: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n' };

export function normalize(s: string): string {
  let out = s.toLowerCase();
  try { out = out.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch { out = out.replace(/[àáâäèéêëìíîïòóôöùúûüçñ]/g, (c) => FALLBACK[c] ?? c); }
  return out.replace(/\s+/g, ' ').trim();
}

/** Parole di ricerca (lettere e cifre) normalizzate. */
export function tokenize(q: string): string[] {
  return (normalize(q).match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
}
