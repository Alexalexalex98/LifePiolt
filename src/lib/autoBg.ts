/** Sfondo automatico per i post di sola frase: LifePilot sceglie una foto adatta al significato (argomento e parole), sempre la stessa per lo stesso testo. Se non c'è una relazione chiara con una foto, restituisce null e resta lo sfondo neutro. */
const BUCKETS: { re: RegExp; keys: string[] }[] = [
  { re: /caff|colazion|cornett|cappucc|espresso|bar\b/i, keys: ['cappuccino', 'colazione', 'caffeInterno', 'tazzeCaffe', 'caffePalme'] },
  { re: /cucin|pizza|cena|pranzo|ricett|mangi|gust|piatto|burger/i, keys: ['pizza', 'pizzaBufala', 'cenaCandele', 'burgerArdesia'] },
  { re: /viagg|vacanz|citt|partenz|volo|mare|lago|montagn|escurs/i, keys: ['tettiMontagna', 'marienplatz', 'calleVenezia', 'finestrino', 'duomo'] },
  { re: /serat|aperitiv|amic|festa|birra|cocktail/i, keys: ['aperitivo', 'cocktailScuri', 'barSera', 'brindisiBirra'] },
  { re: /cane|cani|gatt|animal|natura|parco|passeggiat/i, keys: ['cucciolo', 'goldenAdulto', 'anatre', 'torreBambu'] },
  { re: /corsa|allenament|sport|palestra|fitness|run|gara|formula/i, keys: ['formulaUno', 'spiaggiaFallback'] },
  { re: /casa|design|arredo|libro|leggere|mind|calma|respir|pace|riposo/i, keys: ['poltrone', 'tavolinoFinestra', 'libro', 'androne'] },
  { re: /amor|cuore|grazie|gratitudin|rose|regal/i, keys: ['roseRosse', 'cenaCandele'] },
];
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export function autoBgKey(text: string, tag?: string): string | null {
  const hay = `${tag ?? ''} ${text}`;
  const b = BUCKETS.find((x) => x.re.test(hay));
  const list = (b?.keys ?? []).filter((k) => k !== 'spiaggiaFallback');
  return list.length ? list[hash(text) % list.length] : null;
}
