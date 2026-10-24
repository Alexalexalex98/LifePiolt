import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { SMART, VISION, LITE, isQuota, run, textOf, tooMany, whoIs, usage, guestTooMany } from '../worker/ai.js';

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
test('senza accesso valido Theia risponde lo stesso (modalita\' leggera); foto e documenti no; percorso sconosciuto: 404; GET è il controllo di salute', async () => {
  const env = envWith(async () => ({ response: 'x' }), { SUPABASE_URL: '', SUPABASE_KEY: '' });
  const g = await worker.fetch(req('/chat', { message: 'a' }, 'sbagliato'), env);
  assert.equal(g.status, 200); const gj = await g.json(); assert.equal(gj.reply, 'x'); assert.equal(gj.plan, 'guest'); assert.equal(gj.lite, true);
  assert.equal((await worker.fetch(req('/vision', { image: 'AAAA', mime: 'image/jpeg', prompt: 'a' }, 'sbagliato'), env)).status, 401);
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

test('piani: free/plus/pro con limiti diversi; finiti i messaggi completi si passa ai modelli leggeri ma si risponde', async () => {
  const used = [];
  const f = async (url, o) => {
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u' + o.headers.authorization.slice(7) }));
    const plan = o.headers.authorization.slice(7);
    const limit = { free: 30, plus: 200, pro: 1000 }[plan]; const n = plan === 'free' ? 31 : 5;
    used.push(plan);
    return new Response(JSON.stringify({ plan, limit, used: n, full: n <= limit }));
  };
  const seen = [];
  const env = envWith(async (m, input) => { seen.push([m, input.max_tokens]); return { response: 'ok' }; }, { SUPABASE_URL: 'https://s.co', SUPABASE_KEY: 'k' });
  const call = async (plan) => (await worker.fetch(req('/chat', { message: 'ciao' }, plan), env, undefined, f)).json();
  const free = await call('free'); assert.equal(free.lite, true); assert.equal(free.plan, 'free'); assert.equal(seen.at(-1)[0], LITE[0]); assert.ok(seen.at(-1)[1] <= 450);
  const plus = await call('plus'); assert.equal(plus.lite, false); assert.equal(plus.left, 195); assert.equal(seen.at(-1)[0], SMART[0]);
  const pro = await call('pro'); assert.equal(pro.limit, 1000); assert.equal(pro.lite, false);
});
test('se il conteggio non risponde non si blocca nessuno; il freno degli ospiti e\' stretto', async () => {
  assert.equal(await usage('t', { SUPABASE_URL: 'https://s.co', SUPABASE_KEY: 'k' }, async () => new Response('{}', { status: 404 })), null);
  let blocked = false; for (let i = 0; i < 8; i++) blocked = guestTooMany('ip', 5000) || blocked;
  assert.ok(blocked);
});
