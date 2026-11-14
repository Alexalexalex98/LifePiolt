import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, isCode, formatCode, qrPayload, parseQr, cleanUsername, usernameProblem, queryKind, canSee, AUDIENCES, POST_AUDIENCES, initials, peopleError } from '../src/lib/people.ts';

test('codice: normalizza, formatta, riconosce; niente caratteri ambigui', () => {
  assert.equal(normalizeCode(' k7m4-9qxr '), 'K7M49QXR'); assert.equal(formatCode('k7m49qxr'), 'K7M4-9QXR'); assert.equal(isCode('K7M4-9QXR'), true);
  assert.equal(isCode('K7M4-9QX0'), false, 'lo zero non c\'è'); assert.equal(isCode('K7M4-9QXI'), false, 'la I non c\'è'); assert.equal(isCode('K7M4'), false); assert.equal(isCode('anna verdi'), false);
});
test('QR: indirizzo con il codice, letto da app, link web o codice nudo', () => {
  assert.equal(qrPayload('k7m4-9qxr'), 'lifepilot://u/K7M49QXR');
  assert.equal(parseQr('lifepilot://u/K7M49QXR'), 'K7M49QXR'); assert.equal(parseQr('https://lifepilot.app/u/k7m4-9qxr?x=1'), 'K7M49QXR'); assert.equal(parseQr('  K7M4-9QXR '), 'K7M49QXR');
  assert.equal(parseQr('https://evil.example/pay?to=1'), null); assert.equal(parseQr('lifepilot://u/SHORT'), null); assert.equal(parseQr(''), null);
});
test('nome utente: regole e messaggi', () => {
  assert.equal(cleanUsername(' @Anna.V '), 'anna.v'); assert.equal(usernameProblem(''), null); assert.equal(usernameProblem('@anna.v'), null);
  assert.match(usernameProblem('ab'), /3 caratteri/); assert.match(usernameProblem('a'.repeat(21)), /20/); assert.match(usernameProblem('.anna'), /Solo lettere/); assert.match(usernameProblem('an na'), /Solo lettere/); assert.match(usernameProblem('a..b'), /punti/); assert.match(usernameProblem('admin'), /disponibile/);
});
test('ricerca: codice, @nome, nome, troppo corta', () => { assert.equal(queryKind('K7M4-9QXR'), 'code'); assert.equal(queryKind('@an'), 'username'); assert.equal(queryKind('@a'), 'short'); assert.equal(queryKind('Anna Verdi'), 'name'); assert.equal(queryKind('an'), 'short'); });
test('pubblico dei contenuti: tutti / solo chi mi segue / tutti tranne chi mi segue; l\'autore vede sempre', () => {
  assert.equal(canSee('public', false, false), true);
  assert.equal(canSee('followers', false, true), true); assert.equal(canSee('followers', false, false), false);
  assert.equal(canSee('not_followers', false, true), false); assert.equal(canSee('not_followers', false, false), true);
  for (const a of ['public', 'followers', 'not_followers']) assert.equal(canSee(a, true, false), true);
  assert.deepEqual(AUDIENCES.map((a) => a.k), ['public', 'followers', 'not_followers']); assert.deepEqual(POST_AUDIENCES, ['public', 'followers']);
});
test('iniziali e messaggi d\'errore', () => { assert.equal(initials('Anna Maria Verdi'), 'AM'); assert.equal(initials(''), ''); assert.match(peopleError(new Error('nome_utente_occupato')), /già preso/); assert.match(peopleError('troppe_ricerche'), /minuto/); assert.match(peopleError('non_visibile'), /codice/); assert.match(peopleError('boh'), /connessione/); });
