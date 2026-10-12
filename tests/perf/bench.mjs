// Benchmark ripetibili (Node) su dati sintetici grandi (5 anni di vita). Falliscono solo se un tempo MEDIANO supera il budget
// (budget molto larghi: servono a intercettare regressioni di ordine di grandezza, non micro-variazioni).
//   npm run bench                       # esegue tutto, scrive tests/perf/report.json (non committato)
//   BENCH_FACTOR=3 npm run bench        # moltiplica i budget (macchine lente / CI)
//   BENCH_RUNS=7 npm run bench          # ripetizioni per ogni misura (default 5; mediana)
//   BENCH_ONLY=search npm run bench     # solo i benchmark il cui nome contiene la stringa
// Moduli non ancora presenti (src/lib/habits, ...) vengono saltati con un avviso.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openNodeDriver } from '../helpers/nodeSqlite.mjs';
import { makeSynthStates, totalBytes } from '../helpers/synth.mjs';
import { SqlKvBackend } from '../../src/db/sqlKv.ts';
import { KvEngine } from '../../src/db/engine.ts';
import { validateBackup, buildBackup, serializeBackup } from '../../src/lib/backupCore.ts';
import { MemoryIndex } from '../../src/lib/search/memory.ts';
import { FtsIndex } from '../../src/lib/search/fts.ts';
import { buildDocs } from '../../src/lib/search/docs.ts';
import { analyze, makeForecast, correlations, addDays } from '../../src/lib/analytics.ts';
import { planMonth } from '../../src/lib/planner.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const FACTOR = Number(process.env.BENCH_FACTOR || 1);
const RUNS = Math.max(1, Number(process.env.BENCH_RUNS || 5));
const ONLY = process.env.BENCH_ONLY || '';

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const results = [];
const skipped = [];

/** Esegue `fn` RUNS volte (dopo un riscaldamento) e registra la mediana. `setup` non e' cronometrata. */
async function bench(name, budgetMs, fn, { setup, warmup = 1, note } = {}) {
  if (ONLY && !name.includes(ONLY)) return;
  const times = [];
  for (let i = 0; i < warmup + RUNS; i++) {
    const ctx = setup ? await setup() : undefined;
    const t0 = performance.now();
    await fn(ctx);
    const dt = performance.now() - t0;
    if (i >= warmup) times.push(dt);
  }
  const med = median(times);
  const budget = budgetMs * FACTOR;
  const ok = med <= budget;
  results.push({ name, medianMs: Math.round(med * 100) / 100, minMs: Math.round(Math.min(...times) * 100) / 100, maxMs: Math.round(Math.max(...times) * 100) / 100, budgetMs: budget, ok, runs: RUNS, note });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(44)} mediana ${med.toFixed(1).padStart(8)} ms  (budget ${budget} ms)${note ? '  # ' + note : ''}`);
}
function skip(name, why) { skipped.push({ name, why }); console.log(`SKIP ${name}: ${why}`); }

// ---- dati sintetici (una sola volta) ----
const t0 = performance.now();
const states = makeSynthStates({ years: 5 });
const parsed = Object.fromEntries(Object.entries(states).map(([k, v]) => [k.replace('lp2-', ''), JSON.parse(v).state]));
console.log(`dati sintetici: ${(totalBytes(states) / 1e6).toFixed(1)} MB in ${(performance.now() - t0).toFixed(0)} ms | tasks ${parsed.life.tasks.length}, messaggi ${Object.values(parsed.chat.messages).reduce((a, l) => a + l.length, 0)}, note ${parsed.life.notes.length}`);

// ---- avvio / idratazione ----
const mkBackend = () => { const { driver } = openNodeDriver(); return new SqlKvBackend({ driver, bakIntervalMs: 0 }); };
let seeded = null;
async function seededBackend() {
  const b = mkBackend(); await b.init();
  await b.writeMany(states, Object.fromEntries(Object.keys(states).map((k) => [k, 1])));
  return b;
}
await bench('avvio: idratazione di tutti gli store (SQLite)', 4000, async (b) => {
  const e = new KvEngine({ backend: b, notify: () => {} });
  const got = await Promise.all(Object.keys(states).map((k) => e.getItem(k)));
  if (got.some((g) => !g)) throw new Error('store mancante');
}, { setup: async () => (seeded ??= await seededBackend()), note: '5 anni di dati' });
await bench('avvio: scrittura completa iniziale (SQLite)', 8000, async (b) => {
  await b.writeMany(states, Object.fromEntries(Object.keys(states).map((k) => [k, 1])));
}, { setup: async () => { const b = mkBackend(); await b.init(); return b; } });
await bench('avvio: JSON.parse di tutti gli store', 1500, () => { for (const v of Object.values(states)) JSON.parse(v); });

// ---- backup ----
const backupText = serializeBackup(buildBackup(states, '1.0.0'));
await bench('backup: serializza 5 anni di dati', 2500, () => serializeBackup(buildBackup(states, '1.0.0')));
await bench('backup: validateBackup (riparazione + anteprima)', 3000, () => { const r = validateBackup(backupText); if (!r.ok) throw new Error(r.error); }, { note: `${(backupText.length / 1e6).toFixed(1)} MB` });

// ---- ricerca ----
const docs = buildDocs({ life: parsed.life, network: parsed.network, chat: parsed.chat, finance: parsed.finance });
const QUERIES = ['dentista', 'riunione progetto', 'bolletta luce', 'viaggio treno', 'palestra', 'contratto', 'cena amici', 'weekend montagna'];
await bench('ricerca: costruzione documenti', 1500, () => buildDocs({ life: parsed.life, network: parsed.network, chat: parsed.chat, finance: parsed.finance }), { note: `${docs.length} documenti` });
await bench('ricerca: indicizzazione in memoria', 6000, async () => { await new MemoryIndex().sync(docs); });
let memIdx = null;
await bench('ricerca: 8 query (indice in memoria)', 5000, async (idx) => { for (const q of QUERIES) await idx.search(q, { limit: 20 }); }, { setup: async () => { if (!memIdx) { memIdx = new MemoryIndex(); await memIdx.sync(docs); } return memIdx; } });
let ftsIdx = null;
await bench('ricerca: indicizzazione FTS5', 15000, async () => { const { driver } = openNodeDriver(); await new FtsIndex(driver).sync(docs); });
await bench('ricerca: 8 query (FTS5)', 1500, async (idx) => { for (const q of QUERIES) await idx.search(q, { limit: 20 }); }, {
  setup: async () => { if (!ftsIdx) { const { driver } = openNodeDriver(); ftsIdx = new FtsIndex(driver); await ftsIdx.sync(docs); } return ftsIdx; },
});

// ---- analisi (analytics / forecast) ----
const day = (i) => addDays('2021-01-01', i);
const def = (id, better = 'up') => ({ id, label: id, unit: '', domain: 'salute', better, dec: 0, color: '#000', period: 'day', target: 8000 });
const series = ['steps', 'sleep', 'hr', 'hrv', 'weight', 'kcal'].map((m) => ({ def: def(m), source: 'test', pts: parsed.health.series[m].map((v, i) => ({ d: day(i), v })) }));
const TODAY = day(5 * 365 - 1);
await bench('analisi: analyze() su 6 serie x 5 anni', 1500, () => { for (const s of series) analyze(s, TODAY); });
await bench('analisi: makeForecast 30 giorni x 6 serie', 300, () => { for (const s of series) makeForecast(s.def, s.pts, 30); });
await bench('analisi: correlations() su 6 serie', 2500, () => { correlations(series); });

// ---- planner ----
const NOW = new Date(2026, 9, 7, 10, 0);
const events = {};
for (let i = 0; i < 30; i++) { const d = new Date(2026, 9, 7 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; events[k] = Array.from({ length: 4 }, (_, j) => ({ time: `${String(9 + j * 2).padStart(2, '0')}:00`, title: 'Impegno', dur: 45 })); }
const ranked = Array.from({ length: 300 }, (_, i) => ({ task: { id: 't' + i, t: 'Attivita ' + i }, score: 300 - i, reasons: [] }));
await bench('planner: planMonth con 300 task e 120 impegni', 1500, () => { planMonth({ now: NOW, workStart: '09:00', workEnd: '18:00', events, ranked }); });

// ---- sincronizzazione (se src/sync esiste) ----
if (existsSync(join(root, 'src/sync/diff.ts')) && existsSync(join(root, 'src/sync/adapters.ts'))) {
  const { newSnapshot, scanCollection } = await import('../../src/sync/diff.ts');
  const { listAdapter } = await import('../../src/sync/adapters.ts');
  const adapter = listAdapter({ get: (s) => s.tasks, set: (tasks) => ({ tasks }), idOf: (e) => e.id, toWire: (e) => { const { id, ...r } = e; return r; }, fromWire: (id, w) => ({ ...w, id }) });
  let n = 0; const opts = () => ({ newId: () => 'n' + ++n });
  const tasks = parsed.life.tasks;
  await bench(`sync: scansione iniziale di ${tasks.length} task`, 6000, () => { scanCollection(adapter, { tasks }, newSnapshot(), opts()); });
  const primed = newSnapshot(); scanCollection(adapter, { tasks }, primed, opts());
  await bench('sync: riscansione senza modifiche', 3000, () => { const r = scanCollection(adapter, { tasks }, primed, opts()); if (r.added.length || r.updated.length || r.removed.length) throw new Error('diff non vuoto'); });
  const changed = tasks.map((t, i) => (i % 100 === 0 ? { ...t, done: !t.done } : t));
  await bench('sync: riscansione con 1% di modifiche', 4000, () => {
    const snap = newSnapshot(); scanCollection(adapter, { tasks }, snap, opts());
    const r = scanCollection(adapter, { tasks: changed }, snap, opts());
    if (r.updated.length !== Math.ceil(tasks.length / 100)) throw new Error('attesi ' + Math.ceil(tasks.length / 100) + ' aggiornamenti, trovati ' + r.updated.length);
  });
} else skip('sync: diff', 'src/sync non presente');

// ---- abitudini (se esiste) ----
if (existsSync(join(root, 'src/lib/habits'))) skip('habits', 'modulo presente ma nessun benchmark definito: aggiungine uno qui');
else skip('habits', 'src/lib/habits non ancora presente');

// ---- report ----
const failed = results.filter((r) => !r.ok);
const report = { generatedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`, factor: FACTOR, runs: RUNS, results, skipped, failed: failed.length };
writeFileSync(join(here, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${results.length} benchmark, ${failed.length} fuori budget, ${skipped.length} saltati. Report: tests/perf/report.json`);
if (failed.length) { console.error('Fuori budget: ' + failed.map((f) => f.name).join('; ')); process.exit(1); }
