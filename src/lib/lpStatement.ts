/**
 * Rendiconto LifePoints per la dichiarazione fiscale (modulo PURO, nessun alias '@/').
 * Raccoglie i movimenti di un periodo: guadagnati (per origine), usati nell'app, ritirati in denaro.
 * Sul ritiro c'è una commissione del 5%; sui LifePoints non ritirati (o spesi nell'app) non si applica nulla.
 */
export const WITHDRAW_FEE_PCT = 5;

export type LpSource = 'giornaliero' | 'idee' | 'iscrizioni' | 'altro';
export const SOURCE_LABEL: Record<LpSource, string> = { giornaliero: 'LifePoints Giornalieri', idee: 'Contributi alle idee', iscrizioni: 'Quote, iscrizioni e servizi', altro: 'Altro' };
export type LpMove = { id: string; ts: number; kind: 'earn' | 'spend' | 'withdraw'; source?: LpSource; label: string; amount: number; /** collegamento (es. 'idea:12') per annullare il movimento in caso di rimborso */ ref?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Commissione e importo netto di un ritiro di `gross` LifePoints. */
export function withdrawFee(gross: number): { fee: number; net: number } {
  const g = Math.max(0, Number.isFinite(gross) ? gross : 0);
  const fee = r2((g * WITHDRAW_FEE_PCT) / 100);
  return { fee, net: r2(g - fee) };
}

export type Statement = {
  from: number; to: number;
  earned: { total: number; bySource: Record<LpSource, number>; items: LpMove[] };
  spent: { total: number; items: LpMove[] };
  withdrawn: { gross: number; fee: number; net: number; items: (LpMove & { fee: number; net: number })[] };
  /** guadagnati nel periodo e rimasti sul conto (né spesi né ritirati): nessuna commissione */
  kept: number;
};

export function buildStatement(moves: LpMove[], from: number, to: number): Statement {
  const inP = moves.filter((m) => m && Number.isFinite(m.ts) && m.ts >= from && m.ts <= to && m.amount > 0).sort((a, b) => a.ts - b.ts);
  const bySource: Record<LpSource, number> = { giornaliero: 0, idee: 0, iscrizioni: 0, altro: 0 };
  const earnedItems = inP.filter((m) => m.kind === 'earn');
  earnedItems.forEach((m) => { bySource[m.source ?? 'altro'] = r2(bySource[m.source ?? 'altro'] + m.amount); });
  const earnedTotal = r2(earnedItems.reduce((a, m) => a + m.amount, 0));
  const spentItems = inP.filter((m) => m.kind === 'spend');
  const spentTotal = r2(spentItems.reduce((a, m) => a + m.amount, 0));
  const wItems = inP.filter((m) => m.kind === 'withdraw').map((m) => ({ ...m, ...withdrawFee(m.amount) }));
  const gross = r2(wItems.reduce((a, m) => a + m.amount, 0));
  const fee = r2(wItems.reduce((a, m) => a + m.fee, 0));
  return {
    from, to,
    earned: { total: earnedTotal, bySource, items: earnedItems },
    spent: { total: spentTotal, items: spentItems },
    withdrawn: { gross, fee, net: r2(gross - fee), items: wItems },
    kept: Math.max(0, r2(earnedTotal - spentTotal - gross)),
  };
}

/** Intervallo (ms) dell'anno civile `year`. */
export const yearRange = (year: number): { from: number; to: number } => ({ from: new Date(year, 0, 1).getTime(), to: new Date(year, 11, 31, 23, 59, 59, 999).getTime() });

const d = (ts: number) => { const x = new Date(ts); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`; };
const n2 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Testo del rendiconto da condividere o allegare alla dichiarazione. */
export function statementText(s: Statement, year: number, name: string): string {
  const L: string[] = [];
  L.push(`Rendiconto LifePoints ${year} · ${name}`, `Periodo: ${d(s.from)} – ${d(s.to)}`, '');
  L.push(`Guadagnati: ${n2(s.earned.total)} LP`);
  (Object.keys(SOURCE_LABEL) as LpSource[]).forEach((k) => { if (s.earned.bySource[k]) L.push(`  ${SOURCE_LABEL[k]}: ${n2(s.earned.bySource[k])} LP`); });
  L.push(`Usati nell'app: ${n2(s.spent.total)} LP`);
  L.push(`Ritirati in denaro: ${n2(s.withdrawn.gross)} LP`, `  Commissione ${WITHDRAW_FEE_PCT}%: ${n2(s.withdrawn.fee)} LP`, `  Importo netto accreditato: ${n2(s.withdrawn.net)} LP`);
  L.push(`Non ritirati (nessuna commissione): ${n2(s.kept)} LP`, '', 'Movimenti');
  [...s.earned.items, ...s.spent.items, ...s.withdrawn.items].sort((a, b) => a.ts - b.ts).forEach((m) => L.push(`${d(m.ts)} · ${m.kind === 'earn' ? '+' : '-'}${n2(m.amount)} LP · ${m.label}`));
  L.push('', 'Documento di riepilogo generato dall\'app: verifica sempre i dati con un consulente fiscale.');
  return L.join('\n');
}

/* ---------- chi può ritirare ---------- */
/** Per ritirare i LifePoints Giornalieri ricevuti servono persone diverse che li hanno donati (soglia provvisoria, da rivedere). */
export const DAILY_DONORS_REQUIRED = 1000;

export type WithdrawInfo = {
  /** i Giornalieri sono ritirabili solo con la soglia di donatori diversi */
  dailyUnlocked: boolean; donors: number; required: number;
  /** LifePoints ritirabili adesso (mai più del saldo) */
  withdrawable: number;
  /** guadagnati con servizi, iscrizioni, store o idee riuscite: sempre ritirabili */
  fromActivities: number;
  /** guadagnati con i Giornalieri e altro: ritirabili solo sbloccando la soglia */
  locked: number;
};

/** Quanto si può ritirare. Gli acquisti nell'app consumano prima i LifePoints non ritirabili (scelta prudente). */
export function withdrawInfo(moves: LpMove[], donors: number, balance: number): WithdrawInfo {
  const earn = moves.filter((m) => m.kind === 'earn' && m.amount > 0);
  const fromActivities = r2(earn.filter((m) => m.source === 'iscrizioni' || m.source === 'idee').reduce((a, m) => a + m.amount, 0));
  const lockedEarned = r2(earn.filter((m) => m.source !== 'iscrizioni' && m.source !== 'idee').reduce((a, m) => a + m.amount, 0));
  const spent = r2(moves.filter((m) => m.kind === 'spend').reduce((a, m) => a + m.amount, 0));
  const withdrawn = r2(moves.filter((m) => m.kind === 'withdraw').reduce((a, m) => a + m.amount, 0));
  const dailyUnlocked = donors >= DAILY_DONORS_REQUIRED;
  const spentFromLocked = Math.min(spent, lockedEarned);
  const lockedLeft = r2(lockedEarned - spentFromLocked);
  const activitiesLeft = Math.max(0, r2(fromActivities - (spent - spentFromLocked) - withdrawn));
  const pool = dailyUnlocked ? r2(activitiesLeft + lockedLeft) : activitiesLeft;
  return { dailyUnlocked, donors, required: DAILY_DONORS_REQUIRED, withdrawable: Math.floor(Math.max(0, Math.min(pool, balance))), fromActivities: activitiesLeft, locked: dailyUnlocked ? 0 : lockedLeft };
}
