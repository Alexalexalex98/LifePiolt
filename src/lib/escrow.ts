import { unlockAt } from '@/lib/booking';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/**
 * Sblocca i pagamenti bloccati dei seminari e delle sessioni finite: i LifePoints vengono accreditati a chi li ha organizzati.
 * Da chiamare all'avvio e quando si apre la pagina LifePoints.
 */
export function settleEscrow(now = Date.now()) {
  const st = useNet.getState();
  const me = useApp.getState().account.name;
  const due = st.enrollments.filter((e) => e.held && !e.releasedAt && e.status !== 'declined' && now >= unlockAt(e));
  const dueDeclined = st.enrollments.filter((e) => e.held && !e.releasedAt && e.status === 'declined' && now >= unlockAt(e));
  const all = [...due, ...dueDeclined];
  if (!all.length) return;
  const paid = { ...st.receivedPayments };
  all.forEach((e) => { paid[e.host] = (paid[e.host] || 0) + (e.paid ?? 0); });
  const ids = new Set(all.map((e) => e.id));
  let moves = [...(st.lpMoves ?? [])];
  let balance = st.lifePoints;
  all.filter((e) => e.host === me).forEach((e) => { balance += e.paid ?? 0; moves = [...moves, { id: `rl${e.id}`, ts: now, kind: 'earn' as const, source: 'iscrizioni' as const, label: `${e.title}`, amount: e.paid ?? 0 }]; });
  useNet.setState({ receivedPayments: paid, lifePoints: balance, lpMoves: moves, enrollments: st.enrollments.map((e) => (ids.has(e.id) ? { ...e, releasedAt: now } : e)) });
}
