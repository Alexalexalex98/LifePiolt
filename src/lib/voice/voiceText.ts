/**
 * Logica PURA della modalità voce di Theia: che cosa leggere ad alta voce e come trasformare l'audio grezzo di Gemini (PCM) in un file WAV.
 * Nessun import dall'app: si prova con node:test.
 */

/** Il testo di una risposta, pronto da leggere: senza markdown, link, «Fonti», elenchi puntati e simboli. Taglia a una frase intera. */
export function cleanForSpeech(texts: string[]): string {
  let s = texts.map((x) => (x ?? '').replace(/^\s*(fonti|sources)\s*:.*$/gim, ' ').trim()).filter(Boolean).join('. ');
  s = s
    .replace(/\[\[[\s\S]*?\]\]/g, ' ')
    .replace(/^\s*(fonti|sources)\s*:.*$/gim, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_`~#>|]+/g, ' ')
    .replace(/^\s*[-•·]\s+/gm, '. ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.(\s*\.)+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function speakable(texts: string[], opts: { max?: number; more?: string } = {}): string {
  const max = opts.max ?? 650;
  const s = cleanForSpeech(texts);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  const head = end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}.`;
  return opts.more ? `${head} ${opts.more}` : head;
}

/** Frequenza di campionamento dal tipo di audio («audio/L16;codec=pcm;rate=24000»). */
export function pcmRate(mime: string | undefined): number {
  const m = /rate=(\d{4,6})/i.exec(mime ?? '');
  return m ? Number(m[1]) : 24000;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]!), b = B64.indexOf(clean[i + 1]!), c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]!) : -1, d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]!) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/** PCM a 16 bit, mono, little endian -> file WAV riproducibile. */
export function pcmToWav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length, true); out.set(pcm, 44);
  return out;
}

/** La frase dell'utente è un comando per chiudere la conversazione a voce? («basta», «grazie, ciao», «chiudi»). */
export const wantsToStop = (text: string): boolean => /^\s*(basta|stop|chiudi|ciao theia|ciao|a dopo|grazie e ciao|grazie mille ciao|esci|fine)[\s.!]*$/i.test(text);


/** Le frasi di un testo con la posizione di inizio (per evidenziare quella che Theia sta dicendo, come i testi di Spotify). */
export function sentenceSpans(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?…]+(?:[.!?…]+["»”)]*|$)\s*/g;
  for (let m = re.exec(text); m; m = re.exec(text)) { if (!m[0]) { re.lastIndex++; continue; } if (m[0].trim()) out.push({ text: m[0].trim(), start: m.index }); }
  return out;
}

/**
 * Mentre Theia scrive, la voce parte dopo le prime frasi: dal testo ripulito prende i pezzi da leggere (il primo corto per partire subito,
 * gli altri più lunghi) senza mai tagliare una frase. `from` = quanti caratteri sono già stati consegnati; con `final` si consegna anche il resto.
 */
export function takeChunks(clean: string, from: number, final: boolean, first: boolean): { chunks: string[]; to: number } {
  const chunks: string[] = [];
  let buf = ''; let to = from; let pending = 0;
  const rest = clean.slice(from);
  const re = /[^.!?…]+(?:[.!?…]+["»”)]*\s+|[.!?…]+["»”)]*$)/g;
  let eaten = 0;
  for (let m = re.exec(rest); m; m = re.exec(rest)) {
    buf += m[0]; pending += m[0].length; eaten = m.index + m[0].length;
    const need = first && chunks.length === 0 ? 28 : 110;
    if (buf.trim().length >= need) { chunks.push(buf.trim()); to = from + eaten; buf = ''; pending = 0; }
  }
  if (final) {
    const tail = (buf + rest.slice(eaten)).trim();
    if (tail) chunks.push(tail);
    to = clean.length;
  }
  void pending;
  return { chunks, to };
}

/** Le parole sentite sono (quasi) quelle che sta dicendo Theia? Allora è l'eco dell'altoparlante, non l'utente che parla. */
export function isEcho(heard: string, spoken: string): boolean {
  const w = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((a) => a.length > 1);
  const h = w(heard); if (!h.length) return true;
  const set = new Set(w(spoken));
  return h.filter((a) => set.has(a)).length / h.length >= 0.6;
}
