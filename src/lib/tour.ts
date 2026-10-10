/**
 * Percorso a sblocco graduale + tour guidato. LOGICA PURA (nessun import da '@/'): testabile con node.
 * Il testo sorgente è italiano; l'interfaccia lo traduce quando lo disegna dentro <Text>/Btn.
 */

export type TourMode = 'guided' | 'demo' | 'open';
export const MAX_LEVEL = 7;
export const WELCOME_ID = 'welcome';

/** Segnali d'uso (conteggi dai dati dell'utente): servono a capire se ha "usato" l'area precedente. */
export type SignalKey = 'mood' | 'events' | 'tasks' | 'notes' | 'health' | 'finance' | 'trips' | 'drive' | 'network';
export type Signals = Partial<Record<SignalKey, number>>;

export type LevelDef = {
  level: number;
  id: string;
  title: string;
  /** frase breve per i menu e i riepiloghi */
  short: string;
  /** pagine (rotte) che questo livello apre */
  pages: string[];
  /** l'area precedente è "usata" se uno di questi segnali è cresciuto da quando è stata sbloccata */
  prevUsed: SignalKey[];
  /** oppure passano tanti giorni dallo sblocco del livello precedente */
  days: number;
  /** pagina da proporre nel mini-tour "Nuovo: ..." */
  openPage: string;
  intro: string;
  how: string;
};

export const LEVELS: LevelDef[] = [
  { level: 1, id: 'oggi', title: 'Oggi, Piano e Theia', short: 'Umore, giornata, impegni e assistente', pages: ['home', 'index', 'mood', 'plan', 'ai'], prevUsed: [], days: 0, openPage: 'home', intro: '', how: '' },
  {
    level: 2, id: 'task', title: 'Task, Obiettivi e Note', short: 'Cose da fare, traguardi e appunti', pages: ['lifetask', 'lifenotes'], prevUsed: ['mood', 'events'], days: 1, openPage: 'lifetask',
    intro: 'Ora che conosci la giornata, puoi tenere traccia di ciò che devi fare e di ciò che vuoi ottenere.',
    how: 'Scrivi un task, segnalo urgente se serve: ti dirò quale fare per primo. Le note raccolgono appunti veloci.',
  },
  {
    level: 3, id: 'salute', title: 'Salute e Mente', short: 'Sonno, movimento, stress e umore nel tempo', pages: ['lifehealth'], prevUsed: ['tasks', 'notes'], days: 2, openPage: 'lifehealth',
    intro: 'Sonno, passi, battito e stress: li registri a mano o li colleghi ad Apple Health. Restano sempre sul tuo telefono.',
    how: 'Comincia con un solo dato, per esempio le ore di sonno di stanotte. Più giorni registri, più i grafici diventano utili.',
  },
  {
    level: 4, id: 'finanze', title: 'Finanze', short: 'Movimenti, budget e previsioni', pages: ['lifefinance', 'lifeforecast', 'taxdecl', 'stocks', 'portfolio'], prevUsed: ['health'], days: 3, openPage: 'lifefinance',
    intro: 'Entrate, uscite e budget in un posto solo, con avvisi quando una categoria sfora.',
    how: 'Aggiungi un movimento oppure importa l\'estratto conto da CSV. Previsioni e tasse arrivano dopo.',
  },
  {
    level: 5, id: 'viaggi', title: 'Viaggi e Drive', short: 'Vacanze, itinerari, documenti e ricevute', pages: ['lifetravel', 'lifedrive'], prevUsed: ['finance'], days: 4, openPage: 'lifetravel',
    intro: 'Pianifica una vacanza sui giorni liberi del tuo Piano e tieni documenti e ricevute in cartelle ordinate.',
    how: 'Scegli una destinazione: ti propongo un itinerario. In LifeDrive carichi un file e lo metto nella cartella giusta.',
  },
  {
    level: 6, id: 'network', title: 'LifeNetwork', short: 'Community, seminari, servizi e lavoro', pages: ['lifenetwork', 'lifepointsPage', 'communityProfile', 'ideaProfile', 'seminarPage', 'servicePage', 'postPage', 'jobDetail', 'jobEdit', 'jobTest', 'applicantView', 'skillProfile', 'businessCard'], prevUsed: ['trips', 'drive'], days: 5, openPage: 'lifenetwork',
    intro: 'La parte sociale di LifePilot: community, seminari, servizi e lavoro. Qui altre persone possono vedere ciò che pubblichi.',
    how: 'Tu decidi cosa condividere: il profilo può essere privato e l\'agenda mostra solo ciò che scegli. Puoi guardare senza pubblicare nulla.',
  },
  {
    level: 7, id: 'analisi', title: 'Analisi e automazioni', short: 'Report, correlazioni e regole automatiche', pages: ['reports'], prevUsed: ['network'], days: 6, openPage: 'reports',
    intro: 'Dashboard avanzata con trend, previsioni e correlazioni, report settimanale in PDF e automazioni che lavorano al posto tuo.',
    how: 'Dalla Home apri il Life Score e tocca un indicatore per vedere spiegazioni e valori ottimali. Le automazioni si controllano dal Profilo.',
  },
];

const PAGE_LEVEL: Record<string, number> = {};
LEVELS.forEach((l) => l.pages.forEach((p) => { PAGE_LEVEL[p] = l.level; }));

/** Livello necessario per una pagina; 0 = sempre aperta (profilo, impostazioni, messaggi, notifiche, ricerca, privacy...). */
export function pageLevel(page: string | null | undefined): number {
  if (!page) return 0;
  const p = page.replace(/^\//, '').split('?')[0];
  if (p === '') return 1;
  return PAGE_LEVEL[p] ?? 0;
}

export const levelDef = (level: number): LevelDef | undefined => LEVELS.find((l) => l.level === level);

/** Livello delle aree della guida "Tutte le funzioni". */
export const GROUP_LEVEL: Record<string, number> = { oggi: 1, piano: 1, assistente: 1, salute: 3, finanze: 4, network: 6, chat: 6, vita: 2, controllo: 0 };

export type TourState = {
  mode: TourMode | null;
  /** massimo livello sbloccato */
  level: number;
  allUnlocked: boolean;
  unlockedAt: Record<string, number>;
  /** conteggi dei segnali quando è stato sbloccato l'ultimo livello */
  baseline: Signals;
  seen: string[];
  startedAt: number | null;
  /** mini-tour in attesa di essere mostrato */
  pending: string | null;
};

export const emptyTourState = (): TourState => ({ mode: null, level: MAX_LEVEL, allUnlocked: true, unlockedAt: {}, baseline: {}, seen: [], startedAt: null, pending: null });

/** Chi è l'utente: nuovo (tour completo), con dati demo (stesso tour, tutto sbloccabile con un tocco), installazione esistente (tutto aperto). */
export function decideMode(p: { firstSeenAt: number | null; demo: boolean }): TourMode {
  if (p.firstSeenAt != null) return 'open';
  return p.demo ? 'demo' : 'guided';
}

export function initialState(mode: TourMode, now: number, signals: Signals = {}): TourState {
  if (mode === 'open') return { mode, level: MAX_LEVEL, allUnlocked: true, unlockedAt: {}, baseline: { ...signals }, seen: [WELCOME_ID], startedAt: now, pending: null };
  return { mode, level: 1, allUnlocked: false, unlockedAt: { 1: now }, baseline: { ...signals }, seen: [], startedAt: now, pending: null };
}

/** Una pagina è aperta se il percorso non è ancora deciso, se tutto è sbloccato o se il suo livello è raggiunto. */
export function isUnlocked(s: Pick<TourState, 'mode' | 'level' | 'allUnlocked'>, page: string | null | undefined): boolean {
  if (s.mode == null || s.mode === 'open' || s.allUnlocked) return true;
  return pageLevel(page) <= s.level;
}

export const isLevelUnlocked = (s: Pick<TourState, 'mode' | 'level' | 'allUnlocked'>, level: number): boolean => s.mode == null || s.mode === 'open' || s.allUnlocked || level <= s.level;

const DAY = 86400000;
/** Numero progressivo del giorno di calendario locale. */
export function dayNo(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** Prossimo livello da sbloccare, e perché: usata l'area precedente oppure passati abbastanza giorni. Mai più di uno alla volta. */
export function nextUnlock(s: TourState, signals: Signals, now: number): { level: number; reason: 'used' | 'days' } | null {
  if (s.mode == null || s.mode === 'open' || s.allUnlocked || s.level >= MAX_LEVEL) return null;
  if (!s.seen.includes(WELCOME_ID)) return null; // prima il benvenuto
  const def = levelDef(s.level + 1);
  if (!def) return null;
  const since = s.unlockedAt[String(s.level)] ?? s.startedAt ?? now;
  if (def.prevUsed.some((k) => (signals[k] ?? 0) > (s.baseline[k] ?? 0))) return { level: def.level, reason: 'used' };
  if (dayNo(now) - dayNo(since) >= def.days) return { level: def.level, reason: 'days' };
  return null;
}

/** Sblocca un livello e prepara il suo mini-tour "Nuovo: ...". */
export function applyUnlock(s: TourState, level: number, signals: Signals, now: number): TourState {
  if (level <= s.level || s.mode === 'open') return s;
  const unlockedAt = { ...s.unlockedAt, [String(level)]: now };
  const id = tourIdForLevel(level);
  return { ...s, level, allUnlocked: level >= MAX_LEVEL, unlockedAt, baseline: { ...signals }, pending: s.seen.includes(id) ? s.pending : id };
}

/** "Sblocca ora" su una pagina: apre tutti i livelli fino a quello richiesto (nessuna attesa), senza riempire di mini-tour. */
export function unlockUpTo(s: TourState, level: number, signals: Signals, now: number): TourState {
  if (level <= s.level || s.mode === 'open') return s;
  const unlockedAt = { ...s.unlockedAt };
  for (let l = s.level + 1; l <= level; l++) unlockedAt[String(l)] = now;
  return { ...s, level, allUnlocked: level >= MAX_LEVEL, unlockedAt, baseline: { ...signals }, pending: null };
}

export function unlockAll(s: TourState, now: number): TourState {
  const unlockedAt = { ...s.unlockedAt };
  for (let l = 1; l <= MAX_LEVEL; l++) if (unlockedAt[String(l)] == null) unlockedAt[String(l)] = now;
  return { ...s, level: MAX_LEVEL, allUnlocked: true, unlockedAt, pending: null };
}

export const tourIdForLevel = (level: number) => `lvl-${level}`;
export const levelOfTour = (id: string): number => (id.startsWith('lvl-') ? Number(id.slice(4)) || 0 : id === WELCOME_ID ? 1 : 0);

export function markSeen(s: TourState, id: string): TourState {
  return { ...s, seen: s.seen.includes(id) ? s.seen : [...s.seen, id], pending: s.pending === id ? null : s.pending };
}

/** Il prossimo tour da mostrare adesso (null = niente): prima il benvenuto, poi l'eventuale "Nuovo: ...". Gli esistenti non vedono nulla. */
export function nextTour(s: TourState): string | null {
  if (s.mode == null || s.mode === 'open') return null;
  if (!s.seen.includes(WELCOME_ID)) return WELCOME_ID;
  if (s.pending && !s.seen.includes(s.pending)) return s.pending;
  return null;
}

/** Quante aree restano da scoprire. */
export const remainingLevels = (s: Pick<TourState, 'mode' | 'level' | 'allUnlocked'>): number => (s.mode == null || s.mode === 'open' || s.allUnlocked ? 0 : MAX_LEVEL - s.level);

/** Livello della prossima area, con il suo nome, per la Home ("Prossima area: ..."). */
export function upcoming(s: Pick<TourState, 'mode' | 'level' | 'allUnlocked'>): LevelDef | null {
  if (remainingLevels(s) === 0) return null;
  return levelDef(s.level + 1) ?? null;
}

/** Cosa mostra la Home in base al livello: più blocchi per chi è avanti. */
export function homeLayout(s: Pick<TourState, 'mode' | 'level' | 'allUnlocked'>): { showScore: boolean; showInsights: boolean; moreOpen: boolean } {
  const level = s.mode == null || s.mode === 'open' || s.allUnlocked ? MAX_LEVEL : s.level;
  return { showScore: level >= 3, showInsights: level >= 5, moreOpen: level >= MAX_LEVEL };
}

/* ---------- contenuto dei tour ---------- */
export type TourStep = {
  id: string;
  /** id del bersaglio da evidenziare; se manca o non è montato, il callout è centrato */
  target?: string;
  title: string;
  text: string;
  /** esempi / elenco breve */
  bullets?: string[];
  /** azione facoltativa nell'ultimo passo: apre una pagina */
  cta?: { label: string; page: string };
  /** nel tour demo, offre di sbloccare tutto */
  offerUnlockAll?: boolean;
};

export function welcomeSteps(mode: TourMode | null): TourStep[] {
  return [
    { id: 'hello', title: 'Benvenuto, {0}', text: 'Ti mostro solo 3 cose, con calma. Tutto il resto dell\'app arriva piano piano, quando sei pronto.' },
    { id: 'mood', target: 'home.mood', title: 'Come ti senti oggi', text: 'Un tocco al giorno: LifePilot lo confronta con meteo, sonno, impegni e spese per capire cosa ti fa stare meglio.' },
    { id: 'today', target: 'home.next', title: 'La tua giornata', text: 'Qui vedi il prossimo impegno di oggi. Se non hai ancora nulla in programma, lo aggiungi da qui.' },
    {
      id: 'plan', target: 'nav.plan', title: 'Il Piano', text: 'È la tua agenda. Per aggiungere un impegno apri il Piano, tocca un giorno e scegli titolo e ora.',
      bullets: ['Oppure scrivi a Theia: "aggiungi dentista giovedì alle 10"', 'Se due impegni si scontrano, ti avviso'],
    },
    {
      id: 'theia', target: 'nav.ai', title: 'Theia, il tuo assistente', text: 'Scrivi come parleresti a una persona. Per esempio:',
      bullets: ['"cosa devo fare adesso?"', '"aggiungi riunione al piano domani alle 15"', '"riepilogo della giornata"'],
    },
    {
      id: 'later', title: 'Il resto arriva dopo', text: 'Finanze, Salute, Viaggi, Network e Analisi sono in pausa: li vedi attenuati con un lucchetto. Si aprono da soli uno alla volta, man mano che prendi confidenza.',
      bullets: ['Puoi sbloccare tutto quando vuoi, con un tocco', 'Il tour si rifà da Home, in "Altro"'],
      offerUnlockAll: mode === 'demo',
    },
  ];
}

export function levelSteps(level: number): TourStep[] {
  const d = levelDef(level);
  if (!d || level < 2) return [];
  return [
    { id: 'new', target: `nav.${d.openPage}`, title: `Nuovo: ${d.title}`, text: d.intro },
    { id: 'how', title: 'Per iniziare', text: d.how, cta: { label: `Apri ${d.title}`, page: d.openPage } },
  ];
}

export function tourSteps(id: string, mode: TourMode | null = null): TourStep[] {
  if (id === WELCOME_ID) return welcomeSteps(mode);
  if (id.startsWith('lvl-')) return levelSteps(Number(id.slice(4)));
  return [];
}

/** Funzioni che l'utente può già usare (per "funzione del giorno" e "Tutte le funzioni"). */
export const featureLevel = (groupId: string, page?: string): number => Math.max(GROUP_LEVEL[groupId] ?? 0, pageLevel(page));

/** Pagina corrispondente a un percorso web/router (per il blocco): "/lifefinance?x=1" -> "lifefinance". */
export const pageFromPath = (path: string): string => {
  const p = path.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  return p === '' || p === 'index' ? 'home' : p;
};
