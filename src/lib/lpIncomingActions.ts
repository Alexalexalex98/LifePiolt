import { weekdayShortDate } from '@/lib/format';
import { dueIncoming, makeIncoming, markCredited, reverseIncoming, type Incoming, type IncomingSource } from '@/lib/lpIncoming';
import type { LpSource } from '@/lib/lpStatement';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

const mvSource = (s: IncomingSource): LpSource => (s === 'giornaliero' ? 'giornaliero' : s === 'idee' ? 'idee' : s === 'iscrizioni' ? 'iscrizioni' : s === 'pagamenti' ? 'pagamenti' : 'altro');
const newId = () => `in${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Accredita un arrivo sul conto: saldo, movimento del rendiconto e contatori del profilo. */
function applyCredit(i: Incoming, me: string) {
  useNet.setState((st) => {
    const moves = [...(st.lpMoves ?? []), { id: `m${i.id}`, ts: Date.now(), kind: 'earn' as const, source: mvSource(i.source), label: i.label, amount: i.amount, ref: `in:${i.id}` }];
    const next: Partial<typeof st> = { lifePoints: st.lifePoints + i.amount, lpMoves: moves, ledger: [{ type: 'topup' as const, desc: i.label, amount: i.amount, date: weekdayShortDate() }, ...st.ledger] };
    if (i.source === 'giornaliero') {
      next.receivedDaily = { ...st.receivedDaily, [me]: (st.receivedDaily[me] || 0) + 1 };
      next.receivedLog = [{ from: i.from, date: weekdayShortDate(), ...(i.ref ? { ref: i.ref } : {}) }, ...(st.receivedLog ?? [])].slice(0, 300);
    } else {
      next.receivedPayments = { ...st.receivedPayments, [me]: (st.receivedPayments[me] || 0) + i.amount };
    }
    return next;
  });
}

/**
 * Qualcuno mi dona o mi paga LifePoints. Senza `releaseAt` arrivano subito sul conto e sul profilo; con `releaseAt` restano «in arrivo»
 * (contano comunque sul profilo e sul conto) finché non si sbloccano. Da usare quando arriva l'evento (oggi: demo; poi il server).
 */
export function receiveLP(a: { from: string; label: string; amount: number; source: IncomingSource; releaseAt?: number; ref?: string; silent?: boolean }): Incoming | null {
  const me = useApp.getState().account.name;
  const inc = makeIncoming({ id: newId(), now: Date.now(), ...a });
  if (!inc) return null;
  useNet.setState((st) => ({ incoming: [inc, ...(st.incoming ?? [])].slice(0, 500) }));
  if (inc.status === 'credited') applyCredit(inc, me);
  if (!a.silent) {
    const held = inc.status === 'pending';
    useNet.getState().notify(a.source === 'giornaliero' ? 'donation' : 'payment', a.source === 'giornaliero'
      ? `${a.from} ti ha donato il suo LifePoint di oggi`
      : `${a.from} ti ha pagato ${inc.amount} LP: ${a.label}${held ? ' (bloccati fino alla fine, ma già nel tuo totale)' : ''}`, false, { kind: 'lifepoints', ref: a.ref ?? `points:${inc.id}` });
  }
  return inc;
}

/** Accredita quelli bloccati la cui ora è arrivata. Da chiamare all'avvio e aprendo la pagina LifePoints. */
export function settleIncoming(now = Date.now()): number {
  const me = useApp.getState().account.name;
  const due = dueIncoming(useNet.getState().incoming, now);
  if (!due.length) return 0;
  due.forEach((i) => applyCredit(i, me));
  useNet.setState((st) => ({ incoming: markCredited(st.incoming ?? [], due.map((i) => i.id)) }));
  return due.length;
}

/** Un pagamento o una donazione non va a buon fine (annullo, rimborso): se era già sul conto viene tolto, se era bloccato sparisce. */
export function reverseLP(id: string): boolean {
  const me = useApp.getState().account.name;
  const r = reverseIncoming(useNet.getState().incoming ?? [], id);
  if (!r.found) return false;
  useNet.setState((st) => {
    const amt = r.found!.amount;
    const next: Partial<typeof st> = { incoming: r.list };
    if (r.deduct > 0) {
      next.lifePoints = Math.max(0, st.lifePoints - r.deduct);
      next.lpMoves = (st.lpMoves ?? []).filter((m) => m.ref !== `in:${id}`);
      if (r.found!.source === 'giornaliero') next.receivedDaily = { ...st.receivedDaily, [me]: Math.max(0, (st.receivedDaily[me] || 0) - 1) };
      else next.receivedPayments = { ...st.receivedPayments, [me]: Math.max(0, (st.receivedPayments[me] || 0) - amt) };
    }
    return next;
  });
  useNet.getState().notify('payment', `${r.found.from}: ${r.found.label} non è andato a buon fine, ${r.found.amount} LP tolti dal tuo totale`, false, { kind: 'lifepoints' });
  return true;
}
