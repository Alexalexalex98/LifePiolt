/** Punto di ingresso puro delle bollette: analisi del testo, riconoscimento, adattatore per una futura lettura con AI. */
import { parseBillText, type ParseOptions } from './parse.ts';
import { isIso } from './dates.ts';
import type { BillDraft, BillKind, Confidence, Field, Recurrence } from './types.ts';
import { BILL_KINDS } from './types.ts';

export * from './types.ts';
export { parseBillText, parseAmount, type ParseOptions } from './parse.ts';
export * from './checks.ts';
export * from './dates.ts';
export * from './plan.ts';
export * from './reminders.ts';
export * from './pdfText.ts';
export * from './form.ts';

/** Bozza da un testo estratto (incollato, da txt/csv o dal livello di testo di un PDF). Non salva nulla. */
export function draftFromText(text: string, opts: ParseOptions = {}): BillDraft {
  return parseBillText(text, opts);
}

const NAME_HINT = /(bollett|fattur|rechnung|facture|invoice|\bbill\b|avviso di pagamento|pagopa|qr-?(?:rechnung|bill|fattura)|zahlschein|einzahlungsschein|scadenz|sollecito|mahnung|ricevuta|utenz|\bacconto\b)/i;

/**
 * True se il file o il testo sembra una bolletta/fattura. Il nome da solo basta; con il testo servono
 * almeno due indizi (importo con valuta, scadenza, IBAN, parole tipiche).
 */
export function looksLikeBill(name: string, text?: string): boolean {
  if (name && NAME_HINT.test(name)) return true;
  if (!text) return false;
  const sample = text.slice(0, 20000);
  const f = sample.toLowerCase();
  let clues = 0;
  if (/(totale da pagare|importo da pagare|amount due|zu zahlen|zahlbetrag|net a payer|montant a payer|montant à payer|total due)/.test(f)) clues++;
  if (/(scadenza|entro il|due date|zahlbar bis|fällig|echéance|payable by|pay by)/.test(f)) clues++;
  if (/\b[a-z]{2}\d{2}(?: ?[a-z0-9]{4}){3,7}\b/i.test(sample) && /iban|konto|conto|compte/.test(f)) clues++;
  if (/(fattura|bolletta|rechnung|facture|invoice)/.test(f)) clues++;
  if (/(chf|eur|€|fr\.)\s*\d|\d\s*(chf|eur|€)/i.test(sample)) clues++;
  if (/^spc\s*$/m.test(sample)) clues += 2;
  return clues >= 2;
}

// ---------------------------------------------------------------- adattatore per la lettura con AI esterna

/** Risposta di una futura lettura AI: testo OCR e/o campi gia' strutturati. Mai applicata senza conferma dell'utente. */
export type AiExtraction = {
  text?: string;
  fields?: Partial<{
    issuer: string; kind: BillKind; amount: number; currency: string; issueDate: string; dueDate: string; number: string;
    iban: string; reference: string; recurrence: Recurrence;
  }>;
};

const ai = <T,>(value: T, source = 'Lettura con AI esterna'): Field<T> => ({ value, confidence: 'media' as Confidence, source, note: 'Letto da un servizio esterno: controlla' });

/**
 * Unisce il risultato di una lettura AI alla bozza SENZA sovrascrivere cio' che e' gia' stato letto in locale con confidenza
 * alta o inserito dall'utente. I campi nuovi hanno confidenza media: l'utente deve comunque confermarli.
 */
export function applyAiExtraction(draft: BillDraft, res: AiExtraction, opts: ParseOptions = {}): BillDraft {
  let d: BillDraft = { ...draft, warnings: [...draft.warnings], ambiguities: [...draft.ambiguities] };
  if (res.text && res.text.trim().length > 20) {
    const p = parseBillText(res.text, opts);
    const take = <K extends keyof BillDraft>(k: K) => {
      const cur = d[k] as Field<unknown> | undefined;
      const nv = p[k] as Field<unknown> | undefined;
      if (nv && (!cur || (cur.confidence === 'bassa' && nv.confidence !== 'bassa'))) (d as Record<string, unknown>)[k] = { ...nv, note: nv.note ?? 'Letto da un servizio esterno: controlla' };
    };
    (['issuer', 'amount', 'currency', 'issueDate', 'dueDate', 'periodFrom', 'periodTo', 'number', 'iban', 'reference', 'pagopa', 'lateFee', 'reminderNotice', 'recurrence'] as const).forEach(take);
    if (!draft.kind || draft.kind.confidence === 'bassa') d.kind = p.kind;
    d.amountAlternatives = d.amountAlternatives.length ? d.amountAlternatives : p.amountAlternatives;
    d.warnings = [...new Set([...d.warnings.filter((w) => !/Non trovo/.test(w) || !(d.amount && d.dueDate)), ...p.warnings])];
  }
  const f = res.fields;
  if (f) {
    const set = (k: keyof BillDraft, v: unknown) => { if (v !== undefined && v !== null && v !== '' && !d[k]) (d as Record<string, unknown>)[k] = ai(v); };
    if (f.issuer) set('issuer', f.issuer);
    if (f.amount && f.amount > 0) set('amount', Math.round(f.amount * 100) / 100);
    if (f.currency) set('currency', f.currency.toUpperCase());
    if (f.issueDate && isIso(f.issueDate)) set('issueDate', f.issueDate);
    if (f.dueDate && isIso(f.dueDate)) set('dueDate', f.dueDate);
    if (f.number) set('number', f.number);
    if (f.iban) set('iban', f.iban);
    if (f.reference) set('reference', f.reference);
    if (f.recurrence) set('recurrence', f.recurrence);
    if (f.kind && BILL_KINDS.includes(f.kind) && d.kind.confidence === 'bassa') d.kind = ai(f.kind);
  }
  d.empty = !d.amount && !d.dueDate && !d.iban && !d.number && !d.issuer;
  return d;
}
