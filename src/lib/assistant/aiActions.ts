import { t } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { monthName, vacationPlan } from '@/lib/vacationPlan';
import { useFin } from '@/store/finance';
import { useLife } from '@/store/life';
import { useMonthPlan } from '@/store/monthPlan';
import { addMonths, estimateIncome, goalMonthly, monthsNeeded } from '@/lib/monthPlan';
import { OPEN_LABELS, findByText, isAll, type AiAct } from './aiActionsCore';

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
    case 'task_edit': return t('Modifico il task «{0}»', a.match);
    case 'event_edit': return t('Modifico l\'impegno «{0}»', a.match);
    case 'note_edit': return t('Aggiorno la nota «{0}»', a.match);
    case 'note_delete': return t('Elimino la nota «{0}»', a.match);
    case 'file_rename': return t('Rinomino il file «{0}»', a.match);
    case 'file_delete': return t('Elimino il file «{0}»', a.match);
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
export type ActResult = { ok: boolean; message: string; undo?: () => void };
const ambiguous = (names: string[]) => t('Ne trovo più di uno ({0}): dimmi quale.', names.slice(0, 4).map((x) => `«${x}»`).join(', '));
export function applyAiAction(a: AiAct): ActResult {
  const life = useLife.getState();
  switch (a.type) {
    case 'task_add': life.addTask({ t: a.t, due: a.due, urgent: a.urgent }); return { ok: true, message: t('Fatto: task «{0}» aggiunto.', a.t) };
    case 'task_done': case 'task_delete': {
      const open = life.tasks.filter((x) => !x.done);
      const hit = isAll(a.match) ? open : findByText(open, (x) => x.t, a.match);
      if (hit.length === 0) return { ok: false, message: t('Non trovo un task aperto che somigli a «{0}».', a.match) };
      if (hit.length > 1 && !isAll(a.match)) return { ok: false, message: ambiguous(hit.map((x) => x.t)) };
      if (a.type === 'task_done') {
        hit.forEach((x) => life.toggleTask(x.id, true));
        return { ok: true, message: hit.length === 1 ? t('Fatto: «{0}» è completato.', hit[0]!.t) : t('Fatto: {0} task completati.', hit.length), undo: () => hit.forEach((x) => useLife.getState().toggleTask(x.id, false)) };
      }
      const gone = hit.map((x) => ({ task: x, idx: life.tasks.findIndex((y) => y.id === x.id) }));
      hit.forEach((x) => useLife.getState().delTask(x.id));
      return { ok: true, message: hit.length === 1 ? t('Fatto: «{0}» eliminato (lo ritrovi nel cestino per 30 giorni).', hit[0]!.t) : t('Fatto: {0} task eliminati (li ritrovi nel cestino per 30 giorni).', hit.length), undo: () => gone.forEach((g) => useLife.getState().restoreTask(g.task, g.idx)) };
    }
    case 'task_edit': {
      const hit = findByText(life.tasks.filter((x) => !x.done), (x) => x.t, a.match);
      if (hit.length !== 1) return { ok: false, message: hit.length ? ambiguous(hit.map((x) => x.t)) : t('Non trovo un task aperto che somigli a «{0}».', a.match) };
      const old = hit[0]!; const patch = { ...(a.t ? { t: a.t } : {}), ...(a.due ? { due: a.due } : {}), ...(a.urgent !== undefined ? { urgent: a.urgent } : {}) };
      life.patchTask(old.id, patch);
      return { ok: true, message: t('Fatto: task «{0}» aggiornato.', a.t ?? old.t), undo: () => useLife.getState().patchTask(old.id, { t: old.t, due: old.due, urgent: old.urgent }) };
    }
    case 'event_add': { const idx = life.addEvent(a.date, { time: a.time, title: a.title, dur: a.dur }); return { ok: true, message: t('Fatto: «{0}» è in agenda il {1} alle {2}.', a.title, a.date, a.time), undo: () => { useLife.getState().delEvent(a.date, idx); } }; }
    case 'event_edit': {
      const days = a.date ? [a.date] : Object.keys(life.events);
      const hits = days.flatMap((d) => findByText((life.events[d] ?? []).map((ev, idx) => ({ ev, idx, d })), (x) => x.ev.title, a.match));
      if (hits.length !== 1) return { ok: false, message: hits.length ? ambiguous(hits.map((x) => `${x.ev.title} ${x.d}`)) : t('Non trovo in agenda «{0}».', a.match) };
      const h = hits[0]!; const next = { ...h.ev, ...(a.newTitle ? { title: a.newTitle } : {}), ...(a.newTime ? { time: a.newTime } : {}), ...(a.dur ? { dur: a.dur } : {}) };
      const day = a.newDate ?? h.d;
      if (day === h.d) { life.patchEvent(h.d, h.idx, next); return { ok: true, message: t('Fatto: «{0}» aggiornato.', next.title), undo: () => useLife.getState().patchEvent(h.d, h.idx, h.ev) }; }
      life.delEvent(h.d, h.idx); const ni = useLife.getState().addEvent(day, next);
      return { ok: true, message: t('Fatto: «{0}» spostato al {1} alle {2}.', next.title, day, next.time), undo: () => { useLife.getState().delEvent(day, ni); useLife.getState().addEvent(h.d, h.ev); } };
    }
    case 'event_delete': {
      const days = a.date ? [a.date] : Object.keys(life.events);
      const hits = days.flatMap((d) => findByText((life.events[d] ?? []).map((ev, idx) => ({ ev, idx, d })), (x) => x.ev.title, a.match));
      if (hits.length === 0) return { ok: false, message: t('Non trovo in agenda «{0}».', a.match) };
      if (hits.length > 1) return { ok: false, message: t('Ne trovo più di uno ({0}): dimmi quale.', hits.slice(0, 4).map((x) => `«${x.ev.title}» ${x.d}`).join(', ')) };
      const h = hits[0]!; life.delEvent(h.d, h.idx); return { ok: true, message: t('Fatto: «{0}» tolto dall\'agenda.', h.ev.title), undo: () => useLife.getState().addEvent(h.d, h.ev) };
    }
    case 'note_add': life.saveNote(null, a.text); return { ok: true, message: t('Fatto: nota salvata.') };
    case 'note_edit': case 'note_delete': {
      const hit = findByText(life.notes, (n) => n.text, a.match);
      if (hit.length !== 1) return { ok: false, message: hit.length ? ambiguous(hit.map((n) => n.text.split('\n')[0]!.slice(0, 40))) : t('Non trovo una nota che somigli a «{0}».', a.match) };
      const n = hit[0]!;
      if (a.type === 'note_edit') { life.saveNote(n.id, a.text); return { ok: true, message: t('Fatto: nota aggiornata.'), undo: () => useLife.getState().saveNote(n.id, n.text) }; }
      const r = life.delNote(n.id); return { ok: true, message: t('Fatto: nota eliminata.'), undo: r ? () => useLife.getState().restoreNote(r.note, r.idx) : undefined };
    }
    case 'file_rename': case 'file_delete': {
      const hit = findByText(life.drive, (f) => f.n, a.match);
      if (hit.length !== 1) return { ok: false, message: hit.length ? ambiguous(hit.map((f) => f.n)) : t('Non trovo un file che somigli a «{0}».', a.match) };
      const f = hit[0]!;
      if (a.type === 'file_rename') { useLife.setState((s) => ({ drive: s.drive.map((x) => (x.id === f.id ? { ...x, n: a.name } : x)) })); return { ok: true, message: t('Fatto: il file ora si chiama «{0}».', a.name), undo: () => useLife.setState((s) => ({ drive: s.drive.map((x) => (x.id === f.id ? { ...x, n: f.n } : x)) })) }; }
      life.delFile(f.id); return { ok: true, message: t('Fatto: file «{0}» eliminato.', f.n), undo: () => useLife.getState().restoreFile(f) };
    }
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

/** Una riga per l'AI con gli elementi che può modificare: i titoli esatti da usare in "match". */
export function editableContext(): string {
  const life = useLife.getState();
  const today = new Date().toISOString().slice(0, 10);
  const cut = (x: string, n = 60) => x.replace(/\s+/g, ' ').slice(0, n);
  const tasks = life.tasks.filter((x) => !x.done).slice(0, 40).map((x) => `${cut(x.t)}${x.due ? ` (entro ${x.due})` : ''}`);
  const events = Object.entries(life.events).filter(([d]) => d >= today).sort(([x], [y]) => x.localeCompare(y)).flatMap(([d, l]) => l.map((e) => `${d} ${e.time} ${cut(e.title)}`)).slice(0, 40);
  const notes = life.notes.slice(0, 20).map((n) => cut(n.text, 50));
  const files = life.drive.filter((f) => !f.photo).slice(0, 20).map((f) => cut(f.n));
  return `Elementi modificabili (usa questi titoli in match):\nTask aperti: ${tasks.join('; ') || 'nessuno'}\nImpegni da oggi: ${events.join('; ') || 'nessuno'}\nNote: ${notes.join(' | ') || 'nessuna'}\nFile Drive: ${files.join('; ') || 'nessuno'}`;
}
