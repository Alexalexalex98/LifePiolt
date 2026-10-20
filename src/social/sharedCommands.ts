import { useLearned } from '@/store/learned';
import { fetchShared, shareCommand, socialSession, voteShared } from './socialApi';
import { isSafeShared, shareBlock } from './socialCore';

/** Scarica i comandi che altri hanno insegnato a Theia e hanno avuto abbastanza conferme (una volta al giorno). */
export async function refreshShared(force = false): Promise<void> {
  const st = useLearned.getState();
  if (!force && Date.now() - st.sharedAt < 24 * 3600 * 1000) return;
  const s = await socialSession(); if (!s) return;
  const list = (await fetchShared(s)).filter((c) => isSafeShared(c));
  st.setShared(list);
}

/** Condivide un comando imparato, solo se l'utente lo sceglie e solo se è innocuo. Restituisce il messaggio da mostrare. */
export async function shareLearned(id: string): Promise<string> {
  const it = useLearned.getState().items.find((i) => i.id === id);
  if (!it) return 'Non trovo più questo comando.';
  const block = shareBlock(it.pattern, it.kind, it.target);
  if (block) return block;
  const s = await socialSession();
  if (!s) return 'Per condividere serve il server collegato e l’accesso con la tua email (Impostazioni > Sincronizzazione).';
  const ok = await shareCommand(s, { pattern: it.pattern, kind: it.kind, target: it.target });
  return ok ? `Condiviso: «${it.pattern}». Gli altri lo useranno solo dopo che almeno due persone lo avranno confermato. Non ho inviato altro.` : 'Non sono riuscita a condividerlo ora: riprova tra poco.';
}

export async function voteSharedCommand(id: string, vote: 1 | -1): Promise<void> {
  const s = await socialSession(); if (s) void voteShared(s, id, vote);
}
