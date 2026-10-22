/** Domande sul piano del mese: fatture troppo alte, doppi addebiti, rimborsi, spostamento dei soldi messi da parte. Modulo puro. */
import { detectDuplicates, detectLumpy, findSavingsMove, matchRefunds, type Row } from './monthPlan.ts';
import type { Tr } from './statementChecks.ts';

export type PlanCheck = {
  id: string;
  kind: 'lumpy' | 'duplicate' | 'refund' | 'moved' | 'not-moved' | 'unexpected-move';
  text: string;
  /** dati per l'azione scelta (es. la fattura da dilazionare) */
  data: { label?: string; amount?: number; date?: string; rowKey?: string };
  options: { label: string; answer: string }[];
};
const itTr: Tr = (src, ...a) => src.replace(/\{(\d+)\}/g, (_m, i) => String(a[+i] ?? ''));
const money = (n: number) => Math.round(Math.abs(n)).toLocaleString('de-CH');
const short = (l: string) => l.replace(/^(pagamento|acquisto)( online| estero| istantaneo)?\s+/i, '').slice(0, 40);

export function findPlanChecks(a: { rows: Row[]; monthlyIncome: number; answers: Record<string, string>; setAside: number; today: string; savingsHint?: string; tr?: Tr }): PlanCheck[] {
  const tr = a.tr ?? itTr;
  const out: PlanCheck[] = [];
  for (const l of detectLumpy(a.rows, a.monthlyIncome).slice(0, 3)) {
    const id = `lumpy:${l.date}:${l.label}:${l.amount}`;
    if (a.answers[id]) continue;
    out.push({ id, kind: 'lumpy', data: { label: short(l.label), amount: -l.amount, date: l.date }, text: l.reason === 'sopra-il-solito' ? tr('Il {0} hai pagato {1} CHF a «{2}»: molto più del solito. Che cos\'è? Se è pesante da sostenere posso distribuirlo su più mesi.', l.date, money(l.amount), short(l.label)) : tr('Il {0} c\'è un pagamento di {1} CHF a «{2}» che pesa molto sulle tue entrate. Che cos\'è? Se è pesante posso distribuirlo su più mesi.', l.date, money(l.amount), short(l.label)),
      options: [{ label: tr('Distribuiscilo su più mesi'), answer: 'spread' }, { label: tr('È una spesa straordinaria una tantum'), answer: 'oneoff' }, { label: tr('L\'ho già pagata, non serve fare nulla'), answer: 'paid' }] });
  }
  for (const d of detectDuplicates(a.rows).slice(0, 3)) {
    const id = `dup:${d.key}`;
    if (a.answers[id]) continue;
    out.push({ id, kind: 'duplicate', data: { label: short(d.label), amount: -d.amount, date: d.date, rowKey: d.key }, text: tr('Il {0} vedo {1} volte lo stesso pagamento di {2} CHF a «{3}». Doppio addebito vero o errore di lettura?', d.date, d.count, money(d.amount), short(d.label)),
      options: [{ label: tr('Errore di lettura: tienine uno solo'), answer: 'error' }, { label: tr('Sono pagamenti veri (due volte)'), answer: 'real' }] });
  }
  for (const r of matchRefunds(a.rows).slice(0, 3)) {
    const id = `refund:${r.credit.date}:${r.credit.label}:${r.credit.amount}`;
    if (a.answers[id]) continue;
    out.push({ id, kind: 'refund', data: { label: short(r.credit.label), amount: r.credit.amount, date: r.credit.date }, text: tr('L\'entrata di {0} CHF del {1} da «{2}» sembra il rimborso di una spesa del {3}. È così?', money(r.credit.amount), r.credit.date, short(r.credit.label), r.debit.date),
      options: [{ label: tr('Sì, è un rimborso: non conta come guadagno'), answer: 'refund' }, { label: tr('No, è un\'entrata vera'), answer: 'income' }] });
  }
  if (a.setAside > 0) {
    const mv = findSavingsMove(a.rows.filter((r) => r.date >= `${a.today.slice(0, 7)}-01`), a.setAside, a.savingsHint);
    const id = `moved:${a.today.slice(0, 7)}:${Math.round(a.setAside)}`;
    if (mv && !a.answers[id]) out.push({ id, kind: 'moved', data: { label: short(mv.label), amount: -mv.amount, date: mv.date }, text: tr('Il {0} vedo un movimento di {1} CHF («{2}»): è la somma che dovevi mettere da parte?', mv.date, money(mv.amount), short(mv.label)), options: [{ label: tr('Sì, l\'ho messa da parte'), answer: 'yes' }, { label: tr('No, è un\'altra cosa'), answer: 'no' }] });
    if (!mv && Number(a.today.slice(8, 10)) >= 5 && !a.answers[id]) out.push({ id, kind: 'not-moved', data: { amount: a.setAside }, text: tr('Non vedo ancora lo spostamento di {0} CHF da mettere da parte questo mese. L\'hai fatto (magari in contanti o su un conto che non vedo)?', money(a.setAside)), options: [{ label: tr('Sì, l\'ho già messa da parte'), answer: 'yes' }, { label: tr('Non ancora: me lo ricordi tu'), answer: 'later' }] });
  }
  return out;
}
