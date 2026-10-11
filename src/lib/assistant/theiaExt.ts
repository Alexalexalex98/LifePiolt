/** Dati extra di un messaggio di Theia (immagini, provider, azioni). Tipi puri: nessun import dall'app. */

export type ExtImage = { uri: string; mime: string; width?: number; height?: number };

export type TheiaAction =
  /** riprova una richiesta all'AI esterna (immagini o testo) quando sarà collegata */
  | { kind: 'retry'; label: string; text: string; lang: string; source: 'typed' | 'voice'; images?: ExtImage[] }
  /** l'utente conferma di chiedere a un'AI esterna */
  | { kind: 'ask-ai'; label: string; text: string; lang: string; source: 'typed' | 'voice' }
  /** esegue un comando (già in italiano/inglese) con l'assistente locale */
  | { kind: 'run'; label: string; command: string }
  | { kind: 'dismiss'; label: string };

export type TheiaExt = {
  images?: string[];
  /** fornitore che ha risposto ("Risposto da: ...") */
  provider?: string;
  actions?: TheiaAction[];
  /** lingua con cui è stato detto/scritto il messaggio dell'utente */
  lang?: string;
  /** il messaggio viene dalla voce */
  voice?: boolean;
  /** dettaglio piccolo sotto il testo (es. messaggio del router) */
  detail?: string;
};
