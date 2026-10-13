/** Le sezioni della Dashboard a colpo d'occhio (modulo PURO): una riga per area importante, con un dato chiaro e un colore di stato. */
export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'none';
export type SectionRow = { id: string; icon: string; title: string; headline: string; detail?: string; tone: Tone; page: string; params?: Record<string, string> };

export type SectionInput = {
  next: { title: string; time: string; daysAhead: number } | null;
  /** seminari e servizi miei, ancora da svolgere, con le persone prenotate */
  booked: { title: string; count: number; startsAt: number }[];
  comments: { count: number; last?: { author: string; text: string } };
  invest: { hasHoldings: boolean; dayPct: number; totalPct: number };
  scores: { salute: number | null; mente: number | null; finanza: number | null };
  tasks: { open: number; urgent: number };
  lifePoints: number;
  /** giorni di fila in cui doni il tuo LifePoint */ streak: number;
  now: number;
};

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const toneOfScore = (s: number | null): Tone => (s == null ? 'none' : s >= 75 ? 'good' : s >= 55 ? 'warn' : 'bad');
const clip = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function dayWord(daysAhead: number): string {
  return daysAhead <= 0 ? 'Oggi' : daysAhead === 1 ? 'Domani' : `Tra ${daysAhead} giorni`;
}

export function buildSections(i: SectionInput): SectionRow[] {
  const rows: SectionRow[] = [];
  rows.push(i.next
    ? { id: 'prossimo', icon: 'calendar', title: 'Prossima cosa in programma', headline: clip(i.next.title), detail: `${dayWord(i.next.daysAhead)} alle ${i.next.time}`, tone: i.next.daysAhead === 0 ? 'warn' : 'neutral', page: 'plan' }
    : { id: 'prossimo', icon: 'calendar', title: 'Prossima cosa in programma', headline: 'Niente in programma', detail: 'Agenda libera', tone: 'none', page: 'plan' });

  const upcoming = i.booked.filter((b) => b.startsAt > i.now).sort((a, b) => a.startsAt - b.startsAt);
  const total = upcoming.reduce((n, b) => n + b.count, 0);
  rows.push(total > 0
    ? { id: 'prenotati', icon: 'award', title: 'Prenotati ai tuoi seminari e servizi', headline: plural(total, 'prenotato', 'prenotati'), detail: `${clip(upcoming[0].title, 34)}: ${upcoming[0].count}`, tone: 'good', page: 'myServices' }
    : { id: 'prenotati', icon: 'award', title: 'Prenotati ai tuoi seminari e servizi', headline: 'Nessuna prenotazione', detail: 'Per ora nessuno si è prenotato', tone: 'none', page: 'lifenetwork' });

  rows.push(i.comments.count > 0
    ? { id: 'commenti', icon: 'comment', title: 'Commenti ai tuoi post', headline: plural(i.comments.count, 'commento', 'commenti'), detail: i.comments.last ? `${i.comments.last.author}: «${clip(i.comments.last.text, 40)}»` : undefined, tone: 'neutral', page: 'lifenetwork' }
    : { id: 'commenti', icon: 'comment', title: 'Commenti ai tuoi post', headline: 'Nessun commento', detail: 'Pubblica un post per iniziare', tone: 'none', page: 'lifenetwork' });

  rows.push(i.invest.hasHoldings
    ? { id: 'investimenti', icon: 'chart', title: 'I tuoi investimenti', headline: `${pct(i.invest.dayPct)} oggi`, detail: `Dall'acquisto ${pct(i.invest.totalPct)}`, tone: i.invest.dayPct >= 0 ? 'good' : i.invest.dayPct > -3 ? 'warn' : 'bad', page: 'stocks' }
    : { id: 'investimenti', icon: 'chart', title: 'I tuoi investimenti', headline: 'Nessuna posizione', detail: 'Aggiungi un titolo per seguirlo', tone: 'none', page: 'stocks' });

  const sc = (id: string, icon: string, title: string, s: number | null, page: string, good: string, mid: string, bad: string): SectionRow =>
    ({ id, icon, title, headline: s == null ? 'Nessun dato' : `${s}/100`, detail: s == null ? 'Registra qualche dato per vedere come va' : s >= 75 ? good : s >= 55 ? mid : bad, tone: toneOfScore(s), page });
  rows.push(sc('salute', 'lifehealth', 'La tua salute', i.scores.salute, 'lifehealth', 'Tutto bene', 'Da tenere d\'occhio', 'Richiede attenzione'));
  rows.push(sc('finanze', 'lifefinance', 'Le tue finanze', i.scores.finanza, 'lifefinance', 'Sotto controllo', 'Qualcosa da sistemare', 'Richiede attenzione'));
  rows.push(sc('mente', 'mood', 'Umore e mente', i.scores.mente, 'mood', 'Sereno', 'Così così', 'Sotto pressione'));

  rows.push(i.tasks.open > 0
    ? { id: 'task', icon: 'tasks', title: 'Da fare', headline: plural(i.tasks.open, 'cosa da fare', 'cose da fare'), detail: i.tasks.urgent ? plural(i.tasks.urgent, 'urgente', 'urgenti') : 'Nessuna urgente', tone: i.tasks.urgent ? 'warn' : 'neutral', page: 'lifetask' }
    : { id: 'task', icon: 'tasks', title: 'Da fare', headline: 'Tutto fatto', detail: 'Nessun task aperto', tone: 'good', page: 'lifetask' });

  rows.push({ id: 'lifepoints', icon: 'coin', title: 'I tuoi LifePoints', headline: `${i.lifePoints.toLocaleString('it-IT')} LP`, detail: i.streak > 0 ? `Streak: ${plural(i.streak, 'giorno', 'giorni')} di fila` : 'Dona il tuo LifePoint di oggi', tone: i.streak >= 7 ? 'good' : 'neutral', page: 'lifepointsPage' });
  return rows;
}
