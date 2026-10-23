import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, emailOk, EMPTY_FORM, LEGAL_VERSION, needsReaccept, parseBirth, toServerPayload, validateAccount } from '../src/lib/accountCore.ts';
import { SupabaseTransport } from '../src/sync/supabaseTransport.ts';

const NOW = new Date('2026-10-23T12:00:00Z');
const ok = { ...EMPTY_FORM, firstName: 'Anna', lastName: 'Rossi', email: 'Anna@Example.com ', birth: '15/03/1990', country: 'Svizzera', city: 'Lugano', postal: '6900', street: 'Via Nassa 5', terms: true, privacy: true, age: true };

test('data di nascita: formati validi e date inesistenti', () => {
  assert.equal(parseBirth('15/03/1990'), '1990-03-15');
  assert.equal(parseBirth('1-2-2000'), '2000-02-01');
  assert.equal(parseBirth('31/02/2000'), null);
  assert.equal(parseBirth('15/03/1850'), null);
  assert.equal(parseBirth('ieri'), null);
});
test('età: compleanno non ancora arrivato', () => {
  assert.equal(ageOn('2010-10-24', NOW), 15);
  assert.equal(ageOn('2010-10-23', NOW), 16);
});
test('un modulo completo non ha errori', () => assert.deepEqual(validateAccount(ok, NOW), {}));
test('sotto i 16 anni non si crea l\'account', () => {
  assert.ok(validateAccount({ ...ok, birth: '24/10/2010' }, NOW).birth);
  assert.equal(validateAccount({ ...ok, birth: '23/10/2010' }, NOW).birth, undefined);
});
test('senza consensi o dati obbligatori si blocca', () => {
  const e = validateAccount({ ...EMPTY_FORM }, NOW);
  for (const k of ['firstName', 'lastName', 'email', 'birth', 'country', 'city', 'postal', 'street', 'terms', 'privacy', 'age']) assert.ok(e[k], k);
  assert.ok(validateAccount({ ...ok, terms: false }, NOW).terms);
  assert.ok(validateAccount({ ...ok, birth: '15/03/2999' }, NOW).birth);
});
test('email', () => { assert.ok(emailOk(' a@b.it ')); assert.ok(!emailOk('a@b')); assert.ok(!emailOk('a b@c.it')); });
test('corpo per il server: solo i campi dichiarati, email non inclusa', () => {
  const p = toServerPayload(ok, 'it', 'ios');
  assert.deepEqual(Object.keys(p).sort(), ['cap', 'citta', 'cognome', 'data_nascita', 'eta', 'lingua', 'nome', 'paese', 'piattaforma', 'privacy', 'termini', 'versione', 'via']);
  assert.equal(p.data_nascita, '1990-03-15'); assert.equal(p.versione, LEGAL_VERSION);
});
test('documenti cambiati: vanno riaccettati', () => { assert.ok(needsReaccept('2020-01')); assert.ok(needsReaccept(undefined)); assert.ok(!needsReaccept(LEGAL_VERSION)); });
test('account_save passa dalla sessione e chiede di accedere se non c\'è', async () => {
  const calls = [];
  const client = { rpc: async (fn, args) => { calls.push([fn, args]); return { data: { ok: true }, error: null }; }, from: () => ({}), auth: { getSession: async () => ({ data: { session: null } }), signInWithOtp: async () => ({ data: {}, error: null }), verifyOtp: async () => ({ data: {}, error: null }), signOut: async () => ({}) } };
  const t = new SupabaseTransport(client, { url: 'u', anonKey: 'k', deviceId: 'd', deviceName: 'n' });
  await assert.rejects(() => t.rpc('account_save', { p: {} }), (e) => e.kind === 'auth');
  await t.auth.signIn({ email: 'a@b.it', token: '123456' });
  assert.deepEqual(await t.rpc('account_save', { p: { nome: 'A' } }), { ok: true });
  assert.equal(calls[0][0], 'account_save');
});
