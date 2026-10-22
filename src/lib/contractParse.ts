/** Legge la risposta dell'AI sul contratto di lavoro (JSON) e la trasforma in un modello di entrata PROPOSTO: l'utente deve confermarlo e può cambiare tutto. Modulo puro. */
import type { IncomeModel } from './monthPlan.ts';

export type ContractRead = { model: IncomeModel; notes: string[]; grossOnly: boolean };
const n = (v: unknown): number | undefined => { const x = typeof v === 'string' ? Number(v.replace(/['\s]/g, '').replace(',', '.')) : (v as number); return typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : undefined; };

export const CONTRACT_PROMPT = `Leggi questo contratto di lavoro e rispondi SOLO con un oggetto JSON (niente altro testo) con questi campi, usando null dove il contratto non lo dice (non inventare e non calcolare nulla): {"tipo":"fisso"|"ore"|"percentuale"|null,"stipendio_netto_mensile":numero|null,"stipendio_lordo_mensile":numero|null,"stipendio_lordo_annuo":numero|null,"ore_settimanali":numero|null,"paga_oraria_lorda":numero|null,"percentuale_su_incasso":numero|null,"parte_fissa_mensile":numero|null,"paga_straordinari":numero|null,"tredicesima":true|false|null,"note":"frase breve su bonus, periodo di prova o altro che incide sullo stipendio"}`;

export function parseContract(reply: string): ContractRead | null {
  const m = reply.match(/\{[\s\S]*\}/); if (!m) return null;
  let j: Record<string, unknown>; try { j = JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
  const net = n(j.stipendio_netto_mensile), gross = n(j.stipendio_lordo_mensile) ?? (n(j.stipendio_lordo_annuo) ? Math.round((n(j.stipendio_lordo_annuo)! / (j.tredicesima === true ? 13 : 12)) * 100) / 100 : undefined);
  const notes: string[] = [];
  if (typeof j.note === 'string' && j.note.trim()) notes.push(j.note.trim().slice(0, 200));
  const tipo = j.tipo === 'ore' || j.tipo === 'percentuale' || j.tipo === 'fisso' ? j.tipo : null;
  let model: IncomeModel;
  if (tipo === 'ore') { const weekly = n(j.ore_settimanali); model = { mode: 'hourly', hours: weekly ? Math.round((weekly * 52) / 12) : undefined, rate: n(j.paga_oraria_lorda) }; notes.push('La paga oraria del contratto è lorda: inserisci quella netta (dalla busta paga).'); }
  else if (tipo === 'percentuale') model = { mode: 'commission', amount: n(j.parte_fissa_mensile), pct: n(j.percentuale_su_incasso) };
  else model = { mode: 'fixed', amount: net };
  if (n(j.paga_straordinari)) model.overtimeRate = n(j.paga_straordinari);
  const grossOnly = tipo !== 'ore' && tipo !== 'percentuale' && !net && !!gross;
  if (grossOnly) notes.push(`Il contratto indica solo il lordo (circa ${gross} al mese): il netto lo vedi sulla busta paga, scrivilo tu.`);
  return { model, notes, grossOnly };
}
