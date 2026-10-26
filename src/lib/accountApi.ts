import { Platform } from 'react-native';

import { t as tl } from '@/i18n/core';

import { applyTransport, ensureEngine, getTransport } from '@/sync/bindings';
import { loadServerConfig } from '@/sync/secure';
import { SupabaseTransport } from '@/sync/supabaseTransport';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app';
import { stopDmSync } from '@/social/dmSync';

import { LEGAL_VERSION, TEST_CODE, normalizeEmail, toServerPayload, type AccountForm } from './accountCore';

/**
 * Parla con il server per creare l'account e confermarlo con il codice via email.
 * 'server'  = indirizzo e chiave del server ci sono: il codice arriva davvero per email.
 * 'test'    = nessun server, build di sviluppo o con EXPO_PUBLIC_ACCOUNT_TEST=1: nessuna email, codice fisso, l'account è marcato "di prova".
 * 'none'    = nessun server e build normale: l'account non si può creare (resta la modalità demo).
 */
export type Backend = 'server' | 'test' | 'none';
export type Res = { ok: boolean; message?: string };

export async function backend(): Promise<Backend> {
  const c = await loadServerConfig();
  const url = c.url || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = c.anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (url && key) return 'server';
  return __DEV__ || process.env.EXPO_PUBLIC_ACCOUNT_TEST === '1' ? 'test' : 'none';
}

async function supa(): Promise<SupabaseTransport> {
  await ensureEngine();
  if (getTransport().name !== 'supabase') await applyTransport();
  const tr = getTransport();
  if (tr.name !== 'supabase') throw new Error('Server non collegato');
  return tr as SupabaseTransport;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Operazione non riuscita');

export async function sendCode(emailRaw: string): Promise<Res> {
  const email = normalizeEmail(emailRaw);
  try {
    const b = await backend();
    if (b === 'none') return { ok: false, message: "Il servizio account non è ancora attivo: per ora puoi esplorare l'app con i dati demo." };
    if (b === 'test') return { ok: true, message: tl('Modalità di prova: nessuna email inviata. Il codice è {0}.', TEST_CODE) };
    await (await supa()).auth.signIn({ email });
    return { ok: true, message: tl('Ti ho scritto un codice a {0}. Controlla anche lo spam.', email) };
  } catch (e) { return { ok: false, message: msg(e) }; }
}

/** Controlla il codice. Se l'email ha già un account completo, lo dice (`existing`) così non si chiede tutto da capo. */
export async function verifyCode(emailRaw: string, code: string): Promise<Res & { existing?: { firstName: string; lastName: string; country: string; city: string } }> {
  const email = normalizeEmail(emailRaw);
  try {
    const b = await backend();
    if (b === 'none') return { ok: false, message: 'Servizio account non attivo.' };
    if (b === 'test') return code.trim() === TEST_CODE ? { ok: true } : { ok: false, message: 'Codice non valido' };
    const tr = await supa();
    await tr.auth.signIn({ email, token: code });
    await applyTransport();
    const g = await (await supa()).rpc<{ complete?: boolean; nome?: string; cognome?: string; paese?: string; citta?: string }>('account_get');
    return g?.complete && (g.nome ?? '').trim() ? { ok: true, existing: { firstName: g.nome ?? '', lastName: g.cognome ?? '', country: g.paese ?? '', city: g.citta ?? '' } } : { ok: true };
  } catch (e) { return { ok: false, message: msg(e) }; }
}

/** Salva il profilo e i consensi sul server (account_save) e sul telefono. Va chiamata dopo verifyCode. */
export async function saveAccount(f: AccountForm): Promise<Res> {
  try {
    const b = await backend();
    if (b === 'none') return { ok: false, message: 'Servizio account non attivo.' };
    const lang = useApp.getState().language;
    if (b === 'server') await (await supa()).rpc('account_save', { p: toServerPayload(f, lang, Platform.OS) });
    const now = Date.now();
    useAccount.getState().set({ status: b === 'server' ? 'verified' : 'test', email: normalizeEmail(f.email), firstName: f.firstName.trim(), lastName: f.lastName.trim(), country: f.country.trim(), city: f.city.trim(), acceptedVersion: LEGAL_VERSION, acceptedAt: now, createdAt: useAccount.getState().createdAt ?? now });
    const app = useApp.getState();
    app.set({ account: { ...app.account, name: f.firstName.trim(), email: normalizeEmail(f.email) } });
    return { ok: true };
  } catch (e) {
    const m = msg(e);
    return { ok: false, message: /eta_minima/.test(m) ? "Serve l'età minima per creare un account." : m };
  }
}

/** Riprende un account già esistente sul server (nuovo telefono): nessun modulo da compilare. */
export function restoreAccount(email: string, p: { firstName: string; lastName: string; country: string; city: string }, verified: boolean) {
  const now = Date.now();
  useAccount.getState().set({ status: verified ? 'verified' : 'test', email: normalizeEmail(email), ...p, acceptedVersion: LEGAL_VERSION, acceptedAt: now, createdAt: now });
  const app = useApp.getState();
  app.set({ account: { ...app.account, name: p.firstName, email: normalizeEmail(email) } });
}

export async function signOutAccount(): Promise<void> {
  try { if ((await backend()) === 'server') await getTransport().auth.signOut?.(); } catch { /* ignore */ }
  stopDmSync();
  useAccount.getState().clear();
}

/** Esporta tutto ciò che il server sa di te (account, post, messaggi, amici, uso dell'AI, dati sincronizzati cifrati) in un file JSON da salvare o condividere. */
export async function exportServerData(): Promise<Res> {
  if (useAccount.getState().status !== 'verified') return { ok: false, message: 'Serve un account verificato: senza account il server non ha dati tuoi (quelli sul telefono si esportano dal backup).' };
  try {
    const data = await (await supa()).rpc<unknown>('export_my_data');
    const text = JSON.stringify(data, null, 2);
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const file = new File(Paths.cache, `lifepilot-dati-server-${new Date().toISOString().slice(0, 10)}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'La condivisione dei file non è disponibile su questo dispositivo.' };
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'I tuoi dati sul server LifePilot', UTI: 'public.json' });
    return { ok: true, message: 'Dati esportati' };
  } catch (e) { return { ok: false, message: msg(e) }; }
}

/** Elimina l'account: prima dal server (profilo, consensi, dati sincronizzati), poi dal telefono. Se il server non risponde si ferma: niente account "a metà". */
export async function deleteAccountEverywhere(): Promise<Res> {
  if (useAccount.getState().status !== 'verified') { useAccount.getState().clear(); return { ok: true }; }
  try {
    await (await supa()).rpc('delete_my_account');
    await signOutAccount();
    return { ok: true };
  } catch (e) { return { ok: false, message: msg(e) }; }
}
