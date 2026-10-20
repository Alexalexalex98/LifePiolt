/**
 * Motore di ritocco foto (modulo PURO): parametri, look pronti, geometria (ritaglio, raddrizza, ruota) e il codice dello shader
 * che calcola i pixel sul telefono (Skia). Qui non c'è nessun import dall'app: così si prova con i test.
 * Tutti i valori dei cursori vanno da -100 a 100 (0 = nessun cambiamento); dentro lo shader diventano da -1 a 1.
 */
export type ColorBand = 'sR' | 'sO' | 'sY' | 'sG' | 'sA' | 'sB' | 'sP' | 'sM';
export type PhotoParams = {
  exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number; dehaze: number;
  temp: number; tint: number; vibrance: number; saturation: number; mono: number;
  clarity: number; sharpen: number; grain: number; vignette: number; fade: number;
  sR: number; sO: number; sY: number; sG: number; sA: number; sB: number; sP: number; sM: number;
  /** tono delle ombre e delle luci: colore (0-360) e quantità (0-100) */
  shHue: number; shAmt: number; hiHue: number; hiAmt: number;
};
export const DEFAULTS: PhotoParams = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, dehaze: 0, temp: 0, tint: 0, vibrance: 0, saturation: 0, mono: 0,
  clarity: 0, sharpen: 0, grain: 0, vignette: 0, fade: 0, sR: 0, sO: 0, sY: 0, sG: 0, sA: 0, sB: 0, sP: 0, sM: 0, shHue: 220, shAmt: 0, hiHue: 40, hiAmt: 0,
};
export type ParamKey = keyof PhotoParams;
export type Control = { key: ParamKey; label: string; hint: string; min: number; max: number; unit?: string };

export const GROUPS: { id: 'luce' | 'colore' | 'dettagli' | 'effetti'; label: string; controls: Control[] }[] = [
  { id: 'luce', label: 'Luce', controls: [
    { key: 'exposure', label: 'Esposizione', hint: 'Rende tutta la foto più chiara o più scura', min: -100, max: 100 },
    { key: 'contrast', label: 'Contrasto', hint: 'Distanza tra chiari e scuri', min: -100, max: 100 },
    { key: 'highlights', label: 'Luci', hint: 'Recupera i chiari bruciati (verso sinistra)', min: -100, max: 100 },
    { key: 'shadows', label: 'Ombre', hint: 'Schiarisce le zone scure (verso destra)', min: -100, max: 100 },
    { key: 'whites', label: 'Bianchi', hint: 'Il punto più chiaro della foto', min: -100, max: 100 },
    { key: 'blacks', label: 'Neri', hint: 'Il punto più scuro della foto', min: -100, max: 100 },
    { key: 'dehaze', label: 'Foschia', hint: 'Toglie la nebbia o la aggiunge (verso sinistra)', min: -100, max: 100 },
  ] },
  { id: 'colore', label: 'Colore', controls: [
    { key: 'temp', label: 'Temperatura', hint: 'Più caldo (arancio) o più freddo (azzurro)', min: -100, max: 100 },
    { key: 'tint', label: 'Tinta', hint: 'Verso il verde o verso il magenta', min: -100, max: 100 },
    { key: 'vibrance', label: 'Vividezza', hint: 'Anima i colori spenti senza esagerare quelli forti', min: -100, max: 100 },
    { key: 'saturation', label: 'Saturazione', hint: 'Intensità di tutti i colori', min: -100, max: 100 },
    { key: 'mono', label: 'Bianco e nero', hint: 'Toglie il colore', min: 0, max: 100 },
  ] },
  { id: 'dettagli', label: 'Dettagli', controls: [
    { key: 'clarity', label: 'Chiarezza', hint: 'Dà corpo e carattere ai medi toni', min: -100, max: 100 },
    { key: 'sharpen', label: 'Nitidezza', hint: 'Rende i contorni più netti', min: 0, max: 100 },
  ] },
  { id: 'effetti', label: 'Effetti', controls: [
    { key: 'vignette', label: 'Vignetta', hint: 'Scurisce (o schiarisce) i bordi', min: -100, max: 100 },
    { key: 'grain', label: 'Grana', hint: 'Grana da pellicola', min: 0, max: 100 },
    { key: 'fade', label: 'Dissolvenza', hint: 'Neri più morbidi, effetto sbiadito', min: 0, max: 100 },
  ] },
];
export const COLOR_BANDS: { key: ColorBand; label: string; dot: string }[] = [
  { key: 'sR', label: 'Rossi', dot: '#e5484d' }, { key: 'sO', label: 'Arancio', dot: '#f2994a' }, { key: 'sY', label: 'Gialli', dot: '#f2c94c' }, { key: 'sG', label: 'Verdi', dot: '#4cc38a' },
  { key: 'sA', label: 'Azzurri', dot: '#4cc9d6' }, { key: 'sB', label: 'Blu', dot: '#4f7df3' }, { key: 'sP', label: 'Viola', dot: '#8e5cf0' }, { key: 'sM', label: 'Magenta', dot: '#e05cc0' },
];
export const ALL_KEYS = Object.keys(DEFAULTS) as ParamKey[];
export const clampParam = (key: ParamKey, v: number): number => {
  const c = GROUPS.flatMap((g) => g.controls).find((x) => x.key === key);
  const [lo, hi] = c ? [c.min, c.max] : key === 'shHue' || key === 'hiHue' ? [0, 360] : key === 'shAmt' || key === 'hiAmt' ? [0, 100] : [-100, 100];
  return Math.round(Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0)));
};
export const cleanParams = (p?: Partial<PhotoParams> | null): PhotoParams => { const out = { ...DEFAULTS }; if (p) for (const k of ALL_KEYS) if (typeof p[k] === 'number') out[k] = clampParam(k, p[k] as number); return out; };
/** Ci sono modifiche rispetto alla foto originale? */
export const isEdited = (p: PhotoParams): boolean => ALL_KEYS.some((k) => (k === 'shHue' || k === 'hiHue' ? false : p[k] !== DEFAULTS[k]));
/** Solo ciò che è diverso dall'originale (per salvare poco). */
export const diffParams = (p: PhotoParams): Partial<PhotoParams> => { const o: Partial<PhotoParams> = {}; for (const k of ALL_KEYS) if (p[k] !== DEFAULTS[k]) o[k] = p[k]; return o; };

/** «Migliora»: un ritocco prudente che va bene per quasi tutte le foto (non legge la foto: è lo stesso per tutte). */
export const AUTO: Partial<PhotoParams> = { contrast: 12, highlights: -14, shadows: 16, vibrance: 22, clarity: 14, sharpen: 18, blacks: -6 };

export type Look = { id: string; label: string; p: Partial<PhotoParams> };
export const LOOKS: Look[] = [
  { id: 'originale', label: 'Originale', p: {} },
  { id: 'vivido', label: 'Vivido', p: { contrast: 14, vibrance: 38, saturation: 10, clarity: 16, sharpen: 20 } },
  { id: 'caldo', label: 'Dorato', p: { temp: 32, tint: 4, contrast: 8, highlights: -10, vibrance: 14, fade: 6 } },
  { id: 'freddo', label: 'Nordico', p: { temp: -30, contrast: 10, shadows: 10, saturation: -8, clarity: 10 } },
  { id: 'cinema', label: 'Cinema', p: { contrast: 18, temp: 10, shadows: -8, saturation: -14, fade: 14, vignette: 26, shHue: 195, shAmt: 22, hiHue: 38, hiAmt: 20 } },
  { id: 'pellicola', label: 'Pellicola', p: { contrast: -6, fade: 22, grain: 34, temp: 8, saturation: -6, vignette: 14 } },
  { id: 'matte', label: 'Matte', p: { contrast: -10, blacks: 30, fade: 26, saturation: -10, highlights: -10 } },
  { id: 'bn', label: 'B/N', p: { mono: 100, contrast: 18, clarity: 14, sharpen: 16 } },
  { id: 'bnduro', label: 'B/N duro', p: { mono: 100, contrast: 42, blacks: -20, whites: 14, clarity: 34, grain: 22 } },
  { id: 'tramonto', label: 'Tramonto', p: { temp: 40, tint: 10, vibrance: 30, contrast: 14, sO: 28, sR: 18, hiHue: 28, hiAmt: 30 } },
  { id: 'natura', label: 'Natura', p: { vibrance: 30, sG: 26, sY: 14, sA: 10, clarity: 14, contrast: 8, shadows: 10 } },
  { id: 'pelle', label: 'Ritratto', p: { temp: 8, contrast: -4, clarity: -12, vibrance: 10, shadows: 8, sO: -8, sR: -6, sharpen: 10 } },
  { id: 'urbano', label: 'Urbano', p: { contrast: 24, clarity: 36, saturation: -18, shadows: 12, vignette: 18, dehaze: 14, sharpen: 24 } },
];

/* ---------------- geometria ---------------- */
export type Ratio = 'free' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16' | '3:2';
export const RATIO_LIST: { id: Ratio; label: string }[] = [{ id: 'free', label: 'Originale' }, { id: '1:1', label: '1:1' }, { id: '4:5', label: '4:5' }, { id: '3:4', label: '3:4' }, { id: '3:2', label: '3:2' }, { id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }];
export type Geo = { rot90: 0 | 1 | 2 | 3; flip: boolean; /** gradi, -45..45 */ angle: number; ratio: Ratio; /** 1..4 */ zoom: number; /** -1..1: spostamento dentro lo spazio che c'è */ panX: number; panY: number };
export const GEO0: Geo = { rot90: 0, flip: false, angle: 0, ratio: 'free', zoom: 1, panX: 0, panY: 0 };
export const geoEdited = (g: Geo) => g.rot90 !== 0 || g.flip || g.angle !== 0 || g.ratio !== 'free' || g.zoom !== 1 || g.panX !== 0 || g.panY !== 0;
const ratioValue = (r: Ratio): number | null => { if (r === 'free') return null; const [a, b] = r.split(':').map(Number); return a / b; };
/** Misure della foto già ruotata di 90° (rot90 dispari scambia larghezza e altezza). */
export const turned = (iw: number, ih: number, g: Geo) => (g.rot90 % 2 ? { w: ih, h: iw } : { w: iw, h: ih });
/** Misure dell'immagine finale: tiene l'inquadratura scelta, con il lato lungo al massimo `maxSide`. */
export function outputSize(iw: number, ih: number, g: Geo, maxSide: number): { w: number; h: number } {
  const t = turned(iw, ih, g);
  const r = ratioValue(g.ratio) ?? t.w / t.h;
  let w = t.w, h = t.w / r;
  if (h > t.h) { h = t.h; w = t.h * r; }
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
/**
 * Da pixel dell'immagine a pixel dell'uscita: centra, ruota di 90°, specchia, raddrizza di `angle` gradi, ingrandisce quanto basta per
 * non lasciare bordi vuoti, applica zoom e spostamento (limitato allo spazio che c'è).
 */
export function geoMatrix(iw: number, ih: number, g: Geo, ow: number, oh: number): Affine {
  const t = turned(iw, ih, g);
  const th = (g.angle * Math.PI) / 180, cs = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
  const cover = Math.max((ow * cs + oh * sn) / t.w, (ow * sn + oh * cs) / t.h);
  const k = cover * Math.max(1, g.zoom);
  // spazio libero: quanto l'immagine scalata supera l'uscita (nel riferimento ruotato, approssimato sugli assi dell'uscita)
  const slackX = Math.max(0, (t.w * k * cs + t.h * k * sn - ow) / 2 - 0), slackY = Math.max(0, (t.w * k * sn + t.h * k * cs - oh) / 2);
  const px = Math.max(-1, Math.min(1, g.panX)) * Math.max(0, slackX - (t.w * k * sn + 0) * 0), py = Math.max(-1, Math.min(1, g.panY)) * slackY;
  // composizione, dall'esterno all'interno: traslazione, raddrizza, scala, specchio, rotazione di 90°, centro dell'immagine
  const ang = (g.rot90 * Math.PI) / 2;
  const cr = Math.cos(ang), sr = Math.sin(ang), cth = Math.cos(th), sth = Math.sin(th);
  const fx = g.flip ? -1 : 1;
  // M = R(th) * k * F * R90   (parte lineare)
  const r90 = [cr, -sr, sr, cr]; // [m00,m01,m10,m11]
  const F = [fx, 0, 0, 1];
  const mul = (A: number[], B: number[]) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
  const Rth = [cth, -sth, sth, cth];
  const L = mul(mul(Rth, F), r90).map((x) => x * k);
  const e = ow / 2 + px - (L[0] * (iw / 2) + L[1] * (ih / 2));
  const f = oh / 2 + py - (L[2] * (iw / 2) + L[3] * (ih / 2));
  return { a: L[0], c: L[1], b: L[2], d: L[3], e, f };
}
export const applyAffine = (m: Affine, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

/* ---------------- shader ---------------- */
/** Ordine dei valori: deve coincidere con le dichiarazioni «uniform» dello shader (lo controlla un test). */
export const UNIFORM_ORDER: (ParamKey | 'resX' | 'resY' | 'seed')[] = [
  'resX', 'resY', 'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'dehaze', 'temp', 'tint', 'vibrance', 'saturation', 'mono',
  'clarity', 'sharpen', 'grain', 'vignette', 'fade', 'sR', 'sO', 'sY', 'sG', 'sA', 'sB', 'sP', 'sM', 'shHue', 'shAmt', 'hiHue', 'hiAmt', 'seed',
];
/** Valori per lo shader: da -100..100 a -1..1, colori come 0..1. */
export function uniformValues(p: PhotoParams, resX: number, resY: number, seed = 0.37): number[] {
  return UNIFORM_ORDER.map((k) => {
    if (k === 'resX') return resX; if (k === 'resY') return resY; if (k === 'seed') return seed;
    if (k === 'shHue' || k === 'hiHue') return p[k] / 360;
    return p[k] / 100;
  });
}

export const SKSL = `
uniform shader image;
uniform float resX; uniform float resY;
uniform float exposure; uniform float contrast; uniform float highlights; uniform float shadows; uniform float whites; uniform float blacks; uniform float dehaze;
uniform float temp; uniform float tint; uniform float vibrance; uniform float saturation; uniform float mono;
uniform float clarity; uniform float sharpen; uniform float grain; uniform float vignette; uniform float fade;
uniform float sR; uniform float sO; uniform float sY; uniform float sG; uniform float sA; uniform float sB; uniform float sP; uniform float sM;
uniform float shHue; uniform float shAmt; uniform float hiHue; uniform float hiAmt;
uniform float seed;

float lum(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }
float3 rgb2hsv(float3 c) {
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b)); float d = mx - mn;
  float h = 0.0;
  if (d > 0.00001) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h = h / 6.0;
    if (h < 0.0) h += 1.0;
  }
  float s = mx <= 0.00001 ? 0.0 : d / mx;
  return float3(h, s, mx);
}
float3 hsv2rgb(float3 c) {
  float3 p = abs(fract(float3(c.x) + float3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(float3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
float band(float h, float center) {
  float d = abs(h - center); d = min(d, 1.0 - d);
  return max(0.0, 1.0 - d / 0.09);
}
float3 blurAt(float2 xy, float r) {
  float3 s = image.eval(xy).rgb * 4.0;
  s += image.eval(xy + float2(r, 0.0)).rgb * 2.0; s += image.eval(xy - float2(r, 0.0)).rgb * 2.0;
  s += image.eval(xy + float2(0.0, r)).rgb * 2.0; s += image.eval(xy - float2(0.0, r)).rgb * 2.0;
  s += image.eval(xy + float2(r, r) * 0.7071).rgb; s += image.eval(xy + float2(r, -r) * 0.7071).rgb;
  s += image.eval(xy + float2(-r, r) * 0.7071).rgb; s += image.eval(xy - float2(r, r) * 0.7071).rgb;
  return s / 16.0;
}

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  float3 c = float3(src.rgb);
  float k = max(resY, resX) / 1080.0;
  float3 orig = c;

  // foschia
  if (dehaze > 0.0) { c = (c - dehaze * 0.12) / (1.0 - dehaze * 0.12); c = mix(float3(lum(c)), c, 1.0 + dehaze * 0.25); }
  else if (dehaze < 0.0) { c = mix(c, float3(0.72), -dehaze * 0.28); }

  // esposizione, neri e bianchi
  c = c * exp2(exposure * 1.5);
  float bp = -blacks * 0.12; float wp = 1.0 - whites * 0.15;
  c = (c - bp) / max(0.2, wp - bp);

  // luci e ombre (mascherate sulla luminosità)
  float l = clamp(lum(c), 0.0, 1.0);
  float sm = 1.0 - smoothstep(0.0, 0.55, l);
  float hm = smoothstep(0.45, 1.0, l);
  c = c * (1.0 + shadows * 0.7 * sm);
  c = c * (1.0 + highlights * 0.5 * hm);
  c = c + float3(shadows * 0.06 * sm);

  // contrasto
  c = (c - 0.5) * (1.0 + contrast * 0.85) + 0.5;

  // temperatura e tinta
  c.r += temp * 0.12; c.b -= temp * 0.12; c.g += temp * 0.02;
  c.g -= tint * 0.08; c.r += tint * 0.04; c.b += tint * 0.04;

  // dettagli: nitidezza e chiarezza (maschera di contrasto)
  if (sharpen > 0.0) { float3 b1 = blurAt(xy, 1.3 * k); c += (orig - b1) * sharpen * 1.6; }
  if (clarity != 0.0) {
    float3 b2 = blurAt(xy, 7.0 * k); float mid = 4.0 * l * (1.0 - l);
    c += (orig - b2) * clarity * 0.9 * (0.35 + 0.65 * mid);
  }

  // vividezza e saturazione
  float lc = lum(c);
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
  float sat0 = (mx - mn) / max(mx, 0.0001);
  c = mix(float3(lc), c, 1.0 + vibrance * (1.0 - sat0) * 1.1);
  c = mix(float3(lc), c, 1.0 + saturation);

  // saturazione per colore
  float3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float adj = sR * band(hsv.x, 0.0) + sR * band(hsv.x, 1.0) + sO * band(hsv.x, 0.083) + sY * band(hsv.x, 0.167) + sG * band(hsv.x, 0.333)
            + sA * band(hsv.x, 0.5) + sB * band(hsv.x, 0.667) + sP * band(hsv.x, 0.75) + sM * band(hsv.x, 0.875);
  hsv.y = clamp(hsv.y * (1.0 + adj), 0.0, 1.0);
  c = hsv2rgb(hsv);

  // tono di ombre e luci
  float l3 = clamp(lum(c), 0.0, 1.0);
  c += (hsv2rgb(float3(shHue, 1.0, 1.0)) - 0.5) * shAmt * 0.3 * (1.0 - l3);
  c += (hsv2rgb(float3(hiHue, 1.0, 1.0)) - 0.5) * hiAmt * 0.3 * l3;

  // bianco e nero, dissolvenza
  c = mix(c, float3(lum(c)), mono);
  c = mix(c, c * 0.86 + 0.11, fade);

  // vignetta
  float2 uv = xy / float2(resX, resY);
  float dd = distance(uv, float2(0.5)) * 1.4142;
  float vg = smoothstep(0.35, 1.05, dd);
  if (vignette > 0.0) c *= 1.0 - vg * vignette * 0.75; else c = mix(c, float3(1.0), vg * (-vignette) * 0.5);

  // grana
  float n = hash(floor(xy / max(1.0, k)) + float2(seed * 91.7, seed * 33.1)) - 0.5;
  c += n * grain * 0.28 * (0.55 + 0.45 * (1.0 - abs(l3 - 0.5) * 2.0));

  return half4(half3(clamp(c, 0.0, 1.0)), src.a);
}
`;
