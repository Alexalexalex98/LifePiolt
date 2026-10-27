/**
 * I tag di LifeDrive: ogni foto o file caricato porta il nome della sezione da cui arriva (Finanza personale, Cibo, Bollette…).
 * Se non si sa cos'è (per esempio arriva da una chat) lo si capisce dal nome o, con il tuo consenso, guardando il contenuto, e poi si tagga.
 * Modulo PURO.
 */
export const DRIVE_TAGS = [
  'Finanza personale', 'Bollette', 'Fisco', 'Scontrini', 'Cibo', 'Frigo', 'Salute', 'Allenamento', 'Corpo', 'Lavoro',
  'Documenti', 'Viaggi', 'Casa', 'Task', 'Progetti', 'Chat', 'Caricate da Theia', 'Caricate da te', 'Altro',
] as const;
export type DriveTag = (typeof DRIVE_TAGS)[number];

/** Da quale punto dell'app arriva il file → tag (quello che l'app sa già senza guardare il contenuto). */
export const SOURCE_TAG: Record<string, DriveTag> = {
  Pasto: 'Cibo', Frigo: 'Frigo', Scontrino: 'Scontrini', 'Estratto conto': 'Finanza personale', Bolletta: 'Bollette', Fisco: 'Fisco',
  Esercizio: 'Allenamento', Corpo: 'Corpo', Task: 'Task', Progetti: 'Progetti', Chat: 'Chat', Theia: 'Caricate da Theia', Lavoro: 'Lavoro',
};
export const tagForSource = (from: string): DriveTag => SOURCE_TAG[from] ?? 'Caricate da te';

/** Tag di cui non ci si fida: dicono solo da dove arriva il file, non cos'è. Per questi vale la pena capire il contenuto. */
export const GENERIC_TAGS: readonly string[] = ['Chat', 'Caricate da te', 'Caricate da Theia', 'Altro'];

const BY_NAME: [RegExp, DriveTag][] = [
  [/estratto conto|movimenti|\bcsv\b|conto corrente|iban/i, 'Finanza personale'],
  [/bolletta|luce|gas\b|acqua potabile|energia|telefono|internet|canone|fattura/i, 'Bollette'],
  [/730|dichiarazione|fisco|imposte|tasse|f24|cu\b|certificazione unica/i, 'Fisco'],
  [/scontrino|ricevuta|receipt/i, 'Scontrini'],
  [/referto|analisi|esame|medic|cassa malati|ricetta|visita|vaccin/i, 'Salute'],
  [/busta paga|stipendio|contratto di lavoro|colloquio|cv\b|curriculum|lavoro/i, 'Lavoro'],
  [/contratto|locazione|affitto|passaporto|carta d.identit|patente|documento/i, 'Documenti'],
  [/volo|biglietto|prenotazione|hotel|albergo|viaggio|boarding/i, 'Viaggi'],
  [/pasto|cena|pranzo|colazione|piatto|ricetta/i, 'Cibo'],
  [/frigo|dispensa/i, 'Frigo'],
  [/allenamento|palestra|workout|esercizio/i, 'Allenamento'],
  [/casa|condominio|mutuo|arredo/i, 'Casa'],
];
/** Un'ipotesi dal solo nome del file (gratis, sul telefono). null se il nome non dice niente. */
export function guessTagFromName(name: string): DriveTag | null {
  const n = String(name ?? '');
  for (const [re, tag] of BY_NAME) if (re.test(n)) return tag;
  return null;
}

/** Richiesta all'AI per capire una foto o un documento: una sola parola scelta dall'elenco. */
export const TAG_PROMPT = `Guarda questo file e dimmi di cosa si tratta. Rispondi con UNA SOLA etichetta scelta da questo elenco, esattamente com'è scritta, senza altro testo: ${DRIVE_TAGS.filter((t) => !GENERIC_TAGS.includes(t) || t === 'Altro').join(', ')}. Usa «Altro» solo se nessuna etichetta va bene.`;

/** Dalla risposta dell'AI all'etichetta (tollera maiuscole, punteggiatura e frasi attorno). null se non ne riconosce nessuna. */
export function parseTag(reply: string): DriveTag | null {
  const r = String(reply ?? '').toLowerCase();
  let best: { t: DriveTag; at: number } | null = null;
  for (const t of DRIVE_TAGS) {
    if (GENERIC_TAGS.includes(t) && t !== 'Altro') continue;
    const at = r.indexOf(t.toLowerCase());
    if (at >= 0 && (!best || at < best.at)) best = { t, at };
  }
  return best?.t ?? null;
}
