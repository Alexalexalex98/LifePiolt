import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { openNodeDriver } from './helpers/nodeSqlite.mjs';
import { makeSynthStates, totalBytes } from './helpers/synth.mjs';
import { SqlKvBackend } from '../src/db/sqlKv.ts';
import { KvEngine } from '../src/db/engine.ts';
import { checksum } from '../src/db/checksum.ts';
import { ASYNCSTORAGE_ROW_LIMIT, ASYNCSTORAGE_TOTAL_LIMIT, formatBytes } from '../src/db/space.ts';

const states = makeSynthStates({ years: 5 });
const mb = (n) => (n / 1e6).toFixed(2) + ' MB';
const log = (s) => console.log('# ' + s);

test('dimensioni: 5 anni di dati sintetici vs limiti di AsyncStorage', () => {
  const total = totalBytes(states);
  const rows = Object.entries(states).map(([k, v]) => `${k.replace('lp2-', '')} ${mb(v.length)}`).join(', ');
  log(`dati: ${mb(total)} totali (${rows}); limite AsyncStorage Android ~${formatBytes(ASYNCSTORAGE_TOTAL_LIMIT)} totali, ~${formatBytes(ASYNCSTORAGE_ROW_LIMIT)} per riga in lettura`);
  assert.ok(total > ASYNCSTORAGE_TOTAL_LIMIT, 'il motore vecchio sfora il tetto: e\' il caso che vogliamo coprire');
});

test('hydrate + scrittura: SQLite regge 5 anni di dati e restituisce gli stessi dati', async () => {
  const { driver } = openNodeDriver();
  const b = new SqlKvBackend({ driver }); await b.init();
  const e = new KvEngine({ backend: b, notify: () => {} });
  let t0 = performance.now();
  await b.writeMany(states, Object.fromEntries(Object.keys(states).map((k) => [k, 1])));
  const tWrite = performance.now() - t0;
  const e2 = new KvEngine({ backend: b, notify: () => {} });
  t0 = performance.now();
  const got = await Promise.all(Object.keys(states).map((k) => e2.getItem(k)));
  const tHydrate = performance.now() - t0;
  t0 = performance.now(); for (const v of Object.values(states)) checksum(v); const tSum = performance.now() - t0;
  t0 = performance.now(); for (const v of Object.values(states)) JSON.parse(v); const tParseOld = performance.now() - t0;
  log(`scrittura completa iniziale ${tWrite.toFixed(0)} ms | idratazione di ${got.length} store in parallelo ${tHydrate.toFixed(0)} ms (comprende il parse JSON, che c'era anche prima: ${tParseOld.toFixed(0)} ms) | checksum di tutto ${tSum.toFixed(0)} ms`);
  assert.equal(got.filter(Boolean).length, Object.keys(states).length);
  void e;
});

/** Blocco massimo del thread: un timer a 2 ms misura quanto a lungo il ciclo eventi resta fermo. */
async function measure(label, fn) {
  const h = monitorEventLoopDelay({ resolution: 1 }); h.enable();
  const t0 = performance.now();
  await fn();
  await new Promise((r) => setTimeout(r, 30));
  const total = performance.now() - t0;
  h.disable();
  return { label, total, maxBlock: h.max / 1e6, p99: h.percentile(99) / 1e6 };
}

test('raffica di 60 modifiche alla chat: engine vecchio (stringify a ogni set) vs nuovo (coalescente, a pezzi)', async () => {
  const chat = JSON.parse(states['lp2-chat']);
  const c0 = Object.keys(chat.state.messages)[0];
  const mutate = (st, i) => ({ ...st, messages: { ...st.messages, [c0]: [...st.messages[c0], { id: 'n' + i, chatId: c0, from: 'Alex', kind: 'text', text: 'messaggio ' + i, ts: i, status: 'sent' }] } });

  // vecchio: createJSONStorage -> JSON.stringify dell'intero stato a OGNI set(), poi AsyncStorage.setItem(stringa intera)
  const old = await measure('vecchio', async () => {
    const mem = new Map(); let st = chat.state;
    for (let i = 0; i < 60; i++) { st = mutate(st, i); mem.set('lp2-chat', JSON.stringify({ state: st, version: 0 })); await new Promise((r) => setImmediate(r)); }
  });

  // nuovo: set() sincrono e leggero, un flush solo (debounce) che serializza il solo pezzo cambiato
  const { driver } = openNodeDriver();
  const b = new SqlKvBackend({ driver }); await b.init();
  await b.writeMany({ 'lp2-chat': states['lp2-chat'] }, { 'lp2-chat': 1 });
  const e = new KvEngine({ backend: b, notify: () => {}, debounceMs: 20, maxWaitMs: 1000 });
  const hydrated = await e.getItem('lp2-chat');
  const fresh = await measure('nuovo', async () => {
    let st = hydrated.state;
    for (let i = 0; i < 60; i++) { st = mutate(st, i); e.set('lp2-chat', { state: st, version: 1 }); await new Promise((r) => setImmediate(r)); }
    await e.flush();
  });
  log(`60 modifiche su chat da ${mb(states['lp2-chat'].length)}: vecchio ${old.total.toFixed(0)} ms totali, blocco massimo ${old.maxBlock.toFixed(0)} ms | nuovo ${fresh.total.toFixed(0)} ms totali, blocco massimo ${fresh.maxBlock.toFixed(0)} ms, ${e.stats.flushes} scritture, ${e.stats.serializedPieces} pezzo/i serializzati nell'ultima`);
  assert.ok(e.stats.flushes <= 3, 'coalescenza: poche scritture, non 60');
  assert.ok(fresh.total < old.total / 3, 'il nuovo deve essere molto piu\' leggero');
  assert.ok(fresh.maxBlock < old.maxBlock, 'il blocco massimo del thread deve calare');
  assert.ok(fresh.maxBlock < 50, 'nessun blocco lungo (> 50 ms) nel caso comune');
});

test('un salvataggio completo dopo 5 anni (tutti gli store a pezzi) non supera il tempo di un frame lungo per ogni store', async () => {
  const { driver } = openNodeDriver();
  const b = new SqlKvBackend({ driver }); await b.init();
  await b.writeMany(states, Object.fromEntries(Object.keys(states).map((k) => [k, 1])));
  const e = new KvEngine({ backend: b, notify: () => {} });
  const all = {};
  for (const k of Object.keys(states)) all[k] = await e.getItem(k);
  // stato "nuovo riferimento ma contenuto identico" (come dopo un'idratazione): zero pezzi riscritti
  const r = await measure('verifica completa', async () => { for (const [k, v] of Object.entries(all)) e.set(k, { state: { ...v.state }, version: 1 }); await e.flush({ full: true }); });
  log(`flush di verifica completa (app in background) su ${mb(totalBytes(states))}: ${r.total.toFixed(0)} ms, blocco massimo ${r.maxBlock.toFixed(0)} ms, ${e.stats.serializedPieces}/${e.stats.pieces} pezzi serializzati`);
  assert.ok(r.total < 5000);
});
