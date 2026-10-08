import { isVisible, modKey, type ModKind } from '@/lib/modRules';
import { useChat } from '@/store/chat';
import { useMod } from '@/store/moderation';

/** Funzione (kind, ref, author?) => visibile?, che si aggiorna da sola quando cambiano segnalazioni, nascosti o bloccati. */
export function useVisible() {
  const reports = useMod((s) => s.reports);
  const hidden = useMod((s) => s.hidden);
  const blocked = useChat((s) => s.blocked);
  return (kind: ModKind, ref: string | number, author?: string) => isVisible(modKey(kind, ref), author, reports, hidden, blocked);
}

/** Versione non reattiva, per logica fuori dai componenti. */
export function visibleNow(kind: ModKind, ref: string | number, author?: string): boolean {
  const m = useMod.getState();
  return isVisible(modKey(kind, ref), author, m.reports, m.hidden, useChat.getState().blocked);
}

export const isBlockedUser = (name: string) => useChat.getState().blocked.includes(name);
export function setBlockedUser(name: string, on: boolean) { useChat.getState().block(name, on); }
