/**
 * Spazio consapevolezza (modulo PURO): esercizi brevi ispirati alla terapia cognitivo-comportamentale (autoaiuto), da OFFRIRE e mai da imporre.
 * L'app non dice cosa fare né cosa provare: dà strumenti per vedere meglio cosa succede dentro di sé; la scelta di cosa farne è dell'utente.
 * Non è terapia né un dispositivo medico e non sostituisce un professionista. Niente punteggi, niente diagnosi, niente «giusto/sbagliato».
 */
export type StepKind = 'text' | 'scale' | 'multi' | 'choice' | 'check' | 'breath' | 'info' | 'ladder';
export type Step = {
  id: string; kind: StepKind; prompt: string; hint?: string;
  options?: string[]; min?: number; max?: number; optional?: boolean;
  /** compare solo se un'altra risposta ha questo valore */
  showIf?: { id: string; equals: string };
  /** respiro: secondi di inspirazione, espirazione e durata totale scelte */
  breath?: { inS: number; outS: number; totalS: number[] };
};
export type Exercise = { id: string; title: string; minutes: number; why: string; steps: Step[]; closing: string };

export const EMOTIONS: Record<string, string[]> = {
  'Piacevoli': ['Gioia', 'Serenità', 'Gratitudine', 'Entusiasmo', 'Orgoglio', 'Affetto', 'Speranza', 'Sollievo'],
  'Difficili': ['Tristezza', 'Rabbia', 'Ansia', 'Paura', 'Frustrazione', 'Solitudine', 'Vergogna', 'Senso di colpa', 'Stanchezza', 'Delusione'],
  'Altre': ['Confusione', 'Noia', 'Sorpresa', 'Nostalgia'],
};
/** Scala delle situazioni: «punteggio|testo» (SUDS 0-100), dal gradino più basso al più alto. */
export const ladderSorted = (rows: string[]) => rows.map((r) => { const [n, ...t] = r.split('|'); return { suds: Number(n) || 0, text: t.join('|') }; }).filter((x) => x.text.trim()).sort((a, b) => a.suds - b.suds);
export const BODY = ['Testa', 'Gola', 'Petto', 'Stomaco', 'Spalle', 'Mani', 'Tutto il corpo', 'Non lo so'];

export const EXERCISES: Exercise[] = [
  { id: 'name', title: 'Dai un nome a quello che senti', minutes: 2,
    why: 'Fermarsi a dire cosa si prova, senza giudicarlo, è un modo per vederlo con più chiarezza.',
    steps: [
      { id: 'emo', kind: 'multi', prompt: 'Cosa senti in questo momento? Puoi sceglierne più d\'una.', options: Object.values(EMOTIONS).flat() },
      { id: 'int', kind: 'scale', prompt: 'Quanto è forte, da 0 a 10?', min: 0, max: 10, optional: true },
      { id: 'body', kind: 'multi', prompt: 'Dove la senti nel corpo?', options: BODY, optional: true },
      { id: 'why', kind: 'text', prompt: 'Se ti va: cosa è successo poco prima?', optional: true },
    ],
    closing: 'Non esistono emozioni giuste o sbagliate: ci dicono qualcosa di quello che ci sta a cuore. Cosa decidi di farne, se vuoi farci qualcosa, lo scegli tu.' },
  { id: 'thought', title: 'Guarda un pensiero da vicino', minutes: 5,
    why: 'Un pensiero non è un fatto. Metterlo per iscritto e guardarlo da più lati può mostrare altre letture possibili.',
    steps: [
      { id: 'sit', kind: 'text', prompt: 'Che situazione stai vivendo? Racconta solo i fatti.' },
      { id: 'th', kind: 'text', prompt: 'Che pensiero ti è passato per la testa?' },
      { id: 'b1', kind: 'scale', prompt: 'Quanto ci credi adesso, da 0 a 100?', min: 0, max: 100 },
      { id: 'trap', kind: 'multi', prompt: 'Ti sembra che il pensiero somigli a qualcuna di queste abitudini della mente? (facoltativo)', options: ['Tutto o niente', 'Leggere nel pensiero degli altri', 'Pensare al peggio', 'Dover per forza', 'Darmi un\'etichetta', 'Non vedere il positivo'], optional: true },
      { id: 'friend', kind: 'text', prompt: 'Cosa diresti a una persona a cui tieni che avesse questo pensiero?', optional: true },
      { id: 'alt', kind: 'text', prompt: 'Esiste un\'altra lettura possibile della stessa situazione?', optional: true },
      { id: 'b2', kind: 'scale', prompt: 'E adesso, quanto credi al pensiero di prima, da 0 a 100?', min: 0, max: 100 },
    ],
    closing: 'Se la fiducia nel pensiero è cambiata, bene; se non è cambiata, va bene lo stesso. Hai guardato il pensiero invece di esserne trascinato: il resto lo decidi tu.' },
  { id: 'breath', title: 'Un respiro lento', minutes: 2,
    why: 'Qualche minuto di respiro lento dà al corpo un ritmo calmo: non risolve i problemi, ma ti ferma un momento.',
    steps: [{ id: 'b', kind: 'breath', prompt: 'Siediti comodo e segui il ritmo. Puoi fermarti quando vuoi.', breath: { inS: 4, outS: 6, totalS: [60, 120, 180] } }],
    closing: 'Come ti senti adesso rispetto a prima? Non c\'è una risposta giusta.' },
  { id: 'senses', title: 'Torna qui con i sensi', minutes: 3,
    why: 'Portare l\'attenzione su ciò che i sensi percepiscono ora aiuta a uscire per un attimo dai pensieri.',
    steps: [
      { id: 'see', kind: 'text', prompt: 'Nomina 5 cose che vedi.', optional: true },
      { id: 'touch', kind: 'text', prompt: 'Nomina 4 cose che puoi toccare.', optional: true },
      { id: 'hear', kind: 'text', prompt: 'Nomina 3 suoni che senti.', optional: true },
      { id: 'smell', kind: 'text', prompt: 'Nomina 2 odori.', optional: true },
      { id: 'taste', kind: 'text', prompt: 'Nomina 1 sapore.', optional: true },
    ],
    closing: 'Se qualcosa si è ammorbidito, bene; se no, puoi riprovare quando vuoi o scegliere altro.' },
  { id: 'loop', title: 'Un pensiero che gira', minutes: 3,
    why: 'Quando un pensiero gira a vuoto, a volte aiuta distinguere se c\'è qualcosa da fare adesso o se può aspettare.',
    steps: [
      { id: 'th', kind: 'text', prompt: 'Qual è il pensiero che continua a tornare?' },
      { id: 'act', kind: 'choice', prompt: 'C\'è qualcosa che puoi fare adesso a riguardo?', options: ['Sì', 'No, non adesso'] },
      { id: 'small', kind: 'text', prompt: 'Qual è un primo passo piccolissimo?', showIf: { id: 'act', equals: 'Sì' }, optional: true },
      { id: 'later', kind: 'choice', prompt: 'Puoi darti un «momento per i pensieri» più tardi, per tornarci con calma. Quando?', options: ['Stasera', 'Domani', 'Nel fine settimana', 'Non mi serve'], showIf: { id: 'act', equals: 'No, non adesso' } },
      { id: 'focus', kind: 'choice', prompt: 'Nel frattempo, dove vuoi portare l\'attenzione?', options: ['Al respiro', 'A una camminata', 'A della musica', 'A una persona a cui voglio bene', 'A qualcosa che mi piace fare'], optional: true },
    ],
    closing: 'Non devi risolvere tutto adesso. Hai messo il pensiero su carta e scelto cosa farne: è una tua scelta.' },
  { id: 'step', title: 'Un piccolo passo scelto da te', minutes: 3,
    why: 'Fare una piccola cosa che ti sta a cuore può cambiare la giornata più di quanto sembri. Cosa e quando lo decidi tu.',
    steps: [
      { id: 'area', kind: 'choice', prompt: 'Cosa ti farebbe bene o ti sta a cuore, in questo periodo?', options: ['Muovermi', 'Stare con qualcuno', 'Fare qualcosa di creativo', 'Stare all\'aperto', 'Riposare', 'Mettere ordine', 'Imparare qualcosa', 'Altro'] },
      { id: 'what', kind: 'text', prompt: 'Qual è un passo piccolissimo, che richiede 5 minuti?' },
      { id: 'when', kind: 'choice', prompt: 'Quando ti va di farlo?', options: ['Oggi', 'Domani', 'Questa settimana', 'Non adesso'] },
    ],
    closing: 'Se ti va, puoi trasformarlo in un task: nessun obbligo, e se non lo fai non succede nulla.' },
  { id: 'good', title: 'Tre momenti buoni', minutes: 2,
    why: 'Fermarsi a notare ciò che è andato bene, anche se piccolo, bilancia lo sguardo che di solito si ferma sulle difficoltà.',
    steps: [
      { id: 'g1', kind: 'text', prompt: 'Un momento buono di oggi o di ieri.' },
      { id: 'g2', kind: 'text', prompt: 'Un altro, anche piccolissimo.', optional: true },
      { id: 'g3', kind: 'text', prompt: 'Un terzo, se ti viene.', optional: true },
      { id: 'why', kind: 'text', prompt: 'Cosa ti ha fatto sentire così?', optional: true },
    ],
    closing: 'Quei momenti sono tuoi: li ritrovi nel diario quando ne hai voglia.' },
  { id: 'abc', title: 'Cosa è successo, cosa ho pensato, cosa ho sentito', minutes: 4,
    why: 'Non sono gli eventi a farci sentire in un certo modo da soli: conta anche come li leggiamo. Metterli in fila aiuta a vederlo.',
    steps: [
      { id: 'a', kind: 'text', prompt: 'A. La situazione: cosa è successo di concreto? (ad esempio: il capo mi ha scritto una mail)' },
      { id: 'b', kind: 'text', prompt: 'B. I pensieri: cosa ti è passato per la mente in quel momento? (ad esempio: «mi licenzieranno»)' },
      { id: 'c', kind: 'multi', prompt: 'C. Le conseguenze: che emozioni hai provato?', options: Object.values(EMOTIONS).flat() },
      { id: 'c2', kind: 'text', prompt: 'E nel corpo o nel comportamento? (ad esempio: cuore veloce, mi sono isolato)', optional: true },
    ],
    closing: 'Hai messo in fila evento, pensiero e conseguenza. Non c\'è niente da correggere: se ti va, puoi provare a guardare quel pensiero più da vicino.' },
  { id: 'evidence', title: 'Metti alla prova un pensiero', minutes: 5,
    why: 'Come un investigatore: cosa dice a favore, cosa dice contro, e che lettura più equilibrata esiste.',
    steps: [
      { id: 'th', kind: 'text', prompt: 'Quale pensiero vuoi mettere alla prova?' },
      { id: 'b1', kind: 'scale', prompt: 'Quanto ci credi adesso, da 0 a 100?', min: 0, max: 100 },
      { id: 'pro', kind: 'text', prompt: 'Quali fatti concreti dicono che sia vero?' },
      { id: 'con', kind: 'text', prompt: 'Quali fatti dicono il contrario, o che sia esagerato?' },
      { id: 'bal', kind: 'text', prompt: 'Una lettura più equilibrata e gentile della stessa situazione, con parole tue.' },
      { id: 'b2', kind: 'scale', prompt: 'E adesso, quanto credi al pensiero di prima, da 0 a 100?', min: 0, max: 100 },
    ],
    closing: 'Non serve convincersi di niente: hai guardato i fatti da più lati. Quello che ne fai lo decidi tu.' },
  { id: 'ladder', title: 'Una scala di situazioni, un gradino alla volta', minutes: 6,
    why: 'Per ciò che si evita per paura, a volte aiuta elencare le situazioni dalla più facile alla più difficile e scegliere da dove partire.',
    steps: [
      { id: 'info', kind: 'info', prompt: 'Scrivi fino a 10 situazioni che eviti o che ti mettono ansia. Per ognuna dai un numero da 0 (nessun disagio) a 100 (il massimo).' },
      { id: 'ladder', kind: 'ladder', prompt: 'Le tue situazioni' },
    ],
    closing: 'Spesso si parte da un gradino gestibile, intorno a 30-50, restando nella situazione finché il disagio cala da solo. Vai al tuo ritmo e scegli tu se e quando. Se la paura è molto forte o limita parecchio la tua vita, farlo con un professionista è più sicuro.' },
  { id: 'schedule', title: 'Pianifico una piccola cosa', minutes: 3,
    why: 'Quando manca la voglia, decidere prima una cosa piccola può aiutare: spesso è l\'azione a sbloccare la motivazione, non il contrario.',
    steps: [
      { id: 'what', kind: 'text', prompt: 'Quale piccola attività vuoi fare? (ad esempio: camminare 10 minuti, mettere in ordine la scrivania)' },
      { id: 'when', kind: 'choice', prompt: 'Quando?', options: ['Oggi', 'Domani', 'Questa settimana'] },
      { id: 'pred', kind: 'scale', prompt: 'Quanto piacere pensi di provare, da 0 a 10?', min: 0, max: 10, optional: true },
    ],
    closing: 'Fatto: l\'hai decisa tu. Dopo averla fatta, se ti va, ti chiedo com\'è andata.' },
  { id: 'rate', title: 'Com\'è andata?', minutes: 1,
    why: 'Notare quanto ti sei sentito capace e quanto ti è piaciuto aiuta a capire cosa fa per te.',
    steps: [
      { id: 'did', kind: 'choice', prompt: 'L\'hai fatta?', options: ['Sì', 'In parte', 'Non ancora'] },
      { id: 'mastery', kind: 'scale', prompt: 'Quanto ti sei sentito capace, da 0 a 10?', min: 0, max: 10, showIf: { id: 'did', equals: 'Sì' } },
      { id: 'pleasure', kind: 'scale', prompt: 'Quanto ti è piaciuta, da 0 a 10?', min: 0, max: 10, showIf: { id: 'did', equals: 'Sì' } },
    ],
    closing: 'Grazie di avermelo detto. Qualsiasi risposta va bene: serve solo a conoscerti meglio.' },
];

export type Answer = string | number | string[];
export type Entry = { id: string; ex: string; ts: number; answers: Record<string, Answer> };

/** Quali passi mostrare, in base alle risposte date (i passi con `showIf`). */
export const visibleSteps = (ex: Exercise, answers: Record<string, Answer>): Step[] => ex.steps.filter((s) => !s.showIf || String(answers[s.showIf.id] ?? '') === s.showIf.equals);

/** Il passo si può superare? I passi facoltativi sì sempre; gli altri servono una risposta. */
export function stepDone(s: Step, a: Answer | undefined): boolean {
  if (s.optional || s.kind === 'info' || s.kind === 'breath') return true;
  if (s.kind === 'ladder') return Array.isArray(a) && a.length > 0;
  if (s.kind === 'multi') return Array.isArray(a) && a.length > 0;
  if (s.kind === 'scale') return typeof a === 'number';
  return typeof a === 'string' && a.trim().length > 0;
}

/** Cosa emerge dal diario: SOLO conteggi e differenze osservate, mai interpretazioni o diagnosi. */
export function insightsOf(entries: Entry[], now = Date.now(), days = 30): { total: number; byEx: Record<string, number>; topEmotions: { n: string; c: number }[]; beliefShift: { n: number; avg: number } | null; goodMoments: number } {
  const since = now - days * 86400000;
  const e = entries.filter((x) => x.ts >= since);
  const byEx: Record<string, number> = {};
  const emo: Record<string, number> = {};
  const shifts: number[] = [];
  let good = 0;
  for (const x of e) {
    byEx[x.ex] = (byEx[x.ex] ?? 0) + 1;
    if (x.ex === 'name' && Array.isArray(x.answers.emo)) x.answers.emo.forEach((n) => { emo[n] = (emo[n] ?? 0) + 1; });
    if (x.ex === 'thought' && typeof x.answers.b1 === 'number' && typeof x.answers.b2 === 'number') shifts.push(x.answers.b1 - x.answers.b2);
    if (x.ex === 'good') good += ['g1', 'g2', 'g3'].filter((k) => typeof x.answers[k] === 'string' && String(x.answers[k]).trim()).length;
  }
  const topEmotions = Object.entries(emo).map(([n, c]) => ({ n, c })).sort((a, b) => b.c - a.c).slice(0, 3);
  return { total: e.length, byEx, topEmotions, beliefShift: shifts.length ? { n: shifts.length, avg: Math.round(shifts.reduce((a, b) => a + b, 0) / shifts.length) } : null, goodMoments: good };
}
