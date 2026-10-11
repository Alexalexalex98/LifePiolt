import type { ChatConfig, MemberTier } from './types.ts';

export const WRITE_LABEL: Record<ChatConfig['write'], string> = {
  creator: 'Solo il creatore',
  members: 'Tutti gli iscritti',
  premium: 'Solo iscritti Premium',
  chosen: 'Persone scelte',
  none: 'Nessuno (chat chiusa)',
};
export const WRITE_ORDER: ChatConfig['write'][] = ['creator', 'members', 'premium', 'chosen', 'none'];

export type ChatViewer = { user: string; owner: string; tier: MemberTier | 'none'; mutedByOwner?: boolean };

export type WriteDecision = { ok: boolean; reason?: string };

/**
 * Chi puo' scrivere nella chat del club.
 * - Il creatore scrive sempre (salvo 'none': anche lui deve riaprire la chat dallo Studio, per non scrivere per sbaglio).
 * - 'members' = tutti gli iscritti (free o premium; i semplici follower leggono soltanto).
 * - Chi e' silenziato dal creatore non scrive.
 */
export function canWriteChat(cfg: ChatConfig, v: ChatViewer): WriteDecision {
  const isOwner = v.user === v.owner;
  if (cfg.write === 'none') return { ok: false, reason: isOwner ? 'La chat e\' chiusa: riaprila dallo Studio' : 'La chat e\' chiusa dal creatore' };
  if (isOwner) return { ok: true };
  if (v.tier === 'none') return { ok: false, reason: 'Iscriviti per scrivere' };
  if (v.mutedByOwner) return { ok: false, reason: 'Il creatore ti ha silenziato in questa chat' };
  switch (cfg.write) {
    case 'creator': return { ok: false, reason: 'Solo il creatore può scrivere' };
    case 'members': return v.tier === 'follower' ? { ok: false, reason: 'Iscriviti (anche gratis) per scrivere' } : { ok: true };
    case 'premium': return v.tier === 'premium' ? { ok: true } : { ok: false, reason: 'Solo gli iscritti Premium possono scrivere' };
    case 'chosen': return cfg.chosen.includes(v.user) ? { ok: true } : { ok: false, reason: 'Il creatore ha abilitato a scrivere solo alcune persone' };
  }
  return { ok: false };
}

/** Secondi da attendere prima del prossimo messaggio in modalita' lenta (0 = puoi scrivere). Il creatore e' esente. */
export function slowWait(cfg: ChatConfig, isOwner: boolean, lastOwnMsgTs: number | undefined, now = Date.now()): number {
  if (isOwner || !cfg.slowSec || !lastOwnMsgTs) return 0;
  return Math.max(0, Math.ceil((lastOwnMsgTs + cfg.slowSec * 1000 - now) / 1000));
}

/**
 * Le domande sulle lezioni vanno nei commenti della lezione quando la chat e' in sola lettura per l'utente
 * (solo se il creatore lo consente), altrimenti anche nella chat.
 */
export function questionRouting(cfg: ChatConfig, v: ChatViewer): { chat: boolean; comments: boolean } {
  const chat = canWriteChat(cfg, v).ok;
  const comments = v.tier !== 'none' && (chat || cfg.commentsWhenReadOnly || v.user === v.owner);
  return { chat, comments: comments || chat };
}

/** Chi puo' lasciare un commento sulla lezione. */
export function canComment(cfg: ChatConfig, v: ChatViewer): boolean {
  if (v.user === v.owner) return true;
  if (v.tier === 'none' || v.mutedByOwner) return false;
  return canWriteChat(cfg, v).ok || cfg.commentsWhenReadOnly;
}
