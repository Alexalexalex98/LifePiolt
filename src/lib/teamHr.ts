import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import type { Profile } from '@/lib/hr';
import { myUserId } from '@/lib/teams';
import { createProjectFromTemplate } from '@/lib/teamTasks';
import { db, pushWorkEvent, q, run, today } from '@/lib/teamWork';
import { PROJECT_TEMPLATES } from '@/lib/workTasks';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useHr, type HrCandidate, type HrData, type HrProfile, type HrReview, type HrTraining } from '@/store/hr';
import { useLife } from '@/store/life';

/** Persone e HR sul server: ogni permesso lo decide il server (HR vede tutto, ognuno vede solo la propria scheda, le proprie valutazioni condivise e la propria formazione). */
const sel = async <T,>(table: string, team: string): Promise<T[]> => { try { return await q<T[]>((await db()).from(table).select('*').eq('team_id', team)); } catch { return []; } };
export async function pullHr(team: string): Promise<void> {
  const [profiles, candidates, reviews, training, absences] = await Promise.all([sel<HrProfile>('team_hr_profiles', team), sel<HrCandidate>('team_candidates', team), sel<HrReview>('team_reviews', team), sel<HrTraining>('team_training', team), sel<HrData['absences'][number]>('team_absences', team)]);
  let mine: Profile | null = null; try { mine = (await (await supa()).rpc<Profile | null>('team_my_hr', { p_team: team })) ?? null; } catch { mine = null; }
  useHr.getState().set(team, { profiles, mine, candidates, reviews, training, absences });
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullHr(team); return r; });
const planEvent = async (team: string, day: string, time: string, title: string, dur = 60) => { const me = await myUserId(); const ev = { time, title: title.slice(0, 190), dur, color: WORK_COLOR_ID, team, wid: newEventId(), by: me ?? undefined }; useLife.getState().addEvent(day, ev); void pushWorkEvent(day, ev); };

export const saveProfile = (team: string, user: string, p: Partial<Profile> & { hr_notes?: string }) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const cur = useHr.getState().data[team]?.profiles.find((x) => x.user_id === user);
  await q((await db()).from('team_hr_profiles').upsert({ team_id: team, user_id: user, hired_on: cur?.hired_on ?? null, contract: cur?.contract ?? 'indeterminato', contract_end: cur?.contract_end ?? null, weekly_hours: cur?.weekly_hours ?? null, vacation_days: cur?.vacation_days ?? null, phone: cur?.phone ?? '', emergency: cur?.emergency ?? '', hr_notes: cur?.hr_notes ?? '', ...p, updated_by: me, updated_at: new Date().toISOString() }));
});

export type NewCand = { team: string; name: string; email?: string; phone?: string; role?: string; source?: string; cv_doc?: string | null };
export const createCandidate = (n: NewCand) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_candidates').insert({ id: newEventId(), team_id: n.team, name: n.name.trim(), email: n.email ?? '', phone: n.phone ?? '', role: n.role ?? '', source: n.source ?? '', cv_doc: n.cv_doc ?? null, created_by: me }));
});
export const updateCandidate = (c: HrCandidate, patch: Partial<Pick<HrCandidate, 'name' | 'email' | 'phone' | 'role' | 'stage' | 'scores' | 'notes' | 'interview_at'>>) => after(c.team_id, async () => {
  await q((await db()).from('team_candidates').update(patch).eq('id', c.id));
  if (patch.interview_at && patch.interview_at !== c.interview_at) { const d = new Date(patch.interview_at); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; await planEvent(c.team_id, day, `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, `${t('Colloquio')}: ${c.name}`); }
});
export const deleteCandidate = (c: HrCandidate) => after(c.team_id, async () => { await q((await db()).from('team_candidates').delete().eq('id', c.id)); });

export const createReview = (team: string, person: string, period: string) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId(); await q((await db()).from('team_reviews').insert({ id, team_id: team, person, period, by: me })); return id;
});
export const updateReview = (r: HrReview, patch: Partial<Pick<HrReview, 'goals' | 'rating' | 'feedback' | 'status'>>) => after(r.team_id, async () => { await q((await db()).from('team_reviews').update(patch).eq('id', r.id)); });
export const deleteReview = (r: HrReview) => after(r.team_id, async () => { await q((await db()).from('team_reviews').delete().eq('id', r.id)); });

export const addTraining = (team: string, person: string, x: { title: string; kind: HrTraining['kind']; done_on: string | null; expires_on: string | null }) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_training').insert({ id: newEventId(), team_id: team, person, ...x, created_by: me }));
  if (x.expires_on) { const d = new Date(x.expires_on + 'T12:00:00'); d.setDate(d.getDate() - 30); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (day >= today()) await planEvent(team, day, '09:00', `${t('Rinnovare')}: ${x.title}`, 30); }
});
export const deleteTraining = (x: HrTraining) => after(x.team_id, async () => { await q((await db()).from('team_training').delete().eq('id', x.id)); });

/** Avvia l'inserimento di un nuovo collega o la sua uscita: un progetto con tutti i passaggi e le scadenze, assegnato a te. */
export const startProcess = (team: string, kind: 'onboarding' | 'uscita', personName: string) => run(async () => {
  const tpl = PROJECT_TEMPLATES.find((x) => x.id === kind)!; const me = await myUserId();
  const r = await createProjectFromTemplate(team, tpl, today(), me, `${tpl.name}: ${personName}`); if (!r.ok) throw new Error(r.message); return r.data;
});
