/** La mascotte di Theia (modulo PURO): colori derivati dal colore dell'app ed elenco delle espressioni. */
export type Expression = 'neutral' | 'happy' | 'thinking' | 'understood' | 'doubtful' | 'celebrating' | 'sleepy' | 'surprised' | 'sad' | 'working'
  | 'love' | 'laughing' | 'wink' | 'angry' | 'crying' | 'blushing' | 'cool' | 'sleeping' | 'confused' | 'idea' | 'proud' | 'shy' | 'excited' | 'nervous' | 'thanks' | 'goodbye';
export const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: 'neutral', label: 'Neutra' }, { id: 'happy', label: 'Felice' }, { id: 'thinking', label: 'Pensa' }, { id: 'understood', label: 'Ha capito' }, { id: 'doubtful', label: 'Ha un dubbio' },
  { id: 'celebrating', label: 'Festeggia' }, { id: 'sleepy', label: 'Assonnata' }, { id: 'surprised', label: 'Sorpresa' }, { id: 'sad', label: 'Triste' }, { id: 'working', label: 'Al lavoro' },
  { id: 'love', label: 'Innamorata' }, { id: 'laughing', label: 'Ride' }, { id: 'wink', label: 'Occhiolino' }, { id: 'angry', label: 'Arrabbiata' }, { id: 'crying', label: 'Piange' }, { id: 'blushing', label: 'Arrossisce' },
  { id: 'cool', label: 'Cool' }, { id: 'sleeping', label: 'Dorme' }, { id: 'confused', label: 'Confusa' }, { id: 'idea', label: 'Ha un\'idea' }, { id: 'proud', label: 'Orgogliosa' }, { id: 'shy', label: 'Timida' },
  { id: 'excited', label: 'Emozionata' }, { id: 'nervous', label: 'Nervosa' }, { id: 'thanks', label: 'Grazie' }, { id: 'goodbye', label: 'Ciao' },
];

type RGB = [number, number, number];
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
export const parseHex = (hex: string): RGB => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; };
export const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('')}`;
/** Mescola due colori: t=0 è `a`, t=1 è `b`. */
export const mix = (a: string, b: string, t: number): string => { const x = parseHex(a), y = parseHex(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); };

/** Le tre tinte del corpo (luce, base, ombra) e il bagliore, a partire dal colore scelto. Il corpo è bianco-grigio con una velatura di colore, così resta leggibile con ogni colore. */
export function bodyTones(color: string): { light: string; base: string; shade: string; glow: string; eye: string } {
  const base = mix('#ffffff', color, 0.5);
  return { light: mix('#ffffff', color, 0.1), base, shade: mix(color, '#0b0d12', 0.22), glow: color, eye: mix(color, '#0b0d12', 0.86) };
}

/** L'espressione che Theia fa leggendo la sua risposta: dubbio se non sa o non può, «capito» se ha fatto qualcosa, felice altrimenti. */
export function moodOf(text: string | undefined): Expression {
  const x = (text ?? '').toLowerCase();
  if (/\b(non so|non ho (trovato|dati|abbastanza)|non posso|non riesco|non sono sicura|non sono sicuro|mi manca|non ci sono dati)\b/.test(x)) return 'doubtful';
  if (/\b(ho (aggiunto|salvato|creato|preparato|segnato|spostato|inviato)|fatto|aggiunt[oa]|salvat[oa])\b/.test(x)) return 'understood';
  if (/\b(attenzione|errore|problema|scadut[oa]|in rosso)\b/.test(x)) return 'sad';
  return 'happy';
}

/** «Theia, fai un adesivo che festeggia»: dalla descrizione scelgo espressione ed eventualmente colore (regole semplici, niente AI: gratis e sempre uguale). */
const MOODS: [RegExp, Expression][] = [
  [/\b(ti voglio bene|amore|cuore|innamorat|love|heart|adoro)/, 'love'], [/\b(rid[eo]|ahah|lol|divertent|laugh|funny)/, 'laughing'], [/\b(occhiolino|wink|scherz)/, 'wink'],
  [/\b(arrabbiat|furios|angry|mad|rabbia)/, 'angry'], [/\b(piang|triste|sad|cry|dispiac)/, 'sad'], [/\b(arross|imbarazz|blush)/, 'blushing'], [/\b(cool|figo|occhiali|sunglasses)/, 'cool'],
  [/\b(dorm|nanna|buonanotte|sleep|night)/, 'sleeping'], [/\b(confus|boh|non capisco|confused)/, 'confused'], [/\b(idea|intuizione|lampadina)/, 'idea'], [/\b(orgogli|proud|bravo|brava)/, 'proud'],
  [/\b(timid|shy|vergogn)/, 'shy'], [/\b(emozionat|entusiast|excited|wow|stell)/, 'excited'], [/\b(nervos|ansia|paura|nervous)/, 'nervous'], [/\b(grazie|thanks|thank)/, 'thanks'], [/\b(ciao|addio|bye|arrivederci|saluto)/, 'goodbye'],
  [/\b(festegg|brindisi|party|complean|celebrat|evviva)/, 'celebrating'], [/\b(sorpres|incredibile|surpris|shock)/, 'surprised'], [/\b(pensa|penso|dubbio|thinking|mmm)/, 'thinking'], [/\b(capito|ok|perfetto|understood|chiaro)/, 'understood'],
  [/\b(lavor|work|studi)\w*\b/, 'working'], [/\b(sonno|stanc|sleepy|tired)/, 'sleepy'], [/\b(felice|content|happy|bene)/, 'happy'],
];
const COLORS: [RegExp, string][] = [[/\b(rosso|red)\b/, '#ff5a5f'], [/\b(blu|azzurro|blue)\b/, '#4aa8ff'], [/\b(verde|green)\b/, '#3ddc97'], [/\b(giallo|oro|yellow|gold)\b/, '#ffc940'], [/\b(rosa|pink)\b/, '#ff7ab8'], [/\b(viola|purple)\b/, '#a98bff'], [/\b(arancio|orange)\b/, '#ff9d6e']];
export function stickerFromText(text: string): { expr: Expression; color?: string; matched: boolean } {
  const x = text.toLowerCase();
  const m = MOODS.find(([re]) => re.test(x));
  const c = COLORS.find(([re]) => re.test(x));
  return { expr: m?.[1] ?? 'happy', ...(c ? { color: c[1] } : {}), matched: !!m };
}
