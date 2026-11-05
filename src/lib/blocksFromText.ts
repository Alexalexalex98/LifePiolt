/** Un testo a righe in blocchi di pagina (modulo PURO, nessun alias '@/'). */
const HEADS = /^(Cosa va bene|Cosa preoccupa|Che cosa fare|Decisioni|Da fare|Domande aperte|Date e numeri|Ordine del giorno|In sintesi|Sviluppo|Prossimi passi|Voci|Uscite per categoria|Descrizione · Quantità · Prezzo · Importo)$/;
export type BlockSpec = { t: 'p' | 'h' | 'bullet'; text: string };
/** Un testo a righe diventa blocchi chiari: i titoli noti aprono una sezione, le righe «- …» sono punti di un elenco, il resto è testo. */
export function linesToBlocks(text: string): BlockSpec[] {
  const out: BlockSpec[] = [];
  for (const raw of text.split('\n')) { const l = raw.replace(/\s+$/, ''); if (!l.trim()) continue; out.push(HEADS.test(l.trim()) ? { t: 'h', text: l.trim() } : l.startsWith('- ') ? { t: 'bullet', text: l.slice(2) } : { t: 'p', text: l }); }
  return out;
}
