/** Dati extra di un messaggio di Theia (immagini, provider, azioni). Tipi puri: nessun import dall'app. */

import type { Att } from '../attachments.ts';

export type ExtImage = { uri: string; mime: string; width?: number; height?: number };

export type TheiaAction =
  /** riprova una richiesta all'AI esterna (immagini o testo) quando sarà collegata */
  | { kind: 'retry'; label: string; text: string; lang: string; source: 'typed' | 'voice'; images?: ExtImage[] }
  /** l'utente conferma di chiedere a un'AI esterna */
  | { kind: 'ask-ai'; label: string; text: string; lang: string; source: 'typed' | 'voice' }
  /** esegue un comando (già in italiano/inglese) con l'assistente locale */
  | { kind: 'run'; label: string; command: string }
  /** apre una pagina dell'app o un indirizzo web (es. la ricerca sulle mappe) */
  | { kind: 'open'; label: string; page?: string; params?: Record<string, string>; url?: string }
  /** apre l'analisi bolletta/fattura su un file ricevuto in chat */
  | { kind: 'bill'; label: string; uri: string; mime: string; name: string }
  /** approfondimento con l'AI dell'estratto conto caricato (solo un riepilogo, dopo il consenso) */
  | { kind: 'ai-analysis'; label: string }
  /** aggiunge alle bollette le fatture lette da un documento (dopo la conferma) */
  | { kind: 'add-invoices'; label: string; invoices: { issuer: string; amount: number; currency: string; number?: string; dueDate?: string }[]; fileUri?: string; fileName?: string; fileMime?: string }
  /** manda a Theia i file (dopo il consenso) per leggerli */
  | { kind: 'read-files'; label: string; text: string; files: { uri: string; mime: string; name?: string }[] }
  /** Theia non conosce il comando: l'utente le mostra cosa fare e lei lo impara */
  | { kind: 'teach'; label: string; phrase: string }
  /** condivide con gli altri utenti un comando imparato (solo se innocuo e solo se l'utente lo sceglie) */
  | { kind: 'share'; label: string; id: string }
  /** dimentica un comando imparato */
  | { kind: 'forget'; label: string; id: string }
  /** rimanda a Theia questa frase come se l'utente l'avesse scritta */
  | { kind: 'say'; label: string; text: string }
  /** azione proposta dall'AI e controllata dall'app: si esegue solo dopo il tocco dell'utente */
  | { kind: 'ai-do'; label: string; act: import('./aiActionsCore.ts').AiAct }
  | { kind: 'dismiss'; label: string };

export type TheiaExt = {
  images?: string[];
  /** allegati non-immagine del messaggio dell'utente (documenti, testo, posizione, contatto, nota, impegno) */
  attachments?: Att[];
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
