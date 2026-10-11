import type { BillingPlan, Membership, MemberTier, Pricing } from './types.ts';
import { effectiveTier } from './tier.ts';

const DAY = 86400000;
export const MONTH_MS = 30 * DAY;
export const periodMs = (plan: BillingPlan) => (plan === 'annuale' ? 365 * DAY : MONTH_MS);

const mid = (user: string, clubId: string) => `${clubId}|${user}`;

export function newMembership(user: string, clubId: string, tier: MemberTier, now = Date.now()): Membership {
  return { id: mid(user, clubId), user, clubId, tier, since: now, status: 'attiva', renews: false, everJoined: true };
}

/** Segui: nessuna iscrizione, solo letture dei contenuti free. */
export const follow = (m: Membership | undefined, user: string, clubId: string, now = Date.now()): Membership =>
  m && m.status !== 'annullata' ? m : { ...newMembership(user, clubId, 'follower', now), everJoined: m?.everJoined ?? false };

export function joinFree(m: Membership | undefined, user: string, clubId: string, now = Date.now()): Membership {
  if (m && m.tier === 'premium' && effectiveTier(m, now) === 'premium') return m;
  return { ...newMembership(user, clubId, 'free', now), since: m?.since ?? now };
}

/**
 * Passa a Premium (DEMO: nessun addebito reale). Con periodo di prova il primo addebito e' a fine prova.
 */
export function startPremium(m: Membership | undefined, user: string, clubId: string, pricing: Pricing, plan: BillingPlan = 'mensile', now = Date.now()): Membership {
  const base = m ?? newMembership(user, clubId, 'premium', now);
  const trial = pricing.trialDays > 0 && !(m && m.trialEndsAt) ? pricing.trialDays * DAY : 0;
  const first = now + trial + periodMs(plan);
  return {
    ...base, tier: 'premium', status: 'attiva', renews: true, plan, everJoined: true,
    trialEndsAt: trial ? now + trial : base.trialEndsAt,
    nextChargeAt: trial ? now + trial : now + periodMs(plan),
    endsAt: trial ? now + trial : first, since: m?.since ?? now,
  };
}

/** Premium annullato: il rinnovo si ferma e l'accesso dura fino a fine periodo pagato. */
export function cancelPremium(m: Membership, now = Date.now()): Membership {
  if (m.tier !== 'premium') return m;
  const end = m.endsAt && m.endsAt > now ? m.endsAt : now;
  return { ...m, renews: false, nextChargeAt: undefined, status: 'annullata', endsAt: end };
}

/** Annullamento dell'iscrizione free/follower: immediato. */
export function cancelFree(m: Membership): Membership {
  return { ...m, status: 'annullata', renews: false, nextChargeAt: undefined, endsAt: undefined };
}

/** Riprende un premium annullato prima della fine del periodo. */
export function resumePremium(m: Membership, now = Date.now()): Membership {
  if (m.tier !== 'premium' || m.status !== 'annullata' || !m.endsAt || m.endsAt <= now) return m;
  return { ...m, status: 'attiva', renews: true, nextChargeAt: m.endsAt };
}

export const pausePremium = (m: Membership): Membership => (m.tier === 'premium' ? { ...m, status: 'in_pausa', renews: false, nextChargeAt: undefined } : m);

/**
 * Fa avanzare gli addebiti dimostrativi fino a `now`: ogni scadenza con rinnovo attivo sposta le date di un periodo.
 * Un premium annullato la cui fine e' passata diventa 'annullata' senza accesso (effectiveTier lo gestisce).
 */
export function advance(m: Membership, now = Date.now()): Membership {
  if (m.tier !== 'premium' || m.status !== 'attiva' || !m.renews || !m.nextChargeAt) return m;
  let next = m.nextChargeAt, end = m.endsAt ?? next, guard = 0;
  const per = periodMs(m.plan ?? 'mensile');
  while (next <= now && guard++ < 60) { end = next + per; next += per; }
  return next === m.nextChargeAt ? m : { ...m, nextChargeAt: next, endsAt: end };
}

export type SubState = 'nessuna' | 'follower' | 'free' | 'prova' | 'premium' | 'in_scadenza' | 'in_pausa';

export function subState(m: Membership | undefined, now = Date.now()): SubState {
  if (!m) return 'nessuna';
  const t = effectiveTier(m, now);
  if (t === 'none') return 'nessuna';
  if (m.status === 'in_pausa') return 'in_pausa';
  if (t === 'premium') {
    if (m.status === 'annullata') return 'in_scadenza';
    if (m.trialEndsAt && m.trialEndsAt > now) return 'prova';
    return 'premium';
  }
  return t;
}

/** Stato + data rilevante (da formattare nella UI con la lingua attiva). */
export function subInfo(m: Membership | undefined, now = Date.now()): { state: SubState; until?: number } {
  const state = subState(m, now);
  if (state === 'prova') return { state, until: m?.trialEndsAt };
  if (state === 'premium') return { state, until: m?.nextChargeAt };
  if (state === 'in_scadenza') return { state, until: m?.endsAt };
  return { state };
}

/** Puo' votare (club o risposte) solo chi si e' iscritto almeno una volta. */
export const canRate = (m: Membership | undefined) => !!m && (m.everJoined ?? m.tier !== 'follower');
