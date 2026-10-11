import { create } from 'zustand';

import { bank, questionById, traits, type FileRef, type Question, type Trait } from '@/data/skillBank';
import { uid } from '@/lib/format';
import { gradeTest, isLate, pickQuestions, type Answer, type SkillReq, type TestResult } from '@/lib/hiring';
import * as IV from '@/lib/interview';
import { persisted } from './persist';

export type JobKind = 'Tempo pieno' | 'Part-time' | 'Freelance' | 'Stage';
/** Prova pratica con file: il tempo parte quando il candidato scarica il test. */
export type Practical = { title: string; instructions: string; deliverables: string; files: FileRef[]; limitMin: number; skill: string; weight: number };
export const PRACTICAL_QID = 'practical';
export type Job = {
  id: string; owner: string; company: string; title: string; description: string; location: string; kind: JobKind; pay: string;
  reqs: SkillReq[]; questionIds: string[]; custom: Question[]; timeLimitMin: number;
  /** candidature "alla cieca": chi assume vede solo il nome (nome + iniziale), i punteggi e le risposte; il contatto si sblocca solo alla risposta alla videochiamata (sempre attivo: il campo resta per compatibilità) */
  blind: boolean; trustWeight: number; status: 'open' | 'closed'; createdAt: number;
  practical?: Practical;
};
/** Stato della prova pratica di un candidato. `startedAt` è salvato subito: il conto alla rovescia sopravvive alla chiusura dell'app. */
export type PracticalRun = { id: string; jobId: string; candidate: string; startedAt: number; submittedAt?: number; files: FileRef[]; note: string; late?: boolean };
export type SavedQuestion = { id: string; owner: string; q: Question };
/** 'invited' è il vecchio stato (rivelazione automatica): non viene più assegnato, si legge come 'shortlist'. L'invito vero è `iv`. */
export type AppStatus = 'submitted' | 'shortlist' | 'invited' | 'rejected';
export type Application = {
  id: string; jobId: string; candidate: string; submittedAt: number; answers: Answer[]; openScores: Record<string, number>;
  result: TestResult; status: AppStatus; feedback?: string; revealed?: boolean;
  /** colloquio in videochiamata e sblocco del contatto (lib/interview.ts) */
  iv?: IV.Interview;
  /** ulteriori verifiche chieste dall'azienda */
  checks?: IV.FurtherCheck[];
};
export const appStatusOf = (a: Application): Exclude<AppStatus, 'invited'> => (a.status === 'invited' ? 'shortlist' : a.status);
/** Domande di una verifica aggiuntiva (test: banca + create dall'azienda; prova pratica: una domanda a file). */
export const CHECK_PRACTICAL_QID = 'check-practical';
export function checkQuestions(c: IV.FurtherCheck): Question[] {
  if (c.kind === 'practical') return [{ id: CHECK_PRACTICAL_QID, skill: c.skill, kind: 'file', prompt: c.title || 'Prova pratica', rubric: c.practical?.deliverables || undefined, w: 1 }];
  if (c.kind === 'live') return [];
  return [...c.questionIds.map((id) => questionById(id)).filter((q): q is Question => !!q), ...c.custom];
}
export type PracticeResult = { id: string; person: string; skill: string; ts: number; answers: Answer[]; result: TestResult; questionIds: string[] };

export const jobQuestions = (j: Job): Question[] => [...j.questionIds.map((id) => questionById(id)).filter((q): q is Question => !!q), ...j.custom];
/** La prova pratica vista come una domanda a risposta file, così alimenta le competenze come le altre. */
export const practicalQuestion = (j: Job): Question | null => (j.practical ? { id: PRACTICAL_QID, skill: j.practical.skill, kind: 'file', prompt: j.practical.title || 'Prova pratica', rubric: j.practical.deliverables || undefined, w: j.practical.weight } : null);
/** Domande che contano per una candidatura: quelle del test e, se consegnata, la prova pratica. */
export function questionsOfApp(j: Job, a: Application): Question[] {
  const pq = practicalQuestion(j);
  return pq && a.answers.some((x) => x.qid === PRACTICAL_QID) ? [...jobQuestions(j), pq] : jobQuestions(j);
}
export const DAY = 86400000;
export const PRACTICE_COOLDOWN = 7 * DAY;

type JobsState = {
  jobs: Job[];
  applications: Application[];
  practice: PracticeResult[];
  practicals: PracticalRun[];
  library: SavedQuestion[];
  startPractical: (jobId: string, candidate: string) => PracticalRun | null;
  submitPractical: (jobId: string, candidate: string, files: FileRef[], note: string) => boolean;
  saveQuestion: (owner: string, q: Question) => void;
  removeSaved: (id: string) => void;
  /** persone che hanno rimosso i propri risultati (diritto alla cancellazione) */
  createJob: (j: Omit<Job, 'id' | 'createdAt' | 'status'>) => string;
  updateJob: (id: string, p: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  apply: (jobId: string, candidate: string, answers: Answer[]) => string | null;
  gradeOpen: (appId: string, qid: string, score: number) => void;
  setStatus: (appId: string, status: AppStatus, feedback?: string) => void;
  /* --- colloquio e sblocco del contatto (ogni azione passa dalle regole pure di lib/interview.ts) --- */
  inviteInterview: (appId: string, input: { slots: IV.Slot[]; tz: string; lang: string; message?: string }) => boolean;
  acceptInterview: (appId: string, slotIdx: number, share: IV.Share) => boolean;
  proposeOther: (appId: string, slot: IV.Slot) => boolean;
  acceptCounter: (appId: string) => boolean;
  declineInterview: (appId: string, reason: string) => boolean;
  updateShare: (appId: string, share: IV.Share) => boolean;
  callCandidate: (appId: string) => boolean;
  cancelCall: (appId: string) => boolean;
  /** il candidato risponde: SBLOCCA il contatto */
  answerCall: (appId: string) => boolean;
  declineCall: (appId: string) => boolean;
  setKeepContact: (appId: string, keep: boolean) => boolean;
  finishInterview: (appId: string, result: IV.OutcomeResult, reasons: string[], note: string) => boolean;
  /** applica scadenze (inviti, squillo, tentativi); restituisce quante candidature sono cambiate */
  settleInterviews: (now?: number) => number;
  removeApplication: (appId: string) => Application | null;
  restoreApplication: (a: Application) => void;
  /* --- ulteriori verifiche --- */
  requestCheck: (appId: string, c: Pick<IV.FurtherCheck, 'kind' | 'title' | 'skill' | 'questionIds' | 'custom' | 'timeLimitMin' | 'practical' | 'liveQuestions'>) => string | null;
  respondCheck: (appId: string, checkId: string, accept: boolean) => boolean;
  submitCheckTest: (appId: string, checkId: string, answers: Answer[]) => boolean;
  submitCheckPractical: (appId: string, checkId: string, files: FileRef[], note: string) => boolean;
  gradeCheckOpen: (appId: string, checkId: string, qid: string, score: number) => void;
  saveLiveCheck: (appId: string, checkId: string, notes: string, score: number | undefined, done: boolean) => void;
  recordPractice: (person: string, skill: string, questions: Question[], answers: Answer[]) => PracticeResult;
  deleteResults: (person: string) => void;
  reset: () => void;
};

/** Applica una transizione di colloquio a una candidatura (false se non consentita). */
function applyIv(appId: string, fn: (iv: IV.Interview, now: number) => IV.Interview | null): boolean {
  const a = useJobs.getState().applications.find((x) => x.id === appId);
  if (!a?.iv) return false;
  const next = fn(a.iv, Date.now());
  if (!next) return false;
  useJobs.setState((s) => ({ applications: s.applications.map((x) => (x.id === appId ? { ...x, iv: next } : x)) }));
  return true;
}
function applyCheck(appId: string, checkId: string, fn: (c: IV.FurtherCheck, now: number) => IV.FurtherCheck | null): boolean {
  const a = useJobs.getState().applications.find((x) => x.id === appId);
  const c = a?.checks?.find((x) => x.id === checkId);
  if (!a || !c) return false;
  const next = fn(c, Date.now());
  if (!next) return false;
  useJobs.setState((s) => ({ applications: s.applications.map((x) => (x.id === appId ? { ...x, checks: (x.checks ?? []).map((y) => (y.id === checkId ? next : y)) } : x)) }));
  return true;
}

export const useJobs = create<JobsState>()(
  persisted<JobsState>('jobs', (set, get) => ({
    jobs: [], applications: [], practice: [], practicals: [], library: [],
    createJob: (j) => { const id = uid(); set((s) => ({ jobs: [{ ...j, id, status: 'open', createdAt: Date.now() }, ...s.jobs] })); return id; },
    updateJob: (id, p) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) })),
    deleteJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id), applications: s.applications.filter((a) => a.jobId !== id), practicals: (s.practicals ?? []).filter((p) => p.jobId !== id) })),
    apply: (jobId, candidate, answers) => {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || get().applications.some((a) => a.jobId === jobId && a.candidate === candidate)) return null;
      const id = uid();
      const result = gradeTest(jobQuestions(job), answers);
      set((s) => ({ applications: [...s.applications, { id, jobId, candidate, submittedAt: Date.now(), answers, openScores: {}, result, status: 'submitted' }] }));
      return id;
    },
    startPractical: (jobId, candidate) => {
      const st = get(), job = st.jobs.find((j) => j.id === jobId);
      if (!job?.practical || !st.applications.some((a) => a.jobId === jobId && a.candidate === candidate)) return null;
      const prev = (st.practicals ?? []).find((p) => p.jobId === jobId && p.candidate === candidate);
      if (prev) return prev; // una sola prova: il tempo non riparte
      const run: PracticalRun = { id: uid(), jobId, candidate, startedAt: Date.now(), files: [], note: '' };
      set((x) => ({ practicals: [...(x.practicals ?? []), run] }));
      return run;
    },
    submitPractical: (jobId, candidate, files, note) => {
      const st = get(), job = st.jobs.find((j) => j.id === jobId);
      const run = (st.practicals ?? []).find((p) => p.jobId === jobId && p.candidate === candidate);
      if (!job?.practical || !run || run.submittedAt || (!files.length && !note.trim())) return false;
      const now = Date.now(), late = isLate(run.startedAt, job.practical.limitMin, now);
      set((s) => ({
        practicals: (s.practicals ?? []).map((p) => (p.id === run.id ? { ...p, submittedAt: now, files, note: note.trim(), late } : p)),
        applications: s.applications.map((a) => {
          if (a.jobId !== jobId || a.candidate !== candidate) return a;
          const answers = [...a.answers.filter((x) => x.qid !== PRACTICAL_QID), { qid: PRACTICAL_QID, value: note.trim(), ms: now - run.startedAt, files }];
          return { ...a, answers, result: gradeTest(questionsOfApp(job, { ...a, answers }), answers, a.openScores) };
        }),
      }));
      return true;
    },
    saveQuestion: (owner, q) => set((s) => ((s.library ?? []).some((x) => x.owner === owner && x.q.id === q.id) ? s : { library: [{ id: uid(), owner, q }, ...(s.library ?? [])] })),
    removeSaved: (id) => set((s) => ({ library: (s.library ?? []).filter((x) => x.id !== id) })),
    gradeOpen: (appId, qid, score) => set((s) => ({
      applications: s.applications.map((a) => {
        if (a.id !== appId) return a;
        const job = s.jobs.find((j) => j.id === a.jobId);
        if (!job) return a;
        const openScores = { ...a.openScores, [qid]: score };
        return { ...a, openScores, result: gradeTest(questionsOfApp(job, a), a.answers, openScores) };
      }),
    })),
    // `revealed` non scatta più: l'identità completa e il contatto si sbloccano solo alla risposta alla videochiamata (iv.contact)
    setStatus: (appId, status, feedback) => set((s) => ({ applications: s.applications.map((a) => (a.id === appId ? { ...a, status: status === 'invited' ? 'shortlist' : status, feedback: feedback ?? a.feedback } : a)) })),
    inviteInterview: (appId, input) => {
      const a = get().applications.find((x) => x.id === appId);
      if (!a || !IV.canInvite(a.status, a.iv ? IV.settle(a.iv, Date.now()) : null)) return false;
      const now = Date.now();
      const next = a.iv ? IV.reinvite(a.iv, input, now) : IV.createInvite({ ...input, now });
      if (!next) return false;
      set((s) => ({ applications: s.applications.map((x) => (x.id === appId ? { ...x, iv: next } : x)) }));
      return true;
    },
    acceptInterview: (appId, idx, share) => applyIv(appId, (iv, now) => IV.accept(iv, idx, share, now)),
    proposeOther: (appId, slot) => applyIv(appId, (iv, now) => IV.propose(iv, slot, now)),
    acceptCounter: (appId) => applyIv(appId, (iv, now) => IV.acceptCounter(iv, now)),
    declineInterview: (appId, reason) => applyIv(appId, (iv, now) => IV.decline(iv, reason, now)),
    updateShare: (appId, share) => applyIv(appId, (iv, now) => IV.setShare(iv, share, now)),
    callCandidate: (appId) => applyIv(appId, (iv, now) => IV.startCall(iv, now)),
    cancelCall: (appId) => applyIv(appId, (iv, now) => IV.cancelCall(iv, now)),
    answerCall: (appId) => applyIv(appId, (iv, now) => IV.answerCall(iv, get().applications.find((x) => x.id === appId)?.candidate ?? '', now)),
    declineCall: (appId) => applyIv(appId, (iv, now) => IV.declineCall(iv, now)),
    setKeepContact: (appId, keep) => applyIv(appId, (iv, now) => IV.setKeep(iv, keep, now)),
    finishInterview: (appId, result, reasons, note) => {
      const ok = applyIv(appId, (iv, now) => IV.finish(iv, result, reasons, note, now));
      if (ok && result === 'rejected') get().setStatus(appId, 'rejected', [...reasons, note].filter(Boolean).join(' · ') || 'Grazie per il colloquio: per questo ruolo abbiamo scelto altri profili.');
      return ok;
    },
    settleInterviews: (now = Date.now()) => {
      let n = 0;
      const apps = get().applications.map((a) => { if (!a.iv) return a; const iv = IV.settle(a.iv, now); if (iv === a.iv) return a; n++; return { ...a, iv }; });
      if (n) set({ applications: apps });
      return n;
    },
    removeApplication: (appId) => {
      const a = get().applications.find((x) => x.id === appId) ?? null;
      if (a) set((s) => ({ applications: s.applications.filter((x) => x.id !== appId), practicals: (s.practicals ?? []).filter((p) => !(p.jobId === a.jobId && p.candidate === a.candidate)) }));
      return a;
    },
    restoreApplication: (a) => set((s) => (s.applications.some((x) => x.id === a.id) ? s : { applications: [...s.applications, a] })),
    requestCheck: (appId, c) => {
      const a = get().applications.find((x) => x.id === appId);
      if (!a || a.status === 'rejected') return null;
      if (IV.asksForPersonalDocs([c.title, c.practical?.instructions, c.practical?.deliverables, ...c.liveQuestions, ...c.custom.map((q) => q.prompt)].filter(Boolean).join(' '))) return null;
      const id = uid();
      const check: IV.FurtherCheck = { ...c, id, askedAt: Date.now(), status: 'requested', answers: [], openScores: {}, privateNotes: '' };
      set((s) => ({ applications: s.applications.map((x) => (x.id === appId ? { ...x, checks: [...(x.checks ?? []), check] } : x)) }));
      return id;
    },
    respondCheck: (appId, checkId, accept) => applyCheck(appId, checkId, (c, now) => IV.respondCheck(c, accept, now)),
    submitCheckTest: (appId, checkId, answers) => applyCheck(appId, checkId, (c, now) => {
      if (c.kind !== 'test' || c.status !== 'accepted') return null;
      return { ...c, status: 'done', doneAt: now, answers, result: gradeTest(checkQuestions(c), answers, c.openScores) };
    }),
    submitCheckPractical: (appId, checkId, files, note) => applyCheck(appId, checkId, (c, now) => {
      if (c.kind !== 'practical' || c.status !== 'accepted' || (!files.length && !note.trim())) return null;
      const late = c.startedAt != null && c.practical ? isLate(c.startedAt, c.practical.limitMin, now) : false;
      const answers: Answer[] = [{ qid: CHECK_PRACTICAL_QID, value: note.trim(), ms: now - (c.startedAt ?? now), files }];
      return { ...c, status: 'done', doneAt: now, answers, files, note: note.trim(), late, result: gradeTest(checkQuestions(c), answers, c.openScores) };
    }),
    gradeCheckOpen: (appId, checkId, qid, score) => { applyCheck(appId, checkId, (c) => { const openScores = { ...c.openScores, [qid]: Math.max(0, Math.min(100, Math.round(score))) }; return { ...c, openScores, result: c.result ? gradeTest(checkQuestions(c), c.answers, openScores) : c.result }; }); },
    saveLiveCheck: (appId, checkId, notes, score, done) => { applyCheck(appId, checkId, (c, now) => (c.kind !== 'live' || (c.status !== 'accepted' && c.status !== 'done') ? null : { ...c, privateNotes: notes.slice(0, 2000), liveScore: score, status: done ? 'done' : 'accepted', doneAt: done ? now : c.doneAt, result: done && score != null ? { skillScores: { [c.skill]: score }, traits: {}, consistency: null, pending: [], answered: 1, total: 1, timeMs: 0, flags: [] } : c.result })); },
    recordPractice: (person, skill, questions, answers) => {
      const r: PracticeResult = { id: uid(), person, skill, ts: Date.now(), answers, questionIds: questions.map((q) => q.id), result: gradeTest(questions, answers) };
      set((s) => ({ practice: [...s.practice, r] }));
      return r;
    },
    deleteResults: (person) => set((s) => ({ practice: s.practice.filter((p) => p.person !== person), applications: s.applications.filter((a) => a.candidate !== person), practicals: (s.practicals ?? []).filter((p) => p.candidate !== person) })),
    reset: () => set({ jobs: [], applications: [], practice: [], practicals: [], library: [] }),
  })),
);

/* ---------- profilo di competenze di una persona ---------- */
export type SkillRecord = { score: number; ts: number; attempts: number; provisional: boolean; source: 'candidatura' | 'prova' | 'verifica' };
export type Profile = { skills: Record<string, SkillRecord>; traits: Partial<Record<Trait, number>>; consistency: number | null; tests: number };

/** Ricava il profilo dai risultati: per ogni competenza vale il test più recente. Nessun dato inventato. */
export function profileOf(person: string, st = useJobs.getState()): Profile {
  type Entry = { ts: number; r: TestResult; src: 'candidatura' | 'prova' | 'verifica' };
  const entries: Entry[] = [
    ...st.applications.filter((a) => a.candidate === person).map((a) => ({ ts: a.submittedAt, r: a.result, src: 'candidatura' as const })),
    ...st.practice.filter((p) => p.person === person).map((p) => ({ ts: p.ts, r: p.result, src: 'prova' as const })),
    ...st.applications.filter((a) => a.candidate === person).flatMap((a) => (a.checks ?? []).filter((c) => c.status === 'done' && c.result).map((c) => ({ ts: c.doneAt ?? a.submittedAt, r: c.result as TestResult, src: 'verifica' as const }))),
  ].sort((a, b) => a.ts - b.ts);
  const skills: Profile['skills'] = {};
  entries.forEach((e) => {
    Object.entries(e.r.skillScores).forEach(([sk, v]) => {
      if (v == null) return;
      const prev = skills[sk];
      skills[sk] = { score: v, ts: e.ts, attempts: (prev?.attempts ?? 0) + 1, provisional: e.r.pending.length > 0, source: e.src };
    });
  });
  const tr: Partial<Record<Trait, number[]>> = {};
  const cons: number[] = [];
  entries.forEach((e) => { traits.forEach((t) => { const v = e.r.traits[t]; if (v != null) (tr[t] ??= []).push(v); }); if (e.r.consistency != null) cons.push(e.r.consistency); });
  const tavg: Profile['traits'] = {};
  traits.forEach((t) => { if (tr[t]?.length) tavg[t] = Math.round(tr[t]!.reduce((s, x) => s + x, 0) / tr[t]!.length); });
  return { skills, traits: tavg, consistency: cons.length ? Math.round(cons.reduce((s, x) => s + x, 0) / cons.length) : null, tests: entries.length };
}

/** Domande di una prova di allenamento: 5 per competenza, 9 per l'atteggiamento. */
export const practiceQuestions = (skill: string, seed = Date.now()): Question[] =>
  skill === 'atteggiamento' ? bank.filter((q) => q.skill === 'atteggiamento') : pickQuestions(bank, [skill], 5, seed);
