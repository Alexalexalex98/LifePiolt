/** Base64 e hex senza dipendenze (Hermes non garantisce Buffer; atob/btoa non sono ovunque). */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const REV: Record<string, number> = {};
for (let i = 0; i < ABC.length; i++) REV[ABC[i]] = i;

export function bytesToBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + (i + 1 < b.length ? ABC[(n >> 6) & 63] : '=') + (i + 2 < b.length ? ABC[n & 63] : '=');
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[\s]/g, '');
  if (clean.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(clean)) throw new Error('base64 non valido');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (REV[clean[i]] << 18) | (REV[clean[i + 1]] << 12) | ((REV[clean[i + 2]] ?? 0) << 6) | (REV[clean[i + 3]] ?? 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function hexToBytes(h: string): Uint8Array {
  if (h.length % 2 !== 0 || /[^0-9a-fA-F]/.test(h)) throw new Error('hex non valido');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** UTF-8 senza TextEncoder (disponibile su Hermes, ma meglio non dipenderne nei test di logica pura). */
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);
