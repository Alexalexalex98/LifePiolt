import type { Analysis, Correlation, Insight } from '@/lib/analytics';
import { reliabilityOf, type Candidate, type Topic } from '@/lib/dashBrief';
import type { Suggestion } from '@/lib/theia';

const topicOfDomain = (d: string): Topic => (d === 'salute' ? 'salute' : d === 'mente' ? 'mente' : d === 'finanza' ? 'finanza' : d === 'crescita' ? 'crescita' : 'altro');
const pageOfTopic: Record<Topic, { page: string; label: string }> = {
  salute: { page: 'lifehealth', label: 'Apri Salute' }, mente: { page: 'mood', label: 'Apri Umore e contesto' }, finanza: { page: 'lifefinance', label: 'Apri Finanze' },
  crescita: { page: 'lifetask', label: 'Apri i tuoi task' }, agenda: { page: 'plan', label: 'Apri il Plan' }, messaggi: { page: 'messagesPage', label: 'Apri i messaggi' }, altro: { page: 'lifehealth', label: 'Apri Salute' },
};

/** Insight dell'analisi dati -> candidato: fatto osservato + periodo, eventuale lettura, affidabilità e perché ora. */
export function fromInsight(i: Insight, byId: Record<string, Analysis>, corrs: Correlation[]): Candidate {
  const a = i.metricId ? byId[i.metricId] : undefined;
  const topic = topicOfDomain(i.domain);
  const kind = i.id.startsWith('trend-') ? 'trend' : i.id.startsWith('goal-') ? 'goal' : i.id.startsWith('anom-') ? 'anomaly' : i.id.startsWith('corr-') ? 'correlation' : i.id.startsWith('gap-') || i.id.startsWith('streak-') ? 'fact' : 'fact';
  const corr = kind === 'correlation' ? corrs.find((c) => i.id === `corr-${c.a.id}-${c.b.id}`) : undefined;
  const n = corr?.n ?? a?.n;
  const period = kind === 'correlation' ? `ultimi ${corr?.n ?? '—'} giorni` : kind === 'anomaly' ? 'ultimi 3 giorni' : i.id.startsWith('gap-') ? 'dall\'ultima misura' : a?.def.period === 'month' ? 'ultimi mesi' : 'ultimi 7 giorni';
  const reading = kind === 'trend' ? 'Il valore si sta muovendo in modo costante. Non so ancora dire il perché: i dati dicono cosa cambia, non la causa.'
    : kind === 'anomaly' ? 'Può essere un valore isolato: un singolo dato fuori dalla norma non basta a parlare di un cambiamento.'
    : kind === 'correlation' ? 'I due andamenti tendono a muoversi insieme. È un\'associazione: può dipendere da altro o essere un caso.' : undefined;
  const whyNow = kind === 'trend' ? 'Il cambiamento si vede negli ultimi giorni.' : kind === 'goal' ? 'La media di questa settimana è sotto il tuo obiettivo.' : kind === 'anomaly' ? 'Valore insolito registrato di recente.'
    : kind === 'correlation' ? 'È un legame che si ripete nei tuoi dati.' : i.id.startsWith('gap-') ? 'Mancano dati da qualche giorno.' : 'È un risultato recente.';
  const jump = i.metricId && a ? { metricId: i.metricId } : { page: pageOfTopic[topic].page };
  return {
    id: i.id, topic, sub: a?.def.id ?? i.id, severity: i.severity === 'info' ? 'info' : i.severity, urgency: Math.min(1, i.priority / 4),
    observed: kind === 'correlation' ? i.detail.split(' (')[0] : i.title, period, ...(reading ? { reading } : {}),
    reliability: reliabilityOf({ n, significant: a?.significant, kind: kind === 'fact' ? 'fact' : kind }), whyNow,
    ...(i.action && i.severity !== 'good' ? { suggestion: i.action } : {}),
    followLabel: i.metricId && a ? `Apri l'andamento: ${a.def.label}` : pageOfTopic[topic].label, follow: jump, detail: i.detail,
  };
}

const needTopic = (id: string): Topic => (id.startsWith('ev') ? 'agenda' : id === 'tasks' || id.startsWith('goal-') ? 'crescita' : id === 'chat' ? 'messaggi' : id === 'sleep' ? 'salute' : id.startsWith('bud-') ? 'finanza' : 'altro');

/** Suggerimenti pratici di Theia (agenda, task, obiettivi, messaggi, budget) -> candidati. */
export function fromNeed(s: Suggestion): Candidate {
  const topic = needTopic(s.id);
  return {
    id: `need-${s.id}`, topic, sub: s.id.replace(/\d+$/, ''), severity: 'todo', urgency: Math.max(0.15, Math.min(1, s.score / 10)),
    observed: s.title, period: 'oggi', reliability: null, whyNow: s.why, ...(s.detail ? { suggestion: s.detail } : {}),
    followLabel: s.cta, follow: s.page ? { page: s.page, ...(s.params ? { params: s.params } : {}) } : { ask: 'Cosa devo fare adesso?' }, critical: s.id.startsWith('ev'),
  };
}
