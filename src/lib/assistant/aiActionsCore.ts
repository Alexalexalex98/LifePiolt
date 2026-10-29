/**
 * Azioni che l'AI può PROPORRE (mai eseguire da sola): l'AI scrive in fondo alla risposta una riga [[AZIONE {...}]],
 * l'app la controlla, la descrive con le sue parole e la esegue solo dopo il «sì» dell'utente. Modulo puro: niente store, niente import dall'app.
 */
export type AiAct =
  | { type: 'task_add'; t: string; due?: string; urgent?: boolean }
  | { type: 'task_done'; match: string }
  | { type: 'task_delete'; match: string }
  | { type: 'task_edit'; match: string; t?: string; due?: string; urgent?: boolean }
  | { type: 'event_edit'; match: string; date?: string; newTitle?: string; newDate?: string; newTime?: string; dur?: number }
  | { type: 'note_edit'; match: string; text: string }
  | { type: 'note_delete'; match: string }
  | { type: 'file_rename'; match: string; name: string }
  | { type: 'file_delete'; match: string }
  | { type: 'reminder_add'; text: string; date: string; time: string; repeat?: 'daily' | 'weekly' | 'monthly' }
  | { type: 'reminder_edit'; match: string; text?: string; date?: string; time?: string; repeat?: 'none' | 'daily' | 'weekly' | 'monthly' }
  | { type: 'reminder_delete'; match: string }
  | { type: 'reminder_done'; match: string }
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

/** Come si chiamano le pagine che l'AI puo' proporre di aprire (per dirlo chiaramente nel pulsante). */
export const OPEN_LABELS: Record<string, string> = { monthPlan: 'il Piano del mese', lifefinance: 'Finanze', vacationPlan: 'il Piano vacanze', privacyCenter: 'il Centro Privacy', fitnessMealPlan: 'il Piano alimentare', fitnessFridge: 'Frigo e spesa', lifetask: 'LifeTask', plan: 'il Piano', settings: 'le Impostazioni' };
export const OPEN_PAGES = ['monthPlan', 'lifefinance', 'vacationPlan', 'privacyCenter', 'fitnessMealPlan', 'fitnessFridge', 'lifetask', 'plan', 'settings'];

/* accetta anche le varianti dei modelli aperti: senza la parola AZIONE, con un elenco [[{...},{...}]] */
const RE = /\[\[\s*(?:AZIONE\s*:?\s*)?(\[?\s*\{[\s\S]*?\}\s*\]?)\s*\]\]/gi;
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
    case 'task_edit': { const m = str(a.match, 80), nt = str(a.t), due = isDate(a.due) ? a.due : undefined, urgent = typeof a.urgent === 'boolean' ? a.urgent : undefined; return m && (nt || due || urgent !== undefined) ? { type: 'task_edit', match: m, t: nt ?? undefined, due, urgent } : null; }
    case 'event_edit': { const m = str(a.match, 80), nt = str(a.newTitle, 120), nd = isDate(a.newDate) ? a.newDate : undefined, ntm = isTime(a.newTime) ? a.newTime : undefined, dur = num(a.dur); return m && (nt || nd || ntm || dur) ? { type: 'event_edit', match: m, date: isDate(a.date) ? a.date : undefined, newTitle: nt ?? undefined, newDate: nd, newTime: ntm, dur: dur && dur > 0 && dur <= 1440 ? Math.round(dur) : undefined } : null; }
    case 'note_edit': { const m = str(a.match, 80), tx = str(a.text, 2000); return m && tx ? { type: 'note_edit', match: m, text: tx } : null; }
    case 'note_delete': case 'file_delete': { const m = str(a.match, 80); return m ? { type: a.type, match: m } : null; }
    case 'file_rename': { const m = str(a.match, 80), n = str(a.name, 120); return m && n ? { type: 'file_rename', match: m, name: n } : null; }
    case 'reminder_add': { const tx = str(a.text, 200); if (!tx || !isDate(a.date) || !isTime(a.time)) return null; const r = a.repeat === 'daily' || a.repeat === 'weekly' || a.repeat === 'monthly' ? a.repeat : undefined; return { type: 'reminder_add', text: tx, date: a.date, time: a.time, repeat: r }; }
    case 'reminder_edit': { const m = str(a.match, 80), tx = str(a.text, 200); const r = a.repeat === 'none' || a.repeat === 'daily' || a.repeat === 'weekly' || a.repeat === 'monthly' ? a.repeat : undefined; const d = isDate(a.date) ? a.date : undefined, tm = isTime(a.time) ? a.time : undefined; return m && (tx || d || tm || r) ? { type: 'reminder_edit', match: m, text: tx ?? undefined, date: d, time: tm, repeat: r } : null; }
    case 'reminder_delete': case 'reminder_done': { const m = str(a.match, 80); return m ? { type: a.type, match: m } : null; }
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

/** Separa il testo da leggere dalle azioni proposte (al massimo 12, valide). */
export function parseAiActions(reply: string): { text: string; actions: AiAct[] } {
  const actions: AiAct[] = [];
  const text = reply.replace(RE, (_m, j: string) => {
    try { const raw = JSON.parse(j) as unknown; for (const o of Array.isArray(raw) ? raw : [raw]) { const v = validate(o); if (v && actions.length < 12) actions.push(v); } } catch { /* json non valido: ignorata */ }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { text, actions };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** «tutti», «tutte», «*»: vale per ogni voce. */
export const isAll = (m: string): boolean => /^(\*|tutt[ei]|all|everything)$/.test(norm(m));
/** Trova l'unica voce che corrisponde: [] = nessuna, più d'una = ambigua (si chiede all'utente, non si indovina). */
export function findByText<T>(items: T[], text: (x: T) => string, match: string): T[] {
  const m = norm(match); if (!m) return [];
  const exact = items.filter((x) => norm(text(x)) === m); if (exact.length) return exact;
  return items.filter((x) => { const n = norm(text(x)); return n.includes(m) || m.includes(n); });
}

/** Istruzioni per l'AI: cosa può proporre e come. */
export const AI_ACTION_PROMPT = `Tu PUOI fare tutto nell'app al posto dell'utente: task, impegni, note, file del Drive, obiettivi, finanze. Quando l'utente ti chiede di aggiungere, cambiare, spostare, segnare come fatto o cancellare qualcosa, FALLO: non dire mai che non puoi, non chiedere conferma e non spiegargli i passaggi a mano. Aggiungi in fondo alla risposta una riga esatta per ogni azione, nel formato [[AZIONE {json}]]: l'app la esegue subito e scrive lei il risultato (e l'utente può annullare), quindi tu rispondi solo con una frase breve (es. «Ok, fatto.»). Se l'utente dice «ricordami», «avvisami», «promemoria» o simili, crea un PROMEMORIA con reminder_add (suona una notifica all'ora scelta): serve data e ora, se manca l'ora chiedila. Se la richiesta ha un orario preciso (es. «chiamare l'idraulico alle 11») crea un impegno in agenda con event_add (data di oggi se dice «oggi»); senza orario crea un task con la scadenza. Per più cose scrivi più righe (fino a 12). Non usare azioni per un saluto, una domanda o una semplice conversazione, e mai open se non ti chiede di aprire una pagina. Nel campo match scrivi parte del titolo ESATTO preso dall'elenco «Elementi modificabili» del contesto; per tutti i task aperti usa match "*". Azioni possibili: {"type":"task_add","t":"testo","due":"AAAA-MM-GG"} · {"type":"task_done","match":"parte del testo"} · {"type":"task_delete","match":"..."} · {"type":"task_edit","match":"...","t":"nuovo testo","due":"AAAA-MM-GG","urgent":true} · {"type":"event_edit","match":"...","date":"AAAA-MM-GG di ora","newTitle":"...","newDate":"AAAA-MM-GG","newTime":"HH:MM","dur":minuti} · {"type":"note_edit","match":"...","text":"testo nuovo completo"} · {"type":"note_delete","match":"..."} · {"type":"file_rename","match":"...","name":"..."} · {"type":"file_delete","match":"..."} · {"type":"event_add","title":"...","date":"AAAA-MM-GG","time":"HH:MM","dur":minuti} · {"type":"event_delete","match":"...","date":"AAAA-MM-GG"} · {"type":"note_add","text":"..."} · {"type":"reminder_add","text":"cosa ricordare","date":"AAAA-MM-GG","time":"HH:MM","repeat":"daily|weekly|monthly (solo se si ripete)"} · {"type":"reminder_edit","match":"...","text":"...","date":"...","time":"..."} · {"type":"reminder_delete","match":"..."} · {"type":"reminder_done","match":"..."} · {"type":"goal_add","t":"..."} · {"type":"goal_progress","match":"...","p":0-100} · {"type":"vacation_set","name":"...","goal":importo,"month":"AAAA-MM","saved":già_messo} (piano di risparmio: l'importo mensile lo calcola l'app, non scriverlo tu) · {"type":"income_set","mode":"fixed|hourly|commission","amount":netto_mensile,"hours":ore,"rate":paga_oraria_netta,"overtimeHours":..,"overtimeRate":..,"revenue":incasso,"pct":percentuale,"extra":..,"next":quanto_arriva_il_mese_prossimo} (entrata prevista) · {"type":"fixed_add","name":"...","amount":importo_mensile} · {"type":"fixed_change","match":"nome della spesa fissa","amount":nuovo_importo} · {"type":"save_goal","name":"...","total":importo,"month":"AAAA-MM","saved":già_messo} (soldi da mettere da parte per acquisti/vacanze; il mensile lo calcola l'app) · {"type":"bill_spread","name":"fattura","total":importo,"months":mesi,"perMonth":importo_al_mese} (distribuire una fattura grossa su più mesi: dai mesi OPPURE l'importo mensile) · {"type":"open","page":"monthPlan|lifefinance|vacationPlan|privacyCenter|fitnessMealPlan|fitnessFridge|lifetask|plan|settings"}. Usa solo dati che l'utente ha detto o che stanno nel contesto; se manca un dato essenziale (importo, data, ora) chiedilo invece di inventarlo. Dì che l'hai fatto solo se hai scritto la riga [[AZIONE]]; se l'elemento non c'è nell'elenco, chiedi quale intende.`;

/** Theia scrive come in una chat: i messaggi sono separati da una riga con solo |||. Al massimo 5, mai vuoti. */
export function splitReply(text: string): string[] {
  return String(text ?? '').split(/\n\s*\|\|\|\s*\n/).map((x) => x.replace(/\|\|\|/g, '').trim()).filter(Boolean).slice(0, 5);
}

/** Il testo che Theia sta scrivendo adesso: senza le azioni [[...]] e senza i separatori ||| a meta', diviso nei messaggi gia' aperti. */
export function liveParts(acc: string): string[] {
  const cut = acc.indexOf('[[');
  const t = (cut >= 0 ? acc.slice(0, cut) : acc).replace(/\n?\s*\|{1,3}\s*$/, '').replace(/\[$/, '');
  return t.split(/\n\s*\|\|\|\s*\n?/).map((x) => x.replace(/\|\|\|/g, '').trim()).filter(Boolean).slice(0, 5);
}

const ASK_OPEN = /\b(apri|aprimi|vai|portami|mostrami|mostra|fammi vedere|open|show|go to|take me)\b/i;
const ASK_DO = /\b(aggiung|rinomin|sposta|anticip|posticip|completa|salva|scrivi|aggiorna|rimuov|svuota|togli|ricordami|avvisami|promemoria|crea|segn|mett|cancell|elimin|sposta|imposta|inserisc|pianific|ricord|prenot|fissa|fai|fammi|registr|modific|cambia|distribui|add|create|delete|remove|set|remind|schedule|move|mark|change)\w*/i;
/* un «si» vale solo se e' una risposta breve («sì», «sì fallo», «ok va bene»), non l'inizio di un'altra domanda */
const SAYS_YES = /^\s*(s[iì]|ok|va bene|certo|esatto|fallo|procedi|yes|sure|do it)(?![\p{L}\d])[^\p{L}\d]*([\p{L}\d']+[^\p{L}\d]*){0,3}$/iu;
/** L'AI propone un'azione solo se l'utente l'ha chiesta o ha detto di si: mai a un saluto o a una semplice domanda. */
export function filterActions(userText: string, actions: AiAct[]): AiAct[] {
  const yes = SAYS_YES.test(userText);
  return actions.filter((a) => yes || (a.type === 'open' ? ASK_OPEN.test(userText) : ASK_DO.test(userText)));
}
