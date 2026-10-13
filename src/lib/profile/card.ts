/**
 * Biglietto da visita: modello della composizione (fronte e retro), contenuto consentito e geometria. Modulo PURO, testato in
 * tests/profileCard.test.mjs.
 *
 * Formato reale 85 x 55 mm (proporzione 85:55). Gli elementi si posizionano in coordinate normalizzate 0..1 rispetto alla card.
 * CONTENUTO CONSENTITO: solo nome, ruolo dichiarato, attività collegata, competenze principali (max 5, solo quelle dichiarate),
 * contatti scelti dall'utente (email e telefono opzionali, controllati da "Cosa condivido"). Niente scuole, titoli di studio,
 * storico lavorativo, età, indirizzo: i campi legacy (schools, experience, companyComments, residence, birthYear) restano nello
 * store ma sono ignorati qui ("migrazione silenziosa").
 */

export const CARD_W_MM = 85, CARD_H_MM = 55;
export const CARD_RATIO = CARD_W_MM / CARD_H_MM;
export const MAX_ELEMENTS = 40;
export const MAX_STROKES = 200;
export const MAX_POINTS = 600;

export type FieldId = 'name' | 'role' | 'business' | 'skills' | 'email' | 'phone';
export const FIELD_LABEL: Record<FieldId, string> = { name: 'Nome', role: 'Ruolo', business: 'Attività', skills: 'Competenze', email: 'Email', phone: 'Telefono' };
export type FontId = 'sans' | 'serif' | 'mono' | 'rounded';
export const FONTS: { id: FontId; label: string }[] = [{ id: 'sans', label: 'Moderno' }, { id: 'serif', label: 'Classico' }, { id: 'mono', label: 'Tecnico' }, { id: 'rounded', label: 'Morbido' }];

/** rot: rotazione in gradi; op: opacità 0.1..1 (come in Canva) */
type Pos = { x: number; y: number; rot?: number; op?: number };
export type FieldEl = Pos & { id: string; t: 'field'; field: FieldId; size: number; color: string; font: FontId; bold?: boolean };
export type TextEl = Pos & { id: string; t: 'text'; text: string; size: number; color: string; font: FontId; bold?: boolean };
export type ImageEl = Pos & { id: string; t: 'image'; uri: string; w: number; round?: boolean };
export type ShapeEl = Pos & { id: string; t: 'shape'; shape: 'rect' | 'circle' | 'line'; w: number; h: number; color: string };
export type QrEl = Pos & { id: string; t: 'qr'; w: number; color: string };
export type El = FieldEl | TextEl | ImageEl | ShapeEl | QrEl;
export type Stroke = { color: string; width: number; pts: [number, number][] };
export type Bg = { kind: 'solid' | 'gradient'; c1: string; c2: string; angle: number };
export type Side = { bg: Bg; els: El[]; strokes: Stroke[] };
export type CardDesign = { v: 2; template: string; front: Side; back: Side; /** competenze scelte per il biglietto (id) */ skills?: string[]; /** mostra il QR sul retro */ qr: boolean };

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const color = (c: unknown, d: string) => (typeof c === 'string' && COLOR_RE.test(c) ? c : d);

export const TEMPLATES: { id: string; label: string }[] = [
  { id: 'classico', label: 'Classico' }, { id: 'minimale', label: 'Minimale' }, { id: 'centrato', label: 'Centrato' }, { id: 'banda', label: 'Banda' }, { id: 'scuro', label: 'Notte' }, { id: 'foto', label: 'Con foto' },
];
let _n = 0;
export const newElId = () => `e${Date.now().toString(36)}${(_n++).toString(36)}`;
const f = (field: FieldId, x: number, y: number, size: number, c: string, font: FontId = 'sans', bold = false): FieldEl => ({ id: newElId(), t: 'field', field, x, y, size, color: c, font, bold });

export function templateDesign(template: string, accent = '#6c8cff'): CardDesign {
  const solid = (c: string): Bg => ({ kind: 'solid', c1: c, c2: c, angle: 0 });
  const back = (bg: Bg, ink: string): Side => ({ bg, els: [f('business', 0.08, 0.14, 15, ink, 'sans', true), f('skills', 0.08, 0.34, 11, ink), f('email', 0.08, 0.74, 10, ink), f('phone', 0.08, 0.84, 10, ink)], strokes: [] });
  switch (template) {
    case 'minimale': return { v: 2, template, qr: false, front: { bg: solid('#ffffff'), els: [f('name', 0.08, 0.38, 20, '#111111', 'sans', true), f('role', 0.08, 0.56, 12, '#555555')], strokes: [] }, back: back(solid('#ffffff'), '#111111') };
    case 'centrato': return { v: 2, template, qr: false, front: { bg: solid('#f5f1e8'), els: [f('name', 0.2, 0.34, 20, '#2a2a2a', 'serif', true), f('role', 0.2, 0.54, 12, '#6a6254', 'serif'), f('business', 0.2, 0.7, 11, '#6a6254', 'serif')], strokes: [] }, back: back(solid('#f5f1e8'), '#2a2a2a') };
    case 'banda': return { v: 2, template, qr: false, front: { bg: solid('#ffffff'), els: [{ id: newElId(), t: 'shape', shape: 'rect', x: 0, y: 0, w: 1, h: 0.28, color: accent }, f('name', 0.08, 0.4, 19, '#111111', 'sans', true), f('role', 0.08, 0.6, 12, '#444444'), f('business', 0.08, 0.76, 11, '#444444')], strokes: [] }, back: back(solid('#ffffff'), '#111111') };
    case 'scuro': return { v: 2, template, qr: false, front: { bg: { kind: 'gradient', c1: '#141a2b', c2: '#2a1f4a', angle: 135 }, els: [f('name', 0.08, 0.34, 20, '#ffffff', 'sans', true), f('role', 0.08, 0.54, 12, '#c9b6ff'), f('business', 0.08, 0.74, 11, '#aab3c8')], strokes: [] }, back: back({ kind: 'gradient', c1: '#141a2b', c2: '#2a1f4a', angle: 135 }, '#ffffff') };
    case 'foto': return { v: 2, template, qr: false, front: { bg: solid('#ffffff'), els: [{ id: newElId(), t: 'shape', shape: 'circle', x: 0.06, y: 0.2, w: 0.3, h: 0.3 * CARD_RATIO, color: accent }, f('name', 0.42, 0.3, 17, '#111111', 'sans', true), f('role', 0.42, 0.5, 11, '#444444'), f('business', 0.42, 0.66, 10, '#444444')], strokes: [] }, back: back(solid('#ffffff'), '#111111') };
    default: return { v: 2, template: 'classico', qr: false, front: { bg: { kind: 'gradient', c1: accent, c2: '#3b2a7a', angle: 135 }, els: [f('name', 0.08, 0.36, 21, '#ffffff', 'sans', true), f('role', 0.08, 0.58, 12.5, '#e6e1ff'), f('business', 0.08, 0.76, 11, '#e6e1ff')], strokes: [] }, back: back({ kind: 'solid', c1: '#ffffff', c2: '#ffffff', angle: 0 }, '#111111') };
  }
}

const FIELD_IDS = Object.keys(FIELD_LABEL) as FieldId[];
const FONT_IDS = FONTS.map((x) => x.id);
function sanitizeEl(e: unknown): El | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const base = { id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : newElId(), x: clamp(o.x as number, 0, 1), y: clamp(o.y as number, 0, 1), ...(Number(o.rot) ? { rot: Math.round(clamp(o.rot as number, -180, 180)) } : {}), ...(typeof o.op === 'number' && o.op < 1 ? { op: Math.round(clamp(o.op, 0.1, 1) * 100) / 100 } : {}) };
  if (o.t === 'field' && FIELD_IDS.includes(o.field as FieldId)) return { ...base, t: 'field', field: o.field as FieldId, size: clamp(o.size as number, 7, 40), color: color(o.color, '#111111'), font: FONT_IDS.includes(o.font as FontId) ? (o.font as FontId) : 'sans', bold: !!o.bold };
  if (o.t === 'text' && typeof o.text === 'string') return { ...base, t: 'text', text: o.text.slice(0, 80), size: clamp(o.size as number, 7, 40), color: color(o.color, '#111111'), font: FONT_IDS.includes(o.font as FontId) ? (o.font as FontId) : 'sans', bold: !!o.bold };
  if (o.t === 'image' && typeof o.uri === 'string' && o.uri) return { ...base, t: 'image', uri: o.uri, w: clamp(o.w as number, 0.08, 1), round: !!o.round };
  if (o.t === 'shape' && ['rect', 'circle', 'line'].includes(o.shape as string)) return { ...base, t: 'shape', shape: o.shape as ShapeEl['shape'], w: clamp(o.w as number, 0.02, 1), h: clamp(o.h as number, 0.005, 1), color: color(o.color, '#6c8cff') };
  if (o.t === 'qr') return { ...base, t: 'qr', w: clamp(o.w as number, 0.12, 0.5), color: color(o.color, '#111111') };
  return null;
}
function sanitizeSide(s: unknown, d: Side): Side {
  if (!s || typeof s !== 'object') return d;
  const o = s as Record<string, unknown>;
  const bg = (o.bg ?? {}) as Record<string, unknown>;
  const strokes: Stroke[] = (Array.isArray(o.strokes) ? o.strokes : []).slice(0, MAX_STROKES).map((k) => {
    const r = (k ?? {}) as Record<string, unknown>;
    const pts = (Array.isArray(r.pts) ? r.pts : []).slice(0, MAX_POINTS).map((p) => (Array.isArray(p) ? [clamp(p[0], 0, 1), clamp(p[1], 0, 1)] as [number, number] : null)).filter((p): p is [number, number] => !!p);
    return { color: color(r.color, '#111111'), width: clamp(r.width as number, 1, 24), pts };
  }).filter((k) => k.pts.length > 0);
  return {
    bg: { kind: bg.kind === 'gradient' ? 'gradient' : 'solid', c1: color(bg.c1, d.bg.c1), c2: color(bg.c2, d.bg.c2), angle: clamp(bg.angle as number, 0, 360) },
    els: (Array.isArray(o.els) ? o.els : []).slice(0, MAX_ELEMENTS).map(sanitizeEl).filter((e): e is El => !!e),
    strokes,
  };
}
/** Legge un disegno salvato (anche vuoto o corrotto): restituisce sempre un modello valido. */
export function sanitizeDesign(raw: unknown, accent?: string): CardDesign {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = templateDesign(typeof o.template === 'string' ? o.template : 'classico', accent);
  if (o.v !== 2) return d;
  return { v: 2, template: d.template, qr: !!o.qr, front: sanitizeSide(o.front, d.front), back: sanitizeSide(o.back, d.back), skills: Array.isArray(o.skills) ? o.skills.filter((x): x is string => typeof x === 'string').slice(0, 5) : undefined };
}

/** Dati che possono comparire sul biglietto. Qualunque altro campo del vecchio biglietto viene ignorato. */
export type CardData = { name: string; role: string; business: string; skills: string[]; email: string; phone: string };
export const ALLOWED_KEYS: (keyof CardData)[] = ['name', 'role', 'business', 'skills', 'email', 'phone'];
type LegacyCard = Record<string, unknown>;
export function buildCardData(input: { name: string; legacy?: LegacyCard; role?: string; business?: string; skills?: string[]; shareEmail: boolean; sharePhone: boolean; email?: string; phone?: string }): CardData {
  const l = input.legacy ?? {};
  const role = (input.role ?? (typeof l.profession === 'string' ? l.profession : '')).trim();
  return {
    name: input.name.trim(),
    role: l.showProfession === false && input.role == null ? '' : role,
    business: (input.business ?? '').trim(),
    skills: (input.skills ?? []).slice(0, 5),
    email: input.shareEmail ? (input.email ?? (typeof l.email === 'string' ? l.email : '')).trim() : '',
    phone: input.sharePhone ? (input.phone ?? (typeof l.phone === 'string' ? l.phone : '')).trim() : '',
  };
}
export function fieldText(f: FieldId, d: CardData): string {
  return f === 'skills' ? d.skills.join(' · ') : d[f];
}

/** Tratto -> comando path SVG (smussato con punti medi). Coordinate in unità di vista. */
export function strokePath(pts: [number, number][], w: number, h: number): string {
  if (!pts.length) return '';
  const P = pts.map(([x, y]) => [x * w, y * h]);
  const r = (n: number) => Math.round(n * 10) / 10;
  if (P.length === 1) return `M${r(P[0][0])} ${r(P[0][1])}l0.01 0.01`;
  let d = `M${r(P[0][0])} ${r(P[0][1])}`;
  for (let i = 1; i < P.length - 1; i++) d += `Q${r(P[i][0])} ${r(P[i][1])} ${r((P[i][0] + P[i + 1][0]) / 2)} ${r((P[i][1] + P[i + 1][1]) / 2)}`;
  const last = P[P.length - 1];
  return d + `L${r(last[0])} ${r(last[1])}`;
}

/** Cronologia con annulla / ripristina per i tratti. */
export type History<T> = { past: T[]; present: T; future: T[] };
export const hist = <T,>(present: T): History<T> => ({ past: [], present, future: [] });
export const commit = <T,>(h: History<T>, next: T): History<T> => ({ past: [...h.past, h.present].slice(-50), present: next, future: [] });
export const undo = <T,>(h: History<T>): History<T> => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
export const redo = <T,>(h: History<T>): History<T> => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);


/* ---------- modifica da editor grafico: livelli, duplicati, allineamento, resize ---------- */
export type LayerMove = 'front' | 'back' | 'forward' | 'backward';
/** Sposta un elemento tra i livelli (l'ultimo sta sopra). */
export function moveLayer(els: El[], id: string, how: LayerMove): El[] {
  const i = els.findIndex((e) => e.id === id);
  if (i < 0) return els;
  const out = els.slice(); const [e] = out.splice(i, 1);
  const to = how === 'front' ? out.length : how === 'back' ? 0 : how === 'forward' ? Math.min(out.length, i + 1) : Math.max(0, i - 1);
  out.splice(to, 0, e);
  return out;
}
/** Copia un elemento un po' più in basso a destra (i campi del profilo non si duplicano: ne basta uno). */
export function duplicateEl(els: El[], id: string): { els: El[]; id: string | null } {
  const e = els.find((x) => x.id === id);
  if (!e || e.t === 'field' || e.t === 'qr' || els.length >= MAX_ELEMENTS) return { els, id: null };
  const nid = newElId();
  return { els: [...els, { ...e, id: nid, x: clamp(e.x + 0.04, 0, 0.95), y: clamp(e.y + 0.06, 0, 0.95) }], id: nid };
}
/** Larghezza stimata dell'elemento (0..1 della card), per centrarlo. */
export function elWidth(e: El, text = ''): number {
  if (e.t === 'image' || e.t === 'shape' || e.t === 'qr') return e.w;
  const chars = Math.max(1, (e.t === 'text' ? e.text : text).length);
  return Math.min(0.95, (chars * e.size * 0.56) / 320);
}
export function elHeight(e: El): number {
  if (e.t === 'shape') return e.h;
  if (e.t === 'image' || e.t === 'qr') return e.w * CARD_RATIO;
  return (e.size * 1.25) / (320 / CARD_RATIO);
}
export type AlignTo = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export function alignEl(e: El, to: AlignTo, text = ''): Partial<El> {
  const w = elWidth(e, text), h = elHeight(e);
  switch (to) {
    case 'left': return { x: 0.06 };
    case 'hcenter': return { x: clamp((1 - w) / 2, 0, 1) };
    case 'right': return { x: clamp(0.94 - w, 0, 1) };
    case 'top': return { y: 0.06 };
    case 'vcenter': return { y: clamp((1 - h) / 2, 0, 1) };
    default: return { y: clamp(0.94 - h, 0, 1) };
  }
}
/** Ridimensiona (fattore > 0): testi e campi cambiano corpo, le altre cose la larghezza (le forme in proporzione). */
export function scaleEl(e: El, factor: number): Partial<El> {
  if (e.t === 'field' || e.t === 'text') return { size: clamp(e.size * factor, 7, 40) } as Partial<El>;
  if (e.t === 'shape') { const w = clamp(e.w * factor, 0.02, 1); return { w, h: e.shape === 'line' ? e.h : clamp(e.h * (w / e.w), 0.005, 1) } as Partial<El>; }
  if (e.t === 'qr') return { w: clamp(e.w * factor, 0.12, 0.5) } as Partial<El>;
  return { w: clamp(e.w * factor, 0.08, 1) } as Partial<El>;
}
/** Rotazione con aggancio a 0, 90, 180 entro 4 gradi. */
export function snapRot(deg: number): number {
  const d = ((Math.round(deg) + 540) % 360) - 180;
  for (const a of [-180, -90, 0, 90, 180]) if (Math.abs(d - a) <= 4) return a === 180 ? -180 : a;
  return d;
}
