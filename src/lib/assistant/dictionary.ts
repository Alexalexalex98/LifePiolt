/**
 * Dizionario di Theia (modulo PURO, nessun alias '@/'): le parole che si usano di più per chiedere qualcosa, raggruppate per significato.
 * Serve a capire il CONTESTO senza AI: «voglio ordinare una pizza» = (volontà + ordinare) + (cibo) → cerca dove ordinare una pizza.
 * I verbi si riconoscono dalla radice («prenot» = prenota, prenotare, prenotami…), le frasi dai gruppi di parole.
 */
export type VerbKind = 'find' | 'book' | 'order' | 'want' | 'eat' | 'pay' | 'send' | 'create' | 'show' | 'change' | 'ask';

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Radici dei verbi (parole che INIZIANO così). */
export const VERB_STEMS: Record<VerbKind, string[]> = {
  find: ['cerc', 'trov', 'consigl', 'suggeris', 'indicam', 'miglior', 'dove', 'vicin', 'zona', 'nei pressi', 'intorno'],
  book: ['prenot', 'riserv', 'fissa', 'appuntament', 'tavolo', 'camera', 'posto per'],
  order: ['ordin', 'compr', 'acquist', 'portar', 'consegn', 'asporto', 'delivery', 'portami', 'recapit'],
  want: ['voglio', 'vorrei', 'vorremmo', 'volevo', 'mi serve', 'servirebbe', 'ho bisogno', 'necessit', 'devo', 'dovrei', 'mi piacerebbe', 'andiamo', 'andare', 'andar', 'ho voglia', 'avrei voglia', 'mi va'],
  eat: ['mangi', 'cenar', 'cena', 'pranz', 'colazion', 'aperitiv', 'ho fame', 'fame', 'spuntin', 'bere', 'bevi', 'ho sete'],
  pay: ['pag', 'salda', 'versa'],
  send: ['invi', 'mand', 'trasfer', 'don', 'regal'],
  create: ['cre', 'fai ', 'fare ', 'nuov', 'aggiung', 'inserisc', 'pubblic', 'apri un', 'apro'],
  show: ['mostr', 'fammi vedere', 'visualizz', 'portami a', 'vai a', 'vai su', 'apri'],
  change: ['spost', 'rimand', 'cambi', 'modific', 'annull', 'cancell', 'elimin', 'togli'],
  ask: ['quant', 'cosa', 'come', 'perche', 'quando', 'chi ', 'qual'],
};

/** Quali tipi di richiesta contiene il testo. */
export function verbsIn(text: string): Set<VerbKind> {
  const t = ` ${norm(text)} `;
  const words = t.trim().split(' ');
  const out = new Set<VerbKind>();
  for (const [k, stems] of Object.entries(VERB_STEMS) as [VerbKind, string[]][]) {
    for (const s of stems) {
      const hit = s.includes(' ') || s.endsWith(' ') ? t.includes(` ${s.trim()}`) && (s.endsWith(' ') ? t.includes(` ${s}`) || t.includes(` ${s.trim()} `) : true) : words.some((w) => w.startsWith(s));
      if (hit) { out.add(k); break; }
    }
  }
  return out;
}

/** Vuole trovare / prenotare / ordinare / andare in un posto? (bastano un verbo di desiderio o di ricerca) */
export function wantsPlace(text: string): { find: boolean; book: boolean; order: boolean } {
  const v = verbsIn(text);
  const intent = v.has('find') || v.has('book') || v.has('order') || v.has('want') || v.has('eat');
  return { find: intent, book: v.has('book'), order: v.has('order') };
}

/** Parole che indicano che NON è una ricerca di posti ma un appunto, un task o un impegno. */
export const NOT_A_SEARCH = /\b(task|nota|note|ricordami|ricordare|promemoria|aggiungi|segna fatto|riunione|sposta|impegno)\b/;

/** Argomenti dell'app: se il testo li nomina, Theia sa a cosa ci si riferisce anche senza un comando preciso. */
export type AppDomain = { id: string; label: string; words: string[]; page: string; hint: string; examples: string[] };
export const APP_DOMAINS: AppDomain[] = [
  { id: 'finanze', label: 'Finanze', words: ['soldi', 'spes', 'budget', 'risparm', 'stipendi', 'affitt', 'bollett', 'fattur', 'conto', 'cassa malati', 'tasse', 'imposte', 'investiment', 'pension'], page: 'lifefinance', hint: 'Per soldi, spese e budget apro Finanze.', examples: ['Analizza le mie finanze', 'Ho speso 12 franchi al supermercato'] },
  { id: 'salute', label: 'Salute', words: ['salute', 'sonno', 'dormit', 'passi', 'battito', 'peso', 'allenament', 'corsa', 'stanch', 'dolor', 'febbre', 'acqua'], page: 'lifehealth', hint: 'Per sonno, passi e allenamenti apro Salute.', examples: ['Come sto di salute?', 'Stanotte ho dormito 7 ore'] },
  { id: 'piano', label: 'Piano', words: ['agenda', 'calendario', 'impegn', 'appuntament', 'riunion', 'oggi', 'domani', 'settimana', 'ferie', 'vacanz'], page: 'plan', hint: 'Per impegni e giornata apro il Piano.', examples: ['Cosa ho in programma domani?', 'Aggiungi riunione al piano domani alle 15'] },
  { id: 'task', label: 'Task', words: ['task', 'cose da fare', 'da fare', 'lista', 'scadenz', 'urgent'], page: 'lifetask', hint: 'Per le cose da fare apro i Task.', examples: ['Aggiungi un task', 'Cosa devo fare adesso?'] },
  { id: 'note', label: 'Note', words: ['nota', 'note', 'appunt', 'idea per'], page: 'lifenotes', hint: 'Per appunti apro le Note.', examples: ['Nota: idee per il weekend'] },
  { id: 'rete', label: 'LifeNetwork', words: ['post', 'segu', 'follower', 'community', 'lifeclub', 'club', 'seminari', 'webinar', 'corso', 'corsi', 'idea'], page: 'lifenetwork', hint: 'Per post, community e corsi apro LifeNetwork.', examples: ['Pubblica un post', 'Crea un LifeClub'] },
  { id: 'lifepoints', label: 'LifePoints', words: ['lifepoint', 'lifepoints', 'lp', 'punti', 'saldo', 'portafoglio', 'qr'], page: 'lifepointsPage', hint: 'Per i LifePoints apro la pagina LifePoints.', examples: ['Quanti LifePoints ho?', 'Invia 10 LifePoints a Giulia'] },
  { id: 'viaggi', label: 'Viaggi', words: ['viagg', 'volo', 'voli', 'aere', 'treno', 'hotel', 'albergo', 'vacanz', 'valigia', 'biglietto'], page: 'lifetravel', hint: 'Per viaggi e voli apro Viaggi.', examples: ['Segna le vacanze dal 10 al 17 agosto'] },
  { id: 'messaggi', label: 'Messaggi', words: ['messagg', 'chat', 'scrivi a', 'scrivigli', 'rispondi'], page: 'messagesPage', hint: 'Per i messaggi apro le chat.', examples: ['Scrivi a Marco: ci vediamo alle 18'] },
];

/** Gli argomenti dell'app nominati nel testo, dal più pertinente. */
export function domainsIn(text: string): AppDomain[] {
  const t = ` ${norm(text)} `;
  return APP_DOMAINS.map((d) => ({ d, n: d.words.filter((w) => t.includes(` ${norm(w)}`) ).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.d);
}
