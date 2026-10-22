import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useLpMoney } from '@/store/lpMoney';
import { useNet } from '@/store/network';
import { usePantry } from '@/store/pantry';
import { useShifts } from '@/store/shifts';
import { useTravel } from '@/store/travel';

/**
 * Tutto ciò che c'è nell'app, in forma compatta, per Theia: i dati veri dell'utente (mai inventati).
 * Si tolgono funzioni, immagini e testi lunghi; le liste si accorciano tenendo le voci più recenti.
 */
export function compact(v: unknown, depth = 4, list = 25, str = 160): unknown {
  if (v == null || typeof v === 'function') return undefined;
  if (typeof v === 'string') return /^(data:|file:|https?:\/\/.*\.(jpg|jpeg|png|mp4))/i.test(v) ? undefined : v.length > str ? `${v.slice(0, str)}…` : v;
  if (typeof v !== 'object') return v;
  if (depth <= 0) return undefined;
  if (Array.isArray(v)) {
    const out = v.slice(-list).map((x) => compact(x, depth - 1, list, str)).filter((x) => x !== undefined);
    return v.length > list ? [`(${v.length} in tutto, ultime ${list})`, ...out] : out;
  }
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (/^(token|password|pin|secret|photo|image|uri|thumb|avatar|cover|bg)/i.test(k)) continue;
    const c = compact(x, depth - 1, list, str);
    if (c !== undefined && !(typeof c === 'object' && Object.keys(c as object).length === 0)) o[k] = c;
  }
  return o;
}

type Section = { id: string; cat: string; re: RegExp; get: () => unknown };

const pick = (o: object, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, (o as Record<string, unknown>)[k]]));

const SECTIONS: Section[] = [
  { cat: 'agenda', id: 'Agenda, task, note, obiettivi, file', re: /(task|attivit|impegn|event|agenda|calendar|nota|note|obiettiv|file|document|drive|vacanz|automazion|ricord|promemoria|piano|settimana|oggi|domani)/i,
    get: () => { const l = useLife.getState(); return compact({ tasks: l.tasks, goals: l.goals, automations: l.automations, notes: l.notes, files: l.drive.map((f) => ({ name: (f as { name?: string }).name, kind: (f as { kind?: string }).kind })), events: l.events, vacations: l.vacations, vacRange: l.vacRange }, 5, 40, 200); } },
  { cat: 'finance', id: 'Finanze: conto, estratto, budget, bollette, tasse, investimenti', re: /(spes|soldi|budget|risparm|stipendi|estratto|conto|bolletta|bollette|fattur|tass|imposte|dichiarazion|investi|azion|titol|abbonament|affitto|mutuo|finanz|euro|chf|tagli|costi|uscite|entrate|saldo|lifepoint|punti|pagament)/i,
    get: () => { const f = useFin.getState(); const m = useLpMoney.getState(); return compact({ ...pick(f, ['savingsPct', 'vacation', 'budget', 'guidelines', 'bills', 'invoices', 'tax', 'cash', 'trades', 'plans', 'statementInfo', 'insights']), movimentiUltimiMesi: f.months.slice(-4), lifeMoney: pick(m, ['budgets', 'goals', 'roundUpGoal', 'subs', 'requests']) }, 5, 60, 90); } },
  { cat: 'health', id: 'Salute, umore, sonno, mente', re: /(salute|sonno|dorm|passi|umore|stress|mente|medit|cuore|battit|peso|energia|respir|apple|watch|benessere|allenament)/i,
    get: () => compact(pick(useHealth.getState(), ['series', 'dates', 'workouts', 'mindSessions', 'moods', 'wearable', 'extra']), 5, 30, 90) },
  { cat: 'fitness', id: 'Fitness, cibo, frigo, piano alimentare', re: /(allenament|palestra|esercizi|scheda|programm|fitness|cibo|mangi|pranz|cena|colazion|ricett|frigo|dispensa|spesa|calorie|kcal|proteine|dieta|pasto|acqua|bere|peso)/i,
    get: () => { const f = useFitness.getState(); const p = usePantry.getState(); return compact({ ...pick(f, ['profile', 'body', 'activeProgram', 'history', 'meals', 'water', 'sub', 'visits', 'lunch', 'lunchLog', 'exDone']), frigo: pick(p, ['items', 'shop', 'plan', 'prefs']) }, 5, 30, 90); } },
  { cat: 'travel', id: 'Viaggi, hotel, turni', re: /(viagg|hotel|volo|vacanz|itinerar|citt|turno|turni|lavoro|orari)/i,
    get: () => compact({ travel: pick(useTravel.getState(), ['style', 'city', 'guests', 'budget', 'saved']), turni: useShifts.getState().shifts }, 5, 30, 120) },
  { cat: 'network', id: 'Rete, post, messaggi, prenotazioni, seminari, LifePoints', re: /(post|network|seguac|segui|amici|messagg|chat|prenotaz|seminar|servizi|club|community|lifepoint|punti|profilo|biglietto|notific|idee|lavoro|candidat)/i,
    get: () => { const n = useNet.getState(); return compact({ ...pick(n, ['lifePoints', 'ledger', 'following', 'posts', 'communities', 'bookings', 'ideas', 'seminars', 'enrollments', 'bio', 'myCard', 'notifications']) }, 4, 20, 120); } },
];

export type CtxPart = { cat: string; label: string; text: string };

/** Sezioni dei dati che c'entrano con la domanda; se la domanda è generica, un po' di tutto in breve. Il filtro per categoria (consenso) lo fa il chiamante. */
export function appContextParts(question: string, maxChars = 9000): CtxPart[] {
  const hit = SECTIONS.filter((s) => s.re.test(question));
  const chosen = hit.length ? hit : SECTIONS;
  const per = Math.floor(maxChars / chosen.length);
  const out: CtxPart[] = [];
  for (const s of chosen) {
    try { const j = JSON.stringify(s.get()); if (j && j !== '{}') out.push({ cat: s.cat, label: s.id, text: j.length > per ? `${j.slice(0, per)}…` : j }); } catch { /* sezione non disponibile */ }
  }
  return out;
}

export const partsText = (parts: CtxPart[]) => parts.map((p) => `## ${p.label}\n${p.text}`).join('\n');
