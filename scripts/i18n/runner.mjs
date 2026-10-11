// Nucleo del traduttore: maschera -> provider -> ripristina -> controlli qualita' -> (un tentativo di ripetizione) -> fallita.
// Puro rispetto al filesystem: il provider e' iniettato (nei test e' finto).
import { STYLES, mask, unmask, nothingToTranslate, buildTermRe, findCommands, isUntranslatable } from './mask.mjs';
import { termsFor, styleFor } from './glossary.mjs';
import { checkTranslation } from './qc.mjs';

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function pool(tasks, n, stop) {
  let i = 0;
  let fatal = null;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, async () => {
    while (i < tasks.length && !fatal && !stop()) {
      const t = tasks[i++];
      try { await t(); } catch (e) { if (e.fatal) fatal = e; else throw e; }
    }
  }));
  if (fatal) throw fatal;
}

/**
 * Comandi per l'assistente (testo tra virgolette dritte con iniziale minuscola) che devono restare INGLESI.
 * Prima si usa la traduzione inglese esistente (stesse virgolette nello stesso ordine), altrimenti si traduce il comando in inglese.
 * @returns {Promise<Map<string, Map<string,string>>>} chiave -> (segmento italiano -> segmento inglese con virgolette)
 */
async function resolveCommands({ keys, enCatalog, enProvider, glossary, opts }) {
  const res = new Map();
  const toTranslate = new Set();
  const pending = [];
  for (const key of keys) {
    const segs = findCommands(key);
    if (!segs.length) continue;
    const all = key.match(/"[^"]*"/g) ?? [];
    const en = enCatalog[key];
    const enAll = typeof en === 'string' ? en.match(/"[^"]*"/g) ?? [] : [];
    const map = new Map();
    if (enAll.length === all.length) {
      all.forEach((q, i) => { if (segs.includes(q) && !/[^\x00-\x7f]/.test(enAll[i])) map.set(q, enAll[i]); });
    }
    if (segs.every((s) => map.has(s))) { res.set(key, map); continue; }
    for (const s of segs) if (!map.has(s)) toTranslate.add(s.slice(1, -1));
    pending.push([key, segs, map]);
  }
  let tr = new Map();
  if (toTranslate.size && enProvider) {
    const r = await translateKeys({ ...opts, keys: [...toTranslate], lang: 'en', provider: enProvider, glossary, enCatalog: {}, onBatch: null, noCommands: true });
    tr = r.done;
  }
  for (const [key, segs, map] of pending) {
    for (const s of segs) if (!map.has(s)) { const e = tr.get(s.slice(1, -1)); if (e && !/[^\x00-\x7f]/.test(e)) map.set(s, `"${e}"`); }
    if (segs.every((s) => map.has(s))) res.set(key, map);
  }
  return res;
}

/**
 * @param {object} p
 * @param {string[]} p.keys chiavi italiane da tradurre
 * @param {string} p.lang
 * @param {object} p.provider  { translateBatch, maskStyle, batchSize, concurrency }
 * @param {object} p.glossary  da loadGlossary
 * @returns {{done: Map, failed: Map, warned: Map, copied: Set, skipped: number}}
 */
export async function translateKeys({ keys, lang, provider, glossary, enCatalog = {}, enProvider = null, batchSize = null, concurrency = null, onBatch = null, shouldAbort = () => false, context = '', strict = false, noCommands = false, log = () => {} }) {
  const style = STYLES[provider.maskStyle ?? 'brackets'];
  const termSource = buildTermRe(glossary.protected);
  const done = new Map();
  const failed = new Map();
  const warned = new Map();
  const copied = new Set();
  const bs = batchSize ?? provider.batchSize ?? 40;
  const conc = concurrency ?? provider.concurrency ?? 1;
  const baseOpts = { batchSize, concurrency, shouldAbort, context, strict, log };

  const cmds = lang === 'en' || noCommands ? new Map() : await resolveCommands({ keys, enCatalog, enProvider: enProvider ?? provider, glossary, opts: baseOpts });

  const items = [];
  for (const key of keys) {
    if (isUntranslatable(key) || glossary.keepVerbatim?.has(key)) { done.set(key, key); copied.add(key); continue; }
    if (lang !== 'en' && !noCommands && glossary.commandKeyRes?.some((re) => re.test(key)) && typeof enCatalog[key] === 'string' && enCatalog[key] !== key) {
      // comando per l'assistente: resta inglese in tutte le lingue
      done.set(key, enCatalog[key]); copied.add(key); continue;
    }
    let cmap = null;
    if (lang !== 'en' && !noCommands && findCommands(key).length) {
      cmap = cmds.get(key);
      if (!cmap) { failed.set(key, 'comando per l\'assistente non risolto (serve il provider per l\'inglese)'); continue; }
    }
    const { masked, tokens } = mask(key, { termSource, commandMap: cmap, style });
    if (nothingToTranslate(masked, style)) {
      const r = unmask(masked, tokens, style);
      done.set(key, r.ok ? r.text : key); copied.add(key); continue;
    }
    items.push({ key, masked, tokens });
  }

  const glossaryFor = (batch) => ({ terms: termsFor(glossary, lang, batch.map((b) => b.key)), style: styleFor(glossary, lang), protected: glossary.protected });

  const evaluate = (it, out) => {
    if (out === null || out === undefined) return 'nessuna risposta dal motore';
    const r = unmask(out, it.tokens, style);
    if (!r.ok) return r.reason;
    const q = checkTranslation({ src: it.key, out: r.text, lang, glossary, protectedTerms: glossary.protected });
    if (q.errors.length) return q.errors.join('; ');
    if (strict && q.warnings.length) return 'avviso (strict): ' + q.warnings.join('; ');
    done.set(it.key, r.text);
    if (q.warnings.length) warned.set(it.key, q.warnings);
    return null;
  };

  let retry = [];
  const runBatch = (retryPhase) => async (batch) => {
    let outs;
    let err = null;
    try { outs = await provider.translateBatch({ texts: batch.map((b) => b.masked), from: 'it', to: lang, glossary: glossaryFor(batch), context }); }
    catch (e) { if (e.fatal) throw e; err = e.message; outs = batch.map(() => null); log(`  errore batch (${lang}): ${err}`); }
    batch.forEach((it, i) => {
      const reason = evaluate(it, outs?.[i]);
      if (reason) { if (retryPhase) failed.set(it.key, reason); else retry.push({ it, reason }); }
    });
    if (onBatch) await onBatch(done);
  };

  let skipped = 0;
  const first = chunk(items, bs).map((b) => () => (shouldAbort() ? undefined : runBatch(false)(b)));
  await pool(first, conc, shouldAbort);
  if (retry.length && !shouldAbort()) {
    const again = retry.map((r) => r.it);
    const reasons = new Map(retry.map((r) => [r.it.key, r.reason]));
    retry = [];
    const second = chunk(again, Math.min(10, bs)).map((b) => () => runBatch(true)(b));
    await pool(second, conc, shouldAbort);
    for (const it of again) if (failed.has(it.key)) failed.set(it.key, `${failed.get(it.key)} (1o tentativo: ${reasons.get(it.key)})`);
  }
  for (const it of items) if (!done.has(it.key) && !failed.has(it.key)) skipped++;
  return { done, failed, warned, copied, skipped };
}
