/**
 * Normalizzazione del testo per il lessico multilingua. PURO (nessun import dall'app).
 * `fold` produce una versione "piatta" del testo (minuscolo, senza accenti/segni, cifre latine) e una mappa
 * indice-piatto -> indice-originale: così il titolo di un impegno si ritaglia dal testo ORIGINALE, identico a come l'utente l'ha detto.
 */

export type Script = 'latin' | 'cyrillic' | 'arabic' | 'devanagari' | 'cjk';
export type Folded = { src: string; f: string; map: number[] };

const DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0xff10];
function digit(ch: string): string {
  const c = ch.codePointAt(0)!;
  for (const b of DIGIT_BASES) if (c >= b && c <= b + 9) return String(c - b);
  return ch;
}

function foldChar(ch: string, script: Script): string {
  const d = digit(ch);
  if (d !== ch) return d;
  const c = ch.codePointAt(0)!;
  switch (script) {
    case 'latin': {
      const lower = ch.toLowerCase();
      const base = lower.normalize('NFD').replace(/\p{M}/gu, '');
      return base.length ? base : '';
    }
    case 'cyrillic': {
      const lower = ch.toLowerCase();
      return lower === 'ё' ? 'е' : lower;
    }
    case 'arabic': {
      if ((c >= 0x064b && c <= 0x065f) || c === 0x0670 || c === 0x0640) return '';
      if (c === 0x0623 || c === 0x0625 || c === 0x0622 || c === 0x0671) return 'ا';
      if (c === 0x0649) return 'ي';
      if (c === 0x0629) return 'ه';
      return ch.toLowerCase();
    }
    case 'devanagari': {
      if (c === 0x093c || c === 0x200d || c === 0x200c) return '';
      if (c === 0x0901) return 'ं';
      return ch;
    }
    case 'cjk': {
      if (c >= 0xff01 && c <= 0xff5e) return String.fromCodePoint(c - 0xfee0).toLowerCase();
      if (c === 0x3000) return ' ';
      return ch.toLowerCase();
    }
  }
}

export function fold(input: string, script: Script): Folded {
  const src = input.normalize('NFC');
  let f = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of src) {
    const out = foldChar(ch, script);
    for (let k = 0; k < out.length; k++) map.push(i);
    f += out;
    i += ch.length;
  }
  map.push(src.length);
  return { src, f, map };
}

/** Piega un frammento di sorgente del lessico (parole/regex) con le stesse regole del testo. */
export function foldSource(s: string, script: Script): string {
  return fold(s, script).f;
}

/** Intervallo [a,b) del testo piatto -> intervallo nel testo originale. */
export function toSrcRange(map: number[], a: number, b: number): [number, number] {
  return [map[a] ?? 0, b >= map.length ? map[map.length - 1] : map[b]];
}

/** Testo originale senza gli intervalli indicati (indici del testo piatto), con spazi al loro posto. */
export function cutSpans(fd: Folded, spans: [number, number][]): string {
  const cut: boolean[] = new Array(fd.src.length).fill(false);
  for (const [a, b] of spans) { const [x, y] = toSrcRange(fd.map, a, b); for (let i = x; i < y; i++) cut[i] = true; }
  let out = '';
  for (let i = 0; i < fd.src.length; i++) out += cut[i] ? ' ' : fd.src[i];
  return out;
}
