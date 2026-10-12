/**
 * Aspetto del profilo: tutto ciò che la persona può personalizzare (modulo PURO, nessun alias '@/').
 * Vale per il proprio profilo; si salva sul telefono (store identity).
 */
export type SectionId = 'badges' | 'stats' | 'lifepoints' | 'pills' | 'others' | 'grid';
export const SECTION_IDS: SectionId[] = ['badges', 'stats', 'lifepoints', 'pills', 'others', 'grid'];
export const SECTION_LABEL: Record<SectionId, string> = { badges: 'Traguardi', stats: 'Follower, seguiti e voto', lifepoints: 'LifePoints', pills: 'Pillole', others: 'Altri profili', grid: 'Post e contenuti' };
export const PILL_IDS = ['post', 'idee', 'store', 'servizi', 'contributi', 'altro'] as const;
export const PILL_LABEL: Record<string, string> = { post: 'Post', idee: 'Idee', store: 'Store', servizi: 'Servizi', contributi: 'Contributi', altro: 'Altro' };
export const TAB_IDS = ['Post', 'Foto', 'Video', 'Idee'] as const;
export const ACCENTS = ['#8fa4ff', '#6c8cff', '#7be0b0', '#ffb84f', '#ff8fa3', '#c792ea', '#4fd1c5', '#f6e05e'];
export const BANNERS: { c1: string; c2: string }[] = [
  { c1: '#5b86e5', c2: '#36d1dc' }, { c1: '#614385', c2: '#516395' }, { c1: '#ff9966', c2: '#ff5e62' }, { c1: '#11998e', c2: '#38ef7d' }, { c1: '#232526', c2: '#414345' }, { c1: '#ee9ca7', c2: '#ffdde1' },
];

export type ProfileLook = {
  v: 1;
  banner: { uri?: string; c1: string; c2: string } | null;
  accent: string | null;
  headline: string;
  place: string;
  link: string;
  order: SectionId[];
  hidden: SectionId[];
  hiddenPills: string[];
  hiddenTabs: string[];
  showVerified: boolean;
  nameSize: 'S' | 'M' | 'L';
};

export const DEFAULT_LOOK: ProfileLook = {
  v: 1, banner: null, accent: null, headline: '', place: '', link: '',
  order: [...SECTION_IDS], hidden: [], hiddenPills: [], hiddenTabs: [], showVerified: true, nameSize: 'M',
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const strs = (x: unknown, allowed: readonly string[]) => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && allowed.includes(v)))] : []);

/** Rende valido qualsiasi valore salvato: sezioni mancanti rimesse in coda, valori sconosciuti scartati. */
export function sanitizeLook(raw: unknown): ProfileLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const order = strs(r.order, SECTION_IDS) as SectionId[];
  for (const id of SECTION_IDS) if (!order.includes(id)) order.push(id);
  const b = r.banner as { uri?: unknown; c1?: unknown; c2?: unknown } | null | undefined;
  const banner = b && typeof b === 'object' && HEX.test(String(b.c1)) && HEX.test(String(b.c2)) ? { uri: typeof b.uri === 'string' && b.uri ? b.uri : undefined, c1: String(b.c1), c2: String(b.c2) } : null;
  return {
    v: 1, banner,
    accent: typeof r.accent === 'string' && HEX.test(r.accent) ? r.accent : null,
    headline: str(r.headline, 60), place: str(r.place, 40), link: str(r.link, 120),
    order, hidden: strs(r.hidden, SECTION_IDS) as SectionId[],
    hiddenPills: strs(r.hiddenPills, PILL_IDS), hiddenTabs: strs(r.hiddenTabs, TAB_IDS),
    showVerified: r.showVerified !== false,
    nameSize: r.nameSize === 'S' || r.nameSize === 'L' ? r.nameSize : 'M',
  };
}

/** Sposta una sezione di una posizione (-1 su, +1 giù). */
export function moveSection(order: SectionId[], id: SectionId, dir: -1 | 1): SectionId[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Sezioni da mostrare, nell'ordine scelto. */
export const visibleSections = (l: ProfileLook): SectionId[] => l.order.filter((id) => !l.hidden.includes(id));

/** Un indirizzo web sicuro da aprire: solo http/https. Ritorna null se non valido. */
export function safeLink(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
  return /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(withProto) ? withProto : null;
}
