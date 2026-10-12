import { weekdayShortDate } from '@/lib/format';
import { ideaState } from '@/lib/ideas';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/**
 * Chiude le raccolte finite: se l'obiettivo è raggiunto i LifePoints vanno al titolare (per le mie idee), altrimenti chi ha contribuito
 * viene rimborsato (e lo sconto nel negozio revocato). Va chiamata all'avvio e quando si aprono le pagine delle idee.
 */
export function settleIdeas(now = Date.now()) {
  const st = useNet.getState();
  const me = useApp.getState().account.name;
  const todo = st.ideas.filter((i) => !i.settled && ideaState(i, now) !== 'raccolta');
  if (!todo.length) return;
  let balance = st.lifePoints;
  let moves = [...(st.lpMoves ?? [])];
  const credits = { ...(st.shopCredits ?? {}) };
  const contrib = { ...(st.myContrib ?? {}) };
  const ledger = [...st.ledger];
  const ideas = st.ideas.map((i) => {
    const state = ideaState(i, now);
    if (i.settled || state === 'raccolta') return i;
    if (state === 'raggiunta') {
      if (i.author === me) moves = [...moves, { id: `ip${i.id}`, ts: now, kind: 'earn' as const, source: 'idee' as const, label: `Idea riuscita: ${i.title}`, amount: i.raised }];
      return { ...i, settled: 'paid' as const };
    }
    const mine = contrib[i.id] ?? 0;
    if (mine > 0) {
      balance += mine;
      moves = moves.filter((m) => m.ref !== `idea:${i.id}`);
      ledger.unshift({ type: 'topup', desc: `Rimborso: "${i.title}" non ha raggiunto l'obiettivo`, amount: mine, date: weekdayShortDate() });
      credits[i.author] = Math.max(0, (credits[i.author] ?? 0) - mine);
      delete contrib[i.id];
    }
    return { ...i, settled: 'refunded' as const };
  });
  useNet.setState({ ideas, lifePoints: balance, lpMoves: moves, shopCredits: credits, myContrib: contrib, ledger });
}
