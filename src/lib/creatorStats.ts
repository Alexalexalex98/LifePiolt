/**
 * Statistiche per chi crea (modulo PURO): post, idee, seminari e servizi.
 * Senza un server che conti le visualizzazioni, i numeri di pubblico e di orari sono un MODELLO dimostrativo:
 * partono da ciò che c'è davvero (mi piace, commenti, iscrizioni, LifePoints) e il resto è stimato in modo
 * deterministico (stesso contenuto, stesso risultato). Quando ci sarà il server, basta sostituire `model()`.
 */
export type ItemKind = 'post' | 'idea' | 'seminar' | 'service';
export type Fmt = 'foto' | 'video' | 'frase' | 'idea' | 'seminario' | 'servizio';
export type CreatorItem = {
  key: string; kind: ItemKind; fmt: Fmt; title: string; ts: number;
  likes: number; comments: number; saves?: number;
  /** iscrizioni, prenotazioni o contributi ricevuti */ conv: number;
  /** posti o obiettivo (per riempimento e raccolta) */ capacity?: number;
  /** LifePoints guadagnati */ lp: number;
  /** durata del video in secondi */ durationSec?: number;
};
export type Range = 7 | 30 | 90;
export type Kpi = { value: number; prev: number; deltaPct: number };
export type Bar = { label: string; pct: number };
export type Row = { key: string; title: string; fmt: Fmt; reach: number; rate: number; conv: number };
export type Suggestion = { id: string; priority: 1 | 2 | 3; area: 'orari' | 'formato' | 'pubblico' | 'video' | 'azione' | 'costanza' | 'conversazione'; title: string; why: string; action?: { label: string; page: string } };
export type Stats = {
  n: number;
  kpis: { reach: Kpi; interactions: Kpi; rate: Kpi; followers: Kpi; conversions: Kpi; lp: Kpi };
  audience: { age: Bar[]; gender: Bar[]; cities: Bar[]; interests: Bar[]; returning: number };
  timing: { days: Bar[]; hours: Bar[]; bestDay: string; bestHours: string };
  content: { top: Row[]; low: Row[]; byFmt: { fmt: Fmt; rate: number; n: number }[] };
  funnel: { label: string; value: number }[];
  video: { avgWatchPct: number; dropAtSec: number; completionPct: number } | null;
  suggestions: Suggestion[];
};

const DAY = 86400000;
export const AGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;
export const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;
const CITIES = ['Lugano', 'Bellinzona', 'Locarno', 'Mendrisio', 'Chiasso', 'Zurigo', 'Milano', 'Como'];
const INTERESTS = ['Cucina', 'Viaggi', 'Fitness', 'Mind', 'Caffè', 'Serate', 'Design', 'Libri', 'Sport', 'Casa'];
const HOUR_BLOCKS = [['06-09', 6], ['09-12', 9], ['12-14', 12], ['14-17', 14], ['17-19', 17], ['19-21', 19], ['21-24', 21]] as const;

/* ---------- numeri deterministici ---------- */
export function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = (seed: string) => { let s = h32(seed) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** Normalizza a percentuali intere che sommano esattamente a 100. */
export function toPct(raw: number[]): number[] {
  const tot = raw.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const p = raw.map((v) => Math.max(0, v) / tot * 100);
  const fl = p.map((v) => Math.floor(v));
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  const order = p.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (const o of order) { if (rest <= 0) break; fl[o.i]++; rest--; }
  return fl;
}
const delta = (value: number, prev: number): Kpi => ({ value, prev, deltaPct: prev > 0 ? Math.round(((value - prev) / prev) * 100) : value > 0 ? 100 : 0 });

/** Contatti stimati di un contenuto: parte da ciò che c'è davvero (mi piace, commenti, azioni). */
export function reachOfItem(it: CreatorItem): number {
  const r = rnd('reach:' + it.key);
  const base = it.likes * 14 + it.comments * 38 + it.conv * 55 + (it.saves ?? 0) * 24 + 90;
  const fmtBoost = it.fmt === 'video' ? 1.25 : it.fmt === 'foto' ? 1.05 : it.fmt === 'frase' ? 0.8 : 1;
  return Math.round(base * fmtBoost * (0.85 + r() * 0.35));
}
const interactionsOf = (it: CreatorItem) => it.likes + it.comments * 2 + (it.saves ?? 0) * 2 + it.conv * 3;

/** Distribuzione del pubblico di chi crea: una fascia d'età dominante, scelta dal nome e dal tipo di contenuti. */
function audienceFor(seed: string, items: CreatorItem[]) {
  const r = rnd('aud:' + seed);
  const lead = 1 + Math.floor(r() * 3); // 18-24, 25-34 o 35-44
  const age = AGES.map((_, i) => Math.max(1, 30 - Math.abs(i - lead) * 11 + r() * 6));
  const female = 38 + Math.floor(r() * 24);
  const genderRaw = [female, 100 - female - 3, 3];
  const cityRaw = CITIES.map((_, i) => Math.max(1, 34 - i * 5 + r() * 9));
  const text = items.map((x) => x.title).join(' ').toLowerCase();
  const interestRaw = INTERESTS.map((x) => 6 + r() * 10 + (text.includes(x.toLowerCase()) ? 14 : 0));
  return { age: toPct(age), gender: toPct(genderRaw), cities: toPct(cityRaw), interests: interestRaw, returning: 22 + Math.floor(r() * 40) };
}

/** Quando risponde il pubblico: punteggi per giorno e per fascia oraria. */
function timingFor(seed: string) {
  const r = rnd('time:' + seed);
  const peakDay = Math.floor(r() * 7), peakHour = 3 + Math.floor(r() * 4);
  const days = DAYS.map((_, i) => Math.max(8, 55 - Math.min(Math.abs(i - peakDay), 7 - Math.abs(i - peakDay)) * 12 + r() * 14));
  const hours = HOUR_BLOCKS.map((_, i) => Math.max(5, 60 - Math.abs(i - peakHour) * 17 + r() * 12));
  return { days, hours, peakDay, peakHour };
}

function within(items: CreatorItem[], from: number, to: number) { return items.filter((x) => x.ts >= from && x.ts < to); }

/** Calcola tutte le statistiche per un periodo. `now` è passato per avere risultati ripetibili. */
export function computeStats(items: CreatorItem[], seed: string, range: Range, now: number): Stats {
  const cur = within(items, now - range * DAY, now + DAY);
  const prev = within(items, now - range * 2 * DAY, now - range * DAY);
  const sum = (xs: CreatorItem[], f: (x: CreatorItem) => number) => xs.reduce((a, x) => a + f(x), 0);
  const reach = (xs: CreatorItem[]) => sum(xs, reachOfItem);
  const inter = (xs: CreatorItem[]) => sum(xs, interactionsOf);
  const rateOf = (xs: CreatorItem[]) => { const r = reach(xs); return r ? Math.round((inter(xs) / r) * 1000) / 10 : 0; };
  const newFollowers = (xs: CreatorItem[]) => Math.round(sum(xs, (x) => reachOfItem(x) * (0.012 + (h32('f' + x.key) % 100) / 8000)));
  const kpis = {
    reach: delta(reach(cur), reach(prev)), interactions: delta(inter(cur), inter(prev)),
    rate: { value: rateOf(cur), prev: rateOf(prev), deltaPct: rateOf(prev) > 0 ? Math.round(((rateOf(cur) - rateOf(prev)) / rateOf(prev)) * 100) : 0 },
    followers: delta(newFollowers(cur), newFollowers(prev)), conversions: delta(sum(cur, (x) => x.conv), sum(prev, (x) => x.conv)), lp: delta(sum(cur, (x) => x.lp), sum(prev, (x) => x.lp)),
  };

  const aud = audienceFor(seed, items);
  const ageBars = AGES.map((l, i) => ({ label: l, pct: aud.age[i] }));
  const genderBars = ['Donne', 'Uomini', 'Altro'].map((l, i) => ({ label: l, pct: aud.gender[i] }));
  const cityPct = toPct(aud.cities);
  const cityBars = CITIES.map((l, i) => ({ label: l, pct: cityPct[i] })).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const interestPct = toPct(aud.interests);
  const interestBars = INTERESTS.map((l, i) => ({ label: l, pct: interestPct[i] })).sort((a, b) => b.pct - a.pct).slice(0, 5);

  const tm = timingFor(seed);
  const dayPct = toPct(tm.days), hourPct = toPct(tm.hours);
  const dayBars = DAYS.map((l, i) => ({ label: l, pct: dayPct[i] }));
  const hourBars = HOUR_BLOCKS.map(([l], i) => ({ label: l, pct: hourPct[i] }));
  const bestDay = DAYS[dayBars.reduce((b, x, i) => (x.pct > dayBars[b].pct ? i : b), 0)];
  const bh = hourBars.reduce((b, x, i) => (x.pct > hourBars[b].pct ? i : b), 0);

  const rows: Row[] = cur.map((x) => { const r = reachOfItem(x); return { key: x.key, title: x.title, fmt: x.fmt, reach: r, rate: r ? Math.round((interactionsOf(x) / r) * 1000) / 10 : 0, conv: x.conv }; });
  const sorted = rows.slice().sort((a, b) => b.rate - a.rate || b.reach - a.reach);
  const fmts = [...new Set(cur.map((x) => x.fmt))];
  const byFmt = fmts.map((fmt) => { const xs = cur.filter((x) => x.fmt === fmt); return { fmt, rate: rateOf(xs), n: xs.length }; }).sort((a, b) => b.rate - a.rate);

  const R = kpis.reach.value;
  const inter0 = kpis.interactions.value;
  const funnel = [
    { label: 'Hanno visto', value: R }, { label: 'Hanno interagito', value: inter0 },
    { label: 'Hanno aperto il profilo', value: Math.round(inter0 * 0.46) }, { label: 'Hanno agito', value: kpis.conversions.value },
  ];
  const vids = cur.filter((x) => x.fmt === 'video');
  const video = vids.length ? (() => {
    const r = rnd('vid:' + seed + vids.length);
    const dur = vids.reduce((a, x) => a + (x.durationSec ?? 20), 0) / vids.length;
    const avg = Math.round(32 + r() * 38);
    return { avgWatchPct: avg, dropAtSec: Math.max(3, Math.round((dur * avg) / 100 * 0.8)), completionPct: Math.max(4, Math.round(avg * 0.55)) };
  })() : null;

  const base: Stats = { n: cur.length, kpis, audience: { age: ageBars, gender: genderBars, cities: cityBars, interests: interestBars, returning: aud.returning }, timing: { days: dayBars, hours: hourBars, bestDay, bestHours: HOUR_BLOCKS[bh][0] }, content: { top: sorted.slice(0, 3), low: sorted.length > 3 ? sorted.slice(-2).reverse() : [], byFmt }, funnel, video, suggestions: [] };
  base.suggestions = suggest(base, items, now);
  return base;
}

/** I consigli di Theia: poche regole chiare, ognuna con il numero che la giustifica. Ordinate per importanza. */
export function suggest(s: Stats, items: CreatorItem[], now: number): Suggestion[] {
  const out: Suggestion[] = [];
  const lastPost = items.filter((x) => x.kind === 'post').sort((a, b) => b.ts - a.ts)[0];
  const quiet = lastPost ? Math.floor((now - lastPost.ts) / DAY) : null;
  if (items.length === 0) out.push({ id: 'start', priority: 1, area: 'costanza', title: 'Pubblica il tuo primo contenuto', why: 'Senza contenuti non ci sono ancora dati da analizzare. Bastano un post o un recap per iniziare.', action: { label: 'Crea', page: 'lifenetwork' } });
  if (quiet != null && quiet >= 5) out.push({ id: 'quiet', priority: 1, area: 'costanza', title: `Non pubblichi da ${quiet} giorni`, why: 'Chi pubblica almeno tre volte a settimana resta più a lungo nel feed di chi lo segue. Un recap di dieci secondi basta.', action: { label: 'Crea un recap', page: 'storyCreate' } });
  const dom = s.audience.age.reduce((b, x) => (x.pct > b.pct ? x : b), s.audience.age[0]);
  if (dom.pct >= 32) out.push({ id: 'age', priority: 2, area: 'pubblico', title: `Il tuo pubblico ha soprattutto ${dom.label} anni`, why: `${dom.pct}% di chi ti segue è in questa fascia: scegli temi, toni e orari pensati per loro.` });
  const best = s.content.byFmt[0], worst = s.content.byFmt[s.content.byFmt.length - 1];
  if (s.content.byFmt.length > 1 && best.rate >= worst.rate * 1.25 && best.rate > 0) out.push({ id: 'fmt', priority: 2, area: 'formato', title: `I tuoi ${best.fmt} funzionano meglio`, why: `Interazione ${best.rate}% contro ${worst.rate}% dei ${worst.fmt}. Prova a farne di più e a usare i ${worst.fmt} come completamento.` });
  out.push({ id: 'time', priority: 2, area: 'orari', title: `Pubblica di ${s.timing.bestDay} tra le ${s.timing.bestHours.replace('-', ' e le ')}`, why: `È il momento in cui il tuo pubblico risponde di più (${s.timing.days.find((d) => d.label === s.timing.bestDay)?.pct ?? 0}% dell'attività della settimana).` });
  if (s.video && s.video.avgWatchPct < 55) out.push({ id: 'video', priority: 1, area: 'video', title: `Chi guarda i tuoi video lascia dopo circa ${s.video.dropAtSec} secondi`, why: `In media se ne vede il ${s.video.avgWatchPct}%. Metti la scena più forte nei primi tre secondi e taglia le parti lente.` });
  const act = s.funnel[3].value, seen = s.funnel[0].value;
  if (seen > 0 && act / seen < 0.02) out.push({ id: 'cta', priority: 1, area: 'azione', title: 'Molti guardano, pochi agiscono', why: `Solo lo ${Math.round((act / seen) * 1000) / 10}% passa all'azione. Aggiungi un invito chiaro (prenota, iscriviti, sostieni), una foto in più e il prezzo ben visibile.` });
  const com = items.reduce((a, x) => a + x.comments, 0), lik = items.reduce((a, x) => a + x.likes, 0);
  if (lik >= 10 && com / Math.max(1, lik) < 0.08) out.push({ id: 'talk', priority: 3, area: 'conversazione', title: 'Pochi commenti rispetto ai mi piace', why: 'Chiudi i post con una domanda e rispondi ai primi commenti entro un\'ora: la conversazione aumenta la diffusione.' });
  if (s.audience.returning < 32) out.push({ id: 'ret', priority: 3, area: 'costanza', title: 'Poche persone tornano', why: `Solo il ${s.audience.returning}% del pubblico è abituale. Una serie con un appuntamento fisso (ogni giovedì, per esempio) li fa tornare.` });
  const sem = items.filter((x) => (x.kind === 'seminar' || x.kind === 'service') && x.capacity);
  const fill = sem.length ? sem.reduce((a, x) => a + x.conv, 0) / sem.reduce((a, x) => a + (x.capacity ?? 0), 0) : null;
  if (fill != null && fill < 0.5) out.push({ id: 'fill', priority: 2, area: 'azione', title: `Posti riempiti: ${Math.round(fill * 100)}%`, why: 'Prova un orario di sera, un prezzo di lancio per le prime iscrizioni o un recap che mostri com\'è andata l\'ultima volta.' });
  return out.sort((a, b) => a.priority - b.priority).slice(0, 6);
}
