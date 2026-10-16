/** Sfondo automatico per i post di sola frase: si usa una foto SOLO se la frase nomina proprio ciò che la foto mostra (es. «cappuccino» → foto di caffè).
 *  Frasi astratte (respirazione, calma, motivazione, riunioni…) non hanno una foto corretta: restano sullo sfondo neutro. Il confronto è sul testo, mai sull'argomento. */
/** parola intera (anche con lettere accentate): nessun \\b, che con «è» non funziona */
const w = (alt: string) => new RegExp(`(?<![\\p{L}])(?:${alt})(?![\\p{L}])`, 'iu');
const BUCKETS: { re: RegExp; keys: string[] }[] = [
  { re: w('caff[eè]|cappuccin\\p{L}*|espresso|cornett\\p{L}*|croissant|colazion\\p{L}*'), keys: ['cappuccino', 'colazione', 'caffeInterno', 'tazzeCaffe', 'caffePalme', 'croissantBianco'] },
  { re: w('pizz\\p{L}*|margherita'), keys: ['pizza', 'pizzaBufala'] },
  { re: w('hamburger|burger|panin\\p{L}*'), keys: ['burgerArdesia', 'burgerViola', 'hamburgerPiatto'] },
  { re: w('birr\\p{L}*|aperitiv\\p{L}*|cocktail|brindis\\p{L}*'), keys: ['aperitivo', 'cocktailScuri', 'brindisiBirra', 'birraPianta'] },
  { re: w('cane|cani|cagnolin\\p{L}*|cucciol\\p{L}*|golden'), keys: ['cucciolo', 'goldenAdulto'] },
  { re: w('asin\\p{L}*|anatr\\p{L}*'), keys: ['asini', 'anatre'] },
  { re: w('ros[ae]|mazzo di fiori'), keys: ['roseRosse'] },
  { re: w('venezia|calle|calli'), keys: ['calleVenezia'] },
  { re: w('duomo|milano'), keys: ['duomo'] },
  { re: w('formula 1|formula uno|gran premio'), keys: ['formulaUno'] },
  { re: w('piscina'), keys: ['piscinaBaldacchino'] },
];
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export function autoBgKey(text: string, _tag?: string): string | null {
  const b = BUCKETS.find((x) => x.re.test(text));
  return b ? b.keys[hash(text) % b.keys.length] : null;
}
