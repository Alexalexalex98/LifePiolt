#!/usr/bin/env node
// Traduzione automatica dei cataloghi src/i18n/locales/<lang>.json a partire da src/i18n/source.json (testi italiani).
// Uso: node scripts/translate-i18n.mjs [--lang=xx,yy] [--provider=auto|anthropic|deepl|google|libretranslate|mock|none[,fallback]]
//        [--dry-run] [--yes] [--max=N] [--prune] [--retranslate=regex] [--check] [--extract] [--strict] [--sort]
//        [--model=ID] [--batch=N] [--concurrency=N] [--max-cost=USD] [--report=file]
//        [--source=file] [--locales-dir=dir] [--overrides-dir=dir] [--glossary=file]
// Vedi docs/i18n.md.
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LANGS, readJson, saveCatalog, sortLikeSource, planLang, writeAtomic } from './i18n/catalog.mjs';
import { loadEnvFiles } from './i18n/env.mjs';
import { loadGlossary } from './i18n/glossary.mjs';
import { structuralErrors } from './i18n/qc.mjs';
import { translateKeys } from './i18n/runner.mjs';
import { estimateCost } from './i18n/cost.mjs';
import { buildChain, providerFor, NO_KEY_MESSAGE } from './i18n/providers/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const rel = (p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));

loadEnvFiles(ROOT);

const sourceFile = rel(opt('source') ?? path.join(ROOT, 'src/i18n/source.json'));
const localesDir = rel(opt('locales-dir') ?? path.join(ROOT, 'src/i18n/locales'));
const overridesDir = rel(opt('overrides-dir') ?? path.join(ROOT, 'src/i18n/overrides'));
const glossaryFile = rel(opt('glossary') ?? path.join(ROOT, 'i18n/glossary.json'));
const reportFile = rel(opt('report') ?? path.join(ROOT, '.i18n-cache/report.json'));
const dry = flag('dry-run');
const check = flag('check');
const strict = flag('strict');
const maxPer = opt('max') ? Number(opt('max')) : Infinity;
const retranslate = opt('retranslate') ? (['*', 'all'].includes(opt('retranslate')) ? /./ : new RegExp(opt('retranslate'), 'i')) : null;
const only = opt('lang')?.split(',').map((s) => s.trim()).filter(Boolean);
const langs = (only ?? LANGS).filter((l) => l !== 'it');
const bad = langs.filter((l) => !LANGS.includes(l));
if (bad.length) { console.error(`Lingua non valida: ${bad.join(', ')} (valide: ${LANGS.join(', ')})`); process.exit(2); }

if (flag('extract')) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/extract-i18n.mjs')], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}

const source = readJson(sourceFile);
const glossary = loadGlossary(glossaryFile);
const pricing = readJson(path.join(ROOT, 'scripts/i18n/pricing.json'));
const catFile = (l) => path.join(localesDir, `${l}.json`);

// 1) piano per lingua
const state = {};
for (const lang of langs) {
  const catalog = readJson(catFile(lang), {});
  const overrides = readJson(path.join(overridesDir, `${lang}.json`), {});
  const plan = planLang({ source, catalog, overrides, retranslate, invalidFn: (k, v) => structuralErrors(k, v) !== null });
  const todo = [...plan.missing, ...plan.invalid, ...plan.redo].slice(0, maxPer);
  state[lang] = { catalog, overrides, plan, todo };
}

const line = (s = '') => console.log(s);
const shown = (f) => { const r = path.relative(process.cwd(), f); return r.startsWith('..') ? f : r; };
const total = (f) => langs.reduce((a, l) => a + f(state[l]), 0);

// 2) --check (CI): nessuna rete, exit 1 se mancano traduzioni o ci sono valori non validi
if (check) {
  let fail = false;
  for (const lang of langs) {
    const { plan, overrides } = state[lang];
    const ov = Object.keys(overrides).length;
    const pct = source.length ? (((source.length - plan.missing.length) / source.length) * 100).toFixed(1) : '100';
    line(`[${lang}] copertura ${pct}% | mancanti ${plan.missing.length} | non validi ${plan.invalid.length} | orfane ${plan.orphans.length}${ov ? ` | override ${ov}` : ''}`);
    for (const k of plan.missing.slice(0, 15)) line(`   mancante: ${k}`);
    if (plan.missing.length > 15) line(`   ... e altre ${plan.missing.length - 15}`);
    for (const k of plan.invalid.slice(0, 15)) line(`   non valido: ${k}`);
    if (plan.missing.length || plan.invalid.length || (strict && plan.orphans.length)) fail = true;
  }
  if (fail) line('\nTraduzioni da completare: esegui "npm run i18n:translate" (vedi docs/i18n.md).');
  else line('\ni18n OK: tutte le chiavi sono tradotte.');
  process.exit(fail ? 1 : 0);
}

// 3) riepilogo
line(`Sorgente: ${source.length} chiavi | lingue: ${langs.join(', ')}${dry ? ' | DRY RUN' : ''}`);
for (const lang of langs) {
  const { plan, todo, overrides } = state[lang];
  line(`[${lang}] mancanti ${plan.missing.length} | non validi ${plan.invalid.length} | da rifare ${plan.redo.length} | orfane ${plan.orphans.length}${flag('prune') ? ' (da rimuovere)' : ''}${Object.keys(overrides).length ? ` | override ${Object.keys(overrides).length}` : ''} => da tradurre ${todo.length}`);
}
const anyWork = total((s) => s.todo.length) > 0;
const anyPrune = flag('prune') && total((s) => s.plan.orphans.length) > 0;
if (!anyWork && !anyPrune) { line('\nNiente da fare.'); process.exit(0); }

// 4) provider (catena con fallback per lingua)
let chain = [];
const spec = opt('provider') ?? 'auto';
if (anyWork) {
  try { chain = buildChain(spec, { model: opt('model') }); } catch (e) { console.error('\n' + e.message); process.exit(2); }
  if (!chain.length) {
    if (dry) line('\n(nessun provider con chiave: stima non disponibile)\n' + NO_KEY_MESSAGE);
    else { console.error('\n' + NO_KEY_MESSAGE); process.exit(2); }
  }
}
if (chain.some((p) => p.reportOnly)) { line('\nProvider "none": solo report, nessuna traduzione eseguita.'); process.exit(0); }

const assign = {}; // lang -> provider
const unsupported = [];
for (const lang of langs) {
  if (!state[lang].todo.length) continue;
  const p = providerFor(chain, lang);
  if (p) assign[lang] = p; else unsupported.push(lang);
}
if (unsupported.length) {
  line(`\nAttenzione: nessun provider configurato copre ${unsupported.join(', ')} (es. DeepL non ha l'hindi). Aggiungi un fallback: --provider=deepl,anthropic. Lingue saltate.`);
}

// 5) stima costo
let totalUsd = 0;
const byProvider = {};
for (const [lang, p] of Object.entries(assign)) {
  const todo = state[lang].todo;
  (byProvider[p.name] ??= { p, perLang: {} }).perLang[lang] = { items: todo.length, chars: todo.reduce((a, k) => a + k.length, 0) };
}
if (Object.keys(byProvider).length) {
  line('\nStima costo (indicativa, DA VERIFICARE sui listini ufficiali; vedi scripts/i18n/pricing.json):');
  for (const { p, perLang } of Object.values(byProvider)) {
    const est = estimateCost({ pricing, providerName: p.name, model: p.model, perLang, batchSize: opt('batch') ? Number(opt('batch')) : p.batchSize, priceOverride: opt('price-per-mchar') ? Number(opt('price-per-mchar')) : null });
    totalUsd += est.usd;
    line(`  ${p.name}: ${est.totalItems} voci, ${est.totalChars} caratteri sorgente, ${Object.keys(perLang).length} lingue => ~${est.usd.toFixed(2)} USD  [${est.detail}]`);
  }
}
if (opt('max-cost') && totalUsd > Number(opt('max-cost'))) { console.error(`\nStima ${totalUsd.toFixed(2)} USD sopra --max-cost=${opt('max-cost')}: interrotto.`); process.exit(2); }

if (dry) {
  for (const lang of langs) {
    const { todo, plan } = state[lang];
    if (todo.length) { line(`\n[${lang}] prime voci da tradurre (${assign[lang]?.name ?? 'nessun provider'}):`); todo.slice(0, 3).forEach((k) => line('   ' + k)); }
    if (flag('prune') && plan.orphans.length) { line(`[${lang}] orfane da rimuovere:`); plan.orphans.slice(0, 3).forEach((k) => line('   ' + k)); }
  }
  line('\nDry run: nessun file modificato, nessuna chiamata di rete.');
  process.exit(0);
}

const isMockOnly = Object.values(assign).every((p) => p.name === 'mock');
if (anyWork && !flag('yes') && !isMockOnly) {
  if (!process.stdin.isTTY) { console.error('\nConferma necessaria: ripeti con --yes (esecuzione non interattiva).'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question(`\nProcedere con la traduzione (~${totalUsd.toFixed(2)} USD stimati)? [s/N] `, r));
  rl.close();
  if (!/^(s|si|sì|y|yes)$/i.test(ans.trim())) { line('Annullato.'); process.exit(0); }
}

// 6) esecuzione, per lingua, con salvataggio incrementale (riprendibile: le chiavi gia' scritte non sono piu' mancanti)
let aborted = false;
process.on('SIGINT', () => { if (aborted) process.exit(130); aborted = true; console.error('\nInterruzione richiesta: salvo i progressi...'); });

const report = { startedAt: new Date().toISOString(), provider: spec, langs: {}, estimateUsd: Number(totalUsd.toFixed(4)) };
let exitCode = 0;
const enCatalog = state.en ? state.en.catalog : readJson(catFile('en'), {});
const enProvider = providerFor(chain, 'en');

for (const lang of langs) {
  const st = state[lang];
  const r = { translated: 0, copied: 0, failed: {}, warnings: {}, pruned: 0, skipped: 0 };
  report.langs[lang] = r;
  const protectedKeys = new Set(Object.keys(st.overrides));
  const merge = (done) => { for (const k of st.todo) if (done.has(k) && !protectedKeys.has(k)) st.catalog[k] = done.get(k); };
  let lastSave = Date.now();
  const save = (finalPass) => {
    let cat = st.catalog;
    if (finalPass && flag('prune')) { cat = Object.fromEntries(Object.entries(cat).filter(([k]) => !st.plan.orphans.includes(k))); r.pruned = Object.keys(st.catalog).length - Object.keys(cat).length; st.catalog = cat; }
    if (finalPass && flag('sort')) cat = sortLikeSource(cat, source);
    saveCatalog(catFile(lang), cat);
  };
  if (st.todo.length && assign[lang]) {
    const p = assign[lang];
    process.stdout.write(`[${lang}] ${p.name}${p.model ? ' ' + p.model : ''}: ${st.todo.length} voci...`);
    let res;
    try {
      res = await translateKeys({
        keys: st.todo, lang, provider: p, glossary, enCatalog, enProvider,
        batchSize: opt('batch') ? Number(opt('batch')) : null, concurrency: opt('concurrency') ? Number(opt('concurrency')) : null,
        context: 'Mobile app LifePilot: personal planner (calendar, tasks), health, finance, chat, social network, job board, AI assistant "Theia".',
        strict, shouldAbort: () => aborted,
        onBatch: async (done) => { merge(done); if (Date.now() - lastSave > 5000) { saveCatalog(catFile(lang), st.catalog); lastSave = Date.now(); } },
        log: (m) => console.error(m),
      });
    } catch (e) {
      merge(new Map()); save(false);
      console.error(`\n[${lang}] errore fatale del provider: ${e.message}\nProgressi salvati; correggi e riesegui (riprende da dove si era fermato).`);
      report.fatal = e.message; exitCode = 1; break;
    }
    merge(res.done);
    r.translated = res.done.size - res.copied.size;
    r.copied = res.copied.size;
    r.skipped = res.skipped;
    for (const [k, v] of res.failed) r.failed[k] = v;
    for (const [k, v] of res.warned) r.warnings[k] = v;
    line(` ok ${res.done.size}, fallite ${res.failed.size}, avvisi ${res.warned.size}${res.skipped ? `, saltate ${res.skipped}` : ''}`);
    if (res.failed.size) exitCode = 1;
  } else if (st.todo.length) { r.skipped = st.todo.length; exitCode = 1; }
  if (st.todo.length || (flag('prune') && st.plan.orphans.length) || flag('sort')) save(true);
  if (aborted) { line('Interrotto: progressi salvati.'); exitCode = 130; break; }
}
if (unsupported.length) exitCode = exitCode || 1;

writeAtomic(reportFile, JSON.stringify(report, null, 1) + '\n');
line('\n=== Report ===');
for (const [lang, r] of Object.entries(report.langs)) {
  const f = Object.keys(r.failed);
  line(`[${lang}] tradotte ${r.translated} | copiate ${r.copied} | fallite ${f.length} | avvisi ${Object.keys(r.warnings).length} | orfane rimosse ${r.pruned}${r.skipped ? ` | saltate ${r.skipped}` : ''}`);
  f.slice(0, 10).forEach((k) => line(`   FALLITA: ${k}  =>  ${r.failed[k]}`));
  if (f.length > 10) line(`   ... altre ${f.length - 10} (vedi ${shown(reportFile)})`);
  Object.entries(r.warnings).slice(0, 5).forEach(([k, w]) => line(`   avviso: ${k}  =>  ${w.join('; ')}`));
}
line(`Report completo: ${shown(reportFile)}`);
line('Nota: le traduzioni automatiche non sono riviste da madrelingua. Correzioni puntuali: src/i18n/overrides/<lang>.json (mai sovrascritto).');
process.exit(exitCode);
