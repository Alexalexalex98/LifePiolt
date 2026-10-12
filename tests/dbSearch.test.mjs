import test from 'node:test';
import assert from 'node:assert/strict';
import { openNodeDriver } from './helpers/nodeSqlite.mjs';
import { FtsIndex, ftsAvailable } from '../src/lib/search/fts.ts';
import { MemoryIndex } from '../src/lib/search/memory.ts';
import { SearchEngine } from '../src/lib/search/engine.ts';
import { buildDocs, titleOfNote } from '../src/lib/search/docs.ts';
import { normalize, tokenize } from '../src/lib/search/normalize.ts';
import { parseHighlight, stripHighlight } from '../src/lib/search/types.ts';
import { makeSynthStates } from './helpers/synth.mjs';

const DOCS = [
  { type: 'note', id: 'n1', title: 'Città da visitare', text: 'Lista di posti: Perugia, Assisi e Spello. Prenotare il treno.' },
  { type: 'note', id: 'n2', title: 'Spesa', text: 'Latte, uova, caffè e pane. La città è lontana.' },
  { type: 'task', id: 't1', title: 'Prenotare il dentista', text: '' },
  { type: 'task', id: 't2', title: 'Chiamare Marco', text: 'per la cena' },
  { type: 'goal', id: 'g1', title: 'Correre una mezza maratona', text: '' },
  { type: 'file', id: 'f1', title: 'Contratto affitto 2026.pdf', text: 'Documenti' },
  { type: 'chat', id: 'dm:Anna@@m1', title: 'Anna', text: 'Ci vediamo domani alle 18 al caffè' },
  { type: 'bill', id: 'b1', title: 'Enel Energia', text: 'luce 2026-03-10' },
  { type: 'event', id: '2026-03-04#0', title: 'Riunione progetto', text: '2026-03-04 09:00' },
];

async function indexes() {
  const { driver } = openNodeDriver();
  assert.equal(await ftsAvailable(driver), true);
  const fts = new FtsIndex(driver); await fts.sync(DOCS);
  const mem = new MemoryIndex(); await mem.sync(DOCS);
  return { fts, mem };
}

test('normalize e tokenize: accenti, maiuscole, punteggiatura', () => {
  assert.equal(normalize('  CITTÀ   è  '), 'citta e');
  assert.deepEqual(tokenize('Città, "caffè" AND *'), ['citta', 'caffe', 'and']);
});

for (const kind of ['fts', 'mem']) {
  test(`ricerca ${kind}: senza accenti e maiuscole, prefisso, AND tra le parole`, async () => {
    const ix = (await indexes())[kind];
    const r1 = await ix.search('citta');
    assert.deepEqual(new Set(r1.map((h) => h.id)), new Set(['n1', 'n2']));
    assert.equal((await ix.search('CAFFE')).length, 2); // nota + chat
    assert.equal((await ix.search('mezza mar')).map((h) => h.id)[0], 'g1'); // prefisso
    assert.deepEqual((await ix.search('treno perugia')).map((h) => h.id), ['n1']); // AND
    assert.deepEqual(await ix.search('zzzzz'), []);
    assert.deepEqual(await ix.search('   '), []);
  });

  test(`ricerca ${kind}: filtro per tipo e limite`, async () => {
    const ix = (await indexes())[kind];
    assert.deepEqual((await ix.search('caffe', { types: ['chat'] })).map((h) => h.type), ['chat']);
    assert.equal((await ix.search('citta', { limit: 1 })).length, 1);
    assert.equal((await ix.search('citta', { types: ['task'] })).length, 0);
  });

  test(`ricerca ${kind}: evidenzia i termini e non rompe con caratteri speciali`, async () => {
    const ix = (await indexes())[kind];
    const [h] = await ix.search('perugia');
    const segs = parseHighlight(h.snippet);
    assert.ok(segs.some((s) => s.hit && /perugia/i.test(s.text)));
    assert.equal(stripHighlight(h.snippet).includes('\u0001'), false);
    for (const q of ['"', '*', 'AND OR NOT', 'a" OR "b', '(citta', 'citta)', 'NEAR(a b)', "'; DROP TABLE doc;--", '\\', 'col:citta', '^citta']) await ix.search(q); // non lancia
    const [t] = await ix.search('città');
    assert.ok(parseHighlight(t.title).some((s) => s.hit));
  });
}

test('FTS: BM25, il titolo pesa piu\' del testo', async () => {
  const { driver } = openNodeDriver();
  const ix = new FtsIndex(driver);
  await ix.sync([
    { type: 'note', id: 'a', title: 'Idee varie', text: 'molte cose, tra cui il progetto lancio e altre cose' },
    { type: 'note', id: 'b', title: 'Progetto lancio', text: 'piano' },
  ]);
  assert.equal((await ix.search('progetto'))[0].id, 'b');
  assert.ok((await ix.search('progetto'))[0].score <= (await ix.search('progetto'))[1].score);
});

test('FTS e memoria: sync incrementale (aggiunge, aggiorna, toglie)', async () => {
  const { driver } = openNodeDriver();
  for (const ix of [new FtsIndex(driver), new MemoryIndex()]) {
    assert.deepEqual(await ix.sync(DOCS), { added: DOCS.length, updated: 0, removed: 0 });
    assert.deepEqual(await ix.sync(DOCS), { added: 0, updated: 0, removed: 0 });
    const next = DOCS.filter((d) => d.id !== 't2').map((d) => (d.id === 'n2' ? { ...d, text: 'solo latte' } : d)).concat([{ type: 'note', id: 'n3', title: 'Nuova', text: 'zucchine' }]);
    assert.deepEqual(await ix.sync(next), { added: 1, updated: 1, removed: 1 });
    assert.equal((await ix.search('zucchine')).length, 1);
    assert.equal((await ix.search('marco')).length, 0);
    assert.equal((await ix.search('pane')).length, 0); // testo vecchio sparito
    assert.equal(ix.count(), DOCS.length);
    await ix.clear(); assert.equal(ix.count(), 0);
  }
});

test('SearchEngine: usa FTS5 se disponibile, altrimenti ripiega in memoria con la stessa API', async () => {
  let docs = DOCS;
  const e1 = new SearchEngine({ getDocs: () => docs, openMemoryDb: async () => openNodeDriver().driver });
  assert.equal((await e1.searchAll('citta')).length, 2);
  assert.equal(e1.kind, 'fts5');
  docs = DOCS.slice(0, 2); e1.markDirty();
  assert.equal((await e1.searchAll('dentista')).length, 0); // reindicizzazione dopo markDirty
  for (const open of [undefined, async () => null, async () => { throw new Error('no sqlite'); }]) {
    const e2 = new SearchEngine({ getDocs: () => DOCS, openMemoryDb: open });
    assert.equal((await e2.searchAll('citta')).length, 2);
    assert.equal(e2.kind, 'memory');
  }
});

test('buildDocs: estrae note, task, obiettivi, file, impegni, chat, idee, post, bollette', () => {
  const docs = buildDocs({
    life: { notes: [{ id: 'n', text: 'Comprare il pane. Poi altro.', ts: 5 }], tasks: [{ id: 't', t: 'Chiamare', subtasks: [{ t: 'Trovare numero' }] }], goals: [{ id: 'g', t: 'Obiettivo' }], drive: [{ id: 'f', n: 'a.pdf', folder: 'Casa' }], events: { '2026-01-02': [{ time: '10:00', title: 'Visita' }] } },
    network: { ideas: [{ id: 1, title: 'Idea', desc: 'Descrizione' }], posts: [{ id: 2, author: 'Luca', text: 'Ciao a tutti' }] },
    chat: { chats: { 'dm:Anna': { name: 'Anna' } }, messages: { 'dm:Anna': [{ id: 'm1', text: 'Ciao', kind: 'text', ts: 1 }, { id: 'm2', text: 'sys', kind: 'system' }, { id: 'm3', text: 'x', deletedForAll: true }, { id: 'm4', kind: 'image' }] } },
    finance: { invoices: [{ id: 'i1', issuer: 'Enel', kind: 'luce', number: '123', iban: 'CH00SEGRETO' }] },
  });
  const by = (t) => docs.filter((d) => d.type === t);
  assert.equal(by('note')[0].title, 'Comprare il pane');
  assert.equal(by('task')[0].text, 'Trovare numero');
  assert.equal(by('event')[0].id, '2026-01-02#0');
  assert.equal(by('chat').length, 2); // chat + un solo messaggio indicizzabile
  assert.equal(by('bill')[0].title, 'Enel');
  assert.ok(!docs.some((d) => d.text.includes('SEGRETO'))); // IBAN non indicizzato
  assert.equal(titleOfNote(''), 'Nota senza titolo');
  assert.deepEqual(buildDocs({}), []);
  assert.deepEqual(buildDocs({ life: { notes: 'rotto', tasks: [null, 5] } }), []); // stati sporchi non rompono
});

test('ricerca su 5 anni di dati sintetici: indicizzazione e interrogazione misurate', async () => {
  const states = makeSynthStates({ years: 5 });
  const parse = (k) => JSON.parse(states[k]).state;
  const docs = buildDocs({ life: parse('lp2-life'), network: parse('lp2-network'), chat: parse('lp2-chat'), finance: parse('lp2-finance') });
  const { driver } = openNodeDriver();
  const fts = new FtsIndex(driver);
  let t0 = performance.now(); await fts.sync(docs); const tIndex = performance.now() - t0;
  t0 = performance.now(); const hits = await fts.search('palestra viaggio'); const tQ = performance.now() - t0;
  t0 = performance.now(); const r = await fts.sync(docs); const tNoop = performance.now() - t0;
  t0 = performance.now(); await fts.sync(docs.slice(0, docs.length - 50)); const tInc = performance.now() - t0;
  const mem = new MemoryIndex(); t0 = performance.now(); await mem.sync(docs); const tMemIndex = performance.now() - t0;
  t0 = performance.now(); await mem.search('palestra viaggio'); const tMemQ = performance.now() - t0;
  console.log(`# ricerca: ${docs.length} documenti | FTS5 indicizza ${tIndex.toFixed(0)} ms, query ${tQ.toFixed(1)} ms (${hits.length} risultati), resync senza modifiche ${tNoop.toFixed(0)} ms, -50 doc ${tInc.toFixed(0)} ms | memoria indicizza ${tMemIndex.toFixed(0)} ms, query ${tMemQ.toFixed(1)} ms`);
  assert.ok(docs.length > 40_000);
  assert.deepEqual(r, { added: 0, updated: 0, removed: 0 });
  assert.ok(tQ < 200, 'query FTS5 sotto 200 ms');
});
