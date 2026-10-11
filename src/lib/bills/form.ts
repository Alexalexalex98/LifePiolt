/** Modulo di revisione/modifica di una bolletta: da bozza a testi modificabili e ritorno, con validazione. Puro. */
import { t } from '../../i18n/core.ts';
import { parseAmount } from './parse.ts';
import { mkIso, validYmd, isIso } from './dates.ts';
import type { BillDraft, BillKind, Invoice, Recurrence } from './types.ts';
import { BILL_KINDS } from './types.ts';

export type BillForm = {
  issuer: string; kind: BillKind; amount: string; currency: string;
  issueDate: string; dueDate: string; periodFrom: string; periodTo: string;
  number: string; iban: string; reference: string; pagopa: string;
  recurrence: Recurrence | ''; lateFee: string; lateInterestPct: string; notes: string;
  reminderLevel: number;
};

export const emptyForm = (currency = 'CHF'): BillForm => ({
  issuer: '', kind: 'altro', amount: '', currency, issueDate: '', dueDate: '', periodFrom: '', periodTo: '', number: '', iban: '', reference: '', pagopa: '',
  recurrence: '', lateFee: '', lateInterestPct: '', notes: '', reminderLevel: 0,
});

/** ISO -> "gg/mm/aaaa" (formato di digitazione nei campi). */
export function isoToInput(iso?: string): string {
  return iso && isIso(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}
/** "gg/mm/aaaa", "gg.mm.aa", "gg-mm-aaaa" o ISO -> ISO. null se non valida. */
export function inputToIso(s: string): string | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  if (isIso(v)) return v;
  const m = /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4}|\d{2})$/.exec(v);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return validYmd(y, Number(m[2]), Number(m[1])) ? mkIso(y, Number(m[2]), Number(m[1])) : null;
}
export function inputToAmount(s: string): number | null {
  const v = (s ?? '').trim().replace(/^(CHF|EUR|€|Fr\.?)\s*/i, '').replace(/\s*(CHF|EUR|€)$/i, '');
  if (!v) return null;
  const p = parseAmount(v);
  return p && p.value > 0 ? p.value : null;
}

export function formFromDraft(d: BillDraft, defaultCurrency = 'CHF'): BillForm {
  return {
    issuer: d.issuer?.value ?? '', kind: d.kind.value, amount: d.amount ? String(d.amount.value).replace('.', ',') : '', currency: d.currency?.value ?? defaultCurrency,
    issueDate: isoToInput(d.issueDate?.value), dueDate: isoToInput(d.dueDate?.value), periodFrom: isoToInput(d.periodFrom?.value), periodTo: isoToInput(d.periodTo?.value),
    number: d.number?.value ?? '', iban: d.iban?.value ?? '', reference: d.reference?.value ?? '', pagopa: d.pagopa?.value ?? '',
    recurrence: d.recurrence?.value ?? '', lateFee: d.lateFee ? String(d.lateFee.value).replace('.', ',') : '', lateInterestPct: d.lateInterestPct ? String(d.lateInterestPct.value).replace('.', ',') : '',
    notes: '', reminderLevel: d.reminderNotice?.value ?? 0,
  };
}

export type FormErrors = Partial<Record<keyof BillForm, string>>;
export type FormValue = Omit<Invoice, 'id' | 'state' | 'remind' | 'createdAt' | 'history'>;

/** Valida e converte il modulo. Servono almeno fornitore, importo e scadenza (senza scadenza non si possono programmare i promemoria). */
export function validateForm(f: BillForm): { ok: boolean; errors: FormErrors; value?: FormValue } {
  const errors: FormErrors = {};
  const issuer = f.issuer.trim();
  if (!issuer) errors.issuer = t('Scrivi chi emette la bolletta');
  const amount = inputToAmount(f.amount);
  if (amount == null) errors.amount = t('Inserisci un importo maggiore di zero');
  const cur = f.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) errors.currency = t('Valuta di 3 lettere (es. CHF)');
  const due = inputToIso(f.dueDate);
  if (!f.dueDate.trim()) errors.dueDate = t('Inserisci la scadenza (gg/mm/aaaa)');
  else if (!due) errors.dueDate = t('Data non valida: usa gg/mm/aaaa');
  const opt = (k: 'issueDate' | 'periodFrom' | 'periodTo'): string | undefined => {
    if (!f[k].trim()) return undefined;
    const v = inputToIso(f[k]);
    if (!v) errors[k] = t('Data non valida: usa gg/mm/aaaa');
    return v ?? undefined;
  };
  const issueDate = opt('issueDate'), periodFrom = opt('periodFrom'), periodTo = opt('periodTo');
  let lateFee: number | undefined;
  if (f.lateFee.trim()) { const v = inputToAmount(f.lateFee); if (v == null) errors.lateFee = t('Importo non valido'); else lateFee = v; }
  let lateInterestPct: number | undefined;
  if (f.lateInterestPct.trim()) { const v = parseFloat(f.lateInterestPct.replace(',', '.')); if (!Number.isFinite(v) || v <= 0 || v > 40) errors.lateInterestPct = t('Percentuale non valida'); else lateInterestPct = v; }
  const ibanRaw = f.iban.replace(/\s/g, '');
  if (ibanRaw && !/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{11,30}$/.test(ibanRaw)) errors.iban = t('IBAN non valido');
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true, errors,
    value: {
      issuer, kind: BILL_KINDS.includes(f.kind) ? f.kind : 'altro', amount: amount as number, currency: cur,
      ...(issueDate ? { issueDate } : {}), dueDate: due as string, ...(periodFrom ? { periodFrom } : {}), ...(periodTo ? { periodTo } : {}),
      ...(f.number.trim() ? { number: f.number.trim() } : {}), ...(ibanRaw ? { iban: ibanRaw.toUpperCase().replace(/(.{4})/g, '$1 ').trim() } : {}),
      ...(f.reference.trim() ? { reference: f.reference.trim() } : {}), ...(f.pagopa.trim() ? { pagopa: f.pagopa.trim() } : {}),
      ...(f.recurrence ? { recurrence: f.recurrence } : {}), ...(lateFee != null ? { lateFee } : {}), ...(lateInterestPct != null ? { lateInterestPct } : {}),
      ...(f.notes.trim() ? { notes: f.notes.trim() } : {}), ...(f.reminderLevel ? { reminderLevel: f.reminderLevel } : {}),
    },
  };
}

/** Il modulo e' stato modificato rispetto a quanto letto? (per mostrare "corretto da te") */
export function changedFields(draft: BillDraft, f: BillForm): (keyof BillForm)[] {
  const base = formFromDraft(draft, f.currency);
  return (['issuer', 'kind', 'amount', 'currency', 'issueDate', 'dueDate', 'number', 'iban', 'reference'] as const).filter((k) => String(base[k]) !== String(f[k]));
}
