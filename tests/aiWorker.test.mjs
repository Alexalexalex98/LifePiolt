import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { SMART, VISION, isQuota, run, textOf, tooMany, whoIs } from '../worker/ai.js';

const req = (path, body, tok = 'prova') => new Request(`https://x.dev${path}`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const envWith = (ai, more = {}) => ({ AI: { run: ai, toMarkdown: async () => [{ data: 'testo del pdf' }] }, APP_TOKEN: 'prova', SUPABASE_URL: 'https://s.supabase.co', SUPABASE_KEY: 'k', ...more });

test('estrae il testo dai vari formati e toglie il ragionamento', () => {
  assert.equal(textOf({ choices: [{ message: { content: ' ciao ' } }] }), 'ciao');
  assert.equal(textOf({ response: '<think>boh</think>ok' }), 'ok');
  assert.equal(textOf(null), '');
});
test('passa al modello successivo se uno risponde vuoto o va in errore', async () => {
  const calls = [];
  const ai = async (m) => { calls.push(m); if (m === SMART[0]) return { choices: [{ message: { content: null } }] }; if (m === SMART[1]) throw new Error('boom'); return { response: 'risposta' }; };
  const r = await run(envWith(ai), SMART, { messages: [] });
  assert.equal(r.text, 'risposta'); assert.deepEqual(calls, SMART.slice(0, 3));
});
test('quota finita: errore riconoscibile e messaggio chiaro all\'utente', async () => {
  assert.ok(isQuota(new Error('4006: you have used up your daily free allocation')));
  const env = envWith(async () => { throw new Error('4006: daily free allocation'); });
  const r = await worker.fetch(req('/chat', { message: 'ciao' }), env);
  assert.equal(r.status, 429); assert.equal((await r.json()).code, 'quota');
});
test('/chat, /vision, /analyze e /translate rispondono come il vecchio server', async () => {
  const ai = async (m, input) => ({ response: m === VISION[0] ? 'divano giallo' : input.messages.at(-1).content.includes('Traduci') ? '["a","b"]' : '[{"voce":1}]' });
  const env = envWith(ai);
  assert.equal((await (await worker.fetch(req('/chat', { message: 'ciao' }), env)).json()).reply, '[{"voce":1}]');
  assert.equal((await (await worker.fetch(req('/vision', { image: 'AAAA', mime: 'image/jpeg', prompt: 'cosa vedi' }), env)).json()).reply, 'divano giallo');
  const an = await (await worker.fetch(req('/analyze', { files: [{ data: 'AAAA', mime: 'image/jpeg' }], question: 'leggi' }), env)).json();
  assert.equal(an.reply, 'divano giallo');
  const an2 = await (await worker.fetch(req('/analyze', { files: [{ data: btoa('%PDF'), mime: 'application/pdf' }], question: 'elenca' }), env)).json();
  assert.deepEqual(an2.result, [{ voce: 1 }]);
  assert.equal((await (await worker.fetch(req('/translate', { lang: 'en', texts: ['x', 'y'] }), env)).json()).reply, '["a","b"]');
});
test('senza token o con token sbagliato: 401; percorso sconosciuto: 404; GET è il controllo di salute', async () => {
  const env = envWith(async () => ({ response: 'x' }), { SUPABASE_URL: '', SUPABASE_KEY: '' });
  assert.equal((await worker.fetch(req('/chat', { message: 'a' }, 'sbagliato'), env)).status, 401);
  assert.equal((await worker.fetch(req('/boh', {}), env)).status, 404);
  const h = await worker.fetch(new Request('https://x.dev/'), env);
  assert.equal((await h.json()).ok, true);
});
test('il token di Supabase viene verificato dal server di accesso e ricordato un minuto', async () => {
  let n = 0;
  const f = async (url, o) => { n++; assert.match(url, /\/auth\/v1\/user$/); return o.headers.authorization === 'Bearer buono' ? new Response(JSON.stringify({ id: 'u1' })) : new Response('{}', { status: 401 }); };
  const env = envWith(async () => ({}), { APP_TOKEN: '' });
  const mk = (t) => ({ headers: new Headers({ authorization: `Bearer ${t}` }) });
  assert.deepEqual(await whoIs(mk('buono'), env, f), { id: 'u1' });
  assert.deepEqual(await whoIs(mk('buono'), env, f), { id: 'u1' }); assert.equal(n, 1);
  assert.equal(await whoIs(mk('cattivo'), env, f), null);
});
test('freno: oltre 40 richieste al minuto per persona', () => {
  let blocked = false; for (let i = 0; i < 45; i++) blocked = tooMany('freno', 1000) || blocked;
  assert.ok(blocked); assert.equal(tooMany('altro', 1000), false);
});
