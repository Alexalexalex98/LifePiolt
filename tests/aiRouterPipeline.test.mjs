import test from 'node:test';
import assert from 'node:assert/strict';

import { routeDetailed, planRequest } from '../src/lib/aiRouter/pipeline.ts';
import { MockProxyClient } from '../src/lib/aiRouter/adapters/mock.ts';
import { NotConnectedClient, createProxyClient, HttpProxyClient } from '../src/lib/aiRouter/adapters/serverProxy.ts';
import { DEFAULT_PREFS } from '../src/lib/aiRouter/select.ts';

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const H = 3600000;
const mkDeps = (over = {}) => {
  const spent = [], always = [], atts = [];
  const client = over.client ?? new MockProxyClient();
  return {
    deps: {
      prefs: { ...DEFAULT_PREFS, phoneOnly: false }, planId: 'free', usage: [], consents: {}, client, isConnected: () => client.isConfigured(),
      now: NOW, tzOffsetMin: 0, profile: { lang: 'it', answerStyle: 'diretto' }, share: { memory: true, health: false, finance: false },
      data: { tasks: ['Chiamare il dentista', 'Spesa'], goals: [] },
      askConsent: async () => 'once', onSpent: (u, l) => spent.push([u, l]), onConsentAlways: (id) => always.push(id), onAttachment: (a) => atts.push(a), newId: () => 'id1',
      ...over,
    },
    client, spent, always, atts,
  };
};
const req = (text, extra = {}) => ({ text, lang: 'it', source: 'typed', ...extra });

test('oggi, tutti non collegati: anteprima onesta con riscrittura e cosa uscirebbe', async () => {
  const { deps } = mkDeps({ client: new NotConnectedClient(), isConnected: () => false });
  const t = await routeDetailed(req('disegna  un gato rosso con un capello blue, il mio numero e +41 79 123 45 67'), deps);
  assert.equal(t.result.status, 'not_connected');
  assert.equal(t.plan.verdict, 'delegate');
  assert.match(t.result.message, /Per questa richiesta userei GPT \(creazione immagini\)\. Non è ancora collegato: quando lo sarà, il testo che invierei è: «/);
  assert.match(t.result.message, /\[TELEFONO\]/);
  assert.ok(!t.result.message.includes('123 45 67'));
  assert.match(t.result.message, /Sto per inviare a GPT: il tuo testo\./);
  assert.match(t.result.message, /Non invio: .*finanze/);
  assert.equal(t.plan.context.items.length, 0, 'per un\'immagine nessun dato personale');
});

test('solo sul telefono: nessuna delega, mai, anche se i fornitori fossero collegati', async () => {
  const { deps, client, spent } = mkDeps({ prefs: { ...DEFAULT_PREFS, phoneOnly: true } });
  const t = await routeDetailed(req('disegna un gatto'), deps);
  assert.equal(t.result.status, 'not_connected');
  assert.equal(t.result.message, 'Questa richiesta richiede un\'AI esterna: attivala in Intelligenza di Theia.');
  assert.equal(client.calls.length, 0);
  assert.equal(spent.length, 0);
  assert.equal(t.plan.phoneOnly, true);
});

test('comando semplice: in locale, nessuna chiamata', async () => {
  const { deps, client } = mkDeps();
  const t = await routeDetailed(req('aggiungi riunione al piano domani alle 15'), deps);
  assert.equal(t.plan.verdict, 'local');
  assert.equal(t.result.kind, 'local');
  assert.equal(client.calls.length, 0);
});

test('ambiguo: chiede chiarimenti con 2-3 opzioni, non spende', async () => {
  const { deps, client, spent } = mkDeps();
  const t = await routeDetailed(req('una canzone'), deps);
  assert.equal(t.plan.verdict, 'clarify');
  assert.equal(t.result.kind, 'clarify');
  assert.equal(t.result.status, 'answered');
  const opts = t.result.text.split('\n');
  assert.ok(opts.length >= 2 && opts.length <= 3);
  assert.match(opts[0], /una canzone/);
  assert.equal(client.calls.length, 0);
  assert.equal(spent.length, 0);
});

test('limite raggiunto: nessuna chiamata, messaggio con orario di reset', async () => {
  const usage = [{ ts: NOW - 3 * H, kind: 'music_generate', units: 1, tokens: 0, cost: 0.1 }, { ts: NOW - H, kind: 'music_generate', units: 1, tokens: 0, cost: 0.1 }];
  const { deps, client } = mkDeps({ usage });
  const t = await routeDetailed(req('componi una canzone sul mare'), deps);
  assert.equal(t.result.status, 'limit');
  assert.equal(t.result.message, 'Hai usato 2 canzoni su 2 oggi. Si azzera domani alle 00:00.');
  assert.equal(client.calls.length, 0);
});

test('collegato: consenso richiesto, annulla = nessun invio', async () => {
  const { deps, client } = mkDeps({ askConsent: async () => 'cancel' });
  const t = await routeDetailed(req('disegna un gatto rosso'), deps);
  assert.equal(t.result.status, 'error');
  assert.match(t.result.message, /Annullato/);
  assert.equal(client.calls.length, 0);
});

test('collegato: una volta / sempre, uso e cronologia registrati senza contenuto', async () => {
  const client = new MockProxyClient({ gpt_image: { ok: true, assets: [{ kind: 'image', url: 'https://x/img.png', mime: 'image/png', title: 'Gatto', width: 512, height: 512 }], usage: { units: 1, cost: 0.04 } } });
  const { deps, spent, always, atts } = mkDeps({ client, askConsent: async () => 'always' });
  const t = await routeDetailed(req('disegna 3 gatti rossi, scrivi a mario@mail.com'), deps);
  assert.equal(t.result.status, 'answered');
  assert.equal(t.result.provider, 'gpt_image');
  assert.equal(t.result.images.length, 1);
  assert.deepEqual(always, ['gpt_image']);
  assert.equal(atts[0].saveTo, 'lifedrive');
  const sent = client.calls.at(-1);
  assert.ok(!sent.prompt.includes('mario@mail.com'), 'redatto prima dell\'invio');
  assert.ok(sent.prompt.includes('[EMAIL]'));
  assert.equal(client.calls.some((c) => c.kind === 'rewrite'), false, 'senza consenso "sempre" nessuna riscrittura col modello');
  assert.equal(spent.length, 1);
  assert.equal(spent[0][0].kind, 'image_generate');
  assert.equal(spent[0][1].provider, 'gpt_image');
  assert.ok(!JSON.stringify(spent[0][1]).includes('gatti'), 'la cronologia non contiene il testo');
  assert.ok(spent[0][1].redacted >= 1);
});

test('fornitore con "sempre" e dati non sensibili: nessuna domanda; con dati sensibili chiede ancora', async () => {
  let asked = 0;
  const client = new MockProxyClient();
  const base = { client, consents: { claude: { always: true, at: 1 }, gemini: { always: true, at: 1 }, gpt: { always: true, at: 1 } }, askConsent: async () => { asked++; return 'once'; } };
  const { deps } = mkDeps(base);
  await routeDetailed(req('spiega la fotosintesi'), deps);
  assert.equal(asked, 0);
  // salute condivisa -> sensibile
  const { deps: d2 } = mkDeps({ ...base, share: { memory: true, health: true, finance: false }, data: { tasks: [], goals: [], health: 'dormito 6h' } });
  await routeDetailed(req('come ho dormito? analizza il mio sonno in modo approfondito, passo per passo'), d2);
  assert.equal(asked, 1);
});

test('fallback: il primo fornitore e giu, usa il secondo', async () => {
  const client = new MockProxyClient({ gpt_image: { ok: false, error: { code: 'provider_down', message: 'giu' } } });
  const { deps } = mkDeps({ client, askConsent: async () => 'once' });
  const t = await routeDetailed(req('disegna un gatto'), deps);
  assert.equal(t.result.status, 'answered');
  assert.notEqual(t.result.provider, 'gpt_image');
  assert.match(t.result.message, /non era disponibile/);
  assert.equal(client.calls.length, 2);
});

test('errore non recuperabile: si ferma', async () => {
  const client = new MockProxyClient({ gpt_image: { ok: false, error: { code: 'content_blocked', message: 'bloccato' } } });
  const { deps } = mkDeps({ client, askConsent: async () => 'once' });
  const t = await routeDetailed(req('disegna un gatto'), deps);
  assert.equal(t.result.status, 'error');
  assert.equal(client.calls.length, 1);
});

test('riscrittura con modello: fedele usata, infedele scartata', async () => {
  const mk = (rewrite) => new MockProxyClient({ rewrite: { ok: true, text: rewrite } });
  const consents = { gpt_image: { always: true, at: 1 }, imagen: { always: true, at: 1 }, midjourney: { always: true, at: 1 }, gpt: { always: true, at: 1 }, claude: { always: true, at: 1 }, gemini: { always: true, at: 1 }, mistral: { always: true, at: 1 } };
  const c1 = mk(JSON.stringify({ prompt: 'Draw a red cat wearing a blue hat', ambiguities: [] }));
  const { deps: d1 } = mkDeps({ client: c1, consents });
  const t1 = await routeDetailed(req('disegna un gato rosso con un capello blue'), d1);
  assert.equal(t1.plan.rewrite.source, 'model');
  assert.equal(c1.calls.find((c) => c.provider !== 'rewrite' && c.kind !== 'rewrite').prompt, 'Draw a red cat wearing a blue hat');
  const c2 = mk(JSON.stringify({ prompt: 'Draw a cat, 4k, cinematic', ambiguities: [] }));
  const { deps: d2 } = mkDeps({ client: c2, consents });
  const t2 = await routeDetailed(req('disegna un gato rosso con un capello blue'), d2);
  assert.equal(t2.plan.rewrite.source, 'fallback');
  assert.equal(c2.calls.find((c) => c.kind !== 'rewrite').prompt, 'disegna un gato rosso con un capello blue');
  assert.ok(c1.calls.some((c) => c.kind === 'rewrite'));
});

test('testo: contesto minimo e risposta resa semplice', async () => {
  const client = new MockProxyClient({ gemini: { ok: true, text: '**Ecco** il piano. Uno. Due. Tre. Quattro. Cinque. Sei. Sette. Otto.', usage: { tokensIn: 10, tokensOut: 20 } }, claude: { ok: true, text: '**Ecco** il piano. Uno. Due. Tre. Quattro. Cinque. Sei. Sette. Otto.' }, gpt: { ok: true, text: '**Ecco** il piano. Uno. Due. Tre. Quattro. Cinque. Sei. Sette. Otto.' } });
  const { deps } = mkDeps({ client, askConsent: async () => 'once', profile: { lang: 'it', answerStyle: 'breve' } });
  const t = await routeDetailed(req('spiega la fotosintesi in dettaglio, ragiona passo per passo'), deps);
  assert.equal(t.result.status, 'answered');
  assert.ok(!t.result.text.includes('**'));
  assert.ok(t.result.text.split('\n').length <= 2);
  const body = client.calls.at(-1);
  assert.deepEqual(body.context.map((c) => c.key), ['lang', 'style']);
});

test('nessun fornitore adatto / mai: errore chiaro senza spesa', async () => {
  const { deps, client } = mkDeps({ prefs: { ...DEFAULT_PREFS, phoneOnly: false, taskPref: { music: 'never' } } });
  const t = await routeDetailed(req('componi una canzone sul mare'), deps);
  assert.equal(t.result.status, 'error');
  assert.match(t.result.message, /non usare servizi esterni/);
  assert.equal(client.calls.length, 0);
});

test('planRequest e puro: non chiama il client', () => {
  const { deps, client } = mkDeps();
  const p = planRequest(req('disegna un gatto'), deps);
  assert.equal(p.verdict, 'delegate');
  assert.equal(client.calls.length, 0);
  assert.ok(p.estCost > 0);
});

test('client: baseUrl vuoto = non collegato; HTTP usa il nostro server con token', async () => {
  assert.ok(createProxyClient({ baseUrl: '' }) instanceof NotConnectedClient);
  assert.equal((await new NotConnectedClient().route({})).error.code, 'not_connected');
  let seen;
  const http = new HttpProxyClient('https://srv.example/', () => 'tok', async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ ok: true, text: 'ciao' }) }; });
  assert.equal(http.isConfigured(), true);
  const r = await http.route({ kind: 'chat', provider: 'gpt', prompt: 'x', attachments: [], constraints: { lang: 'it' } });
  assert.equal(r.text, 'ciao');
  assert.equal(seen.url, 'https://srv.example/v1/ai/route');
  assert.equal(seen.init.headers.authorization, 'Bearer tok');
  assert.equal(new HttpProxyClient('https://srv.example', () => null, async () => { throw new Error('x'); }).isConfigured(), false);
});
