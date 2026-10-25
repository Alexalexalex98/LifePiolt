import { t } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { monthName, vacationPlan } from '@/lib/vacationPlan';
import { useFin } from '@/store/finance';
import { useLife } from '@/store/life';
import { useMonthPlan } from '@/store/monthPlan';
import { addMonths, estimateIncome, goalMonthly, monthsNeeded } from '@/lib/monthPlan';
import { OPEN_LABELS, findByText, type AiAct } from './aiActionsCore';

const sum = (l: { monthly: number }[]) => l.reduce((a, x) => a + x.monthly, 0);

/** Piano calcolato dall'app (mai dall'AI) per una proposta di risparmio. */
function planFor(a: Extract<AiAct, { type: 'vacation_set' }>) {
  const st = useFin.getState().statementInfo;
  if (!st) return null;
  return vacationPlan({ now: new Date(), goal: a.goal, target: a.month, saved: a.saved ?? 0, incomes: st.salary.sources.map((x) => ({ name: x.name, monthly: x.monthly })), fixed: sum(st.fixed), variable: sum(st.variable) });
}

/** Come l'app descrive l'azione all'utente, con i numeri calcolati da lei. */
export function describe(a: AiAct): string {
  switch (a.type) {
    case 'task_add': return t('Aggiungo il task «{0}»{1}', a.t, a.due ? t(' per il {0}', a.due) : '');
    case 'task_done': return t('Segno come fatto il task «{0}»', a.match);
    case 'task_delete': return t('Elimino il task «{0}»', a.match);
    case 'event_add': return t('Aggiungo all\'agenda «{0}» il {1} alle {2}', a.title, a.date, a.time);
    case 'event_delete': return t('Tolgo dall\'agenda «{0}»', a.match);
    case 'note_add': return t('Salvo una nota');
    case 'goal_add': return t('Creo l\'obiettivo «{0}»', a.t);
    case 'goal_progress': return t('Porto l\'obiettivo «{0}» al {1}%', a.match, a.p);
    case 'vacation_set': {
      const p = planFor(a);
      const base = t('Imposto il risparmio «{0}»: {1} entro {2}', a.name, formatCHF(a.goal), monthName(a.month));
      return p && p.status !== 'senza-dati' && p.status !== 'scaduta' && p.perMonth > 0 ? `${base}. ${t('Dal tuo estratto: {0} al mese per {1} mesi.', formatCHF(p.perMonth), p.months)}` : base;
    }
    case 'income_set': { const { type: _t, ...m } = a; const e = estimateIncome({ ...m, manualNext: m.next }); return t('Imposto l\'entrata prevista: {0} al mese', formatCHF(e.total)); }
    case 'fixed_add': return t('Aggiungo la spesa fissa «{0}»: {1} al mese', a.name, formatCHF(a.amount));
    case 'fixed_change': return t('Cambio la spesa fissa «{0}» a {1} al mese', a.match, formatCHF(a.amount));
    case 'save_goal': return t('Metto da parte per «{0}»: {1} entro {2}, cioè circa {3} questo mese', a.name, formatCHF(a.total), monthName(a.month), formatCHF(goalMonthly({ id: 'x', name: a.name, kind: 'purchase', total: a.total, targetYm: a.month, saved: a.saved }, new Date().toISOString().slice(0, 7))));
    case 'bill_spread': { const n = a.perMonth ? monthsNeeded(a.total, a.perMonth) : a.months!; return t('Distribuisco «{0}» ({1}) su {2} mesi, circa {3} al mese', a.name, formatCHF(a.total), n, formatCHF(a.total / n)); }
    case 'open': return t('Apro {0}', t(OPEN_LABELS[a.page] ?? 'la pagina'));
  }
}

/** Esegue l'azione già confermata. Ritorna il messaggio per l'utente; se una voce è ambigua o manca, lo dice invece di indovinare. */
export function applyAiAction(a: AiAct): { ok: boolean; message: string } {
  const life = useLife.getState();
  switch (a.type) {
    case 'task_add': life.addTask({ t: a.t, due: a.due, urgent: a.urgent }); return { ok: true, message: t('Fatto: task «{0}» aggiunto.', a.t) };
    case 'task_done': case 'task_delete': {
      const hit = findByText(life.tasks.filter((x) => !x.done), (x) => x.t, a.match);
      if (hit.length === 0) return { ok: false, message: t('Non trovo un task aperto che somigli a «{0}».', a.match) };
      if (hit.length > 1) return { ok: false, message: t('Ne trovo più di uno ({0}): dimmi quale.', hit.slice(0, 4).map((x) => `«${x.t}»`).join(', ')) };
      if (a.type === 'task_done') { life.toggleTask(hit[0]!.id, true); return { ok: true, message: t('Fatto: «{0}» è completato.', hit[0]!.t) }; }
      life.delTask(hit[0]!.id); return { ok: true, message: t('Fatto: «{0}» eliminato (lo ritrovi nel cestino per 30 giorni).', hit[0]!.t) };
    }
    case 'event_add': life.addEvent(a.date, { time: a.time, title: a.title, dur: a.dur }); return { ok: true, message: t('Fatto: «{0}» è in agenda il {1} alle {2}.', a.title, a.date, a.time) };
    case 'event_delete': {
      const days = a.date ? [a.date] : Object.keys(life.events);
      const hits = days.flatMap((d) => findByText((life.events[d] ?? []).map((ev, idx) => ({ ev, idx, d })), (x) => x.ev.title, a.match));
      if (hits.length === 0) return { ok: false, message: t('Non trovo in agenda «{0}».', a.match) };
      if (hits.length > 1) return { ok: false, message: t('Ne trovo più di uno ({0}): dimmi quale.', hits.slice(0, 4).map((x) => `«${x.ev.title}» ${x.d}`).join(', ')) };
      life.delEvent(hits[0]!.d, hits[0]!.idx); return { ok: true, message: t('Fatto: «{0}» tolto dall\'agenda.', hits[0]!.ev.title) };
    }
    case 'note_add': life.saveNote(null, a.text); return { ok: true, message: t('Fatto: nota salvata.') };
    case 'goal_add': life.addGoal(a.t); return { ok: true, message: t('Fatto: obiettivo «{0}» creato.', a.t) };
    case 'goal_progress': {
      const hit = findByText(life.goals, (x) => x.t, a.match);
      if (hit.length !== 1) return { ok: false, message: hit.length ? t('Ne trovo più di uno: dimmi quale.') : t('Non trovo l\'obiettivo «{0}».', a.match) };
      life.patchGoal(hit[0]!.id, { p: a.p }); return { ok: true, message: t('Fatto: «{0}» è al {1}%.', hit[0]!.t, a.p) };
    }
    case 'vacation_set': useFin.getState().setVacation({ name: a.name, goal: a.goal, target: a.month, saved: a.saved ?? 0 }); return { ok: true, message: t('Fatto: ho impostato il piano di risparmio «{0}».', a.name) };
    case 'income_set': { const { type: _t, next, ...m } = a; useMonthPlan.getState().setIncome({ ...m, manualNext: next }); return { ok: true, message: t('Fatto: entrata prevista impostata. La trovi in Piano del mese e puoi cambiarla.') }; }
    case 'fixed_add': useMonthPlan.getState().addExtraFixed(a.name, a.amount); return { ok: true, message: t('Fatto: aggiunta la spesa fissa «{0}».', a.name) };
    case 'fixed_change': {
      const fin = useFin.getState(); const mp = useMonthPlan.getState();
      const hits = [...(fin.statementInfo?.fixed ?? []).map((x) => ({ kind: 'st' as const, id: x.key, name: x.name })), ...mp.extraFixed.map((x) => ({ kind: 'ex' as const, id: x.id, name: x.name }))];
      const m = findByText(hits, (x) => x.name, a.match);
      if (m.length !== 1) return { ok: false, message: m.length ? t('Ne trovo più di una ({0}): dimmi quale.', m.slice(0, 4).map((x) => `«${x.name}»`).join(', ')) : t('Non trovo una spesa fissa che somigli a «{0}».', a.match) };
      if (m[0]!.kind === 'st') fin.setFixedOverride(m[0]!.id, a.amount); else mp.patchExtraFixed(m[0]!.id, { amount: a.amount });
      return { ok: true, message: t('Fatto: «{0}» ora è {1} al mese.', m[0]!.name, formatCHF(a.amount)) };
    }
    case 'save_goal': useMonthPlan.getState().addGoal({ name: a.name, kind: 'purchase', total: a.total, targetYm: a.month, saved: a.saved }); return { ok: true, message: t('Fatto: obiettivo «{0}» aggiunto al Piano del mese.', a.name) };
    case 'bill_spread': { const n = a.perMonth ? monthsNeeded(a.total, a.perMonth) : a.months!; useMonthPlan.getState().addPlan({ name: a.name, total: a.total, startYm: addMonths(new Date().toISOString().slice(0, 7), 1), months: n }); return { ok: true, message: t('Fatto: «{0}» è distribuita su {1} mesi nel Piano del mese.', a.name, n) }; }
    case 'open': go(a.page); return { ok: true, message: '' };
  }
}
