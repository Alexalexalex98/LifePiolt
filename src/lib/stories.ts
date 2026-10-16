/**
 * Storie (modulo PURO): foto, video o testo che restano 24 ore. Chi le vede viene segnato; le tue le puoi cancellare quando vuoi.
 * Gli autori si ordinano come nelle altre app: prima le tue, poi quelle non ancora viste (le più recenti per prime), poi le già viste.
 */
export const STORY_MS = 24 * 3600 * 1000;
export const MAX_STORY_TEXT = 140;
export const STORY_SECONDS = 5;
export type StoryKind = 'photo' | 'video' | 'text';
/** Cosa si può allegare a un momento: un impegno del Plan, un seminario, un'idea o un luogo. Chi guarda tocca e ci va. */
export type StoryAttach = { kind: 'event' | 'seminar' | 'idea' | 'place'; label: string; /** giorno (evento), id (seminario, idea) */ ref?: string };
/** Quanto resta: un giorno (standard), una settimana, o fisso nel profilo come «momento». */
export type Keep = 'day' | 'week' | 'moment';
/** Filtri: una velatura di colore sopra la foto o il video. */
export type FilterId = 'none' | 'caldo' | 'freddo' | 'neon' | 'notte' | 'rosa' | 'seppia';
export const FILTERS: { id: FilterId; label: string; tint: string | null }[] = [
  { id: 'none', label: 'Originale', tint: null }, { id: 'caldo', label: 'Caldo', tint: 'rgba(255,150,60,0.28)' }, { id: 'freddo', label: 'Freddo', tint: 'rgba(60,140,255,0.26)' },
  { id: 'neon', label: 'Neon', tint: 'rgba(190,60,255,0.30)' }, { id: 'notte', label: 'Notte', tint: 'rgba(10,15,60,0.45)' }, { id: 'rosa', label: 'Rosa', tint: 'rgba(255,90,160,0.28)' }, { id: 'seppia', label: 'Seppia', tint: 'rgba(150,100,40,0.38)' },
];
export const tintOfFilter = (id?: string): string | null => FILTERS.find((f) => f.id === id)?.tint ?? null;
export type TextPos = 'alto' | 'centro' | 'basso';
export type Story = {
  id: string; author: string; ts: number; kind: StoryKind; keep?: Keep; attach?: StoryAttach; filter?: FilterId; textPos?: TextPos; textColor?: string;
  /** chi ha regalato il LifePoint giornaliero a questo momento (lo vede l'autore) */ gifts?: string[];
  uri?: string; /** fotogramma di anteprima dei video: compare subito */ poster?: string; text?: string; /** colori dello sfondo delle storie di solo testo */ bg?: [string, string];
  /** chi l'ha vista (lo vede solo l'autore) */ views: string[];
};
export const BACKGROUNDS: [string, string][] = [['#6c8cff', '#3b2a7a'], ['#e0866b', '#a4343a'], ['#4fb58a', '#1f5a7a'], ['#c9a24a', '#6a3b12'], ['#141a2b', '#2a1f4a'], ['#d65f8a', '#5a2a7a']];

export const KEEP_MS: Record<Keep, number> = { day: STORY_MS, week: 7 * STORY_MS, moment: Infinity };
export const KEEP_LABEL: Record<Keep, string> = { day: '24 ore', week: '7 giorni', moment: 'Fisso nel profilo' };
export const isActive = (s: Story, now: number) => now - s.ts < KEEP_MS[s.keep ?? 'day'] && now >= s.ts - 60000;
export const activeStories = (all: Story[] | undefined, now: number): Story[] => (all ?? []).filter((s) => isActive(s, now));
/** Toglie le scadute (da fare ogni tanto, così lo store non cresce). */
export const purgeStories = (all: Story[] | undefined, now: number): Story[] => activeStories(all, now);

export type StoryGroup = { author: string; stories: Story[]; unseen: number; latest: number; mine: boolean };
/**
 * Raggruppa per autore. `visible` decide di chi si vedono le storie (le tue sempre). `seen` = id delle storie che ho già visto.
 */
export function storyGroups(all: Story[] | undefined, me: string, visible: (author: string) => boolean, seen: string[], now: number): StoryGroup[] {
  const by = new Map<string, Story[]>();
  for (const s of activeStories(all, now)) {
    if (s.author !== me && !visible(s.author)) continue;
    by.set(s.author, [...(by.get(s.author) ?? []), s]);
  }
  const seenSet = new Set(seen);
  const groups: StoryGroup[] = [...by].map(([author, list]) => {
    const stories = list.slice().sort((a, b) => a.ts - b.ts);
    return { author, stories, unseen: author === me ? 0 : stories.filter((s) => !seenSet.has(s.id)).length, latest: stories[stories.length - 1].ts, mine: author === me };
  });
  return groups.sort((a, b) => (a.mine ? -1 : b.mine ? 1 : (b.unseen > 0 ? 1 : 0) - (a.unseen > 0 ? 1 : 0) || b.latest - a.latest));
}
/** Da quale storia partire: la prima non vista, altrimenti la prima. */
export function startIndex(g: StoryGroup, seen: string[]): number {
  const s = new Set(seen);
  const i = g.stories.findIndex((x) => !s.has(x.id));
  return i < 0 ? 0 : i;
}
/** Registra che `viewer` ha visto la storia (una volta sola; l'autore non conta). */
export function addView(all: Story[], id: string, viewer: string): Story[] {
  return all.map((s) => (s.id === id && s.author !== viewer && !s.views.includes(viewer) ? { ...s, views: [...s.views, viewer] } : s));
}
export function ago(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}
/** Una storia nuova con i controlli sul contenuto: testo non vuoto (max 140) o un file. */
export function makeStory(a: { id: string; author: string; now: number; kind: StoryKind; uri?: string; text?: string; bg?: [string, string]; keep?: Keep; attach?: StoryAttach; filter?: FilterId; textPos?: TextPos; textColor?: string }): Story | null {
  const text = (a.text ?? '').trim().slice(0, MAX_STORY_TEXT);
  if (a.kind === 'text' ? !text : !a.uri) return null;
  const label = a.attach?.label.trim().slice(0, 60);
  return { id: a.id, author: a.author, ts: a.now, kind: a.kind, ...(a.filter && a.filter !== 'none' ? { filter: a.filter } : {}), ...(a.textPos && a.textPos !== 'basso' ? { textPos: a.textPos } : {}), ...(a.textColor && /^#[0-9a-f]{6}$/i.test(a.textColor) && a.textColor.toLowerCase() !== '#ffffff' ? { textColor: a.textColor } : {}), ...(a.keep && a.keep !== 'day' ? { keep: a.keep } : {}), ...(a.attach && label ? { attach: { ...a.attach, label } } : {}), ...(a.uri ? { uri: a.uri } : {}), ...(text ? { text } : {}), ...(a.kind === 'text' ? { bg: a.bg ?? BACKGROUNDS[0] } : {}), views: [] };
}

/* ---------- la giornata: momenti raggruppati per parte del giorno ---------- */
export type Part = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';
export const PART_ORDER: Part[] = ['Mattina', 'Pomeriggio', 'Sera', 'Notte'];
export function partOf(ts: number): Part {
  const h = new Date(ts).getHours();
  return h >= 5 && h < 12 ? 'Mattina' : h >= 12 && h < 18 ? 'Pomeriggio' : h >= 18 && h < 23 ? 'Sera' : 'Notte';
}
export const timeLabel = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** I momenti di una persona, dal più vecchio al più recente, divisi per parte del giorno (le parti vuote non ci sono). I «fissi» vanno a parte. */
export function dayParts(stories: Story[]): { part: Part; stories: Story[] }[] {
  const flow = stories.filter((s) => s.keep !== 'moment').sort((a, b) => a.ts - b.ts);
  return PART_ORDER.map((part) => ({ part, stories: flow.filter((s) => partOf(s.ts) === part) })).filter((x) => x.stories.length);
}
export const fixedMoments = (stories: Story[]) => stories.filter((s) => s.keep === 'moment').sort((a, b) => b.ts - a.ts);
/** Regalo del LifePoint giornaliero a un momento (una volta per persona, non a se stessi). */
export function addGift(all: Story[], id: string, from: string): Story[] {
  return all.map((s) => (s.id === id && s.author !== from && !(s.gifts ?? []).includes(from) ? { ...s, gifts: [...(s.gifts ?? []), from] } : s));
}
