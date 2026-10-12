import { canShare } from '@/lib/privacyGateApp';
import { useMemo } from 'react';

import { buildCardData, sanitizeDesign, type CardData, type CardDesign } from '@/lib/profile/card';
import { skillStatesOf } from '@/lib/profile/actions';
import { cardSkills } from '@/lib/profile/skills';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';

export const profileLink = (name: string) => `lifepilot://userProfile?name=${encodeURIComponent(name)}`;

/** Composizione + contenuto del biglietto di `name`. Per `me`: disegno salvato, ruolo e attività scelti, contatti solo se condivisi. */
export function useCardFor(name: string): { design: CardDesign; data: CardData; qrText: string; isMe: boolean } {
  const me = useApp((s) => s.account.name);
  const isMe = name === me;
  const stored = useIdentity((s) => s.design);
  const role = useIdentity((s) => s.role);
  const bizId = useIdentity((s) => s.cardBusinessId);
  const businesses = useIdentity((s) => s.businesses);
  const declared = useIdentity((s) => s.declared);
  const requests = useIdentity((s) => s.requests);
  const card = useNet((s) => s.myCard);
  const providers = useNet((s) => s.providers);
  const applications = useJobs((s) => s.applications);
  const practice = useJobs((s) => s.practice);
  return useMemo(() => {
    const design = isMe ? sanitizeDesign(stored) : sanitizeDesign(null);
    const states = skillStatesOf(name, me);
    const chosen = isMe ? design.skills : undefined;
    const skills = cardSkills(states, chosen).map((x) => x.label);
    if (isMe) {
      const biz = businesses.find((b) => b.id === bizId) ?? null;
      const data = buildCardData({ name, legacy: card as unknown as Record<string, unknown>, role: role || undefined, business: biz?.name ?? '', skills, shareEmail: !!card.showEmail && canShare('acc_email', 'chat:card', { log: false }).allowed, sharePhone: !!card.showPhone && canShare('card_phone', 'chat:card', { log: false }).allowed });
      return { design, data, qrText: profileLink(name), isMe };
    }
    const p = providers.find((x) => x.name === name);
    const data = buildCardData({ name, role: p?.role ?? '', business: '', skills, shareEmail: false, sharePhone: false });
    return { design, data, qrText: profileLink(name), isMe };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, me, isMe, stored, role, bizId, businesses, declared, requests, card, providers, applications, practice]);
}
