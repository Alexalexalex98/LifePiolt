/** Tipi condivisi delle bollette e fatture. Puro (nessun import di react-native o dello store). */

export type BillKind = 'luce' | 'gas' | 'acqua' | 'internet' | 'affitto' | 'assicurazione' | 'tasse' | 'abbonamento' | 'medico' | 'altro';
export const BILL_KINDS: BillKind[] = ['luce', 'gas', 'acqua', 'internet', 'affitto', 'assicurazione', 'tasse', 'abbonamento', 'medico', 'altro'];
/** Etichette in italiano (sono chiavi del catalogo di traduzione: dentro <Text>/Btn si traducono da sole). */
export const KIND_LABEL: Record<BillKind, string> = {
  luce: 'Luce', gas: 'Gas', acqua: 'Acqua', internet: 'Internet e telefono', affitto: 'Affitto', assicurazione: 'Assicurazione',
  tasse: 'Tasse e imposte', abbonamento: 'Abbonamento', medico: 'Spese mediche', altro: 'Altro',
};

export type Confidence = 'alta' | 'media' | 'bassa';
/** Un campo letto dal testo: valore, quanto e' affidabile, riga di origine e parte esatta riconosciuta (per evidenziarla). */
export type Field<T> = { value: T; confidence: Confidence; source: string; match?: string; note?: string };

export type Recurrence = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
export const RECURRENCE_LABEL: Record<Recurrence, string> = { monthly: 'Ogni mese', bimonthly: 'Ogni 2 mesi', quarterly: 'Ogni 3 mesi', yearly: 'Ogni anno' };

export type BillLang = 'it' | 'de' | 'fr' | 'en' | '?';

export type BillDraft = {
  lang: BillLang;
  issuer?: Field<string>;
  kind: Field<BillKind>;
  amount?: Field<number>;
  currency?: Field<string>;
  issueDate?: Field<string>;
  dueDate?: Field<string>;
  periodFrom?: Field<string>;
  periodTo?: Field<string>;
  number?: Field<string>;
  iban?: Field<string>;
  /** Riferimento di pagamento: QRR (27 cifre), SCOR (RF...) o altro. */
  reference?: Field<string>;
  referenceType?: 'QRR' | 'SCOR' | 'ALTRO';
  qrIban?: boolean;
  pagopa?: Field<string>;
  taxId?: Field<string>;
  recurrence?: Field<Recurrence>;
  /** Spesa/penale di ritardo dichiarata nel documento. */
  lateFee?: Field<number>;
  /** Interesse di mora annuo (%), se dichiarato. */
  lateInterestPct?: Field<number>;
  /** True se il documento sembra gia' un sollecito (livello 1-3). */
  reminderNotice?: Field<number>;
  /** Importi alternativi visti nel testo (per scegliere quello giusto). */
  amountAlternatives: { value: number; source: string; score: number }[];
  warnings: string[];
  /** Punti ambigui da far controllare all'utente (es. data gg/mm o mm/gg). */
  ambiguities: string[];
  /** True se dal testo non e' uscito praticamente nulla di utile. */
  empty: boolean;
  textLength: number;
};

export type BillState = 'open' | 'paid' | 'disputed';
export type BillStatus = 'da_pagare' | 'in_scadenza' | 'scaduta' | 'pagata' | 'rateizzata' | 'contestata';
export const STATUS_LABEL: Record<BillStatus, string> = {
  da_pagare: 'Da pagare', in_scadenza: 'In scadenza', scaduta: 'Scaduta', pagata: 'Pagata', rateizzata: 'Rateizzata', contestata: 'Contestata',
};

export type Installment = { dueDate: string; amount: number; paidAt?: string };
export type InvoiceLog = { at: string; text: string };

/** Bolletta o fattura da pagare (separata dai costi ricorrenti "Bill" del budget). */
export type Invoice = {
  id: string;
  issuer: string;
  kind: BillKind;
  amount: number;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  periodFrom?: string;
  periodTo?: string;
  number?: string;
  iban?: string;
  reference?: string;
  pagopa?: string;
  state: BillState;
  installments?: Installment[];
  recurrence?: Recurrence;
  /** Penale/spese di ritardo note (importo fisso) e interesse annuo (%). */
  lateFee?: number;
  lateInterestPct?: number;
  /** Scadenza stimata dalla ricorrenza (non e' ancora arrivato il documento). */
  estimated?: boolean;
  /** Sollecito gia' ricevuto (livello). */
  reminderLevel?: number;
  notes?: string;
  fileId?: string;
  fileUri?: string;
  fileName?: string;
  fileMime?: string;
  paidAt?: string;
  paidAmount?: number;
  /** Movimento registrato al pagamento (per annullarlo). */
  movement?: { month: string; date: string; label: string; amount: number };
  /** Promemoria locali attivi per questa bolletta. */
  remind: boolean;
  calendar?: boolean;
  createdAt: string;
  history: InvoiceLog[];
};

export type BillPrefs = {
  on: boolean;
  /** Momenti prima della scadenza. */
  d7: boolean; d3: boolean; d1: boolean; d0: boolean;
  /** Se scaduta: il giorno dopo e poi ogni 3 giorni (max 3 volte). */
  overdue: boolean;
  hour: number; minute: number;
  /** Giorni lavorativi di margine per il bonifico (2-3). */
  safetyDays: number;
  /** Giorni di calendario per considerare "in scadenza". */
  soonDays: number;
  /** Margine di liquidita' da non toccare. */
  reserve: number;
  countries: ('CH' | 'IT')[];
};
export const DEFAULT_BILL_PREFS: BillPrefs = {
  on: true, d7: true, d3: true, d1: true, d0: true, overdue: true, hour: 8, minute: 30, safetyDays: 2, soonDays: 7, reserve: 0, countries: ['CH', 'IT'],
};
