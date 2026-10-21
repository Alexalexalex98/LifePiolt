/**
 * Il radar di Theia (modulo PURO): guarda cosa sta per succedere e propone cosa fare. Ogni avviso dice il perché con i numeri veri e non fa nulla da solo:
 * l'azione è sempre un tasto che apre la pagina giusta, l'ultima parola è dell'utente.
 */
import { upcoming } from '../shifts.ts';
import { addDay, dayKeyOf, fmtMoney, fmtNum, hhmm, toMin, type Fact, type Snap } from './core.ts';

export type Severity = 'info' | 'warn' | 'bad';
export type Proposal = {
  /** stabile per giorno e causa: serve a non ripetere un avviso già chiuso */
  id: string;
  kind: 'budget' | 'categoria' | 'conflitto' | 'sonno-turno' | 'task' | 'giornata';
  severity: Severity;
  title: string;
  /** il perché, con i numeri */
  why: string;
  facts: Fact[];
  action?: { label: string; page: string; params?: Record<string, string> };
};

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const dayName = (key: string, today: string) => (key === today ? 'oggi' : key === addDay(today, 1) ? 'domani' : `${WD[new Date(key + 'T00:00:00').getDay()]} ${Number(key.slice(8))}`);
const clock = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function budget(s: Snap, today: string): Proposal[] {
  const f = s.finance; if (!f || !f.partial || f.projectionEnd == null) return [];
  const out: Proposal[] = [];
  if (f.projectionEnd < 0) {
    out.push({ id: `budget:${today.slice(0, 7)}:neg`, kind: 'budget', severity: 'bad', title: 'A questo ritmo il mese finisce in rosso',
      why: `Hai speso ${fmtMoney(f.expense, s.currency)} in ${f.day} giorni su ${f.daysInMonth}. Se continui così, a fine mese il saldo sarà intorno a ${fmtMoney(f.projectionEnd, s.currency)} (è una stima).`,
      facts: [{ label: 'speso', value: Math.round(f.expense), unit: s.currency, source: 'movimenti del mese' }, { label: 'giorni passati', value: f.day, source: 'calendario' }, { label: 'giorni del mese', value: f.daysInMonth, source: 'calendario' }, { label: 'saldo stimato', value: Math.round(f.projectionEnd), unit: s.currency, source: 'stima dal ritmo di spesa' }],
      action: { label: 'Guarda le spese', page: 'lifefinance', params: { ex: 'out' } } });
  } else if (f.income > 0 && f.projectionEnd < f.income * 0.05) {
    out.push({ id: `budget:${today.slice(0, 7)}:low`, kind: 'budget', severity: 'warn', title: 'Il saldo di fine mese sarà molto basso',
      why: `Con il ritmo di spesa di questo mese, a fine mese ti resterebbero circa ${fmtMoney(f.projectionEnd, s.currency)} (stima).`,
      facts: [{ label: 'saldo stimato', value: Math.round(f.projectionEnd), unit: s.currency, source: 'stima dal ritmo di spesa' }],
      action: { label: 'Guarda il saldo', page: 'lifefinance', params: { ex: 'saldo' } } });
  }
  return out;
}

function categories(s: Snap, today: string): Proposal[] {
  const f = s.finance; if (!f) return [];
  // le spese fisse (affitto, abbonamenti, cassa malati…) sono quasi sempre sopra il previsto e non c'è nulla da cambiare: non fanno avviso
  const FIXED = /affitto|abbonament|cassa malati|assicuraz|bollett|imposte|tasse|fondo emergenza|mutuo|rata/i;
  return f.over.filter((o) => o.level === 'over' && o.pct >= 120 && !FIXED.test(o.category)).slice(0, 2).map((o) => ({
    id: `categoria:${today.slice(0, 7)}:${o.category}`, kind: 'categoria' as const, severity: 'warn' as const,
    title: `Hai superato il budget di «${o.category}»`,
    why: `In «${o.category}» sei al ${fmtNum(Math.round(o.pct))}% di quanto avevi previsto per il mese.`,
    facts: [{ label: `percentuale ${o.category}`, value: Math.round(o.pct), unit: '%', source: 'budget del mese' }],
    action: { label: 'Apri il budget', page: 'lifefinance', params: { tab: 'Budget' } },
  }));
}

/** Impegni che cadono dentro un turno di lavoro, nei prossimi 7 giorni. */
function conflicts(s: Snap, today: string): Proposal[] {
  const out: Proposal[] = [];
  const occ = upcoming(s.shifts, s.now, 8);
  for (let i = 0; i < 7; i++) {
    const day = addDay(today, i);
    for (const e of s.events[day] ?? []) {
      const [y, m, d] = day.split('-').map(Number);
      const start = new Date(y, m - 1, d, ...(e.time.split(':').map(Number) as [number, number])).getTime();
      const end = start + (e.dur ?? 60) * 60000;
      const hit = occ.find((o) => start < o.endTs && end > o.startTs);
      if (!hit) continue;
      out.push({ id: `conflitto:${day}:${e.time}:${hit.shift.id}`, kind: 'conflitto', severity: 'warn', title: `«${e.title}» cade durante il turno «${hit.shift.name}»`,
        why: `${dayName(day, today)} alle ${e.time} hai «${e.title}», ma il turno «${hit.shift.name}» va dalle ${clock(hit.startTs)} alle ${clock(hit.endTs)}.`,
        facts: [{ label: 'inizio impegno', value: e.time, source: 'agenda' }, { label: 'inizio turno', value: clock(hit.startTs), source: 'turni' }, { label: 'fine turno', value: clock(hit.endTs), source: 'turni' }],
        action: { label: 'Apri il giorno', page: 'plan', params: { day } } });
    }
  }
  return out.slice(0, 3);
}

/** Turno presto domani e poco sonno la notte scorsa: a che ora andare a letto per dormire 8 ore. */
function sleepVsShift(s: Snap, today: string): Proposal[] {
  const next = upcoming(s.shifts, s.now, 2).find((o) => o.startTs > s.now);
  if (!next) return [];
  const startMin = toMin(clock(next.startTs));
  const tomorrow = addDay(today, 1);
  if (dayKeyOf(next.startTs) !== tomorrow || startMin > 8 * 60) return [];
  const last = s.sleep[s.sleep.length - 1];
  if (!last || last.hours >= 6.5) return [];
  const bed = hhmm(startMin - 8 * 60 - 60); // 8 ore di sonno più un'ora per prepararsi e arrivare
  return [{ id: `sonno-turno:${tomorrow}`, kind: 'sonno-turno', severity: 'warn', title: 'Domani il turno inizia presto e la notte scorsa hai dormito poco',
    why: `Domani il turno «${next.shift.name}» inizia alle ${clock(next.startTs)} e la notte scorsa hai dormito ${fmtNum(last.hours, 1)} ore. Per dormirne 8 e avere un'ora per prepararti, ti conviene essere a letto entro le ${bed}.`,
    facts: [{ label: 'inizio turno', value: clock(next.startTs), source: 'turni' }, { label: 'ore dormite', value: Math.round(last.hours * 10) / 10, unit: 'h', source: 'sonno' }, { label: 'ore di sonno da avere', value: 8, unit: 'h', source: 'obiettivo standard di sonno' }, { label: 'ora a letto', value: bed, source: 'calcolo: inizio turno meno 9 ore' }],
    action: { label: 'Guarda il sonno', page: 'lifehealth' } }];
}

function overdue(s: Snap, today: string): Proposal[] {
  const late = s.tasks.filter((t) => !t.done && t.due && t.due < today);
  if (!late.length) return [];
  return [{ id: `task:${today}`, kind: 'task', severity: 'info', title: late.length === 1 ? 'Hai un task scaduto' : `Hai ${late.length} task scaduti`,
    why: `${late.length === 1 ? 'Il task' : 'I task'} «${late.slice(0, 2).map((t) => t.t).join('», «')}»${late.length > 2 ? ' e altri' : ''} ${late.length === 1 ? 'era previsto' : 'erano previsti'} per un giorno passato.`,
    facts: [{ label: 'task scaduti', value: late.length, source: 'task' }],
    action: { label: 'Apri i task', page: 'plan', params: { task: late[0].id } } }];
}

/** Giornata troppo piena: più ore di impegni che ore di lavoro previste. */
function overloaded(s: Snap, today: string, workMin: number): Proposal[] {
  const evs = s.events[today] ?? [];
  const mins = evs.reduce((a, e) => a + (e.dur ?? 60), 0);
  if (evs.length < 4 || mins <= workMin) return [];
  return [{ id: `giornata:${today}`, kind: 'giornata', severity: 'info', title: 'Oggi hai la giornata molto piena',
    why: `Oggi hai ${evs.length} impegni per circa ${fmtNum(Math.round((mins / 60) * 10) / 10)} ore in totale.`,
    facts: [{ label: 'impegni', value: evs.length, source: 'agenda' }, { label: 'ore di impegni', value: Math.round((mins / 60) * 10) / 10, unit: 'h', source: 'agenda (durata di ogni impegno)' }],
    action: { label: 'Apri oggi', page: 'plan', params: { day: today } } }];
}

const RANK: Record<Severity, number> = { bad: 0, warn: 1, info: 2 };
/** Tutti gli avvisi, dal più importante. `dismissed` = id già chiusi dall'utente. */
export function radar(s: Snap, dismissed: string[] = [], workMin = 8 * 60): Proposal[] {
  const today = dayKeyOf(s.now);
  const all = [...budget(s, today), ...categories(s, today), ...conflicts(s, today), ...sleepVsShift(s, today), ...overdue(s, today), ...overloaded(s, today, workMin)];
  return all.filter((p) => !dismissed.includes(p.id)).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
