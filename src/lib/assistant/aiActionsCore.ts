/**
 * Azioni che l'AI può PROPORRE (mai eseguire da sola): l'AI scrive in fondo alla risposta una riga [[AZIONE {...}]],
 * l'app la controlla, la descrive con le sue parole e la esegue solo dopo il «sì» dell'utente. Modulo puro: niente store, niente import dall'app.
 */
export type AiAct =
  | { type: 'task_add'; t: string; due?: string; urgent?: boolean }
  | { type: 'task_done'; match: string }
  | { type: 'task_delete'; match: string }
  | { type: 'event_add'; title: string; date: string; time: string; dur?: number }
  | { type: 'event_delete'; match: string; date?: string }
  | { type: 'note_add'; text: string }
  | { type: 'goal_add'; t: string }
  | { type: 'goal_progress'; match: string; p: number }
  | { type: 'vacation_set'; name: string; goal: number; month: string; saved?: number }
  | { type: 'income_set'; mode: 'fixed' | 'hourly' | 'commission'; amount?: number; hours?: number; rate?: number; overtimeHours?: number; overtimeRate?: number; revenue?: number; pct?: number; extra?: number; next?: number }
  | { type: 'fixed_add'; name: string; amount: number }
  | { type: 'fixed_change'; match: string; amount: number }
  | { type: 'save_goal'; name: string; total: number; month: string; saved?: number }
  | { type: 'bill_spread'; name: string; total: number; months?: number; perMonth?: number }
  | { type: 'open'; page: string };

export const OPEN_PAGES = ['monthPlan', 'lifefinance', 'vacationPlan', 'privacyCenter', 'fitnessMealPlan', 'fitnessFridge', 'lifetask', 'plan', 'settings'];

const RE = /\[\[\s*AZIONE\s+(\{[\s\S]*?\})\s*\]\]/gi;
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isYm = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const str = (s: unknown, max = 200): string | null => (typeof s === 'string' && s.trim() && s.length <= max ? s.trim() : null);
const num = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);

/** Controlla una singola azione proposta: scarta tutto ciò che non è del tutto valido. */
export function validate(o: unknown): AiAct | null {
  if (!o || typeof o !== 'object') return null;
  const a = o as Record<string, unknown>;
  switch (a.type) {
    case 'task_add': { const t = str(a.t); if (!t) return null; return { type: 'task_add', t, due: isDate(a.due) ? a.due : undefined, urgent: a.urgent === true ? true : undefined }; }
    case 'task_done': case 'task_delete': { const m = str(a.match, 80); return m ? { type: a.type, match: m } : null; }
    case 'event_add': { const title = str(a.title, 120); if (!title || !isDate(a.date) || !isTime(a.time)) return null; const dur = num(a.dur); return { type: 'event_add', title, date: a.date, time: a.time, dur: dur && dur > 0 && dur <= 1440 ? Math.round(dur) : undefined }; }
    case 'event_delete': { const m = str(a.match, 80); return m ? { type: 'event_delete', match: m, date: isDate(a.date) ? a.date : undefined } : null; }
    case 'note_add': { const t = str(a.text, 2000); return t ? { type: 'note_add', text: t } : null; }
    case 'goal_add': { const t = str(a.t, 120); return t ? { type: 'goal_add', t } : null; }
    case 'goal_progress': { const m = str(a.match, 80), p = num(a.p); return m && p != null && p >= 0 && p <= 100 ? { type: 'goal_progress', match: m, p: Math.round(p) } : null; }
    case 'vacation_set': { const name = str(a.name, 60), goal = num(a.goal), saved = num(a.saved); if (!name || goal == null || goal <= 0 || goal > 1e7 || !isYm(a.month)) return null; return { type: 'vacation_set', name, goal, month: a.month, saved: saved != null && saved >= 0 ? saved : undefined }; }
    case 'income_set': {
      const mode = a.mode === 'hourly' ? 'hourly' as const : a.mode === 'commission' ? 'commission' as const : a.mode === 'fixed' ? 'fixed' as const : null; if (!mode) return null;
      const p = (v: unknown, max = 1e7) => { const x = num(v); return x != null && x > 0 && x <= max ? x : undefined; };
      const out = { type: 'income_set' as const, mode, amount: p(a.amount), hours: p(a.hours, 744), rate: p(a.rate, 10000), overtimeHours: p(a.overtimeHours, 744), overtimeRate: p(a.overtimeRate, 10000), revenue: p(a.revenue), pct: p(a.pct, 100), extra: p(a.extra), next: p(a.next) };
      return out.amount || out.hours || out.revenue || out.next ? out : null;
    }
    case 'fixed_add': { const name = str(a.name, 60), amt = num(a.amount); return name && amt != null && amt > 0 && amt <= 1e6 ? { type: 'fixed_add', name, amount: amt } : null; }
    case 'fixed_change': { const m = str(a.match, 80), amt = num(a.amount); return m && amt != null && amt >= 0 && amt <= 1e6 ? { type: 'fixed_change', match: m, amount: amt } : null; }
    case 'save_goal': { const name = str(a.name, 60), total = num(a.total), saved = num(a.saved); return name && total != null && total > 0 && total <= 1e7 && isYm(a.month) ? { type: 'save_goal', name, total, month: a.month, saved: saved != null && saved >= 0 ? saved : undefined } : null; }
    case 'bill_spread': { const name = str(a.name, 60), total = num(a.total), months = num(a.months), per = num(a.perMonth); if (!name || total == null || total <= 0 || total > 1e7) return null; const m = months && months >= 1 && months <= 60 ? Math.round(months) : undefined; const pm = per && per > 0 ? per : undefined; return m || pm ? { type: 'bill_spread', name, total, months: m, perMonth: pm } : null; }
    case 'open': return typeof a.page === 'string' && OPEN_PAGES.includes(a.page) ? { type: 'open', page: a.page } : null;
    default: return null;
  }
}

/** Separa il testo da leggere dalle azioni proposte (al massimo 4, valide). */
export function parseAiActions(reply: string): { text: string; actions: AiAct[] } {
  const actions: AiAct[] = [];
  const text = reply.replace(RE, (_m, j: string) => { try { const v = validate(JSON.parse(j)); if (v && actions.length < 4) actions.push(v); } catch { /* json non valido: ignorata */ } return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  return { text, actions };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Trova l'unica voce che corrisponde: [] = nessuna, più d'una = ambigua (si chiede all'utente, non si indovina). */
export function findByText<T>(items: T[], text: (x: T) => string, match: string): T[] {
  const m = norm(match); if (!m) return [];
  const exact = items.filter((x) => norm(text(x)) === m); if (exact.length) return exact;
  return items.filter((x) => { const n = norm(text(x)); return n.includes(m) || m.includes(n); });
}

/** Istruzioni per l'AI: cosa può proporre e come. */
export const AI_ACTION_PROMPT = `Se l'utente ti chiede di fare qualcosa nell'app (o accetta una tua proposta), NON spiegargli i passaggi da fare a mano: proponi l'azione aggiungendo in fondo alla risposta una riga esatta, una per azione, nel formato [[AZIONE {json}]]. L'app la mostra all'utente, che conferma. Azioni possibili: {"type":"task_add","t":"testo","due":"AAAA-MM-GG"} · {"type":"task_done","match":"parte del testo"} · {"type":"task_delete","match":"..."} · {"type":"event_add","title":"...","date":"AAAA-MM-GG","time":"HH:MM","dur":minuti} · {"type":"event_delete","match":"...","date":"AAAA-MM-GG"} · {"type":"note_add","text":"..."} · {"type":"goal_add","t":"..."} · {"type":"goal_progress","match":"...","p":0-100} · {"type":"vacation_set","name":"...","goal":importo,"month":"AAAA-MM","saved":già_messo} (piano di risparmio: l'importo mensile lo calcola l'app, non scriverlo tu) · {"type":"income_set","mode":"fixed|hourly|commission","amount":netto_mensile,"hours":ore,"rate":paga_oraria_netta,"overtimeHours":..,"overtimeRate":..,"revenue":incasso,"pct":percentuale,"extra":..,"next":quanto_arriva_il_mese_prossimo} (entrata prevista) · {"type":"fixed_add","name":"...","amount":importo_mensile} · {"type":"fixed_change","match":"nome della spesa fissa","amount":nuovo_importo} · {"type":"save_goal","name":"...","total":importo,"month":"AAAA-MM","saved":già_messo} (soldi da mettere da parte per acquisti/vacanze; il mensile lo calcola l'app) · {"type":"bill_spread","name":"fattura","total":importo,"months":mesi,"perMonth":importo_al_mese} (distribuire una fattura grossa su più mesi: dai mesi OPPURE l'importo mensile) · {"type":"open","page":"monthPlan|lifefinance|vacationPlan|privacyCenter|fitnessMealPlan|fitnessFridge|lifetask|plan|settings"}. Usa solo dati che l'utente ha detto o che stanno nel contesto; se manca un dato essenziale (importo, data, ora) chiedilo invece di inventarlo. Non dire mai di aver già fatto la cosa: dì che la proponi e che serve la conferma.`;
