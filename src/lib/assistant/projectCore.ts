/**
 * «Creami un progetto chiamato business plan e dividilo in tutte le task»: Theia capisce la richiesta (nome, sotto-progetti, task) e crea
 * il progetto ad albero. Con l'AI (e il tuo consenso) lo scompone su misura per QUALSIASI tipo di progetto; senza, usa un modello adatto
 * al tipo (o generico). Modulo PURO.
 */
export type ProjectRequest = { name: string; split: boolean; original: string };

const CREATE = /\b(crea|creami|creare|fammi|fare|fai|prepara|preparami|costruisci|costruiscimi|imposta|impostami|apri|aprimi|aggiungi|aggiungimi|inserisci|voglio|vorrei|metti|mettimi|serve|mi serve|devo fare)\b/i;
const PROJECT = /\bprogett[oi]\b/i;
const SPLIT = /\b(divid\w+|scompon\w+|spezz\w+|suddivid\w+|organizz\w+|task|attivit[aà]|sotto\s*-?\s*progett\w+|sotto\s*-?\s*task|passaggi|fasi|step)\b/i;
const STOP = /\s+(?:e|ed|che|in modo|con|così|cosi|dove|voglio|vorrei|vorrebbe|ma|poi|dividi|divid\w+|scompon\w+|suddivid\w+|spezz\w+|organizz\w+|mettici|inserisci|aggiungi|e poi)\b.*$/i;

const tidy = (s: string) => {
  const c = s.replace(STOP, '').replace(/^[\s"“«'’]+|[\s"”»'’.,;:!?]+$/g, '').replace(/\s+/g, ' ').trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : '';
};

/** La richiesta di creare un progetto, se c'è: il nome e se vuole anche la suddivisione in task. */
export function parseProjectRequest(text: string): ProjectRequest | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!PROJECT.test(t) || !CREATE.test(t)) return null;
  // una domanda («quanti progetti ho?») o «apri il progetto X» già esistente non è una creazione
  if (/^(quanti|quali|dove|come|cosa|che cosa|mostra|vedi)\b/i.test(t) || /\b(apri|vai a|mostra)\s+(il\s+)?progett/i.test(t) && !/\b(nuovo|creami|crea|fammi)\b/i.test(t)) return null;
  const named = /\b(?:chiamat[oa]|intitolat[oa]|denominat[oa]|si chiama|di nome|dal nome|dal titolo|con (?:il )?nome|con (?:il )?titolo|nome)\s+(.+)$/i.exec(t)
    ?? /\bprogett[oi]\s+(?:(?:di|per|sul|sulla|sullo|sui|su|del|della)\s+)(.+)$/i.exec(t)
    ?? /\bprogett[oi]\s+([^,.;]+)$/i.exec(t);
  let name = named ? tidy(named[1]!) : '';
  name = name.replace(/^(?:il|lo|la|l'|un|una)\s+/i, (m) => (m.trim().toLowerCase() === 'l\'' ? '' : '')).trim();
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (!name || name.length < 2 || /^(sotto|nuovo|con|che|un|una)\b/i.test(name)) return null;
  return { name: name.slice(0, 80), split: SPLIT.test(t), original: t };
}

/** Il testo da mandare all'AI: solo il nome e la richiesta, niente dati personali. */
export function projectPrompt(r: ProjectRequest): string {
  return `Devi scomporre un progetto in sotto-progetti e task concreti, utili davvero a completarlo. Progetto: «${r.name}». Richiesta dell'utente: «${r.original}».
Rispondi SOLO con un elenco puntato rientrato in italiano, senza introduzione, senza conclusioni e senza la riga del progetto stesso (la aggiungo io).
Formato: i sotto-progetti al primo livello con «- » (da 3 a 7), e sotto ognuno le sue task rientrate di 2 spazi con «  - » (da 3 a 8 task per sotto-progetto, azioni concrete che iniziano con un verbo, brevi). Se una task è grande puoi aggiungere un terzo livello rientrato di 4 spazi. Al massimo 70 voci in tutto.
Adatta le voci al TIPO di progetto (non usare un modello generico): pensa a cosa serve davvero per portarlo a termine, dall'inizio alla consegna.`;
}

type Tpl = { re: RegExp; tree: [string, string[]][] };
const TEMPLATES: Tpl[] = [
  { re: /business plan|piano (di )?business|piano aziendale|piano d'impresa/i, tree: [
    ['Idea e visione', ['Descrivere l\'idea di business in una pagina', 'Definire missione, visione e valori', 'Individuare il problema che risolvi e per chi', 'Definire la proposta di valore']],
    ['Analisi di mercato', ['Definire il mercato di riferimento e la sua dimensione', 'Analizzare i concorrenti diretti e indiretti', 'Definire il cliente ideale (buyer persona)', 'Fare un\'analisi SWOT', 'Raccogliere dati e fonti affidabili']],
    ['Prodotto o servizio', ['Descrivere prodotto o servizio e come funziona', 'Definire cosa lo rende diverso', 'Pianificare sviluppo e roadmap', 'Valutare brevetti, licenze e permessi']],
    ['Marketing e vendite', ['Definire il posizionamento e il prezzo', 'Scegliere i canali di acquisizione clienti', 'Pianificare il lancio e il budget marketing', 'Definire il processo di vendita']],
    ['Organizzazione e operazioni', ['Definire la struttura legale dell\'azienda', 'Definire ruoli e persone chiave', 'Descrivere fornitori e processi operativi', 'Pianificare sede, strumenti e tecnologia']],
    ['Piano finanziario', ['Stimare costi di avvio e costi fissi', 'Prevedere ricavi a 3 anni', 'Calcolare il punto di pareggio', 'Preparare conto economico, flussi di cassa e stato patrimoniale', 'Definire il fabbisogno di finanziamento e le fonti']],
    ['Rischi e obiettivi', ['Elencare i rischi principali e come ridurli', 'Fissare obiettivi misurabili a 12 e 36 mesi']],
    ['Chiusura del documento', ['Scrivere l\'executive summary', 'Rivedere e correggere tutto il documento', 'Impaginare e preparare la presentazione']],
  ] },
  { re: /sito|app\b|applicazione|piattaforma|software/i, tree: [
    ['Obiettivi e requisiti', ['Definire scopo e pubblico', 'Elencare le funzioni indispensabili', 'Scegliere strumenti e tecnologie']],
    ['Progettazione', ['Disegnare la struttura (sitemap o flussi)', 'Creare wireframe delle schermate', 'Definire stile, colori e testi']],
    ['Sviluppo', ['Preparare l\'ambiente di lavoro', 'Sviluppare le funzioni principali', 'Collegare dati e pagamenti se servono', 'Rendere tutto adatto al telefono']],
    ['Test e pubblicazione', ['Provare ogni funzione e correggere gli errori', 'Fare provare a qualcuno e raccogliere pareri', 'Pubblicare e controllare che tutto funzioni']],
  ] },
  { re: /event[oi]|festa|matrimonio|compleanno|party|conferenza|laurea/i, tree: [
    ['Idea e budget', ['Definire tipo di evento e obiettivo', 'Fissare data e budget', 'Stimare il numero di invitati']],
    ['Luogo e fornitori', ['Cercare e visitare i luoghi', 'Confrontare preventivi di catering e servizi', 'Prenotare luogo e fornitori']],
    ['Inviti e comunicazione', ['Preparare la lista degli invitati', 'Inviare gli inviti e raccogliere le conferme']],
    ['Programma e logistica', ['Definire il programma della giornata', 'Organizzare allestimento, trasporti e orari', 'Preparare un piano B']],
    ['Giorno dell\'evento e dopo', ['Verificare tutto il giorno prima', 'Coordinare i fornitori durante l\'evento', 'Ringraziare e saldare i conti']],
  ] },
  { re: /viaggio|vacanza|trasferta|tour/i, tree: [
    ['Scelta e budget', ['Scegliere destinazione e date', 'Fissare il budget', 'Controllare documenti e visti']],
    ['Prenotazioni', ['Prenotare voli o trasporti', 'Prenotare alloggi', 'Prenotare attività e ristoranti']],
    ['Programma', ['Fare un itinerario giorno per giorno', 'Segnare mappe e indirizzi utili']],
    ['Prima di partire', ['Assicurazione e cambio valuta', 'Fare i bagagli', 'Sistemare casa e lavoro per l\'assenza']],
  ] },
  { re: /trasloco|trasferimento|nuova casa|ristruttur/i, tree: [
    ['Pianificazione', ['Fissare data e budget', 'Cercare preventivi', 'Avvisare proprietario, banche e utenze']],
    ['Imballaggio e lavori', ['Fare scatole e inventario', 'Eliminare o vendere ciò che non serve', 'Coordinare i lavori nella nuova casa']],
    ['Il giorno del trasloco', ['Coordinare trasportatori', 'Controllare la casa vecchia', 'Sistemare le cose principali nella nuova']],
    ['Dopo', ['Cambiare residenza e indirizzi', 'Attivare le utenze', 'Disfare gli ultimi scatoloni']],
  ] },
  { re: /tesi|ricerca|studio|esame|corso|articolo|libro|relazione/i, tree: [
    ['Scelta e piano', ['Definire argomento e domanda principale', 'Fare il calendario con le scadenze', 'Raccogliere le fonti principali']],
    ['Studio e raccolta', ['Leggere e prendere appunti sulle fonti', 'Organizzare dati e idee', 'Fare uno schema dei capitoli']],
    ['Scrittura', ['Scrivere la prima bozza di ogni capitolo', 'Rivedere struttura e argomenti', 'Aggiungere citazioni e bibliografia']],
    ['Consegna', ['Correggere forma e refusi', 'Impaginare', 'Consegnare o presentare']],
  ] },
];
const GENERIC: [string, string[]][] = [
  ['Obiettivi e idea', ['Scrivere lo scopo del progetto in una frase', 'Definire cosa vuol dire «finito»', 'Elencare risorse, tempo e budget disponibili']],
  ['Pianificazione', ['Dividere il lavoro nelle parti principali', 'Fissare le scadenze intermedie', 'Individuare rischi e imprevisti']],
  ['Realizzazione', ['Svolgere la prima parte del lavoro', 'Svolgere la parte centrale', 'Completare la parte finale']],
  ['Verifica e chiusura', ['Controllare il risultato rispetto agli obiettivi', 'Correggere ciò che non va', 'Consegnare o comunicare il risultato', 'Fare un bilancio di cosa ha funzionato']],
];

/** Il progetto come elenco senza AI: un modello adatto al tipo, altrimenti generico. */
export function fallbackOutline(name: string): string {
  const tpl = TEMPLATES.find((x) => x.re.test(name));
  const tree = tpl?.tree ?? GENERIC;
  return tree.map(([sub, tasks]) => `- ${sub}\n${tasks.map((t) => `  - ${t}`).join('\n')}`).join('\n');
}

/** La risposta dell'AI (elenco puntato) ripulita da introduzioni e righe vuote; null se non sembra un elenco utile. */
export function cleanAiOutline(reply: string): string | null {
  const lines = String(reply ?? '').replace(/\r/g, '').split('\n').filter((l) => /^\s*(?:[-*+•]|\d+[.)])\s+\S/.test(l));
  if (lines.length < 6) return null;
  const norm = lines.map((l) => l.replace(/^(\s*)(?:[*+•]|\d+[.)])\s+/, '$1- '));
  const minIndent = Math.min(...norm.map((l) => l.length - l.trimStart().length));
  return norm.map((l) => l.slice(minIndent)).slice(0, 90).join('\n');
}

/** Il testo da importare: la riga del progetto e tutto il resto sotto di lei. */
export function withRoot(name: string, body: string): string {
  return `- ${name}\n${body.split('\n').map((l) => `  ${l}`).join('\n')}`;
}
