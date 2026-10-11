import type { Club, Course, Lesson, Membership, MemberTier } from './types.ts';

const DAY = 86400000;

/** Livello effettivo di una iscrizione adesso: un premium annullato resta premium fino a fine periodo pagato. */
export function effectiveTier(m: Membership | undefined, now = Date.now()): MemberTier | 'none' {
  if (!m) return 'none';
  if (m.status === 'annullata') {
    if (m.tier === 'premium' && m.endsAt && m.endsAt > now) return 'premium';
    return 'none';
  }
  if (m.status === 'in_pausa') return m.tier === 'premium' ? 'free' : m.tier;
  if (m.tier === 'premium' && m.endsAt && m.endsAt <= now && !m.renews) return 'free';
  return m.tier;
}

export type Viewer = { user: string; owner: string; tier: MemberTier | 'none' };

export type Access = { ok: boolean; reason?: 'iscriviti' | 'premium' | 'bozza' };

/**
 * Accesso a una lezione:
 *  - il creatore vede tutto (anche le bozze);
 *  - le bozze non sono visibili ad altri;
 *  - anteprima gratuita: chiunque (anche senza iscrizione);
 *  - tier free: serve almeno 'follower'? No: i contenuti free sono per chiunque segua o si iscriva (follower/free/premium);
 *  - tier premium: solo abbonati premium (periodo pagato o prova attiva).
 */
export function lessonAccess(v: Viewer, course: Pick<Course, 'published'>, lesson: Pick<Lesson, 'tier' | 'preview'>): Access {
  if (v.user === v.owner) return { ok: true };
  if (!course.published) return { ok: false, reason: 'bozza' };
  if (lesson.preview) return { ok: true };
  if (lesson.tier === 'free') return v.tier === 'none' ? { ok: false, reason: 'iscriviti' } : { ok: true };
  return v.tier === 'premium' ? { ok: true } : { ok: false, reason: 'premium' };
}

/** Un'anteprima non tiene conto del tier: serve per mostrare il lucchetto. */
export const isLocked = (a: Access) => !a.ok;

/** Quante lezioni del corso sono visibili/sbloccate per il viewer. */
export function unlockedCount(v: Viewer, course: Course): { total: number; open: number } {
  const open = course.lessons.filter((l) => lessonAccess(v, course, l).ok).length;
  return { total: course.lessons.length, open };
}

/** Corso "premium" se ha almeno una lezione premium non in anteprima. */
export const courseHasPremium = (c: Course) => c.lessons.some((l) => l.tier === 'premium');

export function sortedLessons(c: Course): Lesson[] {
  const sec = new Map(c.sections.map((s) => [s.id, s.order]));
  return [...c.lessons].sort((a, b) => (sec.get(a.sectionId) ?? 0) - (sec.get(b.sectionId) ?? 0) || a.order - b.order);
}

/** Il club ha una sezione a pagamento attiva (quota > 0 e almeno una lezione/post premium, o semplicemente quota > 0). */
export const hasPremium = (club: Pick<Club, 'pricing'>) => club.pricing.monthly > 0;

export const daysLeft = (until: number | undefined, now = Date.now()) => (until ? Math.max(0, Math.ceil((until - now) / DAY)) : 0);

/** Post visibile al viewer (i post premium solo agli abbonati; il creatore vede tutto). */
export function postVisible(v: Viewer, p: { tier: 'free' | 'premium' }): boolean {
  if (v.user === v.owner) return true;
  return p.tier === 'free' ? true : v.tier === 'premium';
}
