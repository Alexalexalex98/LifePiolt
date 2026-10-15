import { CASH_FEE_PCT, sendBlockReason, splitPayment, type PayVia, type PaymentRecord, type ReceiveMode } from '@/lib/payments';
import { weekdayShortDate } from '@/lib/format';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

const newId = () => `pay${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Invia LifePoints a una persona (dal QR, dalla chat o dalla pagina LifePoints). Chi paga paga sempre l'importo intero. */
export function sendLP(to: string, amount: number, o: { note?: string; mode?: ReceiveMode; via: PayVia; /** cassa di un negozio: niente messaggio in chat */ merchant?: boolean }): { ok: boolean; message: string; id?: string } {
  const me = useApp.getState().account.name;
  const net = useNet.getState();
  const why = sendBlockReason({ from: me, to, amount, balance: net.lifePoints });
  if (why) return { ok: false, message: why };
  const id = newId();
  const mode = o.mode ?? 'lp';
  const note = (o.note ?? '').trim().slice(0, 120);
  if (!net.spend(amount, `Pagamento a ${to.trim()}`, to.trim(), `pay:${id}`)) return { ok: false, message: 'LifePoints insufficienti.' };
  const sp = splitPayment(amount, mode);
  const rec: PaymentRecord = { id, ts: Date.now(), dir: 'out', peer: to.trim(), amount, mode, fee: sp.fee, net: sp.net, note, via: o.via };
  useNet.setState((s) => ({ payments: [rec, ...(s.payments ?? [])].slice(0, 500) }));
  // lo vede anche nella chat con quella persona
  if (!o.merchant) try {
    const chat = useChat.getState();
    const cid = chat.ensureDm(to.trim(), me);
    chat.send(cid, me, { kind: 'text', text: `Ti ho inviato ${amount} LP${note ? ` · ${note}` : ''}` });
  } catch { /* la chat non è indispensabile */ }
  return { ok: true, message: `Inviati ${amount} LP a ${to.trim()}`, id };
}

/**
 * Riceve un pagamento (da un'altra persona): in LifePoints finisce nel saldo; in denaro viene convertito subito e si trattiene il 2,5%.
 * Oggi i pagamenti in arrivo vengono dal server; qui la funzione serve anche alla demo.
 */
export function receiveLP(from: string, amount: number, o: { note?: string; via: PayVia; mode?: ReceiveMode }): PaymentRecord | null {
  if (!Number.isFinite(amount) || amount < 1) return null;
  const st = useNet.getState();
  const mode = o.mode ?? st.receiveMode ?? 'lp';
  const sp = splitPayment(amount, mode);
  const id = newId();
  const now = Date.now();
  const rec: PaymentRecord = { id, ts: now, dir: 'in', peer: from, amount, mode, fee: sp.fee, net: sp.net, note: (o.note ?? '').slice(0, 120), via: o.via };
  useNet.setState((s) => {
    const moves = [...(s.lpMoves ?? []), { id: `${id}e`, ts: now, kind: 'earn' as const, source: 'pagamenti' as const, label: `Pagamento da ${from}`, amount }];
    if (mode === 'cash') moves.push({ id: `${id}w`, ts: now, kind: 'withdraw' as const, label: `Pagamento da ${from}: ricevuto in denaro`, amount, feePct: CASH_FEE_PCT } as never);
    return {
      payments: [rec, ...(s.payments ?? [])].slice(0, 500),
      lpMoves: moves,
      ...(mode === 'lp' ? { lifePoints: s.lifePoints + amount, ledger: [{ type: 'topup' as const, desc: `Pagamento da ${from}`, amount, date: weekdayShortDate() }, ...s.ledger] } : {}),
    };
  });
  useNet.getState().notify('donation', mode === 'cash' ? `${from} ti ha pagato ${amount} LP: ricevuti ${sp.net} in denaro` : `${from} ti ha inviato ${amount} LP`, false, { kind: 'lifepoints' });
  return rec;
}
