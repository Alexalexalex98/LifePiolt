import { create } from 'zustand';

import { bank, questionById, traits, type FileRef, type Question, type Trait } from '@/data/skillBank';
import { uid } from '@/lib/format';
import { gradeTest, isLate, pickQuestions, type Answer, type SkillReq, type TestResult } from '@/lib/hiring';
import { persisted } from './persist';

export type JobKind = 'Tempo pieno' | 'Part-time' | 'Freelance' | 'Stage';
/** Prova pratica con file: il tempo parte quando il candidato scarica il test. */
export type Practical = { title: string; instructions: string; deliverables: string; files: FileRef[]; limitMin: number; skill: string; weight: number };
export const PRACTICAL_QID = 'practical';
export type Job = {
  id: string; owner: string; company: string; title: string; description: string; location: string; kind: JobKind; pay: string;
  reqs: SkillReq[]; questionIds: string[]; custom: Question[]; timeLimitMin: number;
  /** candidature "alla cieca": chi assume vede competenze e affidabilità, non nome né foto, finché non invita */
  blind: boolean; trustWeight: number; status: 'open' | 'closed'; createdAt: number;
  practical?: Practical;
};
/** Stato della prova pratica di un candidato. `startedAt` è salvato subito: il conto alla rovescia sopravvive alla chiusura dell'app. */
export type PracticalRun = { id: string; jobId: string; candidate: string; startedAt: number; submittedAt?: number; files: FileRef[]; note: string; late?: boolean };
export type SavedQuestion = { id: string; owner: string; q: Question };
export type AppStatus = 'submitted' | 'shortlist' | 'invited' | 'rejected';
export type Application = {
  id: string; jobId: string; candidate: string; submittedAt: number; answers: Answer[]; openScores: Record<string, number>;
  result: TestResult; status: AppStatus; feedback?: string; revealed?: boolean;
};
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
  recordPractice: (person: string, skill: string, questions: Question[], answers: Answer[]) => PracticeResult;
  deleteResults: (person: string) => void;
  reset: () => void;
};

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
    setStatus: (appId, status, feedback) => set((s) => ({ applications: s.applications.map((a) => (a.id === appId ? { ...a, status, feedback: feedback ?? a.feedback, revealed: a.revealed || status === 'invited' } : a)) })),
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
export type SkillRecord = { score: number; ts: number; attempts: number; provisional: boolean; source: 'candidatura' | 'prova' };
export type Profile = { skills: Record<string, SkillRecord>; traits: Partial<Record<Trait, number>>; consistency: number | null; tests: number };

/** Ricava il profilo dai risultati: per ogni competenza vale il test più recente. Nessun dato inventato. */
export function profileOf(person: string, st = useJobs.getState()): Profile {
  type Entry = { ts: number; r: TestResult; src: 'candidatura' | 'prova' };
  const entries: Entry[] = [
    ...st.applications.filter((a) => a.candidate === person).map((a) => ({ ts: a.submittedAt, r: a.result, src: 'candidatura' as const })),
    ...st.practice.filter((p) => p.person === person).map((p) => ({ ts: p.ts, r: p.result, src: 'prova' as const })),
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
