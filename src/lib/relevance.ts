/**
 * Rilevanza per l'utente (modulo PURO, nessun alias '@/'): ogni contenuto (prodotto, seminario, servizio, club) riceve dei temi dal testo
 * e viene ordinato in base a ciò che interessa alla persona. Chi ama le scarpe vede più scarpe che sedute con la psicologa;
 * chi ama le scarpe da corsa vede sia le scarpe sia i corsi di corsa (stesso tema "corsa").
 * Il funzionamento non è mostrato agli utenti.
 */
export type Theme = 'corsa' | 'scarpe' | 'sport' | 'cucina' | 'viaggi' | 'soldi' | 'salute' | 'mente' | 'lingue' | 'studio' | 'tech' | 'casa' | 'moda' | 'musica' | 'natura' | 'lavoro';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Parole che fanno riconoscere un tema (radici, senza accenti). */
const KEYWORDS: Record<Theme, RegExp> = {
  corsa: /\b(corsa|corr\w*|running|maratona|jogging|\d+\s?km|trail)/,
  scarpe: /\b(scarp\w*|sneaker\w*|calzatur\w*|stivali|sandali)/,
  sport: /\b(sport\w*|palestra|allenament\w*|fitness|yoga|nuoto|ciclismo|bici\w*|calcio|tennis|corsa|corr\w*|escursion\w*)/,
  cucina: /\b(cucin\w*|ricett\w*|cen[ae]|pranzo|meal prep|cibo|alimentar\w*|nutrizion\w*|chef)/,
  viaggi: /\b(viagg\w*|vacanz\w*|volo|hotel|itinerar\w*|turismo|weekend)/,
  soldi: /\b(soldi|budget|risparm\w*|investi\w*|fisc\w*|tasse|dichiarazion\w*|finanz\w*|mutuo|pension\w*)/,
  salute: /\b(salute|medic\w*|sonno|dormire|primo soccorso|fisioterap\w*|dolore|ginocchio|alimentazione)/,
  mente: /\b(psicolog\w*|mindful\w*|stress|ansia|meditazion\w*|respirazion\w*|benessere mentale|terapia|seduta|sedute)/,
  lingue: /\b(lingu\w*|inglese|spagnolo|francese|tedesco|conversazion\w*|vocabolari\w*)/,
  studio: /\b(corso|lezion\w*|imparare|studio|esame|tesi|quadern\w*|penn\w*|agenda)/,
  tech: /\b(tecnolog\w*|app|software|programm\w*|computer|telefon\w*|\bai\b|digitale)/,
  casa: /\b(casa|arredo|giardin\w*|pulizi\w*|famigli\w*|borraccia|zaino)/,
  moda: /\b(moda|abbigliament\w*|vestit\w*|giacca|calze|stile|outfit)/,
  musica: /\b(music\w*|chitarra|piano|concert\w*|canto)/,
  natura: /\b(natura|montagna|parco|giardin\w*|escursion\w*|trekking)/,
  lavoro: /\b(lavor\w*|carriera|colloquio|cv|curriculum|azienda|produttiv\w*|organizzar\w*|riunion\w*)/,
};
export const THEMES = Object.keys(KEYWORDS) as Theme[];

/** Temi di un testo. */
export function themesOf(text: string): Theme[] {
  const t = norm(text);
  return THEMES.filter((k) => KEYWORDS[k].test(t));
}

/** Pesi dei temi dell'utente: interessi dichiarati, cose a cui ha messo mi piace, aperto o comprato. */
export type ThemeWeights = Partial<Record<Theme, number>>;
export function addSignal(weights: ThemeWeights | undefined, text: string, strength: number): ThemeWeights {
  const out: ThemeWeights = { ...(weights ?? {}) };
  for (const th of themesOf(text)) out[th] = Math.min(60, (out[th] ?? 0) + strength);
  return out;
}
export const SIGNAL = { like: 1, open: 2, buy: 4, interest: 3 } as const;

export type Rankable = { id: string; text: string };

/** Punteggio di un contenuto: somma dei pesi dei suoi temi (i temi più amati contano di più). */
export function scoreOf(text: string, weights: ThemeWeights | undefined): number {
  const w = weights ?? {};
  return themesOf(text).reduce((a, th) => a + (w[th] ?? 0), 0);
}

/**
 * Ordina per rilevanza, ma senza far sparire i tipi: ogni 3 contenuti, se serve, ne inserisce uno di un altro tipo con punteggio positivo,
 * così chi ama le scarpe vede anche i corsi di corsa. A parità di punteggio resta l'ordine di partenza.
 */
export function rankMixed<T extends { kind: string; text: string }>(items: T[], weights: ThemeWeights | undefined): T[] {
  const scored = items.map((x, i) => ({ x, i, s: scoreOf(x.text, weights) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const out: typeof scored = [];
  const rest = [...scored];
  while (rest.length) {
    const lastTwo = out.slice(-2).map((v) => v.x.kind);
    const sameRun = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];
    let pick = 0;
    if (sameRun) {
      const alt = rest.findIndex((v) => v.x.kind !== lastTwo[1] && v.s > 0);
      if (alt >= 0) pick = alt;
    }
    out.push(rest.splice(pick, 1)[0]);
  }
  return out.map((v) => v.x);
}
