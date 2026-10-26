import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS, detectDomain, isDeep, expertPrompt, officialQueries, isOfficial } from '../worker/domains.js';
import worker from '../worker/ai.js';

test('detectDomain: riconosce i campi principali', () => {
  const t = (q) => detectDomain(q)?.id ?? null;
  assert.equal(t('ho la febbre e mal di gola da due giorni'), 'salute');
  assert.equal(t('come funziona la dichiarazione dei redditi per i forfettari'), 'fisco');
  assert.equal(t('posso disdire il contratto di affitto prima della scadenza?'), 'diritto');
  assert.equal(t('quante proteine devo mangiare per la massa muscolare'), 'alimentazione');
  assert.equal(t('che scheda di allenamento in palestra per la forza'), 'fitness');
  assert.equal(t('come investire in ETF con un orizzonte di 10 anni'), 'finanza');
  assert.equal(t('ciao come stai'), null);
});
test('ogni campo ha fonti, guida e un riconoscitore valido', () => {
  assert.ok(DOMAINS.length >= 20);
  for (const d of DOMAINS) { assert.ok(d.sites.length >= 4, d.id); assert.ok(d.guide.length > 80, d.id); assert.ok(d.re instanceof RegExp, d.id); }
  assert.equal(new Set(DOMAINS.map((d) => d.id)).size, DOMAINS.length);
});
test('approfondimento, fonti ufficiali e prompt dell\'esperto', () => {
  assert.ok(isDeep('Approfondisci: la febbre alta') && isDeep('spiegami nel dettaglio il TFR') && !isDeep('che ora e'));
  const d = DOMAINS.find((x) => x.id === 'diritto');
  assert.match(expertPrompt(d, false), /CAMPO: DIRITTO E CONTRATTI/);
  assert.match(expertPrompt(d, true), /MODALITA' APPROFONDIMENTO/);
  assert.match(officialQueries(d, 'affitto disdetta', 1)[0], /^affitto disdetta site:normattiva\.it OR site:gazzettaufficiale\.it/);
  assert.ok(isOfficial(d, 'www.fedlex.admin.ch'.replace('www.', '')) && !isOfficial(d, 'example.com') && !isOfficial(null, 'x'));
});
test('/chat con domanda di un campo: l\'esperto entra nella richiesta e la risposta dice il campo', async () => {
  const seen = [];
  const ai = async (m, input) => {
    const sys = input.messages[0].content, last = input.messages.at(-1).content;
    if (/Decidi se/.test(sys)) return { response: '{"search":false}' };
    seen.push(last); return { response: 'Risposta.' };
  };
  const env = { AI: { run: ai }, APP_TOKEN: 'prova', SUPABASE_URL: 'https://s.supabase.co', SUPABASE_KEY: 'k' };
  const r = await (await worker.fetch(new Request('https://x.dev/chat', { method: 'POST', headers: { authorization: 'Bearer prova', 'content-type': 'application/json' }, body: JSON.stringify({ message: 'PROMPT', q: 'posso disdire il contratto di affitto prima della scadenza?', web: false }) }), env)).json();
  assert.equal(r.domain.id, 'diritto'); assert.match(seen[0], /CAMPO: DIRITTO/);
  const r2 = await (await worker.fetch(new Request('https://x.dev/chat', { method: 'POST', headers: { authorization: 'Bearer prova', 'content-type': 'application/json' }, body: JSON.stringify({ message: 'PROMPT', q: 'ciao come stai oggi', web: false }) }), env)).json();
  assert.equal(r2.domain, undefined);
});

test('l\'assistente non si presenta mai come un professionista', () => {
  for (const d of DOMAINS) {
    const x = expertPrompt(d, true);
    assert.match(x, /NON sei un medico, avvocato/);
    assert.doesNotMatch(d.guide, /Rispondi come|Spiega come/);
  }
});
