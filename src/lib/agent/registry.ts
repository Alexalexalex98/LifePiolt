import { t } from '@/i18n/core';
import { findBest, findPerson } from '@/lib/agent/match';
import { conflictsWith, freeStarts, rangeOf } from '@/lib/conflicts';
import { computeQuote, quoteText, STAGES, type Currency, type Stage } from '@/lib/crm';
import { DOC_TYPES } from '@/lib/writing';
import { setPosition } from '@/lib/teamPeople';
import { addInteraction, addReceivable, createContact, createDeal, createTicket, markPaid, saveQuote, updateDeal } from '@/lib/teamCrm';
import { addTraining, createCandidate, createReview, startProcess, updateCandidate } from '@/lib/teamHr';
import { createMeeting, removeMeeting } from '@/lib/teamMeetings';
import { createEntry, createSub, decideExpense, payDoc, saveBudget, submitExpense } from '@/lib/teamMoney';
import { saveReportPage } from '@/lib/reportPage';
import { alertLate, createProjectFromTemplate, createTask, deleteTask, logTime, saveProject, setStatus, updateTask } from '@/lib/teamTasks';
import { sendMessage } from '@/lib/teamComms';
import { busyRanges, decideAbsence, requestAbsence, setAwayFor, teamBusy, today } from '@/lib/teamWork';
import { compare, answer, reportText, workload, type PeriodKind } from '@/lib/reports';
import { loadReportInput } from '@/lib/teamReports';
import { planMyTasks } from '@/lib/planMine';
import { PROJECT_TEMPLATES, type Priority } from '@/lib/workTasks';
import { POSITIONS } from '@/lib/workRoles';
import { crmOf, useCrm } from '@/store/crm';
import { useDocs } from '@/store/docs';
import { useHr } from '@/store/hr';
import { useLife } from '@/store/life';
import { useMeetings } from '@/store/meetings';
import { moneyOf, useMoney } from '@/store/money';
import { usePeople } from '@/store/people';
import { useWTasks } from '@/store/tasks';
import { useTeams } from '@/store/teams';
import { useWorkspace } from '@/store/workspace';

/** Che cosa può fare Theia Lavoro dentro il workspace. Ogni azione ha un nome, i parametri e una funzione che la esegue sul server. Le azioni che cancellano o rifiutano chiedono prima conferma. */
export type Ctx = { team: string; me: string; myName: string };
type P = Record<string, unknown>;
export type ActionDef = { id: string; desc: string; params: string; destructive?: boolean; run: (c: Ctx, p: P) => Promise<string> };

const S = (p: P, k: string): string | undefined => (typeof p[k] === 'string' && (p[k] as string).trim() ? (p[k] as string).trim() : undefined);
const N = (p: P, k: string): number | undefined => { const v = p[k]; const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN; return Number.isFinite(n) ? n : undefined; };
const D = (p: P, k: string): string | undefined => { const v = S(p, k); if (!v) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v + 'T12:00:00').getTime())) throw new Error(t('La data «{0}» non è valida: serve il formato 2026-12-31.', v)); return v; };
const A = (p: P, k: string): string[] => (Array.isArray(p[k]) ? (p[k] as unknown[]).filter((x): x is string => typeof x === 'string') : typeof p[k] === 'string' ? [p[k] as string] : []);
const need = <T,>(v: T | undefined, what: string): T => { if (v === undefined) throw new Error(t('Mi manca: {0}.', what)); return v; };
const ok = (r: { ok: boolean; message?: string }) => { if (!r.ok) throw new Error((r as { message: string }).message); };
const money = (n: number, c: string) => `${n.toLocaleString('it-CH', { maximumFractionDigits: 2 })} ${c}`;
const cur = (p: P): Currency => (String(p.currency ?? '').toUpperCase() === 'EUR' ? 'EUR' : 'CHF');
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

/* ---------- ricerca di persone e oggetti per nome ---------- */
const people = (c: Ctx) => (usePeople.getState().people[c.team] ?? []).map((p) => ({ id: p.user_id, name: p.name || t('Collega') }));
function person(c: Ctx, q: string | undefined, label = t('la persona')): string {
  const r = findPerson(need(q, label), people(c), c.me);
  if (r.me) return c.me; if (r.best) return r.best.item.id;
  if (r.ambiguous) throw new Error(t('Quale intendi: {0}?', r.ambiguous.map((x) => x.name).join(', ')));
  throw new Error(t('Non trovo «{0}» tra le persone del workspace.', q ?? ''));
}
function pick<T>(q: string | undefined, items: T[], nameOf: (x: T) => string, what: string): T {
  const r = findBest(need(q, what), items, nameOf);
  if (r.best) return r.best.item; if (r.ambiguous) throw new Error(t('Quale intendi: {0}?', r.ambiguous.slice(0, 5).map(nameOf).join('; ')));
  throw new Error(t('Non trovo «{0}».', q ?? ''));
}
const projects = (c: Ctx) => useWorkspace.getState().pages.filter((p) => p.teamId === c.team && p.parent === null && p.kind === 'page');
const projectId = (c: Ctx, q?: string): string | null => (q ? pick(q, projects(c), (p) => p.title, t('il progetto')).id : null);
const tasks = (c: Ctx) => useWTasks.getState().tasks[c.team] ?? [];
const crm = (c: Ctx) => crmOf(c.team, useCrm.getState().data);
const contact = (c: Ctx, q?: string) => pick(q, crm(c).contacts, (x) => `${x.name} ${x.company}`, t('il cliente'));
const STATUS: Record<string, 'todo' | 'doing' | 'blocked' | 'done'> = { 'da fare': 'todo', todo: 'todo', 'in corso': 'doing', doing: 'doing', bloccato: 'blocked', blocked: 'blocked', fatto: 'done', chiuso: 'done', finito: 'done', completato: 'done', done: 'done' };
const PRIO: Record<string, Priority> = { bassa: 'low', low: 'low', normale: 'normal', normal: 'normal', alta: 'high', high: 'high', urgente: 'urgent', urgent: 'urgent' };
const status = (v: string | undefined) => (v ? STATUS[v.toLowerCase()] : undefined);

export const ACTIONS: ActionDef[] = [
  /* ---- task e progetti ---- */
  { id: 'create_task', desc: 'Crea un task', params: 'title*, project, assignee, due(YYYY-MM-DD), priority(bassa|normale|alta|urgente), est_minutes', run: async (c, p) => {
    const title = need(S(p, 'title'), t('il titolo')); const r = await createTask({ team: c.team, title, project: projectId(c, S(p, 'project')), assignee: S(p, 'assignee') ? person(c, S(p, 'assignee')) : c.me, due: D(p, 'due') ?? null, priority: PRIO[(S(p, 'priority') ?? '').toLowerCase()], est_min: N(p, 'est_minutes') ?? null }); ok(r);
    return t('Task creato: «{0}»{1}.', title, D(p, 'due') ? ` (${t('entro')} ${D(p, 'due')})` : '');
  } },
  { id: 'update_task', desc: 'Cambia un task: stato (da fare, in corso, bloccato, fatto), scadenza, responsabile, priorità, titolo', params: 'task*, status, due, assignee, priority, title, reason(se bloccato)', run: async (c, p) => {
    const task = pick(S(p, 'task'), tasks(c), (x) => x.title, t('il task')); const st = status(S(p, 'status')); const out: string[] = [];
    if (st) { ok(await setStatus(task, st, S(p, 'reason') ?? '')); out.push(`${t('stato')}: ${t({ todo: 'da fare', doing: 'in corso', blocked: 'bloccato', done: 'fatto' }[st])}`); }
    const patch: Parameters<typeof updateTask>[1] = {}; if (D(p, 'due')) { patch.due = D(p, 'due')!; out.push(`${t('scadenza')} ${patch.due}`); } if (S(p, 'assignee')) { patch.assignee = person(c, S(p, 'assignee')); out.push(t('responsabile cambiato')); } if (S(p, 'priority') && PRIO[S(p, 'priority')!.toLowerCase()]) { patch.priority = PRIO[S(p, 'priority')!.toLowerCase()]; out.push(`${t('priorità')} ${S(p, 'priority')}`); } if (S(p, 'title')) { patch.title = S(p, 'title')!; out.push(t('titolo cambiato')); }
    if (Object.keys(patch).length) ok(await updateTask(task, patch)); if (!out.length) throw new Error(t('Non so che cosa cambiare in «{0}».', task.title));
    return t('«{0}»: {1}.', task.title, out.join(', '));
  } },
  { id: 'delete_task', desc: 'Elimina un task', params: 'task*', destructive: true, run: async (c, p) => { const task = pick(S(p, 'task'), tasks(c), (x) => x.title, t('il task')); ok(await deleteTask(task)); return t('Task eliminato: «{0}».', task.title); } },
  { id: 'log_time', desc: 'Registra ore lavorate su un task', params: 'task*, minutes*', run: async (c, p) => { const task = pick(S(p, 'task'), tasks(c), (x) => x.title, t('il task')); const m = need(N(p, 'minutes'), t('i minuti')); ok(await logTime(task, m)); return t('Registrati {0} minuti su «{1}».', Math.round(m), task.title); } },
  { id: 'create_project', desc: 'Crea un progetto, anche da un modello (sito, evento, assunzione, onboarding, chiusura, uscita, cliente)', params: 'name*, template, goal, due', run: async (c, p) => {
    const name = need(S(p, 'name'), t('il nome')); const tplQ = S(p, 'template'); const tpl = tplQ ? findBest(tplQ, PROJECT_TEMPLATES, (x) => `${x.id} ${x.name}`, 0.4).best?.item : undefined;
    if (tpl) { const r = await createProjectFromTemplate(c.team, tpl, today(), c.me, name); ok(r); return t('Progetto «{0}» creato dal modello «{1}» con {2} task.', name, tpl.name, tpl.tasks.length); }
    const page = useWorkspace.getState().addPage(null, 'page', name, c.team); ok(await saveProject(c.team, page, { goal: S(p, 'goal') ?? '', due: D(p, 'due') ?? null })); return t('Progetto «{0}» creato.', name);
  } },
  { id: 'set_project', desc: 'Cambia obiettivo, scadenza o stato (active, paused, done) di un progetto', params: 'project*, goal, due, status', run: async (c, p) => { const id = projectId(c, S(p, 'project'))!; const st = S(p, 'status'); ok(await saveProject(c.team, id, { ...(S(p, 'goal') ? { goal: S(p, 'goal')! } : {}), ...(D(p, 'due') ? { due: D(p, 'due')! } : {}), ...(st === 'active' || st === 'paused' || st === 'done' ? { status: st } : {}) })); return t('Progetto aggiornato.'); } },
  { id: 'plan_my_tasks', desc: 'Mette i miei task nelle fasce libere del mio orario di lavoro', params: '', run: async (c) => planMyTasks(c.team, c.me).message },
  { id: 'alert_late', desc: 'Avvisa nella chat chi ha task in ritardo', params: 'project', run: async (c, p) => { const r = await alertLate(c.team, projectId(c, S(p, 'project'))); if (!r.ok) throw new Error(r.message); return r.message; } },

  /* ---- agenda, riunioni, assenze ---- */
  { id: 'find_free_slot', desc: 'Trova gli orari liberi in comune tra persone in un giorno', params: 'attendees[], day*, duration_min', run: async (c, p) => {
    const day = need(D(p, 'day'), t('il giorno')); const dur = N(p, 'duration_min') ?? 60; const ids = [...new Set([c.me, ...A(p, 'attendees').map((a) => person(c, a))])];
    const b = await teamBusy(c.team, day, day); const rows = b.ok ? b.data : []; const mine = (useLife.getState().events[day] ?? []).filter((e) => /^\d{1,2}:\d{2}$/.test(e.time) && (e.dur ?? 60) < 1440).map(rangeOf);
    const free = freeStarts([...mine, ...ids.filter((i) => i !== c.me).flatMap((i) => busyRanges(rows, i, day))], dur);
    return free.length ? t('Liberi per tutti {0}: {1}.', dayLabel(day), free.slice(0, 8).join(', ')) : t('Non c\'è un orario libero per tutti {0}.', dayLabel(day));
  } },
  { id: 'create_meeting', desc: 'Fissa una riunione (controlla se tu e gli invitati siete occupati; se manca l\'ora sceglie il primo orario libero)', params: 'title*, day*, time(HH:MM), duration_min, attendees[], project, agenda, force(true per invitare comunque se gli altri sono occupati)', run: async (c, p) => {
    const title = need(S(p, 'title'), t('il titolo')); const day = need(D(p, 'day'), t('il giorno')); const dur = N(p, 'duration_min') ?? 60;
    const ids = A(p, 'attendees').length ? [...new Set(A(p, 'attendees').map((a) => person(c, a)))].filter((i) => i !== c.me) : people(c).map((x) => x.id).filter((i) => i !== c.me);
    const b = await teamBusy(c.team, day, day); const rows = b.ok ? b.data : []; const mineEv = useLife.getState().events[day] ?? [];
    const busyAll = [...mineEv.filter((e) => /^\d{1,2}:\d{2}$/.test(e.time) && (e.dur ?? 60) < 1440).map(rangeOf), ...ids.flatMap((i) => busyRanges(rows, i, day))];
    let time = S(p, 'time'); if (time && !/^\d{1,2}:\d{2}$/.test(time)) throw new Error(t('L\'ora «{0}» non è valida.', time)); if (time) time = time.padStart(5, '0');
    if (!time) { time = freeStarts(busyAll, dur, [9 * 60, 18 * 60])[0]; if (!time) throw new Error(t('Non c\'è un orario libero per tutti {0}.', dayLabel(day))); }
    const mine = conflictsWith(mineEv, time, dur); const theirs = ids.filter((i) => busyRanges(rows, i, day).some((r) => { const s = rangeOf({ time, dur }); return r[0] < s[1] && s[0] < r[1]; }));
    if (mine.length) throw new Error(t('Alle {0} sei già impegnato con «{1}»: sposta uno dei due. Orari liberi per tutti: {2}.', time, mine[0]!.e.title, freeStarts(busyAll, dur).slice(0, 5).join(', ') || t('nessuno')));
    if (theirs.length && p.force !== true) throw new Error(t('Alle {0} sono occupati: {1}. Orari liberi per tutti: {2}. Dimmi se inviti comunque.', time, theirs.map((i) => people(c).find((x) => x.id === i)?.name).join(', '), freeStarts(busyAll, dur).slice(0, 5).join(', ') || t('nessuno')));
    ok(await createMeeting({ team: c.team, project: projectId(c, S(p, 'project')), title, day, time, dur, agenda: S(p, 'agenda') ?? '', attendees: ids })); return t('Riunione «{0}» fissata {1} alle {2} ({3} min) con {4} persone.', title, dayLabel(day), time, dur, ids.length);
  } },
  { id: 'cancel_meeting', desc: 'Cancella una riunione', params: 'meeting*', destructive: true, run: async (c, p) => { const m = pick(S(p, 'meeting'), useMeetings.getState().items.filter((x) => x.team_id === c.team && !x.deleted), (x) => x.title, t('la riunione')); ok(await removeMeeting(m.id)); return t('Riunione «{0}» cancellata.', m.title); } },
  { id: 'request_absence', desc: 'Chiede ferie, permesso o malattia', params: 'kind*(ferie|permesso|malattia|altro), from*, to*', run: async (c, p) => { const k = S(p, 'kind') ?? 'ferie'; const kind = (['ferie', 'permesso', 'malattia'].includes(k) ? k : 'altro') as 'ferie'; ok(await requestAbsence(c.team, { kind, from_day: need(D(p, 'from'), t('la data di inizio')), to_day: need(D(p, 'to') ?? D(p, 'from'), t('la data di fine')) })); return t('Richiesta di {0} dal {1} al {2} inviata.', kind, D(p, 'from')!, D(p, 'to') ?? D(p, 'from')!); } },
  { id: 'decide_absence', desc: 'Approva o rifiuta la richiesta di assenza di una persona', params: 'person*, decision*(approva|rifiuta)', destructive: false, run: async (c, p) => {
    const uid = person(c, S(p, 'person')); const approve = /appro|si|ok/i.test(S(p, 'decision') ?? ''); const { listAbsences } = await import('@/lib/teamWork'); const l = await listAbsences(c.team); ok(l);
    const a = l.ok ? l.data.find((x) => x.user_id === uid && x.status === 'requested') : undefined; if (!a) throw new Error(t('Non ci sono richieste in attesa di quella persona.')); ok(await decideAbsence(a.id, approve)); return approve ? t('Richiesta approvata.') : t('Richiesta rifiutata.');
  } },
  { id: 'set_away', desc: 'Imposta la mia assenza con risposta automatica', params: 'until*, message', run: async (c, p) => { ok(await setAwayFor(c.team, { until: need(D(p, 'until'), t('l\'ultimo giorno')), message: S(p, 'message') ?? '' })); return t('Risposta automatica attiva fino al {0}.', D(p, 'until')!); } },

  /* ---- messaggi ---- */
  { id: 'send_message', desc: 'Scrive un messaggio in un canale (generale, annunci o il nome di un progetto), anche citando persone', params: 'channel(generale|annunci|nome progetto), text*, mention[]', run: async (c, p) => {
    const chQ = (S(p, 'channel') ?? 'generale').toLowerCase(); const ch = /annunc/.test(chQ) ? 'ann' : /general/.test(chQ) ? 'general' : projectId(c, chQ) ?? 'general';
    const m = A(p, 'mention').map((x) => person(c, x)); ok(await sendMessage(c.team, ch, need(S(p, 'text'), t('il testo')), { mentions: m })); return t('Messaggio inviato in «{0}».', ch === 'ann' ? t('Annunci') : ch === 'general' ? t('Generale') : projects(c).find((x) => x.id === ch)?.title ?? ch);
  } },

  /* ---- clienti e vendite ---- */
  { id: 'create_contact', desc: 'Crea un cliente, un fornitore o un contatto nuovo', params: 'name*, kind(client|supplier|lead), company, email, phone, country(IT|CH), vat', run: async (c, p) => { const k = S(p, 'kind'); const kind = (k === 'supplier' || k === 'lead' ? k : 'client') as 'client'; ok(await createContact({ team: c.team, kind, name: need(S(p, 'name'), t('il nome')), company: S(p, 'company'), email: S(p, 'email'), phone: S(p, 'phone'), country: S(p, 'country') === 'CH' ? 'CH' : S(p, 'country') === 'IT' ? 'IT' : null, vat: S(p, 'vat') })); return t('Scheda creata: {0}.', S(p, 'name')!); } },
  { id: 'add_note', desc: 'Salva una nota dopo una chiamata o un incontro con un cliente, con un richiamo', params: 'contact*, text*, kind(call|meeting|email|visit|note), follow_up(YYYY-MM-DD)', run: async (c, p) => { const ct = contact(c, S(p, 'contact')); const k = S(p, 'kind'); ok(await addInteraction(ct, (['call', 'meeting', 'email', 'visit'].includes(k ?? '') ? k : 'note') as 'note', need(S(p, 'text'), t('la nota')), D(p, 'follow_up') ?? null)); return t('Nota salvata su {0}{1}.', ct.name, D(p, 'follow_up') ? ` ${t('con richiamo il')} ${D(p, 'follow_up')}` : ''); } },
  { id: 'create_deal', desc: 'Crea una trattativa con un cliente', params: 'contact*, title*, amount, currency, expected_close', run: async (c, p) => { const ct = contact(c, S(p, 'contact')); ok(await createDeal({ team: c.team, contact: ct.id, title: need(S(p, 'title'), t('il titolo')), amount: N(p, 'amount') ?? 0, currency: cur(p), expected_close: D(p, 'expected_close') ?? null })); return t('Trattativa «{0}» creata per {1}.', S(p, 'title')!, ct.name); } },
  { id: 'move_deal', desc: 'Sposta una trattativa di fase (lead, contact, quote, negotiation, won, lost)', params: 'deal*, stage*, lost_reason', run: async (c, p) => { const d = pick(S(p, 'deal'), crm(c).deals, (x) => x.title, t('la trattativa')); const s = STAGES.find((x) => x.id === S(p, 'stage') || x.label.toLowerCase() === (S(p, 'stage') ?? '').toLowerCase())?.id as Stage | undefined; ok(await updateDeal(d, { stage: need(s, t('la fase')), ...(S(p, 'lost_reason') ? { lost_reason: S(p, 'lost_reason')! } : {}) })); return t('«{0}» ora è in fase «{1}».', d.title, STAGES.find((x) => x.id === s)!.label); } },
  { id: 'prepare_quote', desc: 'Prepara il preventivo di una trattativa (con IVA italiana o svizzera) e lo salva nel workspace', params: 'deal*, lines*[{desc,qty,price}], discount_pct', run: async (c, p) => {
    const d = pick(S(p, 'deal'), crm(c).deals, (x) => x.title, t('la trattativa')); const ct = crm(c).contacts.find((x) => x.id === d.contact)!;
    const lines = (Array.isArray(p.lines) ? p.lines : []).map((l) => { const o = l as P; return { desc: String(o.desc ?? ''), qty: N(o, 'qty') ?? 1, price: N(o, 'price') ?? 0 }; }).filter((l) => l.desc);
    if (!lines.length) lines.push({ desc: d.title, qty: 1, price: d.amount }); const country = ct.country ?? (d.currency === 'EUR' ? 'IT' : 'CH');
    const text = quoteText({ from: useWorkspaceName(c), client: { ...ct, country }, title: d.title, lines, currency: d.currency, discountPct: N(p, 'discount_pct') ?? 0, today: today() }); ok(await saveQuote(d, ct, text));
    return t('Preventivo per {0} pronto e salvato nel workspace: totale {1}.', ct.name, money(computeQuote(lines, country, d.currency, N(p, 'discount_pct') ?? 0).total, d.currency));
  } },
  { id: 'create_ticket', desc: 'Apre un reclamo o una richiesta di assistenza', params: 'title*, contact, text, priority(bassa|normale|alta|urgente)', run: async (c, p) => { ok(await createTicket({ team: c.team, contact: S(p, 'contact') ? contact(c, S(p, 'contact')).id : null, title: need(S(p, 'title'), t('il titolo')), text: S(p, 'text'), priority: PRIO[(S(p, 'priority') ?? '').toLowerCase()] as 'normal' })); return t('Reclamo aperto: «{0}».', S(p, 'title')!); } },
  { id: 'add_receivable', desc: 'Registra un importo da incassare da un cliente', params: 'contact*, label*, amount*, currency, due', run: async (c, p) => { const ct = contact(c, S(p, 'contact')); ok(await addReceivable(ct, need(S(p, 'label'), t('la fattura')), need(N(p, 'amount'), t('l\'importo')), cur(p), D(p, 'due') ?? null)); return t('Da incassare da {0}: {1}.', ct.name, money(N(p, 'amount')!, cur(p))); } },
  { id: 'mark_received', desc: 'Segna come incassato un importo di un cliente', params: 'contact*, label', run: async (c, p) => { const ct = contact(c, S(p, 'contact')); const r = crm(c).receivables.filter((x) => x.contact === ct.id && !x.paid); const x = S(p, 'label') ? pick(S(p, 'label'), r, (y) => y.label, t('la fattura')) : r[0]; if (!x) throw new Error(t('{0} non ha importi da incassare.', ct.name)); ok(await markPaid(x, true)); return t('Incassato: {0} ({1}).', x.label, ct.name); } },

  /* ---- soldi ---- */
  { id: 'add_entry', desc: 'Registra un\'entrata o un\'uscita in prima nota', params: 'kind*(in|out), category*, amount*, description, day, currency', run: async (c, p) => { const kind = S(p, 'kind') === 'in' ? 'in' : 'out'; ok(await createEntry({ team: c.team, day: D(p, 'day') ?? today(), kind, category: need(S(p, 'category'), t('la categoria')), description: S(p, 'description'), amount: need(N(p, 'amount'), t('l\'importo')), currency: cur(p) })); return t('{0} registrata: {1} ({2}).', kind === 'in' ? t('Entrata') : t('Uscita'), money(N(p, 'amount')!, cur(p)), S(p, 'category')!); } },
  { id: 'submit_expense', desc: 'Invia una nota spese (senza foto)', params: 'category*, amount*, description, day, currency', run: async (c, p) => { ok(await submitExpense({ team: c.team, day: D(p, 'day') ?? today(), category: need(S(p, 'category'), t('la categoria')), description: S(p, 'description') ?? '', amount: need(N(p, 'amount'), t('l\'importo')), currency: cur(p) })); return t('Nota spese inviata: {0}.', money(N(p, 'amount')!, cur(p))); } },
  { id: 'decide_expense', desc: 'Approva, rifiuta o segna rimborsata una nota spese', params: 'person, description, decision*(approva|rifiuta|rimborsata)', run: async (c, p) => {
    const list = moneyOf(c.team, useMoney.getState().data).expenses.filter((e) => e.status === 'submitted' || e.status === 'approved'); const uid = S(p, 'person') ? person(c, S(p, 'person')) : null;
    const l2 = list.filter((e) => (!uid || e.user_id === uid)); const e = S(p, 'description') ? pick(S(p, 'description'), l2, (x) => `${x.description} ${x.category}`, t('la nota spese')) : l2[0]; if (!e) throw new Error(t('Non ci sono note spese in attesa.'));
    const d = S(p, 'decision') ?? ''; const st = /rifiut/i.test(d) ? 'rejected' : /rimbor|pagat/i.test(d) ? 'paid' : 'approved'; ok(await decideExpense(e, st)); return t('Nota spese «{0}»: {1}.', e.description || e.category, st === 'rejected' ? t('rifiutata') : st === 'paid' ? t('rimborsata') : t('approvata'));
  } },
  { id: 'pay_document', desc: 'Segna come pagata una fattura o bolletta caricata nei Documenti', params: 'document*', run: async (c, p) => { const l = (useDocs.getState().docs[c.team] ?? []).filter((d) => (d.kind === 'invoice' || d.kind === 'bill') && d.status === 'new'); const d = pick(S(p, 'document'), l, (x) => `${x.title} ${x.fields.numero ?? ''} ${x.fields.fornitore ?? ''}`, t('il documento')); ok(await payDoc(d)); return t('Pagata: {0}.', d.title); } },
  { id: 'create_subscription', desc: 'Aggiunge un abbonamento o contratto con il suo rinnovo', params: 'name*, amount*, cycle(month|quarter|year), next_date, vendor, currency', run: async (c, p) => { const cy = S(p, 'cycle'); ok(await createSub({ team_id: c.team, name: need(S(p, 'name'), t('il nome')), vendor: S(p, 'vendor') ?? '', category: 'Abbonamenti', amount: need(N(p, 'amount'), t('l\'importo')), currency: cur(p), cycle: cy === 'year' || cy === 'quarter' ? cy : 'month', next_date: D(p, 'next_date') ?? null })); return t('Abbonamento «{0}» aggiunto.', S(p, 'name')!); } },
  { id: 'set_budget', desc: 'Imposta un budget per una categoria (mese corrente o anno)', params: 'category*, amount*, whole_year(true|false), currency', run: async (c, p) => { const per = p.whole_year === true ? today().slice(0, 4) : today().slice(0, 7); ok(await saveBudget({ team_id: c.team, project: null, category: need(S(p, 'category'), t('la categoria')), period: per, amount: need(N(p, 'amount'), t('l\'importo')), currency: cur(p) })); return t('Budget {0} per «{1}»: {2}.', per, S(p, 'category')!, money(N(p, 'amount')!, cur(p))); } },

  /* ---- persone e HR ---- */
  { id: 'create_candidate', desc: 'Aggiunge un candidato', params: 'name*, role, email, phone', run: async (c, p) => { ok(await createCandidate({ team: c.team, name: need(S(p, 'name'), t('il nome')), role: S(p, 'role'), email: S(p, 'email'), phone: S(p, 'phone') })); return t('Candidato aggiunto: {0}.', S(p, 'name')!); } },
  { id: 'move_candidate', desc: 'Sposta un candidato di fase (new, screening, interview, offer, hired, rejected)', params: 'candidate*, stage*', run: async (c, p) => { const cd = pick(S(p, 'candidate'), useHr.getState().data[c.team]?.candidates ?? [], (x) => x.name, t('il candidato')); const st = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'].find((x) => x === S(p, 'stage')); ok(await updateCandidate(cd, { stage: need(st, t('la fase')) as 'new' })); return t('{0}: fase «{1}».', cd.name, st!); } },
  { id: 'schedule_interview', desc: 'Fissa il colloquio con un candidato (va anche nel Plan)', params: 'candidate*, day*, time*', run: async (c, p) => { const cd = pick(S(p, 'candidate'), useHr.getState().data[c.team]?.candidates ?? [], (x) => x.name, t('il candidato')); const day = need(D(p, 'day'), t('il giorno')); const time = need(S(p, 'time'), t('l\'ora')).padStart(5, '0'); ok(await updateCandidate(cd, { interview_at: new Date(`${day}T${time}:00`).toISOString(), stage: cd.stage === 'new' || cd.stage === 'screening' ? 'interview' : cd.stage })); return t('Colloquio con {0} fissato {1} alle {2}.', cd.name, dayLabel(day), time); } },
  { id: 'create_review', desc: 'Apre una valutazione per una persona', params: 'person*, period', run: async (c, p) => { const uid = person(c, S(p, 'person')); ok(await createReview(c.team, uid, S(p, 'period') ?? `${today().slice(0, 4)}-S${Number(today().slice(5, 7)) <= 6 ? 1 : 2}`)); return t('Valutazione aperta per {0}.', people(c).find((x) => x.id === uid)?.name ?? ''); } },
  { id: 'add_training', desc: 'Registra un corso o certificato di una persona, con la scadenza', params: 'person*, title*, expires', run: async (c, p) => { const uid = person(c, S(p, 'person')); ok(await addTraining(c.team, uid, { title: need(S(p, 'title'), t('il corso')), kind: D(p, 'expires') ? 'certificato' : 'corso', done_on: null, expires_on: D(p, 'expires') ?? null })); return t('Formazione registrata: {0}.', S(p, 'title')!); } },
  { id: 'start_process', desc: 'Avvia l\'inserimento di un nuovo collega o la sua uscita', params: 'person*, kind*(onboarding|uscita)', run: async (c, p) => { const uid = person(c, S(p, 'person')); const nm = people(c).find((x) => x.id === uid)?.name ?? ''; ok(await startProcess(c.team, S(p, 'kind') === 'uscita' ? 'uscita' : 'onboarding', nm)); return t('Progetto di {0} creato per {1}.', S(p, 'kind') === 'uscita' ? t('uscita') : t('inserimento'), nm); } },
  { id: 'set_position', desc: 'Assegna la posizione (ruolo di lavoro) a una persona', params: 'person*, position*, reports_to', run: async (c, p) => { const uid = person(c, S(p, 'person')); const pos = pick(S(p, 'position'), POSITIONS, (x) => `${x.id} ${x.label}`, t('la posizione')); const cur0 = usePeople.getState().people[c.team]?.find((x) => x.user_id === uid); ok(await setPosition(c.team, uid, pos.id, S(p, 'reports_to') ? person(c, S(p, 'reports_to')) : cur0?.reports_to ?? null)); return t('{0} ora è «{1}».', people(c).find((x) => x.id === uid)?.name ?? '', pos.label); } },

  /* ---- report, scrittura, ricerche ---- */
  { id: 'report', desc: 'Prepara il report (task, ore, vendite, assistenza) di un periodo e lo salva nel workspace', params: 'period(week|month|quarter), scope(me|all|nome progetto)', run: async (c, p) => {
    const kind = (['week', 'month', 'quarter'].includes(S(p, 'period') ?? '') ? S(p, 'period') : 'month') as PeriodKind; const sc = S(p, 'scope'); const inp = await loadReportInput(c.team);
    const scope = !sc || sc === 'all' ? {} : sc === 'me' ? { user: c.me } : { project: projectId(c, sc) }; const cmp = compare(inp, kind, 0, today(), scope);
    const text = reportText({ title: sc && sc !== 'all' && sc !== 'me' ? sc : useWorkspaceName(c), period: cmp.period, kpis: cmp.kpis, currency: 'CHF', workload: workload(inp.tasks, (id) => people(c).find((x) => x.id === id)?.name ?? '') }); await saveReportPage(c.team, `${t('Report')} · ${cmp.period.label}`, text); return text.split('\n').slice(0, 14).join('\n');
  } },
  { id: 'answer_data', desc: 'Risponde a una domanda sui numeri (task in ritardo, ore, incassi, vendite, reclami)', params: 'question*', run: async (c, p) => { const inp = await loadReportInput(c.team); const cmp = compare(inp, 'month', 0, today()); const a = answer(need(S(p, 'question'), t('la domanda')), { kpis: cmp.kpis, workload: workload(inp.tasks, (id) => people(c).find((x) => x.id === id)?.name ?? ''), currency: 'CHF', period: cmp.period }); return a ?? t('Non trovo questo numero tra gli indicatori.'); } },
  { id: 'write_document', desc: `Scrive un documento da un modello (${DOC_TYPES.map((d) => d.id).join(', ')}) e lo salva come bozza nel workspace`, params: 'type*, fields*{campo:valore}', run: async (c, p) => { const dt = pick(S(p, 'type'), DOC_TYPES, (d) => `${d.id} ${d.name}`, t('il tipo di documento')); const f = (typeof p.fields === 'object' && p.fields ? p.fields : {}) as Record<string, string>; const text = dt.build(f, { tone: 'formale', today: today(), from: c.myName }); await saveReportPage(c.team, `${dt.name} · ${t('bozza')}`, text); return `${t('Bozza pronta e salvata nel workspace:')}\n${text}`; } },
  { id: 'find_documents', desc: 'Cerca documenti per nome o contenuto (fatture, contratti, CV…)', params: 'query*', run: async (c, p) => { const q = need(S(p, 'query'), t('che cosa cercare')); const l = (useDocs.getState().docs[c.team] ?? []).filter((d) => findBest(q, [d], (x) => `${x.title} ${Object.values(x.fields).join(' ')} ${x.file_name}`, 0.4).best); return l.length ? l.slice(0, 6).map((d) => `• ${d.title}`).join('\n') : t('Non trovo documenti per «{0}».', q); } },
  { id: 'today_summary', desc: 'Dice che cosa ho oggi: riunioni, impegni e task in scadenza', params: '', run: async (c) => {
    const t0 = today(); const ev = [...(useLife.getState().events[t0] ?? [])].sort((a, b) => a.time.localeCompare(b.time)); const tk = tasks(c).filter((x) => x.assignee === c.me && x.status !== 'done' && !x.parent && x.due && x.due <= t0);
    return [ev.length ? `${t('Oggi')}:\n${ev.map((e) => `• ${e.time} ${e.title}`).join('\n')}` : t('Oggi non hai impegni in agenda.'), tk.length ? `${t('Task in scadenza o in ritardo')}:\n${tk.map((x) => `• ${x.title} (${x.due})`).join('\n')}` : ''].filter(Boolean).join('\n\n');
  } },
];
function useWorkspaceName(c: Ctx): string { return useTeams.getState().teams.find((x) => x.id === c.team)?.name ?? ''; }
export const actionById = (id: string) => ACTIONS.find((a) => a.id === id);
/** L'elenco delle azioni da dare all'AI: una riga per azione. */
export const catalogText = (): string => ACTIONS.map((a) => `- ${a.id}(${a.params}): ${a.desc}`).join('\n');
