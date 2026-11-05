/** Task e progetti di lavoro (modulo PURO, nessun alias '@/'): avanzamento, ritardi, dipendenze, ripetizioni, modelli di progetto. */
export type Status = 'todo' | 'doing' | 'blocked' | 'done';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type WTask = {
  id: string; team_id: string; project: string | null; title: string; notes: string; assignee: string | null; priority: Priority; status: Status;
  due: string | null; est_min: number | null; parent: string | null; depends_on: string[]; recurrence: Recurrence; block_reason: string;
  created_by: string; deleted?: boolean; done_at?: string | null; created_at?: string;
};
export const STATUS_LABEL: Record<Status, string> = { todo: 'Da fare', doing: 'In corso', blocked: 'Bloccato', done: 'Fatto' };
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Bassa', normal: 'Normale', high: 'Alta', urgent: 'Urgente' };
const PRIO_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDaysIso = (day: string, n: number): string => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };

/** Un task è bloccato dalle dipendenze se qualcuno di cui dipende non è ancora fatto. */
export function waitingOn(t: WTask, all: WTask[]): WTask[] {
  return t.depends_on.map((id) => all.find((x) => x.id === id)).filter((x): x is WTask => !!x && !x.deleted && x.status !== 'done');
}
export const subtasksOf = (t: WTask, all: WTask[]): WTask[] => all.filter((x) => x.parent === t.id && !x.deleted);

/** Avanzamento 0-100: i task fatti sul totale (i sottotask non contano due volte: conta il padre se ne ha). */
export function progress(tasks: WTask[]): number {
  const top = tasks.filter((t) => !t.deleted && !t.parent);
  if (!top.length) return 0;
  const score = (t: WTask): number => { const subs = subtasksOf(t, tasks); return subs.length ? subs.filter((s) => s.status === 'done').length / subs.length : t.status === 'done' ? 1 : 0; };
  return Math.round((top.reduce((a, t) => a + score(t), 0) / top.length) * 100);
}
export const isLate = (t: WTask, today: string): boolean => !t.deleted && t.status !== 'done' && !!t.due && t.due < today;
export const lateTasks = (tasks: WTask[], today: string): WTask[] => tasks.filter((t) => isLate(t, today)).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

/** Ordine di lavoro: urgenti prima, poi scadenza più vicina, poi senza scadenza. */
export function sortTasks(tasks: WTask[]): WTask[] {
  return [...tasks].sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.title.localeCompare(b.title));
}
export function groupByStatus(tasks: WTask[]): Record<Status, WTask[]> {
  const g: Record<Status, WTask[]> = { todo: [], doing: [], blocked: [], done: [] };
  for (const t of sortTasks(tasks.filter((x) => !x.deleted && !x.parent))) g[t.status].push(t);
  return g;
}

/** Quando un task ripetuto si chiude ne nasce uno nuovo con la scadenza spostata. */
export function nextDue(due: string | null, rec: Recurrence, today: string): string | null {
  if (rec === 'none') return null;
  const base = due && due >= today ? due : today;
  if (rec === 'daily') return addDaysIso(base, 1);
  if (rec === 'weekly') return addDaysIso(base, 7);
  const d = new Date(base + 'T12:00:00'); const dom = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return isoOf(d);
}

/** Che cosa dire ai ritardatari: un messaggio per progetto, con le persone da citare. */
export function lateDigest(tasks: WTask[], today: string, nameOf: (id: string) => string): { text: string; mentions: string[] } | null {
  const late = lateTasks(tasks, today); if (!late.length) return null;
  const lines = late.slice(0, 8).map((t) => `• ${t.title}${t.assignee ? ` (@${nameOf(t.assignee).split(' ')[0]})` : ''} · ${t.due}`);
  return { text: `Task in ritardo (${late.length}):\n${lines.join('\n')}\nMe ne date notizia o spostate la scadenza?`, mentions: [...new Set(late.map((t) => t.assignee).filter((x): x is string => !!x))] };
}

/** Modelli di progetto: titolo del task e giorni dalla partenza. */
export type ProjectTemplate = { id: string; name: string; goal: string; tasks: { t: string; days: number; prio?: Priority }[] };
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  { id: 'sito', name: 'Nuovo sito web', goal: 'Sito online e funzionante', tasks: [{ t: 'Definire obiettivi e pagine', days: 3, prio: 'high' }, { t: 'Scrivere i testi', days: 10 }, { t: 'Scegliere foto e grafica', days: 10 }, { t: 'Costruire il sito', days: 20, prio: 'high' }, { t: 'Controllare e correggere', days: 25 }, { t: 'Pubblicare', days: 30, prio: 'urgent' }] },
  { id: 'evento', name: 'Evento aziendale', goal: 'Evento organizzato nei tempi e nel budget', tasks: [{ t: 'Fissare data e luogo', days: 5, prio: 'high' }, { t: 'Preparare il budget', days: 7 }, { t: 'Invitare gli ospiti', days: 14 }, { t: 'Prenotare fornitori', days: 21 }, { t: 'Preparare il programma', days: 28 }, { t: 'Giorno dell\'evento', days: 35, prio: 'urgent' }, { t: 'Ringraziare e fare il resoconto', days: 40 }] },
  { id: 'assunzione', name: 'Assunzione di una persona', goal: 'Nuova persona inserita', tasks: [{ t: 'Descrivere il ruolo e pubblicare l\'annuncio', days: 3, prio: 'high' }, { t: 'Leggere i CV e scegliere', days: 14 }, { t: 'Fare i colloqui', days: 21 }, { t: 'Scegliere e fare l\'offerta', days: 25, prio: 'high' }, { t: 'Preparare il contratto', days: 28 }, { t: 'Preparare postazione e accessi', days: 35 }, { t: 'Primo giorno di lavoro', days: 42, prio: 'urgent' }] },
  { id: 'onboarding', name: 'Inserimento di un nuovo collega', goal: 'Il collega lavora in autonomia', tasks: [{ t: 'Accessi e strumenti', days: 1, prio: 'urgent' }, { t: 'Presentare il team', days: 2 }, { t: 'Spiegare processi e regole', days: 7 }, { t: 'Primi compiti guidati', days: 14 }, { t: 'Colloquio dopo un mese', days: 30, prio: 'high' }] },
  { id: 'chiusura', name: 'Chiusura mensile', goal: 'Conti del mese chiusi', tasks: [{ t: 'Raccogliere fatture e ricevute', days: 3 }, { t: 'Registrare i movimenti', days: 5 }, { t: 'Riconciliare i conti', days: 7, prio: 'high' }, { t: 'Preparare il report', days: 9 }, { t: 'Inviare al commercialista', days: 10, prio: 'urgent' }] },
  { id: 'cliente', name: 'Nuovo cliente', goal: 'Cliente acquisito e avviato', tasks: [{ t: 'Primo incontro e raccolta richieste', days: 3, prio: 'high' }, { t: 'Preparare il preventivo', days: 7 }, { t: 'Inviare l\'offerta', days: 8, prio: 'high' }, { t: 'Firmare il contratto', days: 20, prio: 'urgent' }, { t: 'Riunione di avvio', days: 25 }] },
];
export function fromTemplate(tpl: ProjectTemplate, start: string): { t: string; due: string; prio: Priority }[] {
  return tpl.tasks.map((x) => ({ t: x.t, due: addDaysIso(start, x.days), prio: x.prio ?? 'normal' }));
}
