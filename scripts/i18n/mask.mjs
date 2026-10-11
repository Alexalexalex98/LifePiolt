// Protezione di segnaposto, nomi di prodotto, URL, numeri e comandi per l'assistente.
// Il testo viene "mascherato" con token prima dell'invio al motore e ripristinato dopo, verificando
// che ogni token torni indietro esattamente una volta.

/** Stili di token: dipendono da cosa il motore lascia intatto (LLM: parentesi; NMT: tag che non si traducono). */
export const STYLES = {
  brackets: { wrap: (i) => `⟦${i}⟧`, re: /⟦\s*(\d+)\s*⟧/g, escape: false, leftover: /[⟦⟧]/ },
  xml: { wrap: (i) => `<x>${i}</x>`, re: /<x>\s*(\d+)\s*<\/x>/g, escape: true, leftover: /<\/?x>/ },
  html: { wrap: (i) => `<span class="notranslate">${i}</span>`, re: /<span[^>]*>\s*(\d+)\s*<\/span>/g, escape: true, leftover: /<\/?span/ },
};

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/**
 * Comandi per l'assistente: testo tra virgolette dritte in frasi che introducono un esempio ("Dimmi ...", "Prova ...",
 * elenchi che iniziano con una virgoletta). Le virgolette "di citazione" (es. Stato "disponibile") non sono comandi e si traducono.
 */
const CMD_CTX = /(dimmi|\bd[iì]['’]|prova|scrivi|chiedi|(?:esempio|es\.)[^"]{0,6}"|comand|digita|puoi dire|•|\bdire\b|\bdici\b|\bscrivere\b|\bchiedere\b|\bcon\s+"|\bcerca\b|\bsegna\b)/i;
const QUOTED_ANY = /"[^"\n]*\p{L}[^"\n]*"/gu;
export function findCommands(s) {
  if (!s.includes('"') || !(CMD_CTX.test(s) || s.startsWith('"'))) return [];
  return (s.match(QUOTED_ANY) ?? []).filter((q) => /\p{L}/u.test(q.replace(/\{\d+\}/g, '')));
}

/** Espressioni regolari / identificatori tecnici: non si traducono, si copiano. */
export function isUntranslatable(s) {
  if (/\(\?[:=!<]/.test(s)) return true;
  if (/^privacy:/.test(s)) return true;
  if (/\\[bdsw]|\\u[0-9a-f]{4}/i.test(s) && !/\s{2,}/.test(s) && /[\\^$|]/.test(s)) return true;
  return false;
}

export function buildTermRe(terms) {
  const list = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length).map(escRe);
  if (!list.length) return null;
  return `(?<![\\p{L}\\p{N}])(?:${list.join('|')})(?![\\p{L}\\p{N}])`;
}

/**
 * Maschera `text`. `commandMap`: Map segmento-italiano-con-virgolette -> sostituto inglese (con virgolette).
 * Restituisce { masked, tokens: [valori originali] }.
 */
export function mask(text, { termSource = null, commandMap = null, style = STYLES.brackets } = {}) {
  const alts = [];
  if (commandMap && commandMap.size) alts.push('("[^"\\n]*\\p{L}[^"\\n]*")');
  else alts.push('(?!)()');
  alts.push('(\\{\\d+\\})', '(https?:\\/\\/[^\\s"\\u201d\\u00bb]+)', '([\\w.+-]+@[\\w-]+\\.[\\w.]+)');
  if (termSource) alts.push(`(${termSource})`); else alts.push('(?!)()');
  alts.push('(\\d+(?:[.,:/]\\d+)*%?)');
  const re = new RegExp(alts.join('|'), 'gu');
  const tokens = [];
  let out = '';
  let last = 0;
  const plain = (s) => (style.escape ? escHtml(s) : s);
  let m;
  while ((m = re.exec(text))) {
    let value = m[0];
    if (m[1]) {
      if (!commandMap.has(m[0])) { re.lastIndex = m.index + 1; continue; }
      value = commandMap.get(m[0]);
    }
    out += plain(text.slice(last, m.index)) + style.wrap(tokens.length);
    tokens.push(value);
    last = m.index + m[0].length;
  }
  out += plain(text.slice(last));
  return { masked: out, tokens };
}

/** Ripristina i token. Restituisce { ok, text, reason }. */
export function unmask(translated, tokens, style = STYLES.brackets) {
  if (typeof translated !== 'string') return { ok: false, reason: 'risposta non testuale' };
  const re = new RegExp(style.re.source, 'g');
  const parts = translated.split(re); // testo, idx, testo, idx...
  const seen = new Array(tokens.length).fill(0);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const p = style.escape ? unescHtml(parts[i]) : parts[i];
      if (style.leftover.test(p)) return { ok: false, reason: 'token residuo o malformato' };
      out += p;
    } else {
      const idx = Number(parts[i]);
      if (!(idx >= 0 && idx < tokens.length)) return { ok: false, reason: `token ${idx} sconosciuto` };
      seen[idx]++;
      out += tokens[idx];
    }
  }
  const bad = seen.findIndex((c) => c !== 1);
  if (bad !== -1) return { ok: false, reason: `token ${bad} presente ${seen[bad]} volte` };
  return { ok: true, text: out.trim() };
}

/** True se, tolti i token, non resta nulla da tradurre (solo numeri/nomi/segnaposto). */
export function nothingToTranslate(masked, style = STYLES.brackets) {
  const rest = masked.replace(new RegExp(style.re.source, 'g'), '');
  return !/\p{L}/u.test(rest);
}
