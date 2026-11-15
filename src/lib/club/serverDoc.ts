import type { Club, ClubPost, Course, Lesson, Membership } from './types.ts';

/** Traduzione tra il LifeClub dell'app e il documento che il server si aspetta (`club_save` / `club_get`). Puro: niente rete. */

/** Il documento da inviare: i file del telefono (`uri`) non partono qui, ci pensa il caricamento nell'archivio privato. */
export function toDoc(c: Club): { club: Record<string, unknown>; courses: unknown[]; posts: unknown[] } {
  return {
    club: {
      id: c.id, name: c.name, tagline: c.tagline, description: c.description, cover: { c1: c.cover.c1, c2: c.cover.c2 }, categories: c.categories,
      published: c.published, adult: !!c.adult, pricing: c.pricing, chat: c.chat, rulesAccepted: c.rulesAccepted ?? null,
    },
    courses: c.courses.map((co) => ({ ...co, lessons: co.lessons.map(({ uri: _u, locked: _l, ...l }) => l) })),
    posts: c.posts,
  };
}

/** Quello che il creatore deve ancora caricare: lezioni con un file sul telefono e nessun file sul server. */
export const pendingUploads = (c: Club): { courseId: string; lesson: Lesson }[] =>
  c.courses.flatMap((co) => co.lessons.filter((l) => l.uri && !l.mediaPath && !/^https?:/i.test(l.uri) && l.kind !== 'testo' && l.kind !== 'link').map((lesson) => ({ courseId: co.id, lesson })));

/** Il percorso nell'archivio privato: la cartella dice a chi è aperto il file (free = iscritti, premium = abbonati). */
export const mediaPathFor = (clubId: string, lesson: Pick<Lesson, 'id' | 'tier' | 'fileName'>): string => {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(lesson.fileName ?? '')?.[1]?.toLowerCase() ?? 'bin';
  return `${clubId}/${lesson.tier === 'premium' ? 'premium' : 'free'}/${lesson.id}.${ext}`;
};

type Remote = Record<string, any>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Dal server all'app. `urls` = indirizzi firmati dei file già pronti (percorso → indirizzo). */
export function fromRemote(r: Remote, urls: Record<string, string> = {}): Club {
  const lesson = (l: Remote): Lesson => ({
    ...(l as Lesson), id: String(l.id), title: String(l.title ?? ''), tier: l.tier === 'premium' ? 'premium' : 'free', preview: !!l.preview,
    uri: l.mediaPath ? urls[l.mediaPath] : undefined, locked: !!l.locked || undefined,
  });
  const course = (c: Remote): Course => ({
    id: String(c.id), title: String(c.title ?? ''), description: String(c.description ?? ''), level: c.level ?? 'base', sections: Array.isArray(c.sections) ? c.sections : [], published: !!c.published, createdAt: num(c.createdAt),
    lessons: (Array.isArray(c.lessons) ? c.lessons : []).map(lesson),
  });
  const counts = r.counts ?? {};
  return {
    id: String(r.id), owner: String(r.owner ?? ''), name: String(r.name ?? ''), tagline: String(r.tagline ?? ''), description: String(r.description ?? ''),
    cover: { c1: r.cover?.c1 ?? '#36d1dc', c2: r.cover?.c2 ?? '#5b86e5' }, categories: Array.isArray(r.categories) ? r.categories : [], createdAt: num(r.createdAt, Date.now()),
    published: !!r.published, adult: r.adult || undefined, rulesAccepted: r.rulesAccepted ?? undefined, remote: true,
    pricing: { monthly: num(r.pricing?.monthly), currency: r.pricing?.currency ?? 'EUR', trialDays: num(r.pricing?.trialDays), yearlyDiscountPct: num(r.pricing?.yearlyDiscountPct) },
    chat: r.chat?.write ? r.chat : { write: 'members', chosen: [], slowSec: 0, commentsWhenReadOnly: true },
    courses: (Array.isArray(r.courses) ? r.courses : []).map(course),
    posts: (Array.isArray(r.posts) ? r.posts : []) as ClubPost[],
    baseline: { followers: num(counts.followers), free: num(counts.free), premium: num(counts.premium) },
  };
}

/** L'iscrizione di questa persona come la vede il server → quella dell'app. */
export function membershipFromRemote(m: Remote, clubId: string, user: string): Membership {
  return {
    id: `srv-${clubId}`, user, clubId, tier: m.tier === 'premium' ? 'premium' : m.tier === 'follower' ? 'follower' : 'free', since: num(m.since, Date.now()),
    status: m.status === 'in_pausa' ? 'in_pausa' : m.status === 'annullata' ? 'annullata' : 'attiva', renews: false, endsAt: m.endsAt ?? undefined, mutedByOwner: !!m.muted, everJoined: true,
  } as Membership;
}

/** Se serve rimandare al server (cambio vero e non solo un file caricato): firma stabile del contenuto. */
export const docKey = (c: Club): string => JSON.stringify(toDoc({ ...c, courses: c.courses.map((co) => ({ ...co, lessons: co.lessons.map((l) => ({ ...l, uri: undefined })) })) }));
