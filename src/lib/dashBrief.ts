/**
 * Dashboard come analista personale (modulo PURO, nessun alias '@/'): sceglie al massimo tre insight in base a urgenza, interessi e
 * a ciò che la persona ha già scartato, e scrive il breve resoconto del giorno. Distingue FATTI (osservati), LETTURE (interpretazioni)
 * e SUGGERIMENTI. Con pochi dati non produce numeri né previsioni. Le correlazioni non sono mai presentate come cause.
 */
export type Topic = 'salute' | 'mente' | 'finanza' | 'crescita' | 'agenda' | 'messaggi' | 'altro';
export const TOPIC_LABEL: Record<Topic, string> = { salute: 'Salute', mente: 'Mente', finanza: 'Finanze', crescita: 'Obiettivi e task', agenda: 'Agenda', messaggi: 'Messaggi', altro: 'Altro' };
export const TOPICS = Object.keys(TOPIC_LABEL) as Topic[];

export type Reliability = { level: 'alta' | 'media' | 'bassa'; why: string };
/** Quanto è affidabile una lettura: dipende da quanti giorni di dati ci sono e dal tipo di osservazione. Null se non valutabile (es. una scadenza). */
export function reliabilityOf(o: { n?: number; significant?: boolean; kind: 'fact' | 'trend' | 'goal' | 'anomaly' | 'correlation' | 'habit' }): Reliability | null {
  if (o.kind === 'fact' || o.kind === 'habit' || o.n == null) return null;
  if (o.kind === 'correlation') return { level: o.n >= 21 ? 'media' : 'bassa', why: `Osservata su ${o.n} giorni: è un'associazione, non una causa` };
  if (o.n < 5) return { level: 'bassa', why: `Solo ${o.n} giorni di dati` };
  if (o.n >= 14 && (o.significant || o.kind === 'goal')) return { level: 'alta', why: `${o.n} giorni di dati${o.significant ? ', andamento significativo' : ''}` };
  return { level: 'media', why: `${o.n} giorni di dati${o.n < 14 ? ': ancora pochi per essere sicuri' : ''}` };
}

export type FollowTarget = { page: string; params?: Record<string, string> } | { metricId: string } | { ask: string };
export type Candidate = {
  id: string; topic: Topic; /** sotto-argomento (es. 'sleep') per poterlo togliere da solo */ sub?: string;
  severity: 'bad' | 'warn' | 'good' | 'info' | 'todo'; /** 0-1: quanto è imminente */ urgency: number;
  /** FATTO osservato e periodo */ observed: string; period: string;
  /** LETTURA proposta da Theia (assente se è solo un promemoria) */ reading?: string;
  reliability: Reliability | null; /** perché compare proprio ora */ whyNow: string;
  /** SUGGERIMENTO */ suggestion?: string;
  followLabel: string; follow: FollowTarget; detail?: string;
  /** scadenze imminenti: restano visibili anche se l'argomento è stato ridotto (non se si dice "non mi interessa" proprio a questa) */ critical?: boolean;
};

export type Feedback = { follow: number; irrelevant: number };
export type DashPrefs = {
  now: number;
  /** interesse della persona per argomento (0-20), da interessi dichiarati, aree scelte e ciò che apre */
  interest: Partial<Record<Topic, number>>;
  /** id esatti o 'sub:<topic>:<sub>' tolti con «Non mi interessa» */
  muted: string[];
  snoozed: Record<string, number>;
  feedback: Partial<Record<Topic, Feedback>>;
};

const SEV: Record<Candidate['severity'], number> = { bad: 3, warn: 2, todo: 1.6, info: 1, good: 1 };
/** Punteggio di rilevanza: gravità e urgenza, moltiplicate per l'interesse e per cosa la persona ha seguito o scartato. */
export function scoreCandidate(c: Candidate, p: DashPrefs): number {
  const interest = 1 + Math.min(1, (p.interest[c.topic] ?? 0) / 20);
  const fb = p.feedback[c.topic] ?? { follow: 0, irrelevant: 0 };
  const factor = Math.max(0.2, Math.min(1.6, 1 + 0.12 * fb.follow - 0.3 * fb.irrelevant));
  const reliab = c.reliability ? (c.reliability.level === 'alta' ? 1 : c.reliability.level === 'media' ? 0.85 : 0.6) : 1;
  const base = (SEV[c.severity] + c.urgency * 2) * reliab;
  return Math.round(base * interest * (c.critical ? Math.max(factor, 1) : factor) * 100) / 100;
}
export const isHidden = (c: Candidate, p: DashPrefs): boolean =>
  p.muted.includes(c.id) || (!c.critical && p.muted.includes(`topic:${c.topic}`)) || (!!c.sub && p.muted.includes(`sub:${c.topic}:${c.sub}`)) || (p.snoozed[c.id] ?? 0) > p.now;

/** I (al massimo) `max` insight da mostrare, in ordine di rilevanza. Mai due dello stesso argomento prima che ne compaiano di altri. */
export function rankCandidates(cands: Candidate[], p: DashPrefs, max = 3): Candidate[] {
  const seen = new Set<string>();
  const ok = cands.filter((c) => !isHidden(c, p) && (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const scored = ok.map((c, i) => ({ c, i, s: scoreCandidate(c, p) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const out: Candidate[] = [];
  const usedTopics = new Set<Topic>();
  for (const x of scored) { if (out.length >= max) break; if (!usedTopics.has(x.c.topic)) { out.push(x.c); usedTopics.add(x.c.topic); } }
  for (const x of scored) { if (out.length >= max) break; if (!out.includes(x.c)) out.push(x.c); }
  return out.sort((a, b) => scoreCandidate(b, p) - scoreCandidate(a, p));
}

/** Interessi per argomento da aree scelte, interessi dichiarati e temi imparati dall'uso. */
export function interestWeights(o: { areas: string[]; interests: string[]; themes: Partial<Record<string, number>> }): Partial<Record<Topic, number>> {
  const w: Partial<Record<Topic, number>> = {};
  const add = (t: Topic, v: number) => { w[t] = Math.min(20, (w[t] ?? 0) + v); };
  const areaMap: Record<string, [Topic, number][]> = {
    giornate: [['agenda', 8], ['crescita', 4]], salute: [['salute', 10], ['mente', 4]], soldi: [['finanza', 10]], viaggi: [['agenda', 3]],
    studio: [['crescita', 8]], famiglia: [['messaggi', 5], ['agenda', 3]], persone: [['messaggi', 6]], investire: [['finanza', 8], ['crescita', 3]],
  };
  o.areas.forEach((a) => (areaMap[a] ?? []).forEach(([t, v]) => add(t, v)));
  const txt = o.interests.join(' ').toLowerCase();
  if (/sport|movimento|natura|relax/.test(txt)) add('salute', 4);
  if (/soldi|shopping/.test(txt)) add('finanza', 3);
  if (/libri|storia|musei|arte/.test(txt)) add('crescita', 2);
  const th: Record<string, Topic> = { corsa: 'salute', sport: 'salute', salute: 'salute', mente: 'mente', soldi: 'finanza', studio: 'crescita', lingue: 'crescita', lavoro: 'crescita', tech: 'crescita' };
  for (const [k, v] of Object.entries(o.themes)) if (th[k] && v) add(th[k], Math.min(6, v / 2));
  return w;
}

/* ---------- il quadro di oggi ---------- */
export type BriefLine = { kind: 'fact' | 'reading' | 'suggestion'; text: string };
export type Brief = { state: 'ok' | 'pochi_dati' | 'tranquillo'; headline: string; lines: BriefLine[]; dataNote?: string };
export type BriefInput = {
  name: string; hour: number;
  eventsToday: { time: string; title: string }[]; nextEvent?: { time: string; title: string; daysAhead: number } | null;
  openTasks: number; urgentTasks: string[];
  /** giorni di dati di salute/umore/finanze utili all'analisi */ dataDays: number; hasAnyData: boolean;
  top: Candidate[]; moodToday?: string | null;
};
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Breve resoconto in linguaggio naturale. Con pochi dati lo dice e non scrive numeri o previsioni. */
export function buildBrief(i: BriefInput): Brief {
  const lines: BriefLine[] = [];
  const first = i.eventsToday[0];
  lines.push({ kind: 'fact', text: i.eventsToday.length === 0 ? 'Oggi non hai impegni in agenda.' : i.eventsToday.length === 1 ? `Oggi hai un impegno: «${first.title}» alle ${first.time}.` : `Oggi hai ${i.eventsToday.length} impegni: il primo è «${first.title}» alle ${first.time}.` });
  if (i.urgentTasks.length) lines.push({ kind: 'fact', text: `${i.urgentTasks.length} ${plural(i.urgentTasks.length, 'task urgente', 'task urgenti')}: ${i.urgentTasks.slice(0, 2).map((x) => `«${x}»`).join(', ')}${i.urgentTasks.length > 2 ? '…' : ''}.` });
  else if (i.openTasks) lines.push({ kind: 'fact', text: `${i.openTasks} ${plural(i.openTasks, 'task aperto', 'task aperti')}, nessuno segnato come urgente.` });
  const lead = i.top[0];
  if (lead?.reading) lines.push({ kind: 'reading', text: lead.reading });
  if (lead?.suggestion) lines.push({ kind: 'suggestion', text: lead.suggestion });
  const lowData = i.dataDays < 7;
  const dataNote = !i.hasAnyData ? 'Non ho ancora dati di salute, umore o finanze da analizzare: non faccio stime. Appena ne registri alcuni, qui compaiono letture e suggerimenti.' : lowData ? `Ho solo ${i.dataDays} ${plural(i.dataDays, 'giorno', 'giorni')} di dati: per ora niente stime né previsioni, solo ciò che è stato osservato.` : undefined;
  const state: Brief['state'] = !i.hasAnyData || lowData ? 'pochi_dati' : i.top.length === 0 ? 'tranquillo' : 'ok';
  const g = i.hour < 12 ? 'Buongiorno' : i.hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const headline = state === 'tranquillo' ? 'Oggi è una giornata tranquilla' : state === 'pochi_dati' ? 'Ti conosco ancora poco' : i.top[0]?.severity === 'bad' || i.top[0]?.severity === 'warn' ? 'Oggi c\'è una cosa da guardare' : 'Il quadro di oggi';
  void g;
  return { state, headline, lines, ...(dataNote ? { dataNote } : {}) };
}

/** Stato tranquillo utile: cosa fare quando non emerge nulla di importante (senza inventare avvisi). */
export function calmSuggestion(i: { nextEvent?: { title: string; time: string; daysAhead: number } | null; eventsToday: number }): string {
  if (i.nextEvent && i.nextEvent.daysAhead === 0) return `Non emerge nulla di importante. Il prossimo impegno è «${i.nextEvent.title}» alle ${i.nextEvent.time}.`;
  if (i.nextEvent) return `Non emerge nulla di importante. Il prossimo impegno è «${i.nextEvent.title}» ${i.nextEvent.daysAhead === 1 ? 'domani' : `tra ${i.nextEvent.daysAhead} giorni`}.`;
  return 'Non emerge nulla di importante e l\'agenda è libera: un buon momento per pianificare la settimana.';
}
