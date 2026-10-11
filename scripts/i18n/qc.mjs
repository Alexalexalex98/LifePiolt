// Controlli qualita' automatici su una traduzione.
import { findCommands } from './mask.mjs';
import { glossaryViolations } from './glossary.mjs';

export const SCRIPTS = {
  zh: /[㐀-鿿]/u,
  ja: /[぀-ヿ㐀-鿿]/u,
  hi: /[ऀ-ॿ]/u,
  ar: /[؀-ۿݐ-ݿ]/u,
  ru: /[Ѐ-ӿ]/u,
};
const FOREIGN = /[Ѐ-ӿ؀-ۿऀ-ॿ぀-ヿ㐀-鿿]/u;
const ph = (s) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort().join(',');

/**
 * @returns {{errors: string[], warnings: string[]}} gli errori impediscono la scrittura, gli avvisi no (salvo --strict).
 */
export function checkTranslation({ src, out, lang, glossary = null, protectedTerms = [] }) {
  const errors = [];
  const warnings = [];
  if (typeof out !== 'string' || out.trim() === '') return { errors: ['valore vuoto'], warnings };
  if (ph(src) !== ph(out)) errors.push(`segnaposto diversi (${ph(src) || '-'} vs ${ph(out) || '-'})`);
  if (/\p{Extended_Pictographic}/u.test(out) && !/\p{Extended_Pictographic}/u.test(src)) errors.push('emoji non presente nel sorgente');
  if (/[⟦⟧]|<\/?x>|<span/.test(out)) errors.push('token di protezione residuo');
  if (/^\s*(translation|traduzione|translator'?s? note)\s*:/i.test(out) || /[(\[]\s*(translator|nota del traduttore)/i.test(out)) errors.push('nota del traduttore nel valore');

  // testo "libero": senza segnaposto, nomi protetti, URL, comandi tra virgolette
  const strip = (s) => {
    let r = s.replace(/\{\d+\}/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/"[^"]*"/g, ' ');
    for (const p of protectedTerms) r = r.split(p).join(' ');
    return r;
  };
  const srcFree = strip(src);
  const outFree = strip(out);
  const srcWords = (srcFree.match(/\p{L}{3,}/gu) ?? []).length;
  const expected = SCRIPTS[lang];
  if (expected) {
    if (srcWords >= 1 && out !== src) {
      const letters = outFree.match(/\p{L}/gu) ?? [];
      const good = letters.filter((c) => expected.test(c)).length;
      if (letters.length >= 3 && good === 0) errors.push(`nessun carattere dello script atteso (${lang})`);
      else if (letters.length >= 8 && good / letters.length < 0.5) warnings.push(`mescolanza di alfabeti (${Math.round((good / letters.length) * 100)}% script atteso)`);
    }
  } else if (lang !== 'it' && FOREIGN.test(outFree)) {
    errors.push('script inatteso per la lingua');
  }
  if (lang !== 'it' && srcWords >= 2 && out === src) warnings.push('identica al sorgente');

  // lunghezza
  const cjk = lang === 'zh' || lang === 'ja';
  const ratio = out.length / Math.max(1, src.length);
  if (src.length >= (cjk ? 12 : 4)) {
    const lo = cjk ? 0.1 : 0.2;
    if (ratio > 3 && src.length < 60) warnings.push(`lunghezza anomala (${ratio.toFixed(1)}x)`);
    else if (ratio > 4) warnings.push(`lunghezza anomala (${ratio.toFixed(1)}x)`);
    else if (ratio < lo) warnings.push(`lunghezza anomala (${ratio.toFixed(2)}x)`);
  }

  // comandi per l'assistente: devono restare in inglese (ASCII) tra virgolette dritte
  if (lang !== 'en' && lang !== 'it') {
    const cmds = findCommands(src);
    if (cmds.length) {
      const outCmds = (out.match(/(?:"|\u00ab|\u201c|\u201e|\u300c)[^"\u00ab\u00bb\u201c\u201d\u201e\u300c\u300d]+(?:"|\u00bb|\u201d|\u201c|\u300d)/g) ?? []).filter((c) => !/[^\x00-\x7f\u00ab\u00bb\u201c\u201d\u201e\u300c\u300d]/.test(c));
      if (outCmds.length < cmds.length) errors.push('comandi tra virgolette non preservati in inglese');
      else if (cmds.some((c) => out.includes(c) && /[à-ÿ]/.test(c))) errors.push('comando rimasto in italiano');
    }
  }
  if (glossary) {
    const g = glossaryViolations(glossary, lang, src.replace(/"[^"]*"/g, ' '), out.replace(/"[^"]*"/g, ' '));
    if (g.length) warnings.push(`glossario: ${g.join('; ')}`);
  }
  return { errors, warnings };
}

/** Controllo strutturale minimo (usato da --check sui valori gia' presenti). */
export function structuralErrors(src, out) {
  if (typeof out !== 'string' || out.trim() === '') return 'valore vuoto';
  if (ph(src) !== ph(out)) return 'segnaposto diversi';
  return null;
}
