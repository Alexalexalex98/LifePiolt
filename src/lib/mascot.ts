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
