import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { CONTRACT_PROMPT, HOURS_PROMPT, PAYSLIP_PROMPT, parseContract, parseHours, parsePayslip, type Contract, type ReadDay } from '@/lib/payroll';
import type { Captured } from '@/lib/warrantyScan';

type Res<T> = { ok: true; data: T } | { ok: false; message: string };

/** Manda il documento a Theia (solo con il tuo consenso) e restituisce il testo della risposta; senza AI o senza consenso si scrive a mano. */
async function read(c: Captured, what: string, prompt: string): Promise<Res<string>> {
  if (!aiServerConfigured) return { ok: false, message: t('Theia con l\'AI non è collegata: inserisci i dati a mano.') };
  if (!(await askSend('files', what))) return { ok: false, message: t('Va bene, non invio il documento: inserisci i dati a mano.') };
  try {
    const files = c.pages.length ? c.pages.slice(0, 4).map((uri) => ({ uri, mime: 'image/jpeg' })) : c.pdf ? [{ uri: c.pdf, mime: 'application/pdf' }] : [];
    if (!files.length) return { ok: false, message: t('Non trovo il documento da leggere.') };
    logSend('files', 0, files.map((f) => f.mime));
    return { ok: true, data: await aiReadFiles(prompt, files, 70000, 1600) };
  } catch (e) { return { ok: false, message: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}
const unreadable = t('Non sono riuscita a leggere i dati: puoi inserirli a mano.');

export async function readContract(c: Captured): Promise<Res<Partial<Contract>>> {
  const r = await read(c, t('Contratto di lavoro'), CONTRACT_PROMPT); if (!r.ok) return r;
  const p = parseContract(r.data); return p ? { ok: true, data: p } : { ok: false, message: unreadable };
}
export async function readPayslip(c: Captured): Promise<Res<NonNullable<ReturnType<typeof parsePayslip>>>> {
  const r = await read(c, t('Busta paga'), PAYSLIP_PROMPT); if (!r.ok) return r;
  const p = parsePayslip(r.data); return p ? { ok: true, data: p } : { ok: false, message: unreadable };
}
export async function readHours(c: Captured, today: string): Promise<Res<ReadDay[]>> {
  const r = await read(c, t('Foglio ore o turni'), `${HOURS_PROMPT}\nAnno corrente: ${today.slice(0, 4)}.`); if (!r.ok) return r;
  const d = parseHours(r.data, today); return d.length ? { ok: true, data: d } : { ok: false, message: unreadable };
}
