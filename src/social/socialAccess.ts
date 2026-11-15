import { useEffect, useState } from 'react';

import { useApp } from '@/store/app';

import { socialSession } from './socialApi';

/** Chi può usare la parte social: dai 16 anni e senza sanzioni. Lo decide il server; senza account online o in demo non si blocca nulla. */
export type SocialStatus = { allowed: boolean; ageOk: boolean; minAge: number; sanction: string | null; admin: boolean };
const OPEN: SocialStatus = { allowed: true, ageOk: true, minAge: 16, sanction: null, admin: false };
let cache: { at: number; v: SocialStatus } | null = null;

export async function socialStatus(force = false): Promise<SocialStatus> {
  if (useApp.getState().demo) return OPEN;
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.v;
  const s = await socialSession(); if (!s) return OPEN;
  try {
    const r = await s.sb.rpc('my_social_status');
    if (r.error || !r.data) return cache?.v ?? OPEN;
    const d = r.data as { allowed: boolean; age_ok: boolean; min_age: number; sanction: string | null; admin: boolean };
    const v: SocialStatus = { allowed: !!d.allowed, ageOk: !!d.age_ok, minAge: d.min_age || 16, sanction: d.sanction ?? null, admin: !!d.admin };
    cache = { at: Date.now(), v }; return v;
  } catch { return cache?.v ?? OPEN; }
}
export const resetSocialStatus = () => { cache = null; };

export function useSocialStatus(): SocialStatus {
  const [st, setSt] = useState<SocialStatus>(cache?.v ?? OPEN);
  const who = useApp((s) => s.account.email);
  useEffect(() => { let on = true; void socialStatus().then((v) => { if (on) setSt(v); }); return () => { on = false; }; }, [who]);
  return st;
}
