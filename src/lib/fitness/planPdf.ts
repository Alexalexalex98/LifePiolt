/** Piano alimentare da un PDF del nutrizionista (modulo PURO): prompt per l'AI e lettura della risposta. Il resto lo fa lo stesso lettore dei piani di Theia. */
export const PLAN_PDF_PROMPT = (text: string): string => `Questo e' il testo di un piano alimentare scritto da un nutrizionista. Trascrivilo FEDELMENTE in JSON, senza inventare niente e senza giudicarlo: tutti i pasti (colazione, spuntino, pranzo, merenda, cena), tutti gli alimenti e le quantita' in grammi. Se una quantita' e' in cucchiai, pezzi o porzioni convertila in grammi con valori normali. Se il piano ha opzioni alternative per lo stesso pasto (opzione A, B, C) o piu' settimane, distribuiscile sui 7 giorni in modo che ogni giorno abbia un'opzione diversa, partendo dalla prima. Se il piano non distingue i giorni, usa gli stessi pasti ripetuti variando le opzioni. Per ogni ingrediente dai anche i valori per 100 g (kcal, proteine, carboidrati, grassi). Rispondi SOLO con JSON valido, niente altro testo, in questo formato: {"titolo":"nome del piano","kcal":calorie al giorno se indicate,"note":"indicazioni generali del nutrizionista in 2-3 frasi (acqua, cotture, cibi da limitare)","giorni":[{"g":0,"pasti":[{"s":"colazione|spuntino|pranzo|merenda|cena","n":"nome del piatto","ric":"preparazione se indicata","i":[{"n":"ingrediente","g":grammi,"k":kcal per 100 g,"p":proteine per 100 g,"c":carboidrati per 100 g,"f":grassi per 100 g}]}]}]} con g da 0 (lunedi') a 6 (domenica).\n\nTESTO DEL PIANO:\n${text.slice(0, 14000)}`;

/** Il JSON della risposta (anche dentro un blocco di codice). */
export function parsePlanReply(reply: string): unknown | null {
  const m = /\{[\s\S]*\}/.exec(reply ?? ''); if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/** Il testo del PDF sembra un piano alimentare? (parole tipiche: pasti, grammi, nutrizionista) */
export function looksLikeDietPlan(text: string): boolean {
  const t = text.toLowerCase();
  const hits = ['colazione', 'pranzo', 'cena', 'spuntino', 'merenda', 'nutrizionista', 'dietista', 'piano alimentare', 'dieta', 'grammi', ' gr', ' g ', 'kcal'].filter((w) => t.includes(w)).length;
  return hits >= 4;
}
/** La richiesta dell'utente parla del piano del nutrizionista? */
export const NUTRITIONIST_TALK = /\b(nutrizionist\w*|dietist\w*|dietolog\w*|piano alimentare|la mia dieta|dieta)\b/i;
