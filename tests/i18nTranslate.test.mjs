import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STYLES, mask, unmask, buildTermRe, findCommands, isUntranslatable, nothingToTranslate } from '../scripts/i18n/mask.mjs';
import { checkTranslation } from '../scripts/i18n/qc.mjs';
import { loadGlossary, termsFor, glossaryViolations } from '../scripts/i18n/glossary.mjs';
import { serialize, planLang, sortLikeSource } from '../scripts/i18n/catalog.mjs';
import { translateKeys } from '../scripts/i18n/runner.mjs';
import { buildChain, providerFor, REGISTRY } from '../scripts/i18n/providers/index.mjs';
import { create as createAnthropic, parseJsonObject, buildSystemPrompt } from '../scripts/i18n/providers/anthropic.mjs';
import { create as createMock } from '../scripts/i18n/providers/mock.mjs';
import { estimateCost } from '../scripts/i18n/cost.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const glossary = loadGlossary(path.join(ROOT, 'i18n/glossary.json'));
const pricing = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/i18n/pricing.json'), 'utf8'));
const termSource = buildTermRe(glossary.protected);

// provider finto configurabile
const fake = (fn, extra = {}) => ({ name: 'fake', maskStyle: 'brackets', batchSize: 3, concurrency: 2, supports: () => true, isAvailable: () => true, translateBatch: async (a) => fn(a), ...extra });
const echo = (prefix = '') => ({ texts, to }) => texts.map((t) => `${prefix}${to}:${t}`);

test('mask/unmask: segnaposto, marchi, numeri e URL tornano identici (tutti gli stili)', () => {
  const src = 'Hai {0} impegni su LifePilot: apri https://lifepilot.app/x entro le 18:30 (Apple Health)';
  for (const style of Object.values(STYLES)) {
    const { masked, tokens } = mask(src, { termSource, style });
    assert.ok(!masked.includes('{0}') && !masked.includes('LifePilot') && !masked.includes('18:30'));
    const back = unmask(masked, tokens, style);
    assert.equal(back.ok, true);
    assert.equal(back.text, src);
  }
});

test('mask: i token possono cambiare ordine, non mancare o duplicarsi', () => {
  const { masked, tokens } = mask('{0} e {1}', { termSource });
  assert.equal(unmask('⟦1⟧ y ⟦0⟧', tokens).text, '{1} y {0}');
  assert.equal(unmask('⟦0⟧ y', tokens).ok, false); // manca
  assert.equal(unmask('⟦0⟧ ⟦0⟧ ⟦1⟧', tokens).ok, false); // duplicato
  assert.equal(unmask('⟦0⟧ ⟦9⟧ ⟦1⟧', tokens).ok, false); // sconosciuto
  assert.equal(unmask('⟦ 0 ⟧ ⟦1⟧', tokens).ok, true); // spazi tollerati
  assert.ok(masked.length > 0);
});

test('mask xml/html: entita\' decodificate dopo il motore', () => {
  const { masked, tokens } = mask('Tom & Jerry {0}', { termSource, style: STYLES.xml });
  assert.ok(masked.includes('&amp;'));
  assert.equal(unmask(masked.replace('Tom', 'Tim'), tokens, STYLES.xml).text, 'Tim & Jerry {0}');
});

test('comandi per l\'assistente: riconosciuti solo nel contesto di esempio', () => {
  assert.deepEqual(findCommands('Dimmi quale task: "rinomina task report in Report"'), ['"rinomina task report in Report"']);
  assert.deepEqual(findCommands('"sposta", "elimina": capisce tutto'), ['"sposta"', '"elimina"']);
  assert.deepEqual(findCommands('Stato "disponibile"'), []);
  assert.deepEqual(findCommands('Basato sul tuo profilo "{0}"'), []);
  const cm = new Map([['"aggiungi dentista"', '"add dentist"']]);
  const { masked, tokens } = mask('Scrivi "aggiungi dentista" ora', { termSource, commandMap: cm });
  assert.ok(!masked.includes('aggiungi'));
  assert.equal(unmask(masked, tokens).text, 'Scrivi "add dentist" ora');
});

test('isUntranslatable: regex e identificatori si copiano', () => {
  assert.ok(isUntranslatable('(?:numero fattura|invoice)\\s*'));
  assert.ok(isUntranslatable('privacy:AI Memory'));
  assert.ok(!isUntranslatable('Salva le modifiche'));
  const { masked } = mask('{0}', { termSource });
  assert.ok(nothingToTranslate(masked));
});

test('qc: segnaposto, vuoto, emoji, script, comandi, glossario, lunghezza', () => {
  const ok = checkTranslation({ src: 'Hai {0} impegni', out: 'You have {0} appointments', lang: 'en', glossary });
  assert.deepEqual(ok.errors, []);
  assert.ok(checkTranslation({ src: 'Hai {0} impegni', out: 'You have appointments', lang: 'en' }).errors[0].includes('segnaposto'));
  assert.ok(checkTranslation({ src: 'Ciao', out: '  ', lang: 'en' }).errors.includes('valore vuoto'));
  assert.ok(checkTranslation({ src: 'Ciao amico', out: 'Hello \u{1F600}', lang: 'en' }).errors.some((e) => e.includes('emoji')));
  assert.ok(checkTranslation({ src: 'Salva le modifiche', out: 'Save changes', lang: 'ja' }).errors.some((e) => e.includes('script')));
  assert.deepEqual(checkTranslation({ src: 'Salva le modifiche', out: '変更を保存', lang: 'ja' }).errors, []);
  assert.ok(checkTranslation({ src: 'Salva le modifiche', out: 'Сохранить', lang: 'de' }).errors.some((e) => e.includes('script')));
  // protetti: un nome di prodotto in latino non e' una mescolanza
  assert.deepEqual(checkTranslation({ src: 'Apri LifePilot ora', out: 'Сейчас откройте LifePilot', lang: 'ru', protectedTerms: glossary.protected }).warnings, []);
  // comandi inglesi
  const src = 'Dimmi per esempio "aggiungi dentista giovedi"';
  assert.ok(checkTranslation({ src, out: 'Dis par exemple « ajoute dentiste jeudi »', lang: 'fr' }).errors.length === 0); // ASCII ma non verificabile: ok
  assert.ok(checkTranslation({ src, out: 'Dis par exemple « ajoute déjeuner »', lang: 'fr' }).errors.some((e) => e.includes('comandi')));
  assert.deepEqual(checkTranslation({ src, out: 'Dis par exemple « add dentist Thursday »', lang: 'fr' }).errors, []);
  // glossario: avviso, non errore
  const g = checkTranslation({ src: 'Nuovo impegno', out: 'Neue Sache', lang: 'de', glossary });
  assert.deepEqual(g.errors, []);
  assert.ok(g.warnings.some((w) => w.startsWith('glossario')));
  assert.ok(checkTranslation({ src: 'Salva tutto il documento adesso', out: 'x'.repeat(200), lang: 'en' }).warnings.some((w) => w.includes('lunghezza')));
});

test('glossario: termini pertinenti e violazioni', () => {
  const terms = termsFor(glossary, 'de', ['Nuovo impegno', 'Altro']);
  assert.ok(terms.some((t) => t.it === 'Impegno' && t.to === 'Termin'));
  assert.ok(!terms.some((t) => t.it === 'Bolletta'));
  assert.deepEqual(glossaryViolations(glossary, 'de', 'Nuovo impegno', 'Neuer Termin'), []);
  assert.equal(glossaryViolations(glossary, 'de', 'Nuovo impegno', 'Neue Sache').length, 1);
});

test('catalog: serialize riproduce byte per byte i file esistenti', () => {
  for (const lang of ['en', 'ja']) {
    const f = path.join(ROOT, `src/i18n/locales/${lang}.json`);
    const text = fs.readFileSync(f, 'utf8');
    assert.equal(serialize(JSON.parse(text)), text.replace(/\n$/, ''));
  }
});

test('catalog: planLang distingue mancanti, orfane, non valide, override, da rifare', () => {
  const source = ['A', 'B {0}', 'C', 'D', 'E'];
  const catalog = { A: 'a', 'B {0}': 'b', C: '', Z: 'orfana', E: 'e' };
  const p = planLang({ source, catalog, overrides: { D: 'd!' }, retranslate: /^E$/, invalidFn: (k, v) => !v || (k.includes('{0}') && !v.includes('{0}')) });
  assert.deepEqual(p.missing, []);
  assert.deepEqual(p.invalid, ['B {0}', 'C']);
  assert.deepEqual(p.orphans, ['Z']);
  assert.deepEqual(p.redo, ['E']);
  assert.deepEqual(Object.keys(sortLikeSource({ C: 1, A: 2, Z: 3 }, ['A', 'B', 'C'])), ['A', 'C', 'Z']);
});

test('runner: traduce, ripristina i token e invia il glossario pertinente', async () => {
  const seen = [];
  const provider = fake(({ texts, to, glossary: g }) => { seen.push(g); return texts.map((t) => t.replace('Salva', 'Speichern')); });
  const keys = ['Salva {0} modifiche', 'Nuovo impegno su LifePilot', 'Wi-Fi'];
  const r = await translateKeys({ keys, lang: 'de', provider, glossary });
  assert.equal(r.done.get('Salva {0} modifiche'), 'Speichern {0} modifiche');
  assert.equal(r.done.get('Nuovo impegno su LifePilot'), 'Nuovo impegno su LifePilot');
  assert.equal(r.failed.size, 0);
  assert.ok(r.warned.has('Nuovo impegno su LifePilot')); // glossario: Impegno -> Termin non rispettato -> avviso
  assert.ok(seen.flat().length > 0);
});

test('runner: voce con token perso -> 1 ripetizione -> poi riuscita o fallita, mai valori sbagliati', async () => {
  let calls = 0;
  const flaky = fake(({ texts }) => { calls++; return calls === 1 ? texts.map((t) => t.replace(/⟦0⟧/, '')) : texts.map((t) => `ok ${t}`); });
  const r1 = await translateKeys({ keys: ['Hai {0} cose'], lang: 'es', provider: flaky, glossary });
  assert.equal(r1.done.get('Hai {0} cose'), 'ok Hai {0} cose');
  assert.equal(calls, 2);
  const broken = fake(({ texts }) => texts.map(() => 'senza segnaposto'));
  const r2 = await translateKeys({ keys: ['Hai {0} cose', 'Ciao a tutti'], lang: 'es', provider: broken, glossary });
  assert.ok(!r2.done.has('Hai {0} cose'));
  assert.ok(r2.failed.get('Hai {0} cose').includes('token'));
  assert.ok(r2.done.has('Ciao a tutti'));
});

test('runner: risposta nulla/vuota, emoji e script sbagliato finiscono tra le fallite', async () => {
  const p = fake(({ texts }) => texts.map((t, i) => (i === 0 ? null : i === 1 ? 'Ciao \u{1F600}' : 'Save all')));
  const r = await translateKeys({ keys: ['Uno due', 'Tre quattro', 'Cinque sei'], lang: 'ja', provider: p, glossary, batchSize: 3 });
  assert.equal(r.done.size, 0);
  assert.equal(r.failed.size, 3);
});

test('runner: errore fatale del provider si propaga, errore transitorio -> ripetizione', async () => {
  const fatal = fake(async () => { const e = new Error('chiave errata'); e.fatal = true; throw e; });
  await assert.rejects(translateKeys({ keys: ['Ciao mondo'], lang: 'es', provider: fatal, glossary }), /chiave errata/);
  let n = 0;
  const transient = fake(({ texts }) => { if (++n === 1) throw new Error('timeout'); return texts.map((t) => `x ${t}`); });
  const r = await translateKeys({ keys: ['Ciao mondo'], lang: 'es', provider: transient, glossary });
  assert.equal(r.done.get('Ciao mondo'), 'x Ciao mondo');
});

test('runner: copia regex/marchi, comandi assistente dall\'inglese, comandi tra virgolette in inglese', async () => {
  const provider = fake(({ texts }) => texts.map((t) => `T ${t}`));
  const enCatalog = { 'cerca nelle mie': 'search my', 'Scrivi "aggiungi dentista giovedi" ora': 'Write "add dentist Thursday" now' };
  const keys = ['(?:fattura|bolletta)\\s*', 'Spotify' , 'cerca nelle mie', 'Scrivi "aggiungi dentista giovedi" ora'];
  const r = await translateKeys({ keys, lang: 'fr', provider, glossary, enCatalog });
  assert.equal(r.done.get(keys[0]), keys[0]);
  assert.equal(r.done.get('Spotify'), 'Spotify');
  assert.equal(r.done.get('cerca nelle mie'), 'search my');
  assert.equal(r.done.get(keys[3]), 'T Scrivi "add dentist Thursday" ora');
});

test('runner: comando senza traduzione inglese di riferimento -> tradotto in inglese col provider', async () => {
  const provider = fake(({ texts, to }) => texts.map((t) => (to === 'en' ? 'add dentist Thursday' : `[${to}] ${t}`)));
  const key = 'Scrivi "aggiungi dentista giovedi" ora';
  const r = await translateKeys({ keys: [key], lang: 'de', provider, glossary, enCatalog: {} });
  assert.equal(r.done.get(key), '[de] Scrivi "add dentist Thursday" ora');
});

test('runner: shouldAbort interrompe tra i batch e conta le saltate', async () => {
  let stop = false;
  const p = fake(({ texts }) => { stop = true; return texts.map((t) => `x ${t}`); }, { batchSize: 2, concurrency: 1 });
  const keys = ['Uno uno', 'Due due', 'Tre tre', 'Quattro quattro', 'Cinque cinque'];
  const r = await translateKeys({ keys, lang: 'es', provider: p, glossary, shouldAbort: () => stop });
  assert.equal(r.done.size, 2);
  assert.equal(r.skipped, 3);
});

test('provider: scelta automatica, lingue coperte, messaggi', () => {
  assert.deepEqual(buildChain('auto', { env: {} }), []);
  assert.deepEqual(buildChain('auto', { env: { DEEPL_API_KEY: 'k:fx', ANTHROPIC_API_KEY: 'a' } }).map((p) => p.name), ['anthropic', 'deepl']);
  assert.throws(() => buildChain('deepl', { env: {} }), /chiave mancante/);
  assert.throws(() => buildChain('nope', { env: {} }), /sconosciuto/);
  const chain = buildChain('deepl,anthropic', { env: { DEEPL_API_KEY: 'k:fx', ANTHROPIC_API_KEY: 'a' } });
  assert.equal(providerFor(chain, 'de').name, 'deepl');
  assert.equal(providerFor(chain, 'hi').name, 'anthropic'); // DeepL non copre l'hindi
  assert.equal(providerFor(buildChain('deepl', { env: { DEEPL_API_KEY: 'k' } }), 'hi'), null);
  assert.ok(Object.keys(REGISTRY).includes('libretranslate'));
});

test('anthropic: richiesta, prompt con glossario, parsing JSON (fetch simulato)', async () => {
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '```json\n{"1":"Hallo","2":"Welt"}\n```' }] }), { status: 200 });
  };
  try {
    const p = createAnthropic({ env: { ANTHROPIC_API_KEY: 'sk-test' }, model: 'claude-test' });
    const g = { terms: termsFor(glossary, 'de', ['Nuovo impegno']), style: { note: 'du' }, protected: [] };
    const out = await p.translateBatch({ texts: ['Ciao', 'Mondo'], to: 'de', glossary: g });
    assert.deepEqual(out, ['Hallo', 'Welt']);
    assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(captured.init.headers['x-api-key'], 'sk-test');
    assert.equal(captured.body.model, 'claude-test');
    assert.deepEqual(JSON.parse(captured.body.messages[0].content), { 1: 'Ciao', 2: 'Mondo' });
    assert.ok(captured.body.system.includes('"Impegno" -> "Termin"'));
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(parseJsonObject('testo {"1":"a"} fine'), { 1: 'a' });
  assert.throws(() => parseJsonObject('niente'), /JSON/);
  assert.ok(buildSystemPrompt({ to: 'ja', glossary: {}, context: 'x' }).includes('Japanese'));
});

test('costo: stima per provider', () => {
  const perLang = { de: { items: 1000, chars: 35000 }, ja: { items: 1000, chars: 35000 } };
  const a = estimateCost({ pricing, providerName: 'anthropic', model: 'claude-haiku-4-5', perLang });
  assert.ok(a.usd > 0 && a.usd < 5);
  assert.equal(estimateCost({ pricing, providerName: 'deepl', perLang }).usd, (70000 / 1e6) * pricing.deepl.perMChars);
  assert.equal(estimateCost({ pricing, providerName: 'libretranslate', perLang }).usd, 0);
  assert.ok(pricing._note.includes('VERIFICARE'));
});

// ---- end-to-end del comando su cartella temporanea (provider mock, nessuna rete, locali reali intatti)
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-e2e-'));
  fs.mkdirSync(path.join(dir, 'locales'));
  fs.mkdirSync(path.join(dir, 'ov'));
  const source = ['Salva', 'Annulla', 'Hai {0} impegni', 'Scrivi "aggiungi dentista giovedi" ora', 'Nuova voce'];
  fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify(source));
  fs.writeFileSync(path.join(dir, 'locales/en.json'), serialize({ Salva: 'Save', Annulla: 'Cancel', 'Hai {0} impegni': 'You have {0} appointments', 'Vecchia orfana': 'x' }));
  fs.writeFileSync(path.join(dir, 'locales/de.json'), serialize({ Salva: 'Speichern', Annulla: '' }));
  fs.writeFileSync(path.join(dir, 'ov/de.json'), JSON.stringify({ 'Nuova voce': 'Neuer Eintrag (override)' }));
  const args = (...more) => [path.join(ROOT, 'scripts/translate-i18n.mjs'), `--source=${path.join(dir, 'source.json')}`, `--locales-dir=${path.join(dir, 'locales')}`, `--overrides-dir=${path.join(dir, 'ov')}`, `--report=${path.join(dir, 'report.json')}`, '--lang=en,de', ...more];
  const run = (...more) => spawnSync(process.execPath, args(...more), { encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: '', DEEPL_API_KEY: '', GOOGLE_TRANSLATE_API_KEY: '', LIBRETRANSLATE_URL: '' } });
  const read = (l) => JSON.parse(fs.readFileSync(path.join(dir, `locales/${l}.json`), 'utf8'));
  return { dir, run, read };
}

test('CLI: --check fallisce con chiavi mancanti, --dry-run non scrive, senza chiavi messaggio chiaro', () => {
  const s = sandbox();
  try {
    const before = fs.readFileSync(path.join(s.dir, 'locales/de.json'), 'utf8');
    const c = s.run('--check');
    assert.equal(c.status, 1);
    assert.match(c.stdout, /mancante: Nuova voce|mancante: Hai \{0\} impegni/);
    const d = s.run('--provider=mock', '--dry-run');
    assert.equal(d.status, 0);
    assert.equal(fs.readFileSync(path.join(s.dir, 'locales/de.json'), 'utf8'), before);
    const n = s.run();
    assert.equal(n.status, 2);
    assert.match(n.stderr, /ANTHROPIC_API_KEY o DEEPL_API_KEY/);
  } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
});

test('CLI: mock end-to-end, override intatti, orfane solo con --prune, idempotente, --check verde', () => {
  const s = sandbox();
  try {
    const r = s.run('--provider=mock', '--prune');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const en = s.read('en');
    const de = s.read('de');
    assert.equal(en.Salva, 'Save'); // gia' tradotta: non toccata
    assert.equal(en['Nuova voce'], '[en] Nuova voce');
    assert.ok(!('Vecchia orfana' in en)); // potata
    assert.equal(de.Salva, 'Speichern');
    assert.equal(de.Annulla, '[de] Annulla'); // era vuota -> rifatta
    assert.equal(de['Hai {0} impegni'], '[de] Hai {0} impegni');
    assert.ok(!('Nuova voce' in de)); // c'e' l'override: il runner non la scrive
    assert.equal(de['Scrivi "aggiungi dentista giovedi" ora'], '[de] Scrivi "aggiungi dentista giovedi" ora');
    assert.equal(fs.readFileSync(path.join(s.dir, 'locales/de.json'), 'utf8'), serialize(de)); // formato stabile
    assert.equal(s.run('--check').status, 0);
    const again = s.run('--provider=mock');
    assert.match(again.stdout, /Niente da fare/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, 'report.json'), 'utf8')).langs.de.translated >= 0, true);
    // --retranslate rifa' solo le chiavi che corrispondono, mai gli override
    const rt = s.run('--provider=mock', '--retranslate=^Salva$');
    assert.equal(rt.status, 0);
    assert.equal(s.read('de').Salva, '[de] Salva');
    assert.equal(s.read('de')['Hai {0} impegni'], '[de] Hai {0} impegni');
  } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
});

test('mock provider: preserva i token e prefissa la lingua', async () => {
  const m = createMock();
  assert.deepEqual(await m.translateBatch({ texts: ['a ⟦0⟧'], to: 'de' }), ['[de] a ⟦0⟧']);
  assert.match((await m.translateBatch({ texts: ['x'], to: 'zh' }))[0], /^\[zh\] 译 x$/);
});
