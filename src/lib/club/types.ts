/**
 * Modello dati dei LifeClub (puro: nessun alias '@/', nessun import dall'app).
 * Oggi tutto vive sul telefono (anteprima); il contratto con il server e' in docs/lifeclub.md.
 */

export type Tier = 'free' | 'premium';
export type LessonKind = 'video' | 'audio' | 'pdf' | 'testo' | 'file' | 'link';
export type Level = 'base' | 'intermedio' | 'avanzato';

export type Section = { id: string; title: string; order: number };

export type Lesson = {
  id: string;
  title: string;
  kind: LessonKind;
  sectionId: string;
  order: number;
  /** free = per chiunque sia iscritto (o segua) il club; premium = solo abbonati */
  tier: Tier;
  /** anteprima gratuita: visibile anche a chi non e' abbonato, pur essendo in un corso premium */
  preview: boolean;
  /** file salvato nella memoria dell'app (nessun upload) */
  uri?: string;
  fileName?: string;
  size?: number;
  mime?: string;
  durationSec?: number;
  pages?: number;
  /** testo della lezione (kind 'testo') o descrizione */
  text?: string;
  url?: string;
  description?: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  level: Level;
  sections: Section[];
  lessons: Lesson[];
  published: boolean;
  createdAt: number;
};

export type ClubPost = { id: string; text: string; ts: number; tier: Tier; pinned?: boolean };

/** Chi puo' scrivere nella chat del club. */
export type ChatWrite = 'creator' | 'members' | 'premium' | 'chosen' | 'none';
export type ChatConfig = {
  write: ChatWrite;
  /** persone scelte (solo con write = 'chosen') */
  chosen: string[];
  /** modalita' lenta: secondi minimi tra due messaggi della stessa persona (0 = spenta) */
  slowSec: number;
  /** se la chat e' in sola lettura per qualcuno: puo' comunque fare domande nei commenti delle lezioni */
  commentsWhenReadOnly: boolean;
};

export type Pricing = {
  /** quota mensile (0 = nessuna sezione a pagamento) */
  monthly: number;
  currency: string;
  /** giorni di prova gratuita (0 = nessuna) */
  trialDays: number;
  /** sconto % sul piano annuale (0 = nessun piano annuale) */
  yearlyDiscountPct: number;
};

export type Cover = { c1: string; c2: string; uri?: string };

export type Club = {
  id: string;
  owner: string;
  name: string;
  tagline: string;
  description: string;
  cover: Cover;
  categories: string[];
  createdAt: number;
  published: boolean;
  pricing: Pricing;
  chat: ChatConfig;
  courses: Course[];
  posts: ClubPost[];
  /** solo club di esempio: persone gia' iscritte nell'anteprima (non sono utenti reali) */
  baseline?: { followers: number; free: number; premium: number };
  /** solo club di esempio: domande aperte e completamento medio dimostrativi */
  demoStats?: { openQuestions: number; avgCompletionPct: number };
};

export type MemberTier = 'follower' | 'free' | 'premium';
export type MemberStatus = 'attiva' | 'in_pausa' | 'annullata';
export type BillingPlan = 'mensile' | 'annuale';

export type Membership = {
  id: string;
  user: string;
  clubId: string;
  tier: MemberTier;
  since: number;
  status: MemberStatus;
  /** il premium si rinnova da solo finche' non viene annullato */
  renews: boolean;
  plan?: BillingPlan;
  /** prossimo addebito (demo: nessun addebito reale) */
  nextChargeAt?: number;
  /** fine del periodo gia' pagato (annullamento premium: l'accesso dura fino a qui) */
  endsAt?: number;
  trialEndsAt?: number;
  /** silenziato dal creatore */
  mutedByOwner?: boolean;
  /** notifiche silenziate da me */
  mutedUntil?: number;
  /** storico: ha mai avuto un'iscrizione (serve per poter votare) */
  everJoined?: boolean;
};

/** Ancora di un commento: minuto del video/audio, pagina del PDF, paragrafo del testo. */
export type Anchor = { kind: 'time'; sec: number } | { kind: 'page'; page: number } | { kind: 'para'; para: number };

export type ClubComment = {
  id: string;
  clubId: string;
  courseId: string;
  lessonId: string;
  author: string;
  text: string;
  ts: number;
  anchor?: Anchor;
  parentId?: string;
  isQuestion: boolean;
  resolved?: boolean;
  /** id del messaggio gemello nella chat del club */
  chatMsgId?: string;
  likes: string[];
  saved: string[];
};

export type AnswerVote = {
  id: string;
  clubId: string;
  /** id della risposta votata (commento o messaggio di chat) */
  answerId: string;
  /** id della domanda a cui risponde */
  questionId: string;
  /** autore della domanda */
  asker: string;
  /** chi ha dato il voto (l'autore della domanda o un altro iscritto) */
  voter: string;
  answerer: string;
  /** 1-5 (il pollice su/giu' vale 5/1) */
  stars: number;
  note?: string;
  ts: number;
};

export type LessonProgress = { done?: boolean; posSec?: number; page?: number; ts: number };
