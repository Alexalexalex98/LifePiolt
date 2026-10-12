import { skillLabel, customSkill, skills as skillBank } from '@/data/skillBank';
import { hashStr, weekdayShortDate } from '@/lib/format';
import { useIdentity } from '@/store/identity';
import { profileOf, useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { useApp } from '@/store/app';
import { receivedLPFor, postByKey } from '@/lib/network';
import { can as canDo, type Action, type IdStatus } from './identity';
import { canVoteProfile, computeReputation, profileVoteBlockReason, type Interactions, type Participation } from './reputation';
import { skillStates, type Declared, type Evidence, type SkillState } from './skills';

/** Stato effettivo dell'identità: lo store dedicato, oppure il vecchio flag (profili demo e dati salvati prima). */
export function identityStatusOf(name: string, me: string): IdStatus {
  if (name !== me) return useApp.getState().demo ? 'verified' : 'none';
  const rec = useIdentity.getState().identity;
  if (rec.status !== 'none') return rec.status;
  return useNet.getState().identity.verified ? 'verified' : 'none';
}
export const myStatus = (): IdStatus => identityStatusOf(useApp.getState().account.name, useApp.getState().account.name);
export const canMe = (a: Action): boolean => canDo(myStatus(), a);

export function participationsOf(me: string, target: string): Participation[] {
  const s = useNet.getState();
  const list: Participation[] = s.enrollments.filter((e) => e.host === target).map((e) => ({ host: e.host, status: e.status, voted: !!e.voted }));
  if (s.clubs[target]?.members.includes(me)) list.push({ host: target, status: 'enrolled', voted: useIdentity.getState().profileVoted.includes(target) });
  return list;
}
export const profileVoteBlock = (me: string, target: string): string | null => {
  const idOk = canDo(identityStatusOf(me, me), 'vote');
  const link = profileVoteBlockReason(me, target, participationsOf(me, target));
  if (idOk) return link;
  if (me === target) return link;
  return link ? 'Mancano due cose: verificare la tua identità con un documento e iscriverti a un seminario, a un servizio o a un LifeClub di questa persona. I messaggi da soli non bastano.' : 'Per votare serve prima verificare la tua identità con un documento.';
};

/** Voto al profilo: consuma l'iscrizione (seminario / servizio) oppure l'appartenenza al LifeClub. */
export function castProfileVote(me: string, target: string, stars: number): boolean {
  if (profileVoteBlock(me, target)) return false;
  if (!canVoteProfile(me, target, participationsOf(me, target))) return false;
  const st = Math.max(1, Math.min(5, Math.round(stars)));
  useNet.setState((s) => {
    const cur = s.votes[target] ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let used = false;
    const enrollments = s.enrollments.map((e) => { if (!used && e.host === target && e.status !== 'declined' && !e.voted) { used = true; return { ...e, voted: true }; } return e; });
    if (!used) useIdentity.setState((x) => ({ profileVoted: [...x.profileVoted, target] }));
    return { votes: { ...s.votes, [target]: { ...cur, [st]: (cur[st] || 0) + 1 } }, enrollments };
  });
  return true;
}

export function interactionsFor(name: string): Interactions {
  const s = useNet.getState();
  const mine = (key: string) => postByKey(key)?.author === name;
  const likes = s.posts.filter((p) => p.author === name).reduce((a, p) => a + p.likes, 0) + s.communities.flatMap((c) => c.posts).filter((p) => p.author === name).reduce((a, p) => a + p.likes, 0);
  const saves = (s.savedPosts ?? []).filter(mine).length;
  return { likes, saves, lpDonors: s.receivedDaily[name] || 0 };
}

export function reputationFor(name: string) {
  const id = useIdentity.getState();
  return computeReputation({
    target: name,
    direct: useNet.getState().votes[name],
    qa: id.qaVotes,
    interactions: interactionsFor(name),
    now: Date.now(),
    sinceOf: (n) => (n === useApp.getState().account.name ? id.since : undefined),
  });
}

export function lifePointsFor(name: string): { total: number; today: number; donors: number } {
  const s = useNet.getState();
  const today = weekdayShortDate();
  return { total: receivedLPFor(name), today: s.dailyHistory.filter((h) => h.to === name && h.date === today).length, donors: s.receivedDaily[name] || 0 };
}

/** Prove disponibili per ogni competenza: test (prove, candidature, verifiche scritte) e verifica dal vivo. */
export function evidenceOf(person: string): Record<string, Evidence> {
  const st = useJobs.getState();
  const prof = profileOf(person, st);
  const out: Record<string, Evidence> = {};
  Object.entries(prof.skills).forEach(([id, r]) => { out[id] = { test: { score: r.score, ts: r.ts, provisional: r.provisional } }; });
  st.applications.filter((a) => a.candidate === person).forEach((a) => (a.checks ?? []).forEach((c) => {
    if (c.kind === 'live' && c.status === 'done' && c.liveScore != null && (!out[c.skill]?.live || (c.doneAt ?? 0) > out[c.skill].live!.ts)) out[c.skill] = { ...(out[c.skill] ?? {}), live: { score: c.liveScore, ts: c.doneAt ?? a.submittedAt } };
  }));
  return out;
}

/** Competenze di una persona con stato. Per `me`: quelle dichiarate; per gli altri: quelle che risultano da prove svolte (le dichiarazioni altrui restano sul loro telefono). */
export function skillStatesOf(name: string, me: string): SkillState[] {
  const id = useIdentity.getState();
  const ev = evidenceOf(name);
  const reqs = id.requests.filter((r) => r.to === name);
  if (name === me) return skillStates(id.declared, ev, reqs);
  const declared: Declared[] = Object.keys(ev).map((k) => ({ id: k, label: skillLabel(k), declaredAt: 0 }));
  reqs.forEach((r) => { if (!declared.some((d) => d.id === r.skill)) declared.push({ id: r.skill, label: skillLabel(r.skill), declaredAt: r.createdAt }); });
  return skillStates(declared, ev, reqs);
}

export const bankSkills = skillBank;
export const skillIdFor = (label: string): string => skillBank.find((s) => s.label.toLowerCase() === label.trim().toLowerCase())?.id ?? customSkill(label);
export const seedOf = (n: string) => Math.abs(hashStr(n));
