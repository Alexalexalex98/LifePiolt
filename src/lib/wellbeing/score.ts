/**
 * Life Score v2: mette insieme i segnali di benessere in un punteggio 0-100 e dice PERCHÉ è quel numero.
 *  - segnali FORTI (misurano come stai): umore, sonno, energia, alimentazione, capacità di fare le cose, relazioni, movimento, tensione/stress, tempo nell'app, alcol dichiarato;
 *  - segnali di CONTESTO (non misurano, spiegano il perché): lavoro, soldi, obiettivi, meteo, visite mediche e quello che l'utente racconta in chat;
 *  - la baseline personale pesa quanto il valore assoluto: peggiorare rispetto al proprio solito abbassa il punteggio anche se il valore resta «ok»;
 *  - più segnali che peggiorano insieme contano di più;
 *  - il questionario WHO-5 recente calibra il risultato;
 *  - se i dati sono pochi il punteggio è «provvisorio» o assente: non si inventa.
 * Non è una diagnosi e non vede tutto: lo dice. Modulo PURO (lavora sulle analisi del motore).
 */
import { attainment, type Analysis } from '../analytics.ts';
import { deviations, type Dev, type Level, type Sig } from './baseline.ts';

export type FactorId = 'umore' | 'sonno' | 'energia' | 'cibo' | 'funzionamento' | 'relazioni' | 'movimento' | 'tensione' | 'schermi' | 'alcol';
export type FactorDef = { id: FactorId; label: string; weight: number; metrics: string[]; /** da dove arriva e come lo leggo */ about: string; /** cosa fare quando è basso */ tip: string };

export const FACTORS: FactorDef[] = [
  { id: 'umore', label: 'Umore', weight: 2, metrics: ['mood', 'moodChat'], about: 'I tuoi check-in dell\'umore (da 1 a 5) e il tono dei messaggi che scrivi a Theia, letto sul telefono.', tip: 'Fai il check-in ogni giorno e scrivimi cosa ti pesa: se dura da più di due settimane, parlane con un professionista.' },
  { id: 'sonno', label: 'Sonno', weight: 1.6, metrics: ['sleep'], about: 'Ore dormite (Apple Health, orologio o inserite da te), rispetto a 7-9 ore.', tip: 'Orari regolari per andare a letto e svegliarti, schermi spenti prima di dormire.' },
  { id: 'energia', label: 'Energia e fatica', weight: 1.3, metrics: ['energyLvl'], about: 'Quanta energia dici di avere nel check-in (da 1 a 5).', tip: 'Guarda sonno, pasti e movimento: sono i tre che la muovono di più. Se la fatica non passa, parlane con il medico.' },
  { id: 'cibo', label: 'Alimentazione', weight: 1.2, metrics: ['diet', 'mealRhythm'], about: 'Qualità dei pasti registrati e regolarità degli orari: saltare i pasti o mangiare a orari caotici è un segnale precoce.', tip: 'Tre pasti a orari regolari, anche semplici: conta più della perfezione.' },
  { id: 'funzionamento', label: 'Lavoro, studio e faccende', weight: 1.3, metrics: ['functioning', 'tasks'], about: 'Quanto dici di riuscire a gestire le cose di tutti i giorni (check-in) e quante task completi.', tip: 'Scegli 3 cose per oggi e spezza le grandi in passi da 10 minuti.' },
  { id: 'relazioni', label: 'Relazioni', weight: 1.5, metrics: ['social'], about: 'Con quante persone parli o ti vedi (chat e agenda). Conta il calo rispetto al tuo solito più del valore assoluto: è così che si vede l\'isolamento.', tip: 'Scrivi o chiama oggi una persona a cui tieni; fissa un caffè nel Plan.' },
  { id: 'movimento', label: 'Attività fisica', weight: 1, metrics: ['steps', 'exercise', 'training'], about: 'Passi, minuti di esercizio e allenamenti rispetto ai tuoi obiettivi.', tip: 'Una camminata di 15-20 minuti al giorno basta per cominciare.' },
  { id: 'tensione', label: 'Stress e tensione', weight: 1.2, metrics: ['stress', 'stressChat'], about: 'Stress dall\'orologio (battito, HRV) o dalle parole che usi scrivendo a Theia.', tip: '3-5 minuti di respiro lento nei momenti di picco, e una pausa vera al giorno.' },
  { id: 'schermi', label: 'Tempo nell\'app', weight: 0.4, metrics: ['appMin'], about: 'Minuti al giorno in questa app (solo questa: non vedo cosa fai nel resto del telefono).', tip: 'Se passi molto tempo nell\'app senza uno scopo, prova a darti degli orari.' },
  { id: 'alcol', label: 'Alcol', weight: 0.5, metrics: ['alcohol'], about: 'Solo quello che mi dici tu nel check-in settimanale.', tip: 'Se senti che bere è diventato un modo per stare meglio, parlane con il medico: non sei solo/a.' },
];

/** Metriche usate per la baseline personale (le deviazioni dal tuo solito). */
export const BASELINE_SIGNALS: { metric: string; factor: FactorId; label: string; bad: 'down' | 'up' }[] = [
  { metric: 'mood', factor: 'umore', label: 'Umore', bad: 'down' },
  { metric: 'sleep', factor: 'sonno', label: 'Sonno', bad: 'down' },
  { metric: 'energyLvl', factor: 'energia', label: 'Energia', bad: 'down' },
  { metric: 'mealRhythm', factor: 'cibo', label: 'Ritmo dei pasti', bad: 'down' },
  { metric: 'functioning', factor: 'funzionamento', label: 'Capacità di fare le cose', bad: 'down' },
  { metric: 'social', factor: 'relazioni', label: 'Contatti con le persone', bad: 'down' },
  { metric: 'steps', factor: 'movimento', label: 'Movimento', bad: 'down' },
  { metric: 'stressChat', factor: 'tensione', label: 'Stress nei messaggi', bad: 'up' },
];

export type FactorResult = {
  id: FactorId; label: string; weight: number; score: number; /** 'ok' da 75, 'attenzione' da 50 */ level: 'ok' | 'attenzione' | 'basso';
  value: string; /** vs il tuo solito */ vsBase?: string; /** perché questo punteggio */ why: string; tip: string; about: string; deviating: boolean; /** quanto toglie al totale (peso × distanza da 100) */ loss: number;
};
export type Context = { id: string; label: string; text: string };
export type Confidence = 'bassa' | 'media' | 'alta';
export type LifeScore = {
  score: number | null; confidence: Confidence; provisional: boolean; coverage: number; days: number;
  factors: FactorResult[]; down: FactorResult[]; up: FactorResult[];
  deviation: { level: Level; devs: Dev[]; ready: boolean };
  who5?: { score: number; ts: number; weight: number }; cap?: string;
  summary: string; reasons: string[]; context: Context[]; notSeen: string[]; limits: string;
};

export const LIMITS = 'Questo punteggio orienta, non diagnostica. Vede solo quello che l\'app conosce e quello che mi dici: l\'assenza di segnali non vuol dire che vada tutto bene, e non misura pensieri di farsi del male. Se stai male da più di due settimane, peggiori, o hai pensieri che ti spaventano, parlane con una persona di fiducia o con un professionista.';

const num = (v: number, dec = 1) => String(Math.round(v * 10 ** dec) / 10 ** dec).replace('.', ',');
const val = (a: Analysis) => (a.def.period === 'day' ? a.avg7 : a.latest.v);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const levelOf = (s: number): FactorResult['level'] => (s >= 75 ? 'ok' : s >= 50 ? 'attenzione' : 'basso');
const unitText = (a: Analysis) => `${num(val(a), a.def.dec)}${a.def.unit.startsWith('/') ? a.def.unit : ` ${a.def.unit}`}`.trim();

export type Input = {
  list: Analysis[]; today: string; days: number;
  /** ultimo WHO-5 (0-100) con data */ who5?: { score: number; ts: number };
  context?: Context[]; now?: number;
};

export function computeLifeScore(inp: Input): LifeScore {
  const by: Record<string, Analysis> = {};
  inp.list.forEach((a) => { by[a.def.id] = a; });
  const sid = (b: (typeof BASELINE_SIGNALS)[number]) => (b.metric === 'energyLvl' ? 'energy' : b.metric);
  const sigs: Sig[] = BASELINE_SIGNALS.filter((b) => by[b.metric]).map((b) => ({ id: sid(b), label: b.label, bad: b.bad, pts: by[b.metric]!.pts }));
  const dev = deviations(sigs, inp.today);
  const devByFactor = new Map<string, Dev>();
  const hasSig = new Set<string>();
  BASELINE_SIGNALS.forEach((b) => { if (by[b.metric]) hasSig.add(b.factor); const d = dev.devs.find((x) => x.id === sid(b)); if (d) devByFactor.set(b.factor, d); });

  const factors: FactorResult[] = [];
  for (const f of FACTORS) {
    const items = f.metrics.map((m) => by[m]).filter((a): a is Analysis => !!a && a.ageDays <= 14);
    const scored = items.map((a) => ({ a, s: attainment(a.def, val(a)) })).filter((x): x is { a: Analysis; s: number } => x.s != null);
    if (!scored.length) continue;
    let s = scored.reduce((x, y) => x + y.s, 0) / scored.length;
    const d = devByFactor.get(f.id);
    let vsBase: string | undefined;
    if (d) {
      const penalty = clamp(6 + 6 * (Math.abs(d.z) - 1.2), 6, 20);
      s -= penalty;
      const pct = d.base ? Math.round(((d.recent - d.base) / Math.abs(d.base)) * 100) : 0;
      vsBase = `Negli ultimi giorni ${num(d.recent, 1)} contro il tuo solito ${num(d.base, 1)} (${pct > 0 ? '+' : ''}${pct}%): peggio del tuo normale, tolgo ${Math.round(penalty)} punti.`;
    } else if (dev.ready && hasSig.has(f.id)) {
      vsBase = 'In linea con il tuo solito.';
    }
    s = Math.round(clamp(s));
    const worst = [...scored].sort((x, y) => x.s - y.s)[0]!;
    const value = scored.map((x) => `${x.a.def.label}: ${unitText(x.a)}`).join(' · ');
    const why = s >= 75
      ? `${f.label} è nei valori buoni.`
      : `${worst.a.def.label} è il punto debole: ${unitText(worst.a)}${worst.a.def.target != null ? ` contro ${worst.a.def.better === 'down' ? 'al massimo' : 'almeno'} ${num(worst.a.def.target, worst.a.def.dec)}` : ''}.`;
    factors.push({ id: f.id, label: f.label, weight: f.weight, score: s, level: levelOf(s), value, vsBase, why, tip: f.tip, about: f.about, deviating: !!d, loss: Math.round((100 - s) * f.weight) });
  }

  const totalW = FACTORS.reduce((x, f) => x + f.weight, 0);
  const haveW = factors.reduce((x, f) => x + f.weight, 0);
  const coverage = Math.round((haveW / totalW) * 100) / 100;
  const confidence: Confidence = coverage >= 0.7 && inp.days >= 21 ? 'alta' : coverage >= 0.5 && inp.days >= 7 ? 'media' : 'bassa';
  const reasons: string[] = [];
  let score: number | null = null;
  let cap: string | undefined;
  let who: LifeScore['who5'];
  if (factors.length >= 3 && coverage >= 0.35) {
    let s = factors.reduce((x, f) => x + f.score * f.weight, 0) / haveW;
    reasons.push(`Media pesata di ${factors.length} fattori (umore e relazioni pesano di più): ${Math.round(s)}.`);
    const nDev = factors.filter((f) => f.deviating).length;
    if (nDev >= 2) { const extra = Math.min(9, (nDev - 1) * 3); s -= extra; reasons.push(`${nDev} segnali peggiorano insieme rispetto al tuo solito: più segnali insieme pesano di più, tolgo altri ${extra} punti.`); }
    if (inp.who5 && (inp.now ?? Date.now()) - inp.who5.ts <= 21 * 86400000) {
      const w = confidence === 'alta' ? 0.2 : confidence === 'media' ? 0.3 : 0.5;
      who = { score: inp.who5.score, ts: inp.who5.ts, weight: w };
      s = (1 - w) * s + w * inp.who5.score;
      reasons.push(`Il tuo questionario WHO-5 recente (${inp.who5.score}/100) calibra il risultato per il ${Math.round(w * 100)}%.`);
    }
    if ((dev.level === 'forte' || (inp.who5 && inp.who5.score <= 28)) && s > 65) { s = 65; cap = dev.level === 'forte' ? 'Il punteggio non può superare 65 mentre più segnali centrali peggiorano insieme.' : 'Il punteggio non può superare 65 con un WHO-5 molto basso.'; reasons.push(cap); }
    score = Math.round(clamp(s));
  }

  const sorted = [...factors].sort((a, b) => b.loss - a.loss);
  const down = sorted.filter((f) => f.score < 70).slice(0, 3);
  const up = [...factors].filter((f) => f.score >= 80).sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 2);
  const context = (inp.context ?? []);
  const notSeen = [
    ...FACTORS.filter((f) => !factors.some((x) => x.id === f.id)).map((f) => `${f.label}: non ho dati (${f.about.split('.')[0]!.toLowerCase()}).`),
    'Ansia, pensieri intrusivi, eventi, conflitti, storia personale e traumi: li conosco solo da ciò che mi racconti in chat.',
  ];
  let summary: string;
  if (score == null) summary = 'Mi mancano ancora dati per darti un numero affidabile: fai il check-in ogni giorno e collega sonno e movimento. Non invento un punteggio.';
  else {
    const dn = down.length ? `Lo abbassano soprattutto ${down.map((f) => f.label.toLowerCase()).join(', ')}.` : 'Nessun fattore lo abbassa in modo importante.';
    const upt = up.length ? ` Lo sostengono ${up.map((f) => f.label.toLowerCase()).join(' e ')}.` : '';
    summary = `Il tuo Life Score è ${score}${confidence === 'bassa' ? ' (provvisorio: dati ancora pochi)' : ''}. ${dn}${upt}`;
  }
  return { score, confidence, provisional: confidence === 'bassa', coverage, days: inp.days, factors: sorted, down, up, deviation: { level: dev.level, devs: dev.devs, ready: dev.ready }, who5: who, cap, summary, reasons, context, notSeen, limits: LIMITS };
}
