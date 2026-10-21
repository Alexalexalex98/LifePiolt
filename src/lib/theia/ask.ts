/**
 * Domande sui tuoi dati, con risposta calcolata (modulo PURO, senza AI e senza rete).
 * Ogni risposta ha i suoi fatti e le fonti; se un numero del testo non torna con i fatti, la risposta non si dà (si passa alla via normale).
 * Se il dato manca, Theia lo dice: non indovina.
 */
import { upcoming, whenText } from '../shifts.ts';
import { addDay, dayKeyOf, fmtMoney, fmtNum, verified, type Answer, type Fact, type Snap } from './core.ts';
import { radar } from './radar.ts';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q: string, ...re: RegExp[]) => re.every((r) => r.test(q));

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const mk = (text: string, facts: Fact[], sources: string[]): Answer => ({ text, facts, sources });
const noData = (what: string, how: string): Answer => mk(`Non ho ${what}. ${how}`, [], []);

function endOfMonth(s: Snap): Answer {
  const f = s.finance;
  if (!f) return noData('ancora dati sui tuoi movimenti', 'Carica un estratto conto o aggiungi un movimento e posso calcolarlo.');
  if (!f.partial || f.projectionEnd == null) return mk(`Il mese è chiuso: il saldo finale è ${fmtMoney(f.end, s.currency)}.`, [{ label: 'saldo finale', value: Math.round(f.end), unit: s.currency, source: 'movimenti del mese' }], ['movimenti del mese']);
  return mk(`Se il ritmo di spesa resta questo, a fine mese il saldo sarà intorno a ${fmtMoney(f.projectionEnd, s.currency)}. È una stima: parte da quanto hai speso finora (${fmtMoney(f.expense, s.currency)} in ${f.day} giorni su ${f.daysInMonth}) e non conosce spese straordinarie.`,
    [{ label: 'saldo stimato', value: Math.round(f.projectionEnd), unit: s.currency, source: 'stima dal ritmo di spesa' }, { label: 'speso finora', value: Math.round(f.expense), unit: s.currency, source: 'movimenti del mese' }, { label: 'giorni passati', value: f.day, source: 'calendario' }, { label: 'giorni del mese', value: f.daysInMonth, source: 'calendario' }], ['movimenti del mese']);
}

function spent(s: Snap, q: string): Answer {
  const f = s.finance;
  if (!f) return noData('ancora dati sui tuoi movimenti', 'Carica un estratto conto o aggiungi un movimento e posso risponderti.');
  const cat = f.topCats.find((c) => q.includes(norm(c.n)));
  if (cat) return mk(`In «${cat.n}» hai speso ${fmtMoney(cat.v, s.currency)} questo mese.`, [{ label: `speso in ${cat.n}`, value: Math.round(cat.v), unit: s.currency, source: 'movimenti del mese' }], ['movimenti del mese']);
  if (/(in|per|di) [a-z]{4,}/.test(q.replace(/questo mese|ho speso|quanto/g, '')) && !/questo mese|finora|in tutto|totale|oggi/.test(q)) return mk(`Questo mese in tutto hai speso ${fmtMoney(f.expense, s.currency)}. Non trovo una categoria con quel nome tra le tue spese: le più grandi sono ${f.topCats.slice(0, 3).map((c) => `«${c.n}» (${fmtMoney(c.v, s.currency)})`).join(', ') || 'non ancora disponibili'}.`, [{ label: 'speso in tutto', value: Math.round(f.expense), unit: s.currency, source: 'movimenti del mese' }, ...f.topCats.slice(0, 3).map((c) => ({ label: c.n, value: Math.round(c.v), unit: s.currency, source: 'movimenti del mese' }))], ['movimenti del mese']);
  return mk(`Questo mese hai speso ${fmtMoney(f.expense, s.currency)} e hai incassato ${fmtMoney(f.income, s.currency)}.`, [{ label: 'speso', value: Math.round(f.expense), unit: s.currency, source: 'movimenti del mese' }, { label: 'incassato', value: Math.round(f.income), unit: s.currency, source: 'movimenti del mese' }], ['movimenti del mese']);
}

function nextShift(s: Snap): Answer {
  if (!s.shifts.length) return noData('nessun turno salvato', 'Aggiungili in Impostazioni > Orari e integrazioni > Turni di lavoro.');
  const o = upcoming(s.shifts, s.now, 60)[0];
  if (!o) return mk('Nei prossimi 60 giorni non risulta nessun turno.', [{ label: 'giorni controllati', value: 60, source: 'turni' }], ['turni']);
  const when = whenText(o, s.now);
  return mk(`Il prossimo turno è «${o.shift.name}»: ${when}, fino alle ${new Date(o.endTs).toTimeString().slice(0, 5)}.`, [{ label: 'turno', value: when, source: 'turni' }, { label: 'fine turno', value: new Date(o.endTs).toTimeString().slice(0, 5), source: 'turni' }], ['turni']);
}

function events(s: Snap, q: string): Answer {
  const today = dayKeyOf(s.now);
  const day = /domani/.test(q) ? addDay(today, 1) : today;
  const label = day === today ? 'oggi' : 'domani';
  const list = [...(s.events[day] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) return mk(`${label === 'oggi' ? 'Oggi' : 'Domani'} non hai impegni in agenda.`, [], ['agenda']);
  const hh = s.now ? new Date(s.now).toTimeString().slice(0, 5) : '00:00';
  const rest = label === 'oggi' ? list.filter((e) => e.time >= hh) : list;
  if (!rest.length) return mk(`Per oggi hai finito gli impegni (ne avevi ${fmtNum(list.length)}).`, [{ label: 'impegni di oggi', value: list.length, source: 'agenda' }], ['agenda']);
  const shown = rest.slice(0, 5);
  return mk(`${label === 'oggi' ? 'Oggi' : 'Domani'}${label === 'oggi' ? ', da adesso,' : ''} hai ${rest.length === 1 ? 'un impegno' : `${fmtNum(rest.length)} impegni`}: ${shown.map((e) => `${e.time} ${e.title}`).join('; ')}${rest.length > shown.length ? '; e altri' : ''}.`,
    [{ label: 'impegni', value: rest.length, source: 'agenda' }, ...shown.map((e) => ({ label: e.title, value: e.time, source: 'agenda' }))], ['agenda']);
}

function tasks(s: Snap): Answer {
  const today = dayKeyOf(s.now);
  const open = s.tasks.filter((t) => !t.done);
  const late = open.filter((t) => t.due && t.due < today);
  const dueToday = open.filter((t) => t.due === today);
  return mk(`Hai ${fmtNum(open.length)} task aperti: ${fmtNum(dueToday.length)} per oggi e ${fmtNum(late.length)} scaduti.`, [{ label: 'aperti', value: open.length, source: 'task' }, { label: 'per oggi', value: dueToday.length, source: 'task' }, { label: 'scaduti', value: late.length, source: 'task' }], ['task']);
}

function sleep(s: Snap): Answer {
  if (!s.sleep.length) return noData('dati sul tuo sonno', 'Collega Apple Health o segnali il sonno a mano in LifeHealth.');
  const last = s.sleep[s.sleep.length - 1];
  const week = s.sleep.slice(-7);
  const avg = week.reduce((a, x) => a + x.hours, 0) / week.length;
  const l = Math.round(last.hours * 10) / 10, a = Math.round(avg * 10) / 10;
  return mk(`L'ultima notte registrata (${last.day}) hai dormito ${fmtNum(l, 1)} ore; la media delle ultime ${fmtNum(week.length)} notti è ${fmtNum(a, 1)} ore.`, [{ label: 'notte', value: last.day, source: 'sonno' }, { label: 'ore dormite', value: l, unit: 'h', source: 'sonno' }, { label: 'media', value: a, unit: 'h', source: 'sonno' }, { label: 'notti', value: week.length, source: 'sonno' }], ['sonno']);
}

function steps(s: Snap): Answer {
  if (!s.steps.length) return noData('dati sui tuoi passi', 'Collega Apple Health o segnali i passi a mano in LifeHealth.');
  const last = s.steps[s.steps.length - 1];
  const today = dayKeyOf(s.now);
  if (last.day !== today) return mk(`Per oggi non ho ancora il dato dei passi. L'ultimo che ho è del ${last.day}: ${fmtNum(Math.round(last.v))} passi.`, [{ label: 'giorno', value: last.day, source: 'passi' }, { label: 'passi', value: Math.round(last.v), source: 'passi' }], ['passi']);
  return mk(`Oggi hai fatto ${fmtNum(Math.round(last.v))} passi.`, [{ label: 'passi', value: Math.round(last.v), source: 'passi' }], ['passi']);
}

function water(s: Snap): Answer {
  if (!s.water) return noData('dati sull\'acqua', 'Puoi segnarla dal banner o da Cibo.');
  const l = Math.round(s.water.todayMl / 100) / 10, g = Math.round(s.water.goalMl / 100) / 10;
  return mk(`Oggi hai segnato ${fmtNum(l, 1)} litri di acqua su un obiettivo di circa ${fmtNum(g, 1)}. Conta solo quello che segni.`, [{ label: 'litri oggi', value: l, unit: 'L', source: 'acqua segnata' }, { label: 'obiettivo', value: g, unit: 'L', source: 'stima dal tuo peso' }], ['acqua segnata']);
}

function kcal(s: Snap): Answer {
  if (!s.kcal) return noData('dati sui tuoi pasti', 'Segna un pasto da Cibo.');
  const t = s.kcal.target;
  return mk(`Oggi hai segnato ${fmtNum(Math.round(s.kcal.today))} kcal${t ? ` su un obiettivo stimato di ${fmtNum(Math.round(t))}` : ''}. Sono stime, non un consiglio nutrizionale.`, [{ label: 'kcal oggi', value: Math.round(s.kcal.today), source: 'pasti segnati' }, ...(t ? [{ label: 'obiettivo', value: Math.round(t), source: 'stima da età, peso e obiettivo' }] : [])], ['pasti segnati']);
}

function conflictsAns(s: Snap): Answer {
  const c = radar(s).filter((p) => p.kind === 'conflitto');
  if (!c.length) return mk('Nei prossimi 7 giorni non vedo impegni che cadono dentro un turno.', [{ label: 'giorni controllati', value: 7, source: 'agenda e turni' }], ['agenda', 'turni']);
  return mk(c.map((p) => p.why).join(' '), c.flatMap((p) => p.facts), ['agenda', 'turni']);
}

/** Prova a rispondere con i dati locali. null = non è una domanda che so calcolare (o il testo non ha passato la verifica). */
export function askLocal(question: string, s: Snap): Answer | null {
  const q = norm(question);
  let a: Answer | null = null;
  if (has(q, /fine mese/) && /(restera|rimane|resta|avro|saldo|finisco|chiudo)/.test(q)) a = endOfMonth(s);
  else if (/quanto (ho )?(speso|spendo)|le mie spese|spese del mese/.test(q)) a = spent(s, q);
  else if (has(q, /turno/) && /(prossimo|quando|che turno)/.test(q)) a = nextShift(s);
  else if (/conflitt|si accavall|sovrappon/.test(q)) a = conflictsAns(s);
  else if (/(quali|che|cosa|quanti).*(impegni|appuntamenti)|cosa ho (oggi|domani)|prossimo impegno|prossimo appuntamento|agenda (di )?(oggi|domani)/.test(q)) a = events(s, q);
  else if (/(quanti|quali|che) task|task (aperti|scaduti)|cose da fare/.test(q)) a = tasks(s);
  else if (/dorm|sonno/.test(q) && /(quanto|come|ho)/.test(q)) a = sleep(s);
  else if (/\bpassi\b/.test(q) && /(quanti|quanto|ho)/.test(q)) a = steps(s);
  else if (/\bacqua\b/.test(q) && /(quanta|quanto|ho)/.test(q)) a = water(s);
  else if (/calorie|kcal/.test(q) && /(quante|quanto|ho)/.test(q)) a = kcal(s);
  if (!a) return null;
  return verified(a) ? a : null;
}
export { MONTHS };
