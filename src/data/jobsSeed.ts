import { bank, questionById, type Question } from './skillBank';
import { gradeTest, pickQuestions, type Answer } from '../lib/hiring';
import type { Application, Job, PracticeResult } from '../store/jobs';

/** Dati di esempio per la modalità demo: offerte, candidature e prove già svolte. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** Genera risposte "plausibili" di una persona con un certo livello (0..1). */
function answersFor(qs: Question[], level: number, seed: number): Answer[] {
  const r = rng(seed);
  return qs.map((q) => {
    const ms = 6000 + Math.round(r() * 30000);
    if (q.kind === 'open') return { qid: q.id, value: level > 0.5 ? 'Buongiorno, ho letto con attenzione la vostra richiesta e propongo una soluzione concreta con tempi chiari.' : 'Ok, vediamo.', ms: ms * 4 };
    if (q.kind === 'number') return { qid: q.id, value: r() < level ? q.answer! : (q.answer ?? 0) * 1.3, ms };
    if (r() < (1 - level) * 0.9) return { qid: q.id, value: Math.floor(r() * q.options!.length), ms };
    const target = level * 100 + (r() - 0.5) * 30;
    const sorted = q.options!.map((o, i) => ({ i, d: Math.abs(o.score - target) })).sort((a, b) => a.d - b.d);
    return { qid: q.id, value: sorted[0].i, ms };
  });
}

const DAY = 86400000;

export function seedJobs(me: string) {
  const now = Date.now();
  const mk = (id: string, owner: string, company: string, title: string, description: string, location: string, kind: Job['kind'], pay: string, skills: [string, number, number][], per: number, extra: Partial<Job> = {}): Job => ({
    id, owner, company, title, description, location, kind, pay, reqs: skills.map(([skill, weight, min]) => ({ skill, weight, min })),
    questionIds: pickQuestions(bank, skills.map((s) => s[0]), per, 11).map((q) => q.id), custom: [], timeLimitMin: 25, blind: true, trustWeight: 0.2, status: 'open', createdAt: now - 3 * DAY, ...extra,
  });
  const mine = mk('job-aura', me, 'Life SA', 'Addetto vendite B2B', 'Cerchiamo una persona che porti AURA a negozi e aziende: capire il bisogno, spiegare con onestà, chiudere. Non ti chiediamo il CV: ti chiediamo di dimostrarci come lavori.', 'Lugano · ibrido', 'Tempo pieno', 'CHF 4’800–6’000 / mese', [['vendite', 4, 70], ['clienti', 2, 60], ['organizzazione', 1, 50]], 3, { createdAt: now - 6 * DAY, custom: [] });
  mine.questionIds = [...mine.questionIds, 'v5'].filter((x, i, a) => a.indexOf(x) === i);
  mine.trustWeight = 0.25;
  const jobs: Job[] = [
    mine,
    mk('job-support', 'Nadia P.', 'Fridge Lab', 'Assistenza clienti', 'Rispondi a clienti e negozi che usano i nostri frigoriferi di quartiere. Servono calma, chiarezza e voglia di risolvere.', 'Zurigo · da remoto', 'Part-time', 'CHF 32 / ora', [['clienti', 4, 70], ['scrittura', 3, 60], ['organizzazione', 1, 40]], 3),
    mk('job-data', 'Marco T.', 'Skillswap', 'Analista dati junior', 'Leggi numeri di prodotto e dici al team cosa fare. Cerchiamo ragionamento e chiarezza, non un titolo.', 'Milano · ibrido', 'Tempo pieno', 'EUR 2’400–3’000 / mese', [['analisi', 4, 70], ['problem', 3, 60], ['scrittura', 1, 50]], 3),
    mk('job-coach', 'Luca Ferri', 'Ferri Coaching', 'Collaboratore vendite freelance', 'Porti nuovi clienti a un programma di coaching: provvigione sulle vendite.', 'Da remoto', 'Freelance', 'Provvigione 15%', [['vendite', 3, 60], ['scrittura', 2, 50]], 3),
  ];

  const people: [string, number, number][] = [['Giulia M.', 0.9, 1], ['Sara B.', 0.78, 2], ['Tommaso V.', 0.62, 3], ['Federica L.', 0.45, 4], ['David K.', 0.7, 5]];
  const qs = (j: Job) => [...j.questionIds.map((id) => questionById(id)).filter((q): q is Question => !!q), ...j.custom];
  const applications: Application[] = [];
  people.slice(0, 4).forEach(([name, level, seed], i) => {
    const answers = answersFor(qs(mine), level, seed * 17);
    applications.push({ id: `app-${i}`, jobId: mine.id, candidate: name, submittedAt: now - (i + 1) * 0.6 * DAY, answers, openScores: {}, result: gradeTest(qs(mine), answers), status: i === 0 ? 'shortlist' : 'submitted' });
  });

  const practice: PracticeResult[] = [];
  const skillsAll = ['vendite', 'analisi', 'scrittura', 'problem', 'clienti', 'organizzazione'];
  people.forEach(([name, level, seed], pi) => {
    skillsAll.forEach((sk, si) => {
      if ((pi + si) % 3 === 2) return;
      const pq = pickQuestions(bank, [sk], 5, seed * 31 + si).filter((q) => q.kind !== 'open');
      const lv = Math.min(1, Math.max(0.2, level + ((si % 3) - 1) * 0.12));
      const answers = answersFor(pq, lv, seed * 100 + si);
      practice.push({ id: `pr-${pi}-${si}`, person: name, skill: sk, ts: now - (si + 2) * DAY, answers, questionIds: pq.map((q) => q.id), result: gradeTest(pq, answers) });
    });
    const att = bank.filter((q) => q.skill === 'atteggiamento');
    const aa = answersFor(att, Math.min(1, level + 0.1), seed * 900);
    practice.push({ id: `pa-${pi}`, person: name, skill: 'atteggiamento', ts: now - 8 * DAY, answers: aa, questionIds: att.map((q) => q.id), result: gradeTest(att, aa) });
  });
  return { jobs, applications, practice, votes: { 'Giulia M.': { 1: 0, 2: 0, 3: 1, 4: 6, 5: 31 }, 'Sara B.': { 1: 0, 2: 0, 3: 2, 4: 9, 5: 14 }, 'Tommaso V.': { 1: 0, 2: 1, 3: 2, 4: 7, 5: 9 }, 'Federica L.': { 1: 1, 2: 1, 3: 3, 4: 4, 5: 3 }, 'David K.': { 1: 0, 2: 0, 3: 1, 4: 5, 5: 11 } } };
}
