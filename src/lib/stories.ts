/**
 * Storie (modulo PURO): foto, video o testo che restano 24 ore. Chi le vede viene segnato; le tue le puoi cancellare quando vuoi.
 * Gli autori si ordinano come nelle altre app: prima le tue, poi quelle non ancora viste (le più recenti per prime), poi le già viste.
 */
export const STORY_MS = 24 * 3600 * 1000;
export const MAX_STORY_TEXT = 140;
export const STORY_SECONDS = 5;
export type StoryKind = 'photo' | 'video' | 'text';
export type Story = {
  id: string; author: string; ts: number; kind: StoryKind;
  uri?: string; text?: string; /** colori dello sfondo delle storie di solo testo */ bg?: [string, string];
  /** chi l'ha vista (lo vede solo l'autore) */ views: string[];
};
export const BACKGROUNDS: [string, string][] = [['#6c8cff', '#3b2a7a'], ['#e0866b', '#a4343a'], ['#4fb58a', '#1f5a7a'], ['#c9a24a', '#6a3b12'], ['#141a2b', '#2a1f4a'], ['#d65f8a', '#5a2a7a']];

export const isActive = (s: Story, now: number) => now - s.ts < STORY_MS && now >= s.ts - 60000;
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
export function makeStory(a: { id: string; author: string; now: number; kind: StoryKind; uri?: string; text?: string; bg?: [string, string] }): Story | null {
  const text = (a.text ?? '').trim().slice(0, MAX_STORY_TEXT);
  if (a.kind === 'text' ? !text : !a.uri) return null;
  return { id: a.id, author: a.author, ts: a.now, kind: a.kind, ...(a.uri ? { uri: a.uri } : {}), ...(text ? { text } : {}), ...(a.kind === 'text' ? { bg: a.bg ?? BACKGROUNDS[0] } : {}), views: [] };
}
