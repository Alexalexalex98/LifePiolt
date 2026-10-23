/** Regole dell'account, senza dipendenze: validazione dei dati, età minima, versione dei documenti accettati. */

/** Cambia quando cambiano Termini o Informativa: chi li ha accettati prima li deve riaccettare. */
export const LEGAL_VERSION = '2026-10';
export const MIN_AGE = 16;
/** Codice che vale solo nella modalità di prova (nessun server collegato): nessuna email viene inviata. */
export const TEST_CODE = '123456';

export type AccountForm = {
  firstName: string; lastName: string; email: string;
  /** GG/MM/AAAA */
  birth: string;
  country: string; city: string; postal: string; street: string;
  terms: boolean; privacy: boolean; age: boolean;
};
export const EMPTY_FORM: AccountForm = { firstName: '', lastName: '', email: '', birth: '', country: '', city: '', postal: '', street: '', terms: false, privacy: false, age: false };

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(e));

/** "GG/MM/AAAA" (anche con - o .) → "AAAA-MM-GG", oppure null se la data non esiste. */
export function parseBirth(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function ageOn(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  let a = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) a -= 1;
  return a;
}

export type FormErrors = Partial<Record<keyof AccountForm, string>>;
/** Errori in italiano (le frasi sono chiavi di traduzione); vuoto = tutto a posto. */
export function validateAccount(f: AccountForm, now = new Date()): FormErrors {
  const e: FormErrors = {};
  if (f.firstName.trim().length < 1) e.firstName = 'Scrivi il tuo nome';
  if (f.lastName.trim().length < 1) e.lastName = 'Scrivi il tuo cognome';
  if (!emailOk(f.email)) e.email = 'Scrivi un indirizzo email valido';
  const b = parseBirth(f.birth);
  if (!b) e.birth = 'Scrivi la data come GG/MM/AAAA';
  else if (new Date(`${b}T00:00:00Z`) > now) e.birth = 'La data non può essere nel futuro';
  else if (ageOn(b, now) < MIN_AGE) e.birth = `Serve un'età minima di ${MIN_AGE} anni`;
  if (f.country.trim().length < 2) e.country = 'Scrivi il tuo paese';
  if (f.city.trim().length < 2) e.city = 'Scrivi la tua città';
  if (!f.terms) e.terms = 'Devi accettare i Termini di servizio';
  if (!f.privacy) e.privacy = "Devi aver letto l'Informativa sulla privacy";
  if (!f.age) e.age = `Devi confermare di avere almeno ${MIN_AGE} anni`;
  return e;
}

/** Il corpo mandato al server (account_save): nessun campo in più di quelli dichiarati. */
export function toServerPayload(f: AccountForm, lang: string, platform: string) {
  return {
    nome: f.firstName.trim(), cognome: f.lastName.trim(), data_nascita: parseBirth(f.birth),
    paese: f.country.trim(), citta: f.city.trim(), cap: f.postal.trim(), via: f.street.trim(), lingua: lang,
    termini: f.terms, privacy: f.privacy, eta: f.age, versione: LEGAL_VERSION, piattaforma: platform,
  };
}

/** I documenti accettati sono quelli in vigore? Altrimenti vanno riaccettati. */
export const needsReaccept = (accepted: string | undefined) => accepted !== LEGAL_VERSION;
