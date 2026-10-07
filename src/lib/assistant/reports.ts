import { computeDashboard, domainLabel } from '@/lib/analyticsData';
import { buildMoodDays } from '@/lib/moodContext';
import { analyseMood } from '@/lib/moodAnalysis';
import { monthEnd, monthNet, useFin } from '@/store/finance';

const chf = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('it-CH')} CHF`;

/** Analisi dettagliata delle finanze, calcolata sul telefono. Nessuna AI. */
export function financeReport(): string {
  const f = useFin.getState();
  const m = f.months[0];
  if (!m || !m.movements.length) return 'Non ho ancora movimenti da analizzare. Aggiungili da Finance e ti preparo l\'analisi.';
  const inc = m.movements.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
  const out = m.movements.filter((x) => x.amount < 0).reduce((s, x) => s + -x.amount, 0);
  const byLabel = new Map<string, number>();
  m.movements.filter((x) => x.amount < 0).forEach((x) => byLabel.set(x.label, (byLabel.get(x.label) ?? 0) + -x.amount));
  const top = [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = [
    `Analisi di ${m.label}`,
    `Entrate ${chf(inc)}, uscite ${chf(out)}, saldo del mese ${chf(monthNet(m))}. Saldo a fine mese ${chf(monthEnd(m))}.`,
    `Tasso di risparmio: ${inc > 0 ? Math.round(((inc - out) / inc) * 100) : 0}% delle entrate.`,
    top.length ? 'Dove vanno i soldi:\n' + top.map(([l, v]) => `• ${l}: ${chf(v)} (${out ? Math.round((v / out) * 100) : 0}%)`).join('\n') : '',
  ];
  const prev = f.months[1];
  if (prev) {
    const pOut = prev.movements.filter((x) => x.amount < 0).reduce((s, x) => s + -x.amount, 0);
    if (pOut > 0) { const d = Math.round(((out - pOut) / pOut) * 100); lines.push(`Rispetto a ${prev.label} spendi ${d >= 0 ? '+' : ''}${d}%.`); }
  }
  const bills = f.bills.reduce((s, b) => s + (b.freq === 'yearly' ? b.amount / 12 : b.amount), 0);
  if (bills) lines.push(`Spese fisse (abbonamenti e bollette): circa ${chf(bills)} al mese.`);
  if (f.budget.salary) lines.push(`Il budget parte da uno stipendio di ${chf(f.budget.salary)}.`);
  lines.push('Per i grafici e il confronto con la salute apri Dashboard.');
  return lines.filter(Boolean).join('\n');
}

export function healthReport(): string {
  const d = computeDashboard();
  const rows = d.list.filter((a) => a.def.domain !== 'finanza' && a.def.domain !== 'contesto').slice(0, 8);
  if (!rows.length) return 'Non ho ancora dati di salute. Collega Apple Health o registra qualcosa da LifeHealth.';
  const sc = Object.entries(d.scores).filter(([, v]) => v != null).map(([k, v]) => `${domainLabel[k as keyof typeof domainLabel]} ${v}/100`).join(', ');
  return ['Sintesi salute e benessere', sc && `Punteggi: ${sc}.`, ...rows.map((a) => `• ${a.def.label}: ${Math.round((a.def.period === 'day' ? a.avg7 : a.latest.v) * 10) / 10}${a.def.unit}`)].filter(Boolean).join('\n');
}

export function moodReport(): string {
  const report = analyseMood(buildMoodDays());
  if (report.n < 3) return 'Ho ancora pochi check-in per un\'analisi seria. Dimmi come ti senti ogni giorno: dopo una settimana inizio a trovare i legami con meteo, impegni, sonno e spese.';
  const lines = [`Umore medio ${report.mean.toFixed(1)}/5 su ${report.n} giorni (affidabilità ${report.confidence}).`];
  report.factors.slice(0, 4).forEach((x) => lines.push('• ' + x.sentence));
  if (!report.factors.length) lines.push('Per ora nessun fattore si distingue in modo netto.');
  lines.push('Sono correlazioni, non cause. Il dettaglio è nella pagina Umore.');
  return lines.join('\n');
}
