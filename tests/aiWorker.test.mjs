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
test('senza accesso valido Theia risponde lo stesso (modalita\' leggera), anche per le foto; percorso sconosciuto: 404; GET è il controllo di salute', async () => {
  const env = envWith(async () => ({ response: 'x' }), { SUPABASE_URL: '', SUPABASE_KEY: '' });
  const g = await worker.fetch(req('/chat', { message: 'a' }, 'sbagliato'), env);
  assert.equal(g.status, 200); const gj = await g.json(); assert.equal(gj.reply, 'x'); assert.equal(gj.plan, 'guest'); assert.equal(gj.lite, true);
  assert.equal((await worker.fetch(req('/vision', { image: 'AAAA', mime: 'image/jpeg', prompt: 'a' }, 'sbagliato'), env)).status, 200);
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
  let blocked = false; for (let i = 0; i < 14; i++) blocked = guestTooMany('ip', 5000) || blocked;
  assert.ok(blocked);
});

const DDG = `<div class="result"><h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.louvre.fr%2Fvisita&amp;rut=abc">Visitare il Louvre &amp; gli ingressi</a></h2><a class="result__snippet" href="//x">L&#x27;ingresso <b>Piramide</b> è il più affollato; il Carrousel è più tranquillo.</a></div>
<div class="result"><a class="result__a" href="https://example.org/guida">Guida</a><a class="result__snippet" href="x">Consigli pratici.</a></div>`;
test('ricerca web: si leggono titolo, indirizzo e frase dei risultati', async () => {
  const { parseDdg, webSearch } = await import('../worker/ai.js');
  const r = parseDdg(DDG);
  assert.equal(r.length, 2); assert.equal(r[0].url, 'https://www.louvre.fr/visita'); assert.equal(r[0].title, 'Visitare il Louvre & gli ingressi');
  assert.match(r[0].snippet, /ingresso Piramide è il più affollato/); assert.equal(r[1].url, 'https://example.org/guida');
  const wiki = async (url) => (String(url).includes('duckduckgo') ? new Response('', { status: 503 }) : new Response(JSON.stringify({ query: { pages: { 1: { title: 'Museo del Louvre', extract: 'Il Louvre è un museo di Parigi.' } } } })));
  const w = await webSearch('louvre', wiki);
  assert.equal(w[0].url, 'https://it.wikipedia.org/wiki/Museo_del_Louvre'); assert.match(w[0].snippet, /museo di Parigi/);
});
test('/chat con domanda di fatti: cerca sul web, risponde con le fonti; saluti e dati personali no', async () => {
  const seen = [];
  const ai = async (m, input) => {
    const last = input.messages.at(-1).content, sys = input.messages[0].content;
    if (/Decidi se/.test(sys)) return { response: /louvre/i.test(last) ? '{"search":true,"queries":["louvre ingresso migliore"]}' : '{"search":false}' };
    seen.push(last); return { response: 'Meglio il Carrousel.' };
  };
  const env = { ...envWith(ai), __fetch: async () => new Response(DDG) };
  const a = await (await worker.fetch(req('/chat', { message: 'PROMPT', q: 'In che ingresso sarebbe meglio entrare nel Louvre?' }), env)).json();
  assert.match(a.reply, /Meglio il Carrousel\./); assert.match(a.reply, /Fonti: \[1\] louvre\.fr, \[2\] example\.org\./); assert.match(seen[0], /RICERCA SUL WEB/);
  const b = await (await worker.fetch(req('/chat', { message: 'PROMPT', q: 'quanto ho speso ieri?' }), env)).json();
  assert.equal(b.reply, 'Meglio il Carrousel.'); assert.doesNotMatch(seen[1], /ricerca sul web/);
  const c = await (await worker.fetch(req('/chat', { message: 'PROMPT', q: 'ciao', web: true }), env)).json();
  assert.doesNotMatch(c.reply, /Fonti/);
  const d = await (await worker.fetch(req('/chat', { message: 'PROMPT', q: 'In che ingresso del Louvre?', web: false }), env)).json();
  assert.doesNotMatch(d.reply, /Fonti/);
});

test('ricerca web: le notizie (RSS) hanno data e testata e vengono prima, le più recenti in cima', async () => {
  const { parseRss, webSearch } = await import('../worker/ai.js');
  const rss = `<rss><channel><item><title>Elezioni in Serbia: vince il partito di Vucic</title><link>https://example.com/a</link><pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate><source url="https://x">ANSA</source><description>&lt;a&gt;Elezioni&lt;/a&gt; Il partito ottiene la maggioranza.</description></item><item><title><![CDATA[Seggi aperti]]></title><link>https://example.com/b</link><pubDate>Sun, 25 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const r = parseRss(rss);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'Elezioni in Serbia: vince il partito di Vucic - ANSA');
  assert.match(r[0].snippet, /^2026-10-26: /);
  assert.equal(r[1].title, 'Seggi aperti');
  const f = async (url) => (String(url).includes('news.google') ? new Response(rss) : new Response('', { status: 503 }));
  const w = await webSearch('elezioni serbia', f);
  assert.equal(w[0].url, 'https://example.com/a');
});

test('ricerca: affidabilita delle fonti, ordine, pagine lette e istruzioni anti fake news', async () => {
  const { credibility, rankResults, research } = await import('../worker/ai.js');
  assert.equal(credibility('https://www.ansa.it/x'), 3);
  assert.equal(credibility('https://it.wikipedia.org/wiki/X'), 3);
  assert.equal(credibility('https://www.salute.gov.it/a'), 3);
  assert.equal(credibility('https://www.facebook.com/p'), 0.5);
  assert.equal(credibility('https://blog-qualunque.example/p'), 2);
  const l = [{ url: 'https://www.facebook.com/a', title: 'Shock' , snippet: '' }, { url: 'https://blog1.example/a', title: 'Uno', snippet: '' }, { url: 'https://www.reuters.com/a', title: 'Due', snippet: '' }, { url: 'https://blog2.example/a', title: 'Tre', snippet: '' }, { url: 'https://blog3.example/a', title: 'Quattro', snippet: '' }, { url: 'https://www.reuters.com/a', title: 'Due', snippet: '' }];
  const r = rankResults(l);
  assert.equal(r[0].url, 'https://www.reuters.com/a');
  assert.equal(r.filter((x) => x.url.includes('reuters')).length, 1);
  assert.ok(!r.some((x) => x.url.includes('facebook')));
  const f = async (url) => (String(url).startsWith('https://r.jina.ai/') ? new Response('Title: x\nMarkdown Content:\n' + 'Il testo della pagina letta. '.repeat(20)) : new Response(DDG));
  const res = await research(['louvre'], f);
  assert.ok(res.some((x) => x.page && /testo della pagina letta/.test(x.page)));
});
