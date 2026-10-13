import { skillLabel, customSkill, skills as skillBank } from '@/data/skillBank';
import { hashStr, weekdayShortDate } from '@/lib/format';
import { useChat, dmId } from '@/store/chat';
import { useIdentity, type Review } from '@/store/identity';
import { profileOf, useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { useClub } from '@/store/club';
import { useApp } from '@/store/app';
import { lpReceived, receivedLPFor, postByKey } from '@/lib/network';
import { can as canDo, type Action, type IdStatus } from './identity';
import { canVoteProfile, computeReputation, itemRating, type ItemVote, profileVoteBlockReason, type Interactions, type Participation } from './reputation';
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

/** Una conversazione vera: ci sono messaggi di testo di entrambi (nessuno scambio "a senso unico"). */
export function hasRealChat(me: string, target: string): boolean {
  const msgs = useChat.getState().messages[dmId(target)] ?? [];
  const mine = msgs.some((m) => m.from === me && m.kind !== 'system' && !m.deletedForAll);
  const theirs = msgs.some((m) => m.from === target && m.kind !== 'system' && !m.deletedForAll);
  return mine && theirs;
}

export function participationsOf(me: string, target: string): Participation[] {
  const s = useNet.getState();
  const id = useIdentity.getState();
  const list: Participation[] = s.enrollments.filter((e) => e.host === target).map((e) => ({ host: e.host, status: e.status, voted: !!e.voted }));
  if (s.clubs[target]?.members.includes(me)) list.push({ host: target, status: 'enrolled', voted: id.profileVoted.includes(target) });
  // anche una conversazione vera in chat dà diritto a un voto (uno per persona)
  if (hasRealChat(me, target)) list.push({ host: target, status: 'chat', voted: (id.chatVoted ?? []).includes(target) });
  return list;
}
export const profileVoteBlock = (me: string, target: string): string | null => {
  const idOk = canDo(identityStatusOf(me, me), 'vote');
  const link = profileVoteBlockReason(me, target, participationsOf(me, target));
  if (idOk || me === target) return link;
  return link ? 'Mancano due cose: verificare la tua identità con un documento e avere un legame con questa persona (una conversazione in chat, o un seminario, un servizio o un LifeClub suo).' : 'Per votare serve prima verificare la tua identità con un documento.';
};

/** Voto al profilo con motivazione: consuma un'iscrizione, l'appartenenza al LifeClub oppure la conversazione in chat. */
export function castProfileVote(me: string, target: string, stars: number, text = ''): boolean {
  if (profileVoteBlock(me, target)) return false;
  if (!canVoteProfile(me, target, participationsOf(me, target))) return false;
  const st = Math.max(1, Math.min(5, Math.round(stars)));
  const idState = useIdentity.getState();
  const clubOpen = !!useNet.getState().clubs[target]?.members.includes(me) && !idState.profileVoted.includes(target);
  const hasEnrol = useNet.getState().enrollments.some((e) => e.host === target && e.status !== 'declined' && !e.voted);
  useNet.setState((s) => {
    const cur = s.votes[target] ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let used = false;
    const enrollments = s.enrollments.map((e) => { if (!used && e.host === target && e.status !== 'declined' && !e.voted) { used = true; return { ...e, voted: true }; } return e; });
    return { votes: { ...s.votes, [target]: { ...cur, [st]: (cur[st] || 0) + 1 } }, enrollments };
  });
  if (!hasEnrol) useIdentity.setState((x) => (clubOpen ? { profileVoted: [...x.profileVoted, target] } : { chatVoted: [...(x.chatVoted ?? []), target] }));
  useIdentity.getState().addReview({ from: me, to: target, stars: st, text: text.trim().slice(0, 400), ts: Date.now() });
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
    items: itemVotesFor(name),
    interactions: interactionsFor(name),
    now: Date.now(),
    sinceOf: (n) => (n === useApp.getState().account.name ? id.since : undefined),
  });
}

export function lifePointsFor(name: string): { total: number; daily: number; today: number; donors: number } {
  const s = useNet.getState();
  const today = weekdayShortDate();
  return { total: receivedLPFor(name), daily: lpReceived(name).daily, today: s.dailyHistory.filter((h) => h.to === name && h.date === today).length, donors: s.receivedDaily[name] || 0 };
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

const DEMO_REVIEWS: [number, string][] = [
  [5, 'Disponibile e chiaro: mi ha aiutato a risolvere in una sera quello che rimandavo da settimane.'],
  [4, 'Molto utile, risposte puntuali. Avrei voluto qualche esempio in più.'],
  [5, 'Persona precisa e gentile, si vede che sa di cosa parla.'],
  [3, 'Buon contenuto, ma i tempi di risposta sono stati un po\' lunghi.'],
  [4, 'Consigli concreti e facili da applicare.'],
  [5, 'Mi sono sentito seguito dall\'inizio alla fine. Lo consiglio.'],
  [5, 'Il seminario era ben organizzato, con esempi veri e tempo per le domande.'],
  [4, 'Sessione di consulenza utile: in un\'ora ho avuto un piano chiaro da seguire.'],
  [5, 'Il LifeClub è pieno di materiale pratico e nella chat risponde sempre, anche sotto i video.'],
  [4, 'Lezioni brevi e ben fatte. Le schede da scaricare sono comodissime.'],
  [5, 'Ha risposto alla mia domanda con calma e poi mi ha mandato anche un riferimento in più.'],
  [3, 'Interessante ma un po\' veloce nella parte finale; mi sarebbe servito più tempo.'],
];
/** Recensioni di una persona (voto + motivazione): quelle reali date su questo telefono e, in demo, alcune di esempio. */
export function reviewsFor(name: string, demo: boolean): Review[] {
  const real = (useIdentity.getState().reviews ?? []).filter((r) => r.to === name);
  if (!demo) return real;
  const counts = useNet.getState().votes[name] ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const authors = useNet.getState().suggested.filter((n) => n !== name);
  const n = Math.min(total, 8, authors.length);
  const base = Math.abs(hashStr(name + 'rev'));
  const sample: Review[] = Array.from({ length: n }, (_, i) => { const [stars, text] = DEMO_REVIEWS[(base + i * 5) % DEMO_REVIEWS.length]; return { from: authors[(base + i) % authors.length], to: name, stars, text, ts: Date.now() - (i + 2) * 5 * 86400000 }; });
  return [...real, ...sample];
}

/** Demo: se il tuo profilo non ha ancora voti (dati salvati prima), ne crea qualcuno di esempio così le recensioni si vedono. */
export function ensureDemoVotes(me: string) {
  const st = useNet.getState();
  const cur = st.votes[me];
  if (cur && Object.values(cur).some((v) => v > 0)) return;
  useNet.setState({ votes: { ...st.votes, [me]: { 1: 0, 2: 1, 3: 1, 4: 3, 5: 6 } } });
}

/* ---------- valutazione di corsi, seminari e sedute ---------- */
/** Valutazioni ai singoli corsi/seminari/sedute di `name`: quelle date su questo telefono e le valutazioni dei LifeClub che gestisce. */
export function itemVotesFor(name: string): ItemVote[] {
  const mine = (useIdentity.getState().itemVotes ?? []).filter((v) => v.to === name);
  const club = useClub.getState();
  const fromClubs: ItemVote[] = Object.values(club.clubs).filter((c) => c.owner === name).flatMap((c) => Object.entries(club.ratings[c.id] ?? {}).map(([user, r]) => ({ from: user, to: name, ref: `club:${c.id}`, stars: r.stars, ts: r.ts })));
  return [...mine, ...fromClubs];
}
export const itemRatingOf = (ref: string): { avg: number | null; n: number } => {
  const owner = ref.startsWith('seminar:') ? useNet.getState().seminars.find((s) => String(s.id) === ref.slice(8))?.host : ref.startsWith('service:') ? ref.slice(8) : ref.startsWith('club:') ? useClub.getState().clubs[ref.slice(5)]?.owner : undefined;
  return itemRating(ref, owner ? itemVotesFor(owner) : [], Date.now());
};
/** Chi ha partecipato (confermato) a quel seminario o sessione può valutarlo; una sola valutazione per persona e per corso. */
export function itemRateBlock(me: string, ref: string): string | null {
  const st = useNet.getState();
  const host = ref.startsWith('seminar:') ? st.seminars.find((s) => String(s.id) === ref.slice(8))?.host : ref.startsWith('service:') ? ref.slice(8) : undefined;
  if (!host) return 'Non puoi valutare questo contenuto.';
  if (host === me) return 'Non puoi valutare te stesso.';
  const took = st.enrollments.some((e) => e.host === host && e.status === 'attended' && (ref.startsWith('seminar:') ? e.kind === 'seminar' && e.ref === ref.slice(8) : e.kind === 'service'));
  if (!took) return 'Puoi valutare solo dopo aver partecipato e confermato.';
  if ((useIdentity.getState().itemVotes ?? []).some((v) => v.from === me && v.ref === ref)) return 'Hai già valutato questo contenuto.';
  return null;
}
export function rateItem(me: string, ref: string, stars: number, text?: string): string | null {
  const why = itemRateBlock(me, ref);
  if (why) return why;
  const st = useNet.getState();
  const to = ref.startsWith('seminar:') ? st.seminars.find((s) => String(s.id) === ref.slice(8))!.host : ref.slice(8);
  useIdentity.getState().addItemVote({ from: me, to, ref, stars: Math.max(1, Math.min(5, Math.round(stars))), ts: Date.now(), ...(text?.trim() ? { text: text.trim().slice(0, 240) } : {}) });
  return null;
}

/** Solo demo: segna come già frequentato un seminario o una seduta, per provare le valutazioni. */
export function demoAttend(me: string, ref: string): void {
  const st = useNet.getState();
  const isSem = ref.startsWith('seminar:');
  const sem = isSem ? st.seminars.find((s) => String(s.id) === ref.slice(8)) : undefined;
  const host = isSem ? sem?.host : ref.slice(8);
  if (!host || host === me) return;
  if (st.enrollments.some((e) => e.host === host && e.status === 'attended' && (isSem ? e.kind === 'seminar' && e.ref === ref.slice(8) : e.kind === 'service'))) return;
  const startsAt = Date.now() - 3 * 86400000;
  useNet.setState({ enrollments: [{ id: 'd' + Date.now().toString(36), kind: isSem ? 'seminar' : 'service', ref: isSem ? ref.slice(8) : `${host}|demo`, title: sem?.title ?? 'Seduta', host, price: 0, startsAt, durationMin: 60, status: 'attended', createdAt: startsAt }, ...st.enrollments] });
}

/** Nome leggibile di un corso, seminario, seduta o LifeClub dal suo riferimento. */
export function itemRefLabel(ref: string): string {
  if (ref.startsWith('seminar:')) return useNet.getState().seminars.find((s) => String(s.id) === ref.slice(8))?.title ?? 'Seminario';
  if (ref.startsWith('service:')) return `Sedute di ${ref.slice(8)}`;
  if (ref.startsWith('club:')) return useClub.getState().clubs[ref.slice(5)]?.name ?? 'LifeClub';
  return 'Contenuto';
}
