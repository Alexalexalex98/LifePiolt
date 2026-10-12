import type { Club, ClubComment, Course, Lesson, Section } from '@/lib/club';

/**
 * LifeClub di esempio (solo modalita' demo). Persone e contenuti sono inventati; i video/audio/PDF di esempio
 * non hanno file: nel lettore girano con un cronometro dimostrativo (vedi docs/lifeclub.md).
 */
const T0 = Date.UTC(2026, 8, 1);
const sec = (id: string, title: string, order: number): Section => ({ id, title, order });
let n = 0;
const les = (courseId: string, sectionId: string, title: string, kind: Lesson['kind'], tier: Lesson['tier'], extra: Partial<Lesson> = {}): Lesson => ({
  id: `${courseId}-l${++n}`, title, kind, sectionId, order: n, tier, preview: false, ...extra,
});

/* ---------- Cucina veloce con Laura ---------- */
const cucina: Course = {
  id: 'cu1', title: 'Cene in 20 minuti', level: 'base', published: true, createdAt: T0,
  description: 'Sette cene semplici con pochi ingredienti, una padella e senza stress. Ogni lezione ha la lista della spesa.',
  sections: [sec('cu1s1', 'Per cominciare', 0), sec('cu1s2', 'Le ricette', 1)],
  lessons: [
    les('cu1', 'cu1s1', 'Gli attrezzi che servono davvero', 'video', 'free', { durationSec: 380, preview: true, description: 'Tre pentole, due coltelli e poco altro: cosa tenere in cucina e cosa no.' }),
    les('cu1', 'cu1s1', 'Lista della spesa della settimana', 'pdf', 'free', { pages: 3, text: 'Lista della spesa · Settimana 1\n\nDispensa: pasta corta, riso, passata di pomodoro, olio, sale grosso, legumi in barattolo.\f\nFresco: uova, parmigiano, yogurt naturale, limoni, aglio, prezzemolo.\f\nVerdura: zucchine, carote, cipolle, spinaci, pomodori. Scegli quella di stagione.' }),
    les('cu1', 'cu1s2', 'Pasta in padella unica', 'video', 'premium', { durationSec: 580, description: 'Pasta, sugo e verdure cuociono insieme: un solo recipiente da lavare.' }),
    les('cu1', 'cu1s2', 'Verdure al forno senza pensieri', 'video', 'premium', { durationSec: 665 }),
    les('cu1', 'cu1s2', 'Frittata che non si rompe', 'video', 'premium', { durationSec: 440 }),
    les('cu1', 'cu1s2', 'Come avanzare le cene della settimana', 'testo', 'premium', { text: 'Cuoci una volta, mangia due.\n\nIl lunedì prepara il doppio di riso e verdure: il martedì diventano una frittata o un\'insalata tiepida.\n\nConserva in contenitori chiusi, in frigorifero, al massimo tre giorni. Scalda sempre fino a quando è ben caldo in ogni punto.\n\nSe cucini per una persona sola, congela porzioni singole e scrivi la data sul coperchio.' }),
  ],
};
const conserva: Course = {
  id: 'cu2', title: 'Conservare e riscaldare in sicurezza', level: 'base', published: true, createdAt: T0 + 86400000,
  description: 'Poche regole chiare per evitare sprechi e rischi in cucina.',
  sections: [sec('cu2s1', 'Guida rapida', 0)],
  lessons: [
    les('cu2', 'cu2s1', 'Frigorifero e congelatore: cosa va dove', 'testo', 'free', { text: 'Ripiano alto: cibi pronti e avanzi.\n\nRipiano centrale: latticini e uova.\n\nRipiano basso: carne e pesce crudi, sempre in contenitori chiusi.\n\nCassetto: frutta e verdura.\n\nPorta: bevande e salse, non il latte.' }),
    les('cu2', 'cu2s1', 'Scongelare senza sorprese', 'audio', 'free', { durationSec: 300 }),
  ],
};

/* ---------- Corsa per tutti con Marco ---------- */
const corsa: Course = {
  id: 'co1', title: 'Dalla camminata ai 5 km', level: 'base', published: true, createdAt: T0,
  description: 'Otto settimane graduali per iniziare a correre senza farsi male. Tre uscite a settimana, nessuna fretta.',
  sections: [sec('co1s1', 'Prima di partire', 0), sec('co1s2', 'Il piano', 1)],
  lessons: [
    les('co1', 'co1s1', 'Come iniziare in modo gentile', 'audio', 'free', { durationSec: 420, preview: true, description: 'Scarpe, ritmo e respiro: tre cose da sapere prima della prima uscita.' }),
    les('co1', 'co1s1', 'Settimana 1: camminata e corsa alternate', 'video', 'free', { durationSec: 530 }),
    les('co1', 'co1s2', 'Piano completo di 8 settimane', 'pdf', 'premium', { pages: 4, text: 'Piano 8 settimane · Settimane 1-2\n\nTre uscite a settimana. 1 minuto di corsa leggera, 2 minuti di camminata, ripetuti 8 volte.\f\nSettimane 3-4\n\n3 minuti di corsa, 2 di camminata, ripetuti 6 volte.\f\nSettimane 5-6\n\n5 minuti di corsa, 2 di camminata, ripetuti 4 volte.\f\nSettimane 7-8\n\n20 minuti di corsa continua, poi 5 km a ritmo comodo. Se hai dolore, fermati e riposa un giorno in più.' }),
    les('co1', 'co1s2', 'Allungamenti dopo la corsa', 'video', 'premium', { durationSec: 495 }),
    les('co1', 'co1s2', 'Cosa fare se ti fa male il ginocchio', 'video', 'premium', { durationSec: 610 }),
  ],
};

/* ---------- Spagnolo in 10 minuti con Elena ---------- */
const spagnolo: Course = {
  id: 'es1', title: 'Spagnolo per viaggiare', level: 'base', published: true, createdAt: T0,
  description: 'Le frasi che servono davvero al bar, in albergo e per strada. Dieci minuti al giorno.',
  sections: [sec('es1s1', 'Salutare e presentarsi', 0), sec('es1s2', 'In giro', 1)],
  lessons: [
    les('es1', 'es1s1', 'Saluti e presentazioni', 'video', 'free', { durationSec: 560, preview: true }),
    les('es1', 'es1s1', 'I numeri da 1 a 100', 'audio', 'free', { durationSec: 480 }),
    les('es1', 'es1s2', 'Al bar e al ristorante', 'video', 'premium', { durationSec: 600 }),
    les('es1', 'es1s2', 'Chiedere indicazioni', 'video', 'premium', { durationSec: 585 }),
    les('es1', 'es1s2', 'Schede di vocabolario', 'pdf', 'premium', { pages: 2, text: 'Al bar · Vocabolario\n\nun café con leche · un caffè con latte\nla cuenta, por favor · il conto, per favore\f\nPer strada\n\n¿Dónde está...? · Dov\'è...?\na la derecha / a la izquierda · a destra / a sinistra' }),
  ],
};

const base = { published: true, createdAt: T0, posts: [] as Club['posts'] };

export const SEED_CLUBS: Club[] = [
  {
    ...base, id: 'club-cucina', owner: 'Laura Conti', name: 'Cucina veloce con Laura', tagline: 'Cene semplici in 20 minuti, una padella sola',
    description: 'Ricette di tutti i giorni con pochi ingredienti, liste della spesa pronte e consigli per non sprecare cibo. Nella chat rispondo alle tue domande, anche durante i video.',
    cover: { c1: '#ff9966', c2: '#ff5e62' }, categories: ['Cucina', 'Casa'],
    pricing: { monthly: 9, currency: 'CHF', trialDays: 7, yearlyDiscountPct: 20 },
    chat: { write: 'members', chosen: [], slowSec: 0, commentsWhenReadOnly: true },
    courses: [cucina, conserva],
    posts: [
      { id: 'po-cu1', text: 'Questa settimana in chat: ogni sera una foto del vostro piatto. Chi vuole un parere, scriva «domanda» nel messaggio.', ts: T0 + 3 * 86400000, tier: 'free', pinned: true },
      { id: 'po-cu2', text: 'Nuova lezione per gli abbonati: la frittata che non si rompe.', ts: T0 + 5 * 86400000, tier: 'premium' },
    ],
    baseline: { followers: 214, free: 96, premium: 31 }, demoStats: { openQuestions: 4, avgCompletionPct: 62 },
  },
  {
    ...base, id: 'club-corsa', owner: 'Marco Valli', name: 'Corsa per tutti con Marco', tagline: 'Dal divano ai 5 km, senza farsi male',
    description: 'Un percorso graduale per chi inizia o riprende a correre. Piani, audio da ascoltare mentre corri e una chat dove chiedere tutto. Non sostituisce il parere del medico.',
    cover: { c1: '#36d1dc', c2: '#5b86e5' }, categories: ['Sport', 'Benessere'],
    pricing: { monthly: 12, currency: 'CHF', trialDays: 14, yearlyDiscountPct: 25 },
    chat: { write: 'premium', chosen: [], slowSec: 30, commentsWhenReadOnly: true },
    courses: [corsa],
    posts: [{ id: 'po-co1', text: 'Domenica uscita di gruppo facile, 5 km a passo chiacchierata. Il punto di ritrovo lo scrivo in chat.', ts: T0 + 6 * 86400000, tier: 'free', pinned: true }],
    baseline: { followers: 340, free: 128, premium: 54 }, demoStats: { openQuestions: 7, avgCompletionPct: 48 },
  },
  {
    ...base, id: 'club-spagnolo', owner: 'Elena Serra', name: 'Spagnolo in 10 minuti con Elena', tagline: 'Le frasi che servono davvero per viaggiare',
    description: 'Lezioni brevi di spagnolo per viaggiare: pronuncia, frasi utili e piccoli esercizi. La chat è del creatore; le domande sulle lezioni si fanno nei commenti.',
    cover: { c1: '#f7971e', c2: '#ffd200' }, categories: ['Lingue', 'Viaggi'],
    pricing: { monthly: 7, currency: 'CHF', trialDays: 0, yearlyDiscountPct: 15 },
    chat: { write: 'creator', chosen: [], slowSec: 0, commentsWhenReadOnly: true },
    courses: [spagnolo],
    posts: [],
    baseline: { followers: 89, free: 41, premium: 12 }, demoStats: { openQuestions: 2, avgCompletionPct: 71 },
  },
];

const cm = (id: string, clubId: string, courseId: string, lessonId: string, author: string, text: string, minsAgo: number, extra: Partial<ClubComment> = {}): ClubComment => ({
  id, clubId, courseId, lessonId, author, text, ts: Date.now() - minsAgo * 60000, isQuestion: false, likes: [], saved: [], ...extra,
});

const L = (c: Course, i: number) => c.lessons[i].id;

export const SEED_COMMENTS: ClubComment[] = [
  cm('sc1', 'club-cucina', 'cu1', L(cucina, 0), 'Giulia M.', 'Il coltello da pane serve anche per i pomodori?', 3100, { anchor: { kind: 'time', sec: 75 }, isQuestion: true, resolved: true }),
  cm('sc2', 'club-cucina', 'cu1', L(cucina, 0), 'Laura Conti', 'Sì, con la lama seghettata i pomodori non si schiacciano. Per il resto basta un coltello da cuoco ben affilato.', 3060, { anchor: { kind: 'time', sec: 75 }, parentId: 'sc1', likes: ['Tommaso V.', 'Giulia M.'] }),
  cm('sc3', 'club-cucina', 'cu1', L(cucina, 0), 'Tommaso V.', 'Quale padella consigli per il piano a induzione?', 1500, { anchor: { kind: 'time', sec: 222 }, isQuestion: true }),
  cm('sc4', 'club-cucina', 'cu1', L(cucina, 0), 'Federica L.', 'Bellissima questa parte sul pesare gli ingredienti.', 900, { anchor: { kind: 'time', sec: 300 }, likes: ['Laura Conti'] }),
  cm('sc5', 'club-corsa', 'co1', L(corsa, 0), 'Giulia M.', 'Con le scarpe vecchie posso iniziare comunque?', 2400, { anchor: { kind: 'time', sec: 140 }, isQuestion: true }),
  cm('sc6', 'club-corsa', 'co1', L(corsa, 0), 'Marco Valli', 'Se hanno meno di 800 km e la suola non è consumata, sì. Altrimenti meglio sostituirle.', 2380, { anchor: { kind: 'time', sec: 140 }, parentId: 'sc5' }),
  cm('sc7', 'club-spagnolo', 'es1', L(spagnolo, 0), 'Federica L.', 'Come si pronuncia la «j» di «jamón»?', 700, { anchor: { kind: 'time', sec: 190 }, isQuestion: true }),
];

/* ---------- LifeClub di esempio di chi usa l'app (solo demo) ---------- */
const orga: Course = {
  id: 'my1', title: 'Organizzare la settimana senza stress', level: 'base', published: true, createdAt: T0,
  description: 'Un metodo semplice per decidere cosa fare, quando farlo e cosa lasciare andare. Pochi minuti al giorno.',
  sections: [sec('my1s1', 'Le basi', 0), sec('my1s2', 'Ogni giorno', 1)],
  lessons: [
    les('my1', 'my1s1', 'Perché le liste lunghe non funzionano', 'video', 'free', { durationSec: 340, preview: true, description: 'Tre domande per capire cosa conta davvero oggi.' }),
    les('my1', 'my1s1', 'Il foglio della settimana', 'pdf', 'free', { pages: 2, text: 'Il foglio della settimana\n\nLunedì: scegli tre cose importanti. Scrivile in alto.\f\nVenerdì: guarda cosa è rimasto. Sposta, delega o cancella: non portarti dietro tutto.' }),
    les('my1', 'my1s2', 'Cinque minuti al mattino', 'video', 'premium', { durationSec: 420, description: 'Come guardare agenda, task e spese prima di uscire di casa.' }),
    les('my1', 'my1s2', 'Gli imprevisti: come lasciare spazio', 'audio', 'premium', { durationSec: 360 }),
    les('my1', 'my1s2', 'Chiudere la giornata', 'testo', 'premium', { text: 'Prima di dormire, due minuti.\n\nCosa ho fatto? Cosa sposto a domani? C\'è qualcosa che mi pesa e che posso scrivere per toglierlo dalla testa?\n\nUna nota breve vale più di un\'ora di buoni propositi.' }),
  ],
};
const denaro: Course = {
  id: 'my2', title: 'Soldi di casa: da dove cominciare', level: 'base', published: true, createdAt: T0 + 86400000,
  description: 'Entrate, spese fisse, scadenze e un piccolo margine. Senza fogli complicati.',
  sections: [sec('my2s1', 'Il quadro', 0)],
  lessons: [
    les('my2', 'my2s1', 'Le tre voci che contano', 'testo', 'free', { text: 'Entrate fisse, spese fisse, tutto il resto.\n\nQuando sai quanto resta dopo le spese fisse, sai quanto puoi davvero spendere. Il resto sono dettagli.' }),
    les('my2', 'my2s1', 'Bollette e scadenze: un calendario solo', 'video', 'premium', { durationSec: 510 }),
  ],
};

export function myDemoClub(owner: string): Club {
  return {
    id: 'club-mio', owner, name: 'Vita organizzata', tagline: 'Piccoli metodi per giornate più leggere',
    description: 'Contenuti pratici su tempo, soldi di casa e abitudini. Nella chat rispondo alle domande, anche sotto i video.',
    cover: { c1: '#8fa4ff', c2: '#5b86e5' }, categories: ['Organizzazione', 'Soldi', 'Abitudini'],
    pricing: { monthly: 6, currency: 'CHF', trialDays: 7, yearlyDiscountPct: 20 },
    chat: { write: 'members', chosen: [], slowSec: 0, commentsWhenReadOnly: true },
    courses: [orga, denaro], published: true, createdAt: T0,
    posts: [
      { id: 'po-my1', text: 'Benvenuti! Questa settimana provate il foglio della settimana e raccontatemi com\'è andata nella chat.', ts: T0 + 86400000, tier: 'free', pinned: true },
      { id: 'po-my2', text: 'Nuova lezione per gli abbonati: cinque minuti al mattino.', ts: T0 + 3 * 86400000, tier: 'premium' },
    ],
    baseline: { followers: 58, free: 24, premium: 7 }, demoStats: { openQuestions: 2, avgCompletionPct: 54 },
  };
}
export function myDemoComments(owner: string): ClubComment[] {
  return [
    cm('mc1', 'club-mio', 'my1', L(orga, 0), 'Giulia M.', 'Tre cose importanti al giorno sono poche o tante?', 600, { anchor: { kind: 'time', sec: 90 }, isQuestion: true }),
    cm('mc2', 'club-mio', 'my1', L(orga, 0), 'Tommaso V.', 'Mi è piaciuta la parte su cosa lasciare andare.', 240, { anchor: { kind: 'time', sec: 210 }, likes: [owner] }),
  ];
}
