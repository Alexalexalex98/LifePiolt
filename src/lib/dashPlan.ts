/**
 * Il piano di oggi (modulo PURO): non solo impegni, ma anche task, benessere (acqua, movimento, scale, pause), soldi e persone.
 * Ogni voce ha un punteggio di importanza: quando una si completa, sotto compare la prossima più importante.
 */
export type PlanKind = 'evento' | 'task' | 'benessere' | 'soldi' | 'persone';
export type PlanItem = { id: string; kind: PlanKind; text: string; why?: string; score: number; /** si può spuntare (task, benessere) */ checkable: boolean; page?: string; taskId?: string };
export type PlanInput = {
  hour: number;
  events: { time: string; title: string }[];
  tasks: { id: string; t: string; urgent?: boolean; due?: string; done?: boolean }[];
  todayKey: string;
  steps?: number | null; stepsGoal?: number;
  sleepHours?: number | null;
  mindfulMin?: number | null;
  unreadMessages?: number;
  bills?: { name: string; days: number }[];
  /** voci di benessere già fatte oggi */
  done?: string[];
};

const min = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const plural = (n: number, a: string, b: string) => (n === 1 ? a : b);

export function buildPlan(i: PlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  const now = i.hour * 60;
  // impegni di oggi: quelli già passati non servono
  for (const e of i.events) {
    const s = min(e.time);
    if (s != null && s + 60 < now) continue;
    const soon = s != null && s - now <= 120 && s >= now - 60;
    items.push({ id: `ev:${e.time}:${e.title}`, kind: 'evento', text: `${e.time} · ${e.title}`, why: soon ? 'È tra poco' : 'In programma oggi', score: soon ? 90 : 55, checkable: false, page: 'plan' });
  }
  // task: urgenti e con scadenza vicina per primi
  const open = i.tasks.filter((x) => !x.done);
  for (const x of open) {
    const overdue = !!x.due && x.due < i.todayKey, today = x.due === i.todayKey;
    const score = x.urgent ? 100 : overdue ? 95 : today ? 80 : x.due ? 45 : 30;
    items.push({ id: `task:${x.id}`, kind: 'task', text: x.t, why: x.urgent ? 'Segnato urgente' : overdue ? 'Scaduto' : today ? 'Scade oggi' : undefined, score, checkable: true, page: 'lifetask', taskId: x.id });
  }
  // benessere
  const w = (id: string, text: string, why: string, score: number, page?: string) => { if (!(i.done ?? []).includes(id)) items.push({ id: `well:${id}`, kind: 'benessere', text, why, score, checkable: true, ...(page ? { page } : {}) }); };
  if (i.hour >= 7 && i.hour <= 22) {
    const glasses = Math.max(1, Math.min(8, Math.floor((i.hour - 7) * 0.55)));
    w(`acqua${Math.floor(i.hour / 3)}`, `Bevi un bicchiere d'acqua`, `A quest'ora dovresti averne bevuti circa ${glasses} su 8`, 58);
  }
  if (i.steps != null && i.stepsGoal) {
    const left = Math.max(0, i.stepsGoal - i.steps);
    if (left > 0 && i.hour >= 11) w('passi', `Mancano ${String(left).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} passi: fai le scale o una camminata`, 'Muoversi un po\' alla volta basta', i.hour >= 17 ? 62 : 48, 'lifehealth');
  } else if (i.hour >= 10 && i.hour <= 19) w(`scale${Math.floor(i.hour / 4)}`, 'Prendi le scale invece dell\'ascensore', 'Un piccolo movimento, senza dati da registrare', 42);
  if (i.sleepHours != null && i.sleepHours < 6.5 && i.hour >= 12 && i.hour <= 17) w('riposo', 'Fai una pausa breve e salta il caffè dopo le 16', `Stanotte hai dormito ${i.sleepHours.toFixed(1).replace('.', ',')} ore`, 60, 'lifehealth');
  if ((i.mindfulMin ?? 0) < 1 && i.hour >= 8 && i.hour <= 21) w('respiro', '5 minuti di respiro profondo', 'Oggi non hai ancora fatto una pausa per la mente', 40, 'mood');
  if (i.hour >= 9 && i.hour <= 18) w(`allunga${Math.floor(i.hour / 2)}`, 'Alzati e allungati per 2 minuti', 'Se stai seduto da un po\'', 36);
  // soldi e persone
  for (const b of i.bills ?? []) if (b.days <= 5) items.push({ id: `bill:${b.name}`, kind: 'soldi', text: `${b.name}: ${b.days <= 0 ? 'scade oggi' : `scade tra ${b.days} ${plural(b.days, 'giorno', 'giorni')}`}`, why: 'Meglio non lasciarla all\'ultimo', score: b.days <= 1 ? 85 : 66, checkable: false, page: 'lifefinance' });
  if ((i.unreadMessages ?? 0) > 0) items.push({ id: 'msg', kind: 'persone', text: `${i.unreadMessages} ${plural(i.unreadMessages!, 'messaggio da leggere', 'messaggi da leggere')}`, why: 'Qualcuno ti ha scritto', score: 50, checkable: false, page: 'messagesPage' });
  return items.sort((a, b) => b.score - a.score);
}

export const KIND_LABEL: Record<PlanKind, string> = { evento: 'Impegni', task: 'Da fare', benessere: 'Benessere', soldi: 'Soldi', persone: 'Persone' };
export const KIND_ORDER: PlanKind[] = ['evento', 'task', 'benessere', 'soldi', 'persone'];
/** Le `n` azioni più importanti adesso (le voci spuntabili o con un'azione): se ne completi una, entra la successiva. */
export function topActions(plan: PlanItem[], n = 3): PlanItem[] {
  const pool = plan.filter((x) => x.kind !== 'evento' || x.score >= 90);
  const top = pool.slice(0, n);
  // se c'è almeno un task da fare ne compare sempre uno, anche se altre voci sono più urgenti
  if (!top.some((x) => x.kind === 'task')) { const t = pool.find((x) => x.kind === 'task'); if (t) top.splice(Math.max(0, n - 1), 1, t); }
  return top.sort((a, b) => b.score - a.score);
}
export function planSummary(plan: PlanItem[]): string {
  const c = (k: PlanKind) => plan.filter((x) => x.kind === k).length;
  const parts: string[] = [];
  if (c('evento')) parts.push(`${c('evento')} ${plural(c('evento'), 'impegno', 'impegni')}`);
  if (c('task')) parts.push(`${c('task')} ${plural(c('task'), 'task', 'task')}`);
  if (c('benessere')) parts.push(`${c('benessere')} ${plural(c('benessere'), 'cosa per il benessere', 'cose per il benessere')}`);
  return parts.length ? parts.join(' · ') : 'Giornata libera';
}
