/** Controlli algoritmici di IBAN, riferimenti svizzeri (QRR/SCOR) e avvisi PagoPA. Puro. */

export const compact = (s: string) => s.replace(/[\s.\-']/g, '').toUpperCase();

const IBAN_LEN: Record<string, number> = {
  CH: 21, LI: 21, IT: 27, DE: 22, FR: 27, AT: 20, ES: 24, GB: 22, NL: 18, BE: 16, LU: 20, PT: 25, IE: 22, SM: 27, MC: 27, DK: 18, SE: 24, NO: 15, FI: 18, PL: 28, CZ: 24, GR: 27, HU: 28, RO: 24,
};

function mod97(s: string): number {
  let r = 0;
  for (const ch of s) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) r = (r * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return r;
}

export type IbanInfo = { iban: string; valid: boolean; lengthOk: boolean; country: string; qrIban: boolean };
export function checkIban(raw: string): IbanInfo | null {
  const iban = compact(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  const country = iban.slice(0, 2);
  const lengthOk = IBAN_LEN[country] ? IBAN_LEN[country] === iban.length : iban.length >= 15 && iban.length <= 34;
  const valid = lengthOk && mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
  // QR-IBAN svizzero: istituto (IID) tra 30000 e 31999
  const iid = Number(iban.slice(4, 9));
  const qrIban = (country === 'CH' || country === 'LI') && iid >= 30000 && iid <= 31999;
  return { iban, valid, lengthOk, country, qrIban };
}
export function formatIban(iban: string): string { return compact(iban).replace(/(.{4})/g, '$1 ').trim(); }

/** Cifra di controllo modulo 10 ricorsivo (QRR e vecchio ESR). */
const MOD10 = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
export function mod10Check(digits: string): number {
  let carry = 0;
  for (const ch of digits) carry = MOD10[(carry + (ch.charCodeAt(0) - 48)) % 10];
  return (10 - carry) % 10;
}
/** Riferimento QR (QRR): 27 cifre, l'ultima e' la cifra di controllo. */
export function checkQrr(raw: string): { ref: string; valid: boolean } | null {
  const ref = raw.replace(/\s/g, '');
  if (!/^\d{27}$/.test(ref)) return null;
  return { ref, valid: mod10Check(ref.slice(0, 26)) === Number(ref[26]) };
}
export const formatQrr = (ref: string) => ref.replace(/^(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})$/, '$1 $2 $3 $4 $5 $6');

/** Riferimento creditore ISO 11649 (SCOR / "RF"): RF + 2 cifre di controllo + max 21 caratteri alfanumerici. */
export function checkScor(raw: string): { ref: string; valid: boolean } | null {
  const ref = raw.replace(/\s/g, '').toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(ref)) return null;
  return { ref, valid: mod97(ref.slice(4) + ref.slice(0, 4)) === 1 };
}

/**
 * Codice avviso PagoPA: 18 cifre; la prima e' il codice "aux" (0-3). Non ha una cifra di controllo pubblica
 * verificabile da sola, quindi si controlla solo la forma.
 */
export function checkPagoPa(raw: string): { code: string; valid: boolean } | null {
  const code = raw.replace(/[\s.\-]/g, '');
  if (!/^\d{18}$/.test(code)) return null;
  return { code, valid: /^[0-3]/.test(code) };
}
export const formatPagoPa = (code: string) => code.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
