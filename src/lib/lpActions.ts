import { WITHDRAW_FEE_PCT, withdrawFee, withdrawInfo, type WithdrawInfo } from '@/lib/lpStatement';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export function myWithdrawInfo(): WithdrawInfo {
  const n = useNet.getState();
  const me = useApp.getState().account.name;
  return withdrawInfo(n.lpMoves ?? [], n.receivedDaily[me] || 0, n.lifePoints);
}

/** Ritira LifePoints in denaro (commissione del 5% trattenuta solo qui). Controlla che l'importo sia ritirabile. */
export function withdrawLp(amount: number): { ok: boolean; message: string; fee?: number; net?: number } {
  const a = Math.floor(amount);
  if (!Number.isFinite(a) || a <= 0) return { ok: false, message: 'Scrivi quanti LifePoints vuoi ritirare.' };
  const info = myWithdrawInfo();
  if (a > info.withdrawable) return { ok: false, message: info.withdrawable === 0 ? 'Non hai LifePoints ritirabili in questo momento.' : `Puoi ritirare al massimo ${info.withdrawable} LP.` };
  const r = useNet.getState().withdraw(a);
  if (!r.ok) return { ok: false, message: 'LifePoints insufficienti.' };
  return { ok: true, message: `Ritiro richiesto: ${a} LP, commissione ${WITHDRAW_FEE_PCT}% (${r.fee} LP), accrediti ${r.net} LP.`, fee: r.fee, net: r.net };
}
export { withdrawFee };
