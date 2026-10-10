/** Tutto ciò che LifePilot sa dei tuoi interessi, in un elenco unico e raggruppabile. Parte pura, testabile. */

export type Source = 'scelto' | 'manuale' | 'ricerca' | 'viaggio' | 'obiettivo' | 'allenamento';
export type KItem = { key: string; label: string; source: Source; group: string; ts?: number };

export const GROUPS = ['Viaggi', 'Cibo e locali', 'Cultura e città', 'Natura e sport', 'Lavoro e studio', 'Soldi', 'Tempo libero', 'Altro'] as const;
export type Group = (typeof GROUPS)[number];

/** Parole chiave -> macro categoria (la prima che combacia). */
const RULES: [RegExp, Group][] = [
  [/viagg|vacanz|hotel|volo|voli|itinerar|weekend|crociera/i, 'Viaggi'],
  [/caff|bar\b|bar e|cucina|ristor|pizza|vino|cibo|gelat|panet|pasticc|trattor/i, 'Cibo e locali'],
  [/architett|storia|monument|muse|arte|galler|citt|passegg|palazz|chiesa|teatro|music|concert|libr|cinema|film/i, 'Cultura e città'],
  [/natura|parco|parchi|montagn|mare|spiagg|sport|corsa|run|palestra|yoga|nuoto|bici|trekking|allenament|fitness|movimento|camminat/i, 'Natura e sport'],
  [/lavor|carriera|studi|corso|esame|tedesc|inglese|lingua|business|startup|progett|riunion|clienti/i, 'Lavoro e studio'],
  [/soldi|rispar|invest|budget|finanz|azion|etf|tasse|mutuo|spes/i, 'Soldi'],
  [/shopping|negozi|moda|relax|spa|benessere|hobby|gioc|fotograf|giardin/i, 'Tempo libero'],
];

export function groupOf(label: string): Group {
  for (const [re, g] of RULES) if (re.test(label)) return g;
  return 'Altro';
}

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export type KInput = {
  /** interessi scelti dal catalogo (id -> etichetta) */
  chosen: { id: string; label: string }[];
  custom: { id: string; label: string }[];
  recent: { q: string; ts: number }[];
  trips: { id: string; city: string }[];
  goals: { id: string; t: string }[];
  workouts: { type: string }[];
  /** voci dedotte che l'utente ha eliminato: non tornano */
  dismissed: string[];
};

/** Elenco unico, senza doppioni, con le voci eliminate escluse. Ordine: scelte, manuali, poi dedotte. */
export function buildKnowledge(i: KInput): KItem[] {
  const out: KItem[] = [];
  const seen = new Set<string>();
  const dis = new Set(i.dismissed);
  const push = (key: string, label: string, source: Source, ts?: number) => {
    const l = label.trim();
    if (!l) return;
    const n = norm(l);
    if (seen.has(n) || dis.has(key)) return;
    seen.add(n);
    out.push({ key, label: l, source, group: groupOf(l), ts });
  };
  i.chosen.forEach((c) => push('c:' + c.id, c.label, 'scelto'));
  i.custom.forEach((c) => push('m:' + c.id, c.label, 'manuale'));
  [...i.recent].sort((a, b) => b.ts - a.ts).slice(0, 8).forEach((r) => push('r:' + norm(r.q), r.q, 'ricerca', r.ts));
  i.trips.forEach((t) => push('t:' + norm(t.city), t.city, 'viaggio'));
  i.goals.forEach((g) => push('g:' + g.id, g.t, 'obiettivo'));
  const wk = new Set<string>();
  i.workouts.forEach((w) => { const k = norm(w.type); if (k && !wk.has(k)) { wk.add(k); push('w:' + k, w.type, 'allenamento'); } });
  return out;
}

/** Sopra questa soglia l'elenco passa a macro categorie. */
export const GROUP_THRESHOLD = 12;

export function groupKnowledge(items: KItem[]): { group: Group; items: KItem[] }[] {
  const by = new Map<Group, KItem[]>();
  items.forEach((x) => by.set(x.group as Group, [...(by.get(x.group as Group) ?? []), x]));
  return GROUPS.filter((g) => by.has(g)).map((g) => ({ group: g, items: by.get(g)! }));
}

export const shouldGroup = (items: KItem[]) => items.length > GROUP_THRESHOLD;

export const SOURCE_LABEL: Record<Source, string> = {
  scelto: 'Scelto da te', manuale: 'Aggiunto da te', ricerca: 'Dalle tue ricerche', viaggio: 'Dai tuoi viaggi', obiettivo: 'Dai tuoi obiettivi', allenamento: 'Dai tuoi allenamenti',
};

/** Se un testo libero corrisponde a un interesse del catalogo (es. "caffè" -> caffe), restituisce l'id. */
export function matchCatalog(text: string, catalog: { id: string; label: string }[]): string | null {
  const n = norm(text);
  if (!n) return null;
  const direct = catalog.find((c) => c.id === n || norm(c.label) === n);
  if (direct) return direct.id;
  const alias: [RegExp, string][] = [[/^caff|^bar$/, 'caffe'], [/^architett/, 'architettura'], [/^stori/, 'storia'], [/^muse|^arte$/, 'musei'], [/^natura|^parch/, 'natura'], [/^cucina|^cibo/, 'cucina'], [/^libr/, 'libri'], [/^sport/, 'sport'], [/^music/, 'musica'], [/^relax|^benessere/, 'relax'], [/^shopping/, 'shopping']];
  const hit = alias.find(([re]) => re.test(n));
  return hit && catalog.some((c) => c.id === hit[1]) ? hit[1] : null;
}
