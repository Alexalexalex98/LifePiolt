// Glossario: termini fissi per lingua, nomi protetti, stile (formalita'). Dati in i18n/glossary.json.
import fs from 'node:fs';

export function loadGlossary(file) {
  const g = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { protected: g.protected ?? [], keepVerbatim: new Set(g.keepVerbatim ?? []), commandKeyRes: (g.assistantCommandPatterns ?? []).map((p) => new RegExp(p)), style: g.style ?? {}, terms: (g.terms ?? []).map((t) => ({ ...t, re: new RegExp(t.match ?? `\\b${t.it}\\b`, 'iu') })) };
}

/** Termini del glossario pertinenti ai testi dati, per la lingua. [{it, to, alts, note}] */
export function termsFor(glossary, lang, texts = null) {
  const out = [];
  for (const t of glossary.terms) {
    const forms = t.tr?.[lang];
    if (!forms || !forms.length) continue;
    if (texts && !texts.some((x) => t.re.test(x))) continue;
    out.push({ it: t.it, to: forms[0], alts: forms.slice(1), note: t.note });
  }
  return out;
}

export const styleFor = (glossary, lang) => glossary.style?.[lang] ?? {};

/** Controllo post-traduzione: restituisce i termini non rispettati (avvisi, non errori: le lingue flesse variano). */
export function glossaryViolations(glossary, lang, src, out) {
  const v = [];
  const low = out.toLowerCase();
  for (const t of glossary.terms) {
    if (t.check === false) continue;
    const forms = t.tr?.[lang];
    if (!forms || !forms.length || !t.re.test(src)) continue;
    if (!forms.some((f) => low.includes(f.toLowerCase()))) v.push(`${t.it} -> ${forms[0]}`);
  }
  return v;
}
