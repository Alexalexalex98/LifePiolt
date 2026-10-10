import { rx } from './build.ts';
import { cutSpans, fold, toSrcRange, type Folded } from './fold.ts';
import type { Concept, LexData, Mood, Page } from './types.ts';
import { whenEn, type WhenOut } from './when.ts';

export type Span = [number, number];
export type Ctx = {
  lex: LexData;
  fd: Folded;
  f: string;                       // testo piatto con data/ora/virgolette già tolti
  h: Partial<Record<Concept, Span>>;
  page?: Page; mood?: Mood;
  w: WhenOut;
  quoted?: string;
  person?: string;
  rn?: { old: string; neu: string };
  /** tutti gli intervalli riconosciuti (date/ora e concetti) */
  all: Span[];
  words: number;                    // parole non spiegate rimaste
};

const ANCHORED: Concept[] = ['undo', 'yes', 'no', 'choose', 'apply', 'keepboth', 'hello', 'thanks'];
const PAGE_EN: Record<Page, string> = {
  home: 'home', plan: 'plan', tasks: 'tasks', notes: 'notes', drive: 'drive', health: 'health', finance: 'finance', travel: 'travel', network: 'network',
  profile: 'profile', settings: 'settings', mood: 'mood', messages: 'messages', notifications: 'notifications', stocks: 'stocks', portfolio: 'portfolio',
  taxes: 'taxes', forecast: 'forecast', chat: 'chat',
};
const MOOD_EN: Record<Mood, string> = { happy: 'happy', calm: 'calm', neutral: 'neutral', stressed: 'stressed', sad: 'sad', tired: 'tired', angry: 'angry' };

export function hitsOf(lex: LexData, f: string): { h: Partial<Record<Concept, Span>>; page?: Page; mood?: Mood; personSpan?: Span } {
  const h: Partial<Record<Concept, Span>> = {};
  const ft = f.replace(/[\s.!?¿¡,،؟。！？、，]+/g, ' ').trim();
  for (const [k, src] of Object.entries(lex.c) as [Concept, string][]) {
    if (!src) continue;
    if (ANCHORED.includes(k)) { if (rx(lex, src).test(ft)) h[k] = [0, 0]; continue; }
    const m = rx(lex, src).exec(f);
    if (m && m[0].length) h[k] = [m.index, m.index + m[0].length];
  }
  let page: Page | undefined;
  if (lex.pages) {
    let best = -1;
    for (const [k, src] of Object.entries(lex.pages) as [Page, string][]) {
      const m = src ? rx(lex, src).exec(f) : null;
      if (m && m[0].length > best) { best = m[0].length; page = k; (h as Record<string, Span>)['page:' + k] = [m.index, m.index + m[0].length]; }
    }
  }
  let mood: Mood | undefined;
  for (const [k, src] of Object.entries(lex.moods) as [Mood, string][]) {
    const m = src ? rx(lex, src).exec(f) : null;
    if (m) { mood = k; (h as Record<string, Span>)['mood:' + k] = [m.index, m.index + m[0].length]; break; }
  }
  let personSpan: Span | undefined;
  if (lex.withP) {
    const m = rx(lex, lex.withP).exec(f);
    if (m?.groups?.p) { const a = m.index + m[0].lastIndexOf(m.groups.p); personSpan = [a, a + m.groups.p.length]; }
  }
  return { h, page, mood, personSpan };
}

const EDGE_PUNCT = /^[\s,.;:!?¿¡،؛؟。、，！？\-–—]+|[\s,.;:!?¿¡،؛؟。、，！？\-–—]+$/gu;

/** Ritaglia dal testo ORIGINALE [a,b) del piatto togliendo `cut` e le parole funzionali ai bordi. */
export function titleOf(c: Pick<Ctx, 'lex' | 'fd'>, cut: Span[], a = 0, b?: number): string {
  const { lex, fd } = c;
  const end = b ?? fd.f.length;
  const relevant = cut.filter(([x, y]) => y > a && x < end);
  const rest = cutSpans(fd, relevant);
  const [sa, sb] = toSrcRange(fd.map, a, end);
  let s = rest.slice(sa, sb);
  if (lex.edge) {
    for (let guard = 0; guard < 8; guard++) {
      const before = s;
      s = s.replace(EDGE_PUNCT, '');
      const f2 = fold(s, lex.script);
      const reL = rx(lex, `^(?:${lex.edge})`);
      const reR = rx(lex, `(?:${lex.edge})$`);
      const mL = reL.exec(f2.f);
      if (mL && mL[0].length) { const [, y] = toSrcRange(f2.map, 0, mL[0].length); s = f2.src.slice(y); continue; }
      const mR = reR.exec(f2.f);
      if (mR && mR[0].length) { const [x] = toSrcRange(f2.map, mR.index, mR.index + mR[0].length); s = f2.src.slice(0, x); continue; }
      if (s === before) break;
    }
  }
  s = s.replace(EDGE_PUNCT, '').replace(/\s+/g, ' ').trim();
  if (lex.spaced === false) s = s.replace(/\s+/g, '');
  return s;
}

const cap = (s: string, lex: LexData) => (lex.script === 'latin' || lex.script === 'cyrillic' ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

type Rule = {
  intent: string; w: number;
  ok: (c: Ctx) => boolean;
  /** concetti da togliere dal titolo */
  strip: Concept[];
  build: (c: Ctx, title: string) => string | null;
  needsTitle?: boolean;
  weak?: boolean;
  /** può contenere testo libero (non conta come parole non spiegate) */
  free?: boolean;
};

/** titolo tra virgolette: l'assistente lo usa identico */
const qt = (t: string) => (t ? `"${t.replace(/"/g, '')}"` : t);
const has = (c: Ctx, ...ks: Concept[]) => ks.every((k) => !!c.h[k]);
const any = (c: Ctx, ...ks: Concept[]) => ks.some((k) => !!c.h[k]);
const at = (c: Ctx) => whenEn(c.w);
const sp = (...p: (string | undefined)[]) => p.filter((x) => x && x.trim()).join(' ');

export const RULES: Rule[] = [
  { intent: 'undo', w: 10, ok: (c) => has(c, 'undo'), strip: [], build: () => 'undo' },
  { intent: 'yes', w: 10, ok: (c) => has(c, 'yes') && !any(c, 'no'), strip: [], build: () => 'yes' },
  { intent: 'no', w: 10, ok: (c) => has(c, 'no'), strip: [], build: () => 'no' },
  { intent: 'choose', w: 10, ok: (c) => has(c, 'choose'), strip: [], build: () => 'you choose' },
  { intent: 'apply', w: 10, ok: (c) => has(c, 'apply'), strip: [], build: () => 'apply' },
  { intent: 'keepboth', w: 10, ok: (c) => has(c, 'keepboth'), strip: [], build: () => 'keep both' },
  { intent: 'hello', w: 8, ok: (c) => has(c, 'hello'), strip: [], build: () => 'hello' },
  { intent: 'thanks', w: 8, ok: (c) => has(c, 'thanks'), strip: [], build: () => 'thanks' },
  { intent: 'open', w: 7, ok: (c) => !!c.page && any(c, 'open') && !any(c, 'add', 'del'), strip: [], build: (c) => `open ${PAGE_EN[c.page!]}` },
  { intent: 'resched', w: 7, ok: (c) => has(c, 'resched'), strip: [], build: () => 'reschedule my skipped sessions' },
  { intent: 'event.recurring', w: 7, ok: (c) => !!c.w.recur && !any(c, 'del', 'show', 'done', 'task'), strip: ['add', 'cal', 'plan'], needsTitle: true, free: true, build: (c, t) => sp(c.w.recur, c.w.start ? (c.w.start === 'midnight' ? 'at midnight' : `at ${c.w.start}`) : '', c.w.dur ? `for ${c.w.dur}` : '', qt(t)) },
  { intent: 'profile.photo', w: 6, ok: (c) => has(c, 'profile', 'photo'), strip: [], build: () => 'change my profile photo' },
  { intent: 'profile.private', w: 6, ok: (c) => has(c, 'profile', 'priv'), strip: [], build: () => 'make my profile private' },
  { intent: 'profile.public', w: 6, ok: (c) => has(c, 'profile', 'pub'), strip: [], build: () => 'make my profile public' },
  { intent: 'briefing', w: 6, ok: (c) => has(c, 'briefing'), strip: [], build: () => 'daily summary' },
  { intent: 'plan.fill', w: 6, ok: (c) => has(c, 'plan') && any(c, 'month', 'week', 'dayN') && !any(c, 'task', 'del'), strip: [], build: (c) => `plan my ${c.h.month ? 'month' : c.h.week ? 'week' : 'day'}` },
  { intent: 'task.next', w: 5, ok: (c) => has(c, 'nowQ'), strip: [], build: () => 'what should I do now?' },
  { intent: 'task.urgent', w: 5, ok: (c) => has(c, 'urgent') && !any(c, 'add', 'del'), strip: ['urgent', 'mark', 'task'], needsTitle: true, free: true, build: (_c, t) => `mark ${qt(t)} as urgent` },
  { intent: 'event.important', w: 5, ok: (c) => has(c, 'important') && any(c, 'mark', 'add') && !any(c, 'task'), strip: ['important', 'mark', 'event'], needsTitle: true, free: true, build: (_c, t) => `mark ${qt(t)} as important` },
  { intent: 'finance.spent', w: 5, ok: (c) => has(c, 'spent'), strip: [], build: () => 'how much did I spend' },
  { intent: 'health.sleep', w: 5, ok: (c) => has(c, 'sleepQ'), strip: [], build: () => 'how did I sleep' },
  { intent: 'mood.analysis', w: 4.5, ok: (c) => has(c, 'mood') && any(c, 'show') && !c.mood, strip: [], build: () => 'how is my mood lately' },
  { intent: 'mood.log', w: 4, ok: (c) => !!c.mood && (any(c, 'feel') || c.words <= 1), strip: [], weak: false, build: (c) => `I feel ${MOOD_EN[c.mood!]}` },
  { intent: 'mood.analysis', w: 4, ok: (c) => has(c, 'mood') && !c.mood, strip: [], weak: true, build: () => 'how is my mood lately' },
  { intent: 'finance.report', w: 4, ok: (c) => has(c, 'finance') && !any(c, 'open', 'add', 'del'), strip: [], build: () => 'how are my finances' },
  { intent: 'health.report', w: 4, ok: (c) => has(c, 'health') && !any(c, 'open', 'add', 'del', 'task', 'event'), strip: [], build: () => 'health summary' },
  { intent: 'agenda.share', w: 4, ok: (c) => has(c, 'share') && any(c, 'cal', 'free'), strip: [], build: (c) => sp('share my agenda', c.person ? `with ${c.person}` : '', c.w.day === 'today' || c.w.day === 'tomorrow' ? c.w.day : '') },
  { intent: 'agenda.free', w: 4, ok: (c) => has(c, 'free') && !any(c, 'add', 'del', 'share'), strip: [], build: (c) => sp('when am I free', at(c)) + '?' },
  { intent: 'event.move', w: 4, ok: (c) => has(c, 'move') && !any(c, 'task'), strip: ['move', 'event', 'cal'], needsTitle: true, free: true, build: (c, t) => sp('move', qt(t), 'to', at(c)) },
  { intent: 'event.rename', w: 4, ok: (c) => has(c, 'rename') && !any(c, 'task') && !!c.rn, strip: [], free: true, build: (c) => `rename meeting ${qt(c.rn!.old)} to ${qt(c.rn!.neu)}` },
  { intent: 'event.delete', w: 4, ok: (c) => has(c, 'del') && any(c, 'event', 'cal') && !any(c, 'task'), strip: ['del', 'cal'], needsTitle: true, free: true, build: (_c, t) => `delete ${qt(t)} from my plan` },
  { intent: 'task.done', w: 4, ok: (c) => has(c, 'done') && !any(c, 'add'), strip: ['done', 'task'], needsTitle: true, free: true, build: (_c, t) => `I finished ${qt(t)}` },
  { intent: 'task.delete', w: 4, ok: (c) => has(c, 'del', 'task'), strip: ['del', 'task'], needsTitle: true, free: true, build: (_c, t) => `delete task ${qt(t)}` },
  { intent: 'task.rename', w: 4, ok: (c) => has(c, 'rename', 'task') && !!c.rn, strip: [], free: true, build: (c) => `rename task ${qt(c.rn!.old)} to ${qt(c.rn!.neu)}` },
  { intent: 'note.add', w: 4, ok: (c) => has(c, 'note') && any(c, 'write', 'add'), strip: ['note', 'write', 'add'], needsTitle: true, free: true, build: (_c, t) => `write a note: ${t}` },
  { intent: 'goal.add', w: 4, ok: (c) => has(c, 'goal') && any(c, 'add', 'write') , strip: ['goal', 'add', 'write'], needsTitle: true, free: true, build: (_c, t) => `new goal ${qt(t)}` },
  { intent: 'task.due', w: 4, ok: (c) => has(c, 'due', 'task') && !any(c, 'add') && !!c.w.day, strip: ['due', 'task'], needsTitle: true, free: true, build: (c, t) => `the task ${qt(t)} is due ${c.w.day}` },
  { intent: 'event.when', w: 4, ok: (c) => has(c, 'qWhen') && !any(c, 'add', 'task'), strip: ['qWhen', 'event'], needsTitle: true, free: true, build: (_c, t) => `what time is ${qt(t)}?` },
  { intent: 'theme.dark', w: 4, ok: (c) => has(c, 'dark') && any(c, 'themeN', 'mark', 'on'), strip: [], build: () => 'dark mode' },
  { intent: 'theme.light', w: 4, ok: (c) => has(c, 'light') && any(c, 'themeN', 'mark', 'on'), strip: [], build: () => 'light mode' },
  { intent: 'notif.on', w: 4, ok: (c) => has(c, 'notif', 'on') && !any(c, 'off'), strip: [], build: () => 'turn on notifications' },
  { intent: 'notif.off', w: 4, ok: (c) => has(c, 'notif', 'off'), strip: [], build: () => 'turn off notifications' },
  { intent: 'hours.set', w: 4, ok: (c) => has(c, 'workhours') && !!c.w.start && !!c.w.end, strip: [], build: (c) => `set my working hours from ${c.w.start} to ${c.w.end}` },
  { intent: 'agenda.show', w: 3.5, ok: (c) => (has(c, 'qHave') || (has(c, 'show') && any(c, 'cal', 'event'))) && !any(c, 'task', 'add', 'del', 'free'), strip: [], build: (c) => sp('show my agenda', at(c)) },
  { intent: 'task.list', w: 3, ok: (c) => has(c, 'task') && any(c, 'show', 'qHave') && !any(c, 'add', 'del', 'done'), strip: [], build: () => 'show my tasks' },
  { intent: 'task.add', w: 3, ok: (c) => has(c, 'add', 'task'), strip: ['add', 'task', 'cal', 'plan', 'due'], needsTitle: true, free: true, build: (c, t) => sp('add task', qt(t), c.w.day ? `by ${c.w.day}` : '') },
  { intent: 'event.add', w: 3, ok: (c) => (has(c, 'add') && any(c, 'cal', 'event')) || (has(c, 'add') && (!!c.w.day || !!c.w.start) && !any(c, 'task', 'note', 'goal')), strip: ['add', 'cal', 'plan', 'write'], free: true, build: (c, t) => sp('add', t ? qt(t) : 'event', 'to my plan', at(c)) },
  { intent: 'event.add', w: 2.5, ok: (c) => has(c, 'event') && (!!c.w.day || !!c.w.start) && !any(c, 'add', 'del', 'move', 'show', 'qHave', 'qWhen', 'task', 'done'), strip: ['cal', 'plan'], free: true, weak: false, build: (c, t) => sp('add', t ? qt(t) : 'event', 'to my plan', at(c)) },
  { intent: 'open.weak', w: 1, ok: (c) => !!c.page && c.words <= 1 && !any(c, 'add', 'del'), strip: [], weak: true, build: (c) => `open ${PAGE_EN[c.page!]}` },
];

export type Match = { intent: string; text: string; confidence: number };

/** Valuta le regole e costruisce il comando canonico. */
export function applyRules(c: Ctx, richTitle: (strip: Concept[]) => string): Match | null {
  let best: { r: Rule; text: string; conf: number } | null = null;
  const tryRule = (r: Rule) => {
    if (!r.ok(c)) return;
    if (best && r.w <= best.r.w) return;
    const title = c.quoted ?? richTitle(r.strip);
    if (r.needsTitle && !title) return;
    const text = r.build(c, cap(title, c.lex));
    if (!text) return;
    let conf = r.weak ? 0.5 : 0.9;
    if (!r.free && c.words > (c.lex.spaced ? 3 : 6)) conf = Math.min(conf, 0.55);
    best = { r, text, conf };
  };
  RULES.forEach(tryRule);
  const b = best as { r: Rule; text: string; conf: number } | null;
  return b ? { intent: b.r.intent, text: b.text, confidence: b.conf } : null;
}
