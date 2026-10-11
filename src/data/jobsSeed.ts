import { bank, questionById, type FileRef, type Question } from './skillBank';
import { gradeTest, pickQuestions, type Answer } from '../lib/hiring';
import { createInvite } from '../lib/interview';
import { PRACTICAL_QID, practicalQuestion, type Application, type Job, type PracticalRun, type PracticeResult } from '../store/jobs';

/** Dati di esempio per la modalità demo: offerte, candidature e prove già svolte. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/** Genera risposte "plausibili" di una persona con un certo livello (0..1). */
function answersFor(qs: Question[], level: number, seed: number): Answer[] {
  const r = rng(seed);
  return qs.map((q) => {
    const ms = 6000 + Math.round(r() * 30000);
    if (q.kind === 'file') return { qid: q.id, value: '', ms };
    if (q.kind === 'open') return { qid: q.id, value: level > 0.5 ? 'Buongiorno, ho letto con attenzione la vostra richiesta e propongo una soluzione concreta con tempi chiari.' : 'Ok, vediamo.', ms: ms * 4 };
    if (q.kind === 'number') return { qid: q.id, value: r() < level ? q.answer! : (q.answer ?? 0) * 1.3, ms };
    if (r() < (1 - level) * 0.9) return { qid: q.id, value: Math.floor(r() * q.options!.length), ms };
    const target = level * 100 + (r() - 0.5) * 30;
    const sorted = q.options!.map((o, i) => ({ i, d: Math.abs(o.score - target) })).sort((a, b) => a.d - b.d);
    return { qid: q.id, value: sorted[0].i, ms };
  });
}

const DAY = 86400000;
const HOUR = 3600000;
/** File di esempio con contenuto in linea: si scarica davvero, ma è un segnaposto. */
const demoFile = (name: string, text: string, mime = 'text/plain'): FileRef => ({ uri: '', name, mime, text, size: text.length });
const SALES_CSV = 'Mese;Negozio;Online;Telefono\nLuglio;120;80;35\nAgosto;110;95;30\nSettembre;135;120;28\n';

export function seedJobs(me: string) {
  const now = Date.now();
  const mk = (id: string, owner: string, company: string, title: string, description: string, location: string, kind: Job['kind'], pay: string, skills: [string, number, number][], per: number, extra: Partial<Job> = {}): Job => ({
    id, owner, company, title, description, location, kind, pay, reqs: skills.map(([skill, weight, min]) => ({ skill, weight, min })),
    questionIds: pickQuestions(bank, skills.map((s) => s[0]), per, 11).map((q) => q.id), custom: [], timeLimitMin: 25, blind: true, trustWeight: 0.2, status: 'open', createdAt: now - 3 * DAY, ...extra,
  });
  const mine = mk('job-aura', me, 'Life SA', 'Addetto vendite B2B', 'Cerchiamo una persona che porti AURA a negozi e aziende: capire il bisogno, spiegare con onestà, chiudere. Non ti chiediamo il CV: ti chiediamo di dimostrarci come lavori.', 'Lugano · ibrido', 'Tempo pieno', 'CHF 4’800–6’000 / mese', [['vendite', 4, 70], ['clienti', 2, 60], ['organizzazione', 1, 50]], 3, { createdAt: now - 6 * DAY, custom: [] });
  mine.questionIds = [...mine.questionIds, 'v5'].filter((x, i, a) => a.indexOf(x) === i);
  mine.trustWeight = 0.25;
  mine.custom = [
    { id: 'ja-c1', skill: 'vendite', kind: 'number', prompt: 'Un negozio compra 12 licenze a 49 CHF/mese e ottiene il 15% di sconto sul totale. Quanto paga al mese? (formula: 12 x 49 x 0,85)', answer: 499.8, tolAbs: 0.5, unit: 'CHF', w: 2, secs: 90 },
  ];
  mine.practical = { title: 'Piano per un cliente nuovo', instructions: 'Leggi la scheda del cliente (file allegato). Prepara un piano di primo contatto: obiettivo, 3 domande da fare, come gestisci l’obiezione sul prezzo, prossimi passi.', deliverables: 'Un documento (PDF o Word) di 1-2 pagine con il piano.', files: [demoFile('Scheda_cliente_Rossi_Sport.txt', 'CLIENTE: Rossi Sport (negozio di quartiere, 4 dipendenti)\nBisogno: prenotazioni via telefono, molte telefonate perse.\nBudget dichiarato: circa 40 CHF/mese.\nObiezione prevista: \"Abbiamo sempre fatto con il quaderno\".\n(File di esempio per la modalità demo.)\n')], limitMin: 60, skill: 'vendite', weight: 3 };
  const jobs: Job[] = [
    mine,
    mk('job-support', 'Nadia P.', 'Fridge Lab', 'Assistenza clienti', 'Rispondi a clienti e negozi che usano i nostri frigoriferi di quartiere. Servono calma, chiarezza e voglia di risolvere.', 'Zurigo · da remoto', 'Part-time', 'CHF 32 / ora', [['clienti', 4, 70], ['scrittura', 3, 60], ['organizzazione', 1, 40]], 3),
    mk('job-data', 'Marco T.', 'Skillswap', 'Analista dati junior', 'Leggi numeri di prodotto e dici al team cosa fare. Cerchiamo ragionamento e chiarezza, non un titolo.', 'Milano · ibrido', 'Tempo pieno', 'EUR 2’400–3’000 / mese', [['analisi', 4, 70], ['problem', 3, 60], ['scrittura', 1, 50], ['custom:Excel avanzato', 2, 50]], 2, {
      custom: [
        { id: 'jd-c1', skill: 'analisi', kind: 'number', prompt: 'Guarda il grafico degli incassi mensili. Di quanti punti percentuali sono cresciuti gli incassi da Aprile a Giugno?', unit: '%', answer: 22, tol: 0.02, w: 2, limitSec: 240, chart: { type: 'line', title: 'Incassi mensili', unit: 'migliaia di CHF', labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'], series: [{ name: 'Incassi', values: [42, 45, 48, 50, 56, 61] }] } },
        { id: 'jd-c2', skill: 'analisi', kind: 'mc', prompt: 'Il grafico mostra la quota di ordini per canale. Quale affermazione è corretta?', w: 1, chart: { type: 'pie', title: 'Ordini per canale', unit: '%', labels: ['Negozio', 'Online', 'Telefono', 'Altro'], series: [{ name: 'Quota', values: [46, 31, 15, 8] }] }, options: [{ t: 'Online e telefono insieme superano il negozio', score: 100 }, { t: 'Il telefono è il secondo canale', score: 0 }, { t: 'Il negozio vale più della metà degli ordini', score: 0 }, { t: 'Altro vale più del telefono', score: 0 }] },
        { id: 'jd-c3', skill: 'problem', kind: 'number', prompt: 'Un abbonamento costa 49 CHF/mese, il costo variabile è 9 CHF per cliente e il costo fisso è 2450 CHF/mese. Quanti clienti servono per andare in pari? Arrotonda per eccesso. Formula: clienti = costo fisso / (prezzo - costo variabile).', answer: 62, tolAbs: 0, w: 3 },
        { id: 'jd-c4', skill: 'custom:Excel avanzato', kind: 'file', prompt: 'Carica un file Excel con una tabella pivot che riassume le vendite per canale e mese, con un grafico.', rubric: 'Pivot corretta, totali, grafico leggibile, formule non fisse.', w: 2, limitSec: 900 },
      ],
      practical: { title: 'Analisi vendite Q3', instructions: 'Scarica il file con le vendite di luglio-settembre per canale. Calcola il totale per canale, la crescita del trimestre e indica in 5 righe cosa consiglieresti al team.', deliverables: 'Un file Excel con i calcoli e una sintesi in PDF o nel foglio.', files: [demoFile('Vendite_Q3.csv', SALES_CSV, 'text/csv')], limitMin: 90, skill: 'analisi', weight: 3 },
    }),
    mk('job-coach', 'Luca Ferri', 'Ferri Coaching', 'Collaboratore vendite freelance', 'Porti nuovi clienti a un programma di coaching: provvigione sulle vendite.', 'Da remoto', 'Freelance', 'Provvigione 15%', [['vendite', 3, 60], ['scrittura', 2, 50]], 3),
  ];

  const people: [string, number, number][] = [['Giulia M.', 0.9, 1], ['Sara B.', 0.78, 2], ['Tommaso V.', 0.62, 3], ['Federica L.', 0.45, 4], ['David K.', 0.7, 5]];
  const qs = (j: Job) => [...j.questionIds.map((id) => questionById(id)).filter((q): q is Question => !!q), ...j.custom];
  const applications: Application[] = [];
  people.slice(0, 4).forEach(([name, level, seed], i) => {
    const answers = answersFor(qs(mine), level, seed * 17);
    applications.push({ id: `app-${i}`, jobId: mine.id, candidate: name, submittedAt: now - (i + 1) * 0.6 * DAY, answers, openScores: {}, result: gradeTest(qs(mine), answers), status: i === 0 ? 'shortlist' : 'submitted' });
  });

  // la mia candidatura a un'offerta altrui, con un invito al colloquio ricevuto (anteprima: l'azienda e' un utente demo)
  const other = jobs.find((j) => j.id === 'job-support')!;
  const myAns = answersFor(qs(other), 0.8, 77);
  const slotAt = (d: number, h: number) => { const x = new Date(now + d * DAY); x.setHours(h, 0, 0, 0); return x.getTime(); };
  applications.push({
    id: 'app-me', jobId: other.id, candidate: me, submittedAt: now - 1.5 * DAY, answers: myAns, openScores: {}, result: gradeTest(qs(other), myAns), status: 'submitted',
    iv: createInvite({ slots: [{ start: slotAt(1, 10), durationMin: 30 }, { start: slotAt(2, 15), durationMin: 30 }], tz: 'Europe/Zurich', lang: 'Italiano', message: 'Ciao! Il tuo test ci è piaciuto: ci farebbe piacere conoscerti in una breve videochiamata.', now: now - 0.5 * DAY }) ?? undefined,
  });

  const practicals: PracticalRun[] = [];
  const pq = practicalQuestion(mine)!;
  const run = (i: number, startedAgoH: number, submitAfterMin: number | null, text: string) => {
    const a = applications[i], startedAt = now - startedAgoH * HOUR;
    const files = [demoFile(`Piano_cliente_${a.candidate.split(' ')[0]}.txt`, text)];
    const submittedAt = submitAfterMin == null ? undefined : startedAt + submitAfterMin * 60000;
    practicals.push({ id: `run-${i}`, jobId: mine.id, candidate: a.candidate, startedAt, submittedAt, files: submittedAt ? files : [], note: submittedAt ? 'Ho aggiunto una nota sul prezzo nell’ultima riga.' : '', late: submittedAt ? submittedAt > startedAt + 60 * 60000 : undefined });
    if (submittedAt) {
      a.answers = [...a.answers, { qid: PRACTICAL_QID, value: 'Ho aggiunto una nota sul prezzo nell’ultima riga.', ms: submittedAt - startedAt, files }];
      a.result = gradeTest([...qs(mine), pq], a.answers);
    }
  };
  run(0, 5, 48, 'Obiettivo: fissare una demo di 20 minuti.\nDomande: quante telefonate perdete a settimana? cosa fate oggi? chi prenota?\nPrezzo: confronto con il costo di una telefonata persa.\n');
  run(1, 6, 83, 'Obiettivo: capire il bisogno prima di parlare di prezzo.\nProssimi passi: prova gratuita di 14 giorni.\n');
  run(2, 4, null, '');

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
  return { jobs, applications, practice, practicals, votes: { 'Giulia M.': { 1: 0, 2: 0, 3: 1, 4: 6, 5: 31 }, 'Sara B.': { 1: 0, 2: 0, 3: 2, 4: 9, 5: 14 }, 'Tommaso V.': { 1: 0, 2: 1, 3: 2, 4: 7, 5: 9 }, 'Federica L.': { 1: 1, 2: 1, 3: 3, 4: 4, 5: 3 }, 'David K.': { 1: 0, 2: 0, 3: 1, 4: 5, 5: 11 } } };
}
