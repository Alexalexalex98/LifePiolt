/**
 * Il colore principale «in corso», per i punti dell'app che non usano l'hook del tema (testi in linea, badge).
 * `useTheme` lo aggiorna ogni volta che la tavolozza cambia.
 */
let accent = '#8fa4ff';
let sections: 'original' | 'accent' = 'original';
export const setLiveTheme = (a: string, s?: 'original' | 'accent') => { accent = a; sections = s === 'accent' ? 'accent' : 'original'; };
export const liveAccent = () => accent;
/** Colore di una sezione: il suo (identità) oppure, se scelto, quello principale dell'utente. */
export const sectionColor = (original: string | undefined, fallback?: string) => (sections === 'accent' ? accent : original ?? fallback ?? accent);
export const TEXT_SCALES: { id: number; label: string }[] = [{ id: 0.9, label: 'Piccolo' }, { id: 1, label: 'Normale' }, { id: 1.12, label: 'Grande' }, { id: 1.25, label: 'Molto grande' }];
/** Fattore finale dei testi: la scelta dell'utente se c'è, altrimenti «Testo più grande» dell'accessibilità. */
export const textFactor = (custom: number | undefined, textLg: boolean, lgScale: number) => { const c = custom && custom >= 0.8 && custom <= 1.4 ? custom : undefined; return c ?? (textLg ? lgScale : 1); };
