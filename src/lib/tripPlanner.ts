// Pianificatore viaggi (puro, nessun import con alias): classifica le destinazioni in base a interessi,
// ricerche recenti, budget e periodo, e costruisce un itinerario giorno per giorno dentro il budget.
// Tutti i prezzi sono STIME d'esempio nella valuta dell'app (non convertiti): verificare prima di prenotare.

export type InterestKey = 'caffe' | 'architettura' | 'storia' | 'musei' | 'citta' | 'natura' | 'cucina' | 'shopping' | 'libri' | 'sport' | 'musica' | 'relax';
export const INTEREST_KEYS: InterestKey[] = ['caffe', 'architettura', 'storia', 'musei', 'citta', 'natura', 'cucina', 'shopping', 'libri', 'sport', 'musica', 'relax'];
const LABEL: Record<InterestKey, string> = {
  caffe: 'bar e caffetterie', architettura: 'architettura', storia: 'storia e monumenti', musei: 'musei e arte', citta: 'passeggiare in città', natura: 'natura e parchi',
  cucina: 'cucina locale', shopping: 'shopping', libri: 'libri e librerie', sport: 'sport e movimento', musica: 'musica e concerti', relax: 'relax e benessere',
};
export const interestLabel = (k: string) => LABEL[k as InterestKey] ?? k;
/** parole che, se presenti in una ricerca recente, fanno dedurre un interesse */
const KEYWORDS: Record<InterestKey, string[]> = {
  caffe: ['caffe', 'bar', 'aperitiv'], architettura: ['architett', 'palazz', 'cattedral'], storia: ['stori', 'monument', 'castell'], musei: ['muse', 'arte', 'galleri', 'mostra'],
  citta: ['citta', 'passegg'], natura: ['natur', 'parco', 'lago', 'montagn', 'trekking', 'escursion'], cucina: ['cucina', 'ristorant', 'cibo', 'gastronom'],
  shopping: ['shopping', 'negozi', 'outlet'], libri: ['libri', 'libreri'], sport: ['sport', 'sci', 'bici', 'corsa'], musica: ['music', 'concert', 'teatro', 'opera'], relax: ['relax', 'spa', 'terme', 'benessere'],
};

export type Level = 'budget' | 'standard' | 'comfort';
const LEVELS: Level[] = ['comfort', 'standard', 'budget'];
const LEVEL_FACTOR: Record<Level, number> = { budget: 0.5, standard: 1, comfort: 1.7 };

export type DestMeta = {
  id: string; name: string; type: 'city' | 'summer' | 'winter';
  /** peso 0-3 per ogni interesse, nell'ordine di INTEREST_KEYS */
  w: number[];
  daily: number;     // pasti + trasporti locali al giorno, a persona
  hotel: number;     // camera doppia standard a notte
  flight: number;    // andata e ritorno a persona (stima)
  best: number[];    // mesi (1-12) consigliati
  alias?: string[];
};
export const DEST_META: DestMeta[] = [
  { id: 'zurigo', name: 'Zurigo', type: 'city', w: [2, 2, 1, 3, 2, 1, 2, 3, 2, 1, 2, 1], daily: 90, hotel: 180, flight: 80, best: [4, 5, 6, 9, 12] },
  { id: 'ginevra', name: 'Ginevra', type: 'city', w: [2, 2, 2, 3, 2, 2, 2, 3, 1, 1, 2, 2], daily: 90, hotel: 190, flight: 85, best: [5, 6, 9], alias: ['geneve'] },
  { id: 'lugano', name: 'Lugano', type: 'summer', w: [2, 1, 1, 2, 2, 3, 3, 2, 0, 2, 2, 3], daily: 80, hotel: 150, flight: 70, best: [5, 6, 7, 8, 9] },
  { id: 'lucerna', name: 'Lucerna', type: 'summer', w: [2, 3, 3, 2, 3, 3, 2, 2, 1, 2, 2, 2], daily: 85, hotel: 160, flight: 70, best: [5, 6, 7, 8, 9], alias: ['luzern'] },
  { id: 'berna', name: 'Berna', type: 'city', w: [2, 3, 3, 2, 3, 1, 2, 1, 2, 1, 1, 1], daily: 80, hotel: 150, flight: 70, best: [5, 6, 9, 10], alias: ['bern'] },
  { id: 'basilea', name: 'Basilea', type: 'city', w: [2, 3, 2, 3, 2, 1, 2, 2, 2, 1, 3, 1], daily: 75, hotel: 140, flight: 70, best: [5, 6, 9, 12], alias: ['basel'] },
  { id: 'interlaken', name: 'Interlaken', type: 'summer', w: [1, 1, 1, 0, 2, 3, 2, 1, 0, 3, 0, 3], daily: 85, hotel: 170, flight: 75, best: [6, 7, 8, 9] },
  { id: 'zermatt', name: 'Zermatt', type: 'winter', w: [1, 2, 1, 0, 2, 3, 2, 2, 0, 3, 0, 3], daily: 100, hotel: 260, flight: 85, best: [12, 1, 2, 3, 7, 8] },
  { id: 'stmoritz', name: 'St. Moritz', type: 'winter', w: [2, 2, 0, 1, 2, 3, 2, 3, 0, 3, 1, 3], daily: 130, hotel: 330, flight: 90, best: [12, 1, 2, 3, 7, 8], alias: ['st moritz', 'saint moritz', 'sankt moritz'] },
  { id: 'montreux', name: 'Montreux', type: 'summer', w: [2, 2, 2, 1, 2, 3, 2, 1, 0, 2, 3, 3], daily: 85, hotel: 180, flight: 80, best: [5, 6, 7, 8, 9, 12] },
  { id: 'parigi', name: 'Parigi', type: 'city', w: [3, 3, 3, 3, 3, 1, 3, 3, 3, 1, 3, 2], daily: 85, hotel: 190, flight: 220, best: [4, 5, 6, 9, 10], alias: ['paris'] },
  { id: 'newyork', name: 'New York', type: 'city', w: [3, 3, 2, 3, 3, 2, 3, 3, 3, 2, 3, 1], daily: 120, hotel: 280, flight: 750, best: [4, 5, 6, 9, 10, 12], alias: ['new york', 'nyc', 'manhattan', 'ny'] },
];
export const destMeta = (id: string) => DEST_META.find((d) => d.id === id);

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** t = modello italiano con {0},{1}; gli argomenti che iniziano con '$' sono importi (da formattare con formatMoney) */
export type Reason = { t: string; a: string[] };
export type Ranked = { id: string; name: string; score: number; reasons: Reason[]; cost: number; level: Level; fits: boolean; seasonOk: boolean };
export type Recent = { q: string; kind?: string; ts?: number };
export type RankInput = {
  interests: string[]; recent: Recent[]; budget: number; nights: number; month: number;
  from?: string; people?: number; flightFor?: (id: string) => number;
};

const lodgingPerNight = (d: DestMeta, level: Level, people: number) => Math.round(d.hotel * LEVEL_FACTOR[level]) * Math.ceil(Math.max(1, people) / 2);
const scale = (d: DestMeta) => d.daily / 90;

/** Costo stimato (senza dettaglio attività) per un livello di alloggio. */
export function estimateCost(d: DestMeta, nights: number, people: number, level: Level, flight = d.flight) {
  const days = nights + 1;
  return Math.round(flight * people + lodgingPerNight(d, level, people) * nights + d.daily * people * days + 12 * scale(d) * people * days);
}
function pickLevel(d: DestMeta, nights: number, people: number, budget: number, flight: number): { level: Level; cost: number; fits: boolean } {
  for (const level of LEVELS) { const cost = estimateCost(d, nights, people, level, flight); if (cost <= budget) return { level, cost, fits: true }; }
  return { level: 'budget', cost: estimateCost(d, nights, people, 'budget', flight), fits: false };
}

export function rankDestinations(inp: RankInput): Ranked[] {
  const people = Math.max(1, inp.people ?? 1), nights = Math.max(0, Math.round(inp.nights));
  const sel = inp.interests.filter((k): k is InterestKey => (INTEREST_KEYS as string[]).includes(k));
  // interessi dedotti dalle ricerche recenti (peso ridotto)
  const implicit = new Map<InterestKey, string>();
  for (const r of inp.recent) {
    const q = norm(r.q);
    for (const k of INTEREST_KEYS) if (!sel.includes(k) && KEYWORDS[k].some((w) => q.includes(w)) && !implicit.has(k)) implicit.set(k, r.q);
  }
  const from = inp.from ? norm(inp.from) : '';
  const out: Ranked[] = [];
  for (const d of DEST_META) {
    const names = [norm(d.name), ...(d.alias ?? []).map(norm)];
    if (from && names.includes(from)) continue; // non proporre la città da cui parti
    const reasons: Reason[] = [];
    let score = 0;
    // interessi
    const matched: { k: InterestKey; w: number }[] = [];
    sel.forEach((k) => { const w = d.w[INTEREST_KEYS.indexOf(k)]; if (w >= 2) matched.push({ k, w }); score += (w / 3) * (50 / Math.max(sel.length, 1)) * 1; });
    implicit.forEach((_q, k) => { const w = d.w[INTEREST_KEYS.indexOf(k)]; score += (w / 3) * 6; });
    matched.sort((a, b) => b.w - a.w).slice(0, 2).forEach((m) => reasons.push({ t: 'Perché ti piace {0}', a: [interestLabel(m.k)] }));
    const imp = [...implicit.entries()].find(([k]) => d.w[INTEREST_KEYS.indexOf(k)] >= 2);
    if (imp) reasons.push({ t: 'In linea con le tue ricerche recenti ({0})', a: [imp[1]] });
    // ricerche recenti sulla destinazione
    const hit = inp.recent.find((r) => { const q = norm(r.q); return q.length >= 3 && names.some((n) => q.includes(n) || (q.length >= 4 && n.startsWith(q))); });
    if (hit) { score += 28; reasons.unshift({ t: 'Hai cercato {0} di recente', a: [d.name] }); }
    // budget
    const flight = inp.flightFor ? inp.flightFor(d.id) : d.flight;
    const pl = pickLevel(d, nights, people, inp.budget, flight);
    if (pl.fits) {
      const slack = 1 - pl.cost / Math.max(inp.budget, 1);
      score += 18 + Math.min(slack, 0.5) * 10 + (pl.level === 'comfort' ? 4 : pl.level === 'standard' ? 2 : 0);
      reasons.push({ t: 'Rientra nel budget (circa {0} su {1})', a: ['$' + pl.cost, '$' + Math.round(inp.budget)] });
    } else {
      score -= Math.min(30, (pl.cost / Math.max(inp.budget, 1) - 1) * 40);
    }
    // periodo
    const seasonOk = d.best.includes(inp.month);
    if (seasonOk) { score += 12; reasons.push({ t: 'Periodo adatto', a: [] }); }
    out.push({ id: d.id, name: d.name, score: Math.round(score * 10) / 10, reasons, cost: pl.cost, level: pl.level, fits: pl.fits, seasonOk });
  }
  return out.sort((a, b) => b.score - a.score || a.cost - b.cost);
}

// ---------------------------------------------------------------- itinerario

export type Slot = 'morning' | 'afternoon' | 'evening';
export type Act = { slot: Slot; title: string; cost: number };
const A = (slot: Slot, title: string, cost: number): Act => ({ slot, title, cost });
const ACTS: Record<InterestKey, Act[]> = {
  caffe: [A('morning', 'Colazione in una caffetteria storica di {city}', 9), A('afternoon', 'Pausa in un bar tipico del centro di {city}', 8), A('evening', 'Aperitivo in un bar di tendenza', 16), A('morning', 'Caffè e dolci in una pasticceria del centro', 10), A('afternoon', 'Merenda nella caffetteria più amata dai locali', 11), A('evening', 'Cocktail bar con vista', 20)],
  architettura: [A('morning', 'Palazzi e quartieri storici di {city}', 0), A('afternoon', 'Visita a una cattedrale o a un edificio simbolo', 14), A('evening', 'Giro serale tra edifici illuminati', 0), A('morning', 'Tour a piedi dell\'architettura moderna', 12), A('afternoon', 'Salita a una torre panoramica', 18), A('evening', 'Passeggiata sul fiume o sul lago tra i ponti', 0)],
  storia: [A('morning', 'Centro storico e monumenti di {city}', 0), A('afternoon', 'Castello o fortezza con visita guidata', 20), A('evening', 'Racconti e leggende della città: tour serale', 15), A('morning', 'Museo di storia locale', 15), A('afternoon', 'Memoriali e piazze storiche', 0), A('evening', 'Cena in una locanda d\'epoca', 0)],
  musei: [A('morning', 'Museo d\'arte principale di {city}', 20), A('afternoon', 'Galleria o mostra temporanea', 16), A('evening', 'Apertura serale di un museo o di una galleria', 12), A('morning', 'Museo di scienza e cultura', 18), A('afternoon', 'Giro tra street art e atelier', 0), A('evening', 'Evento culturale in un centro d\'arte', 14)],
  citta: [A('morning', 'Passeggiata libera nel centro di {city}', 0), A('afternoon', 'Punto panoramico sulla città', 0), A('evening', 'Passeggiata serale lungo il fiume o il lago', 0), A('morning', 'Quartieri e mercati da scoprire a piedi', 0), A('afternoon', 'Giro in battello o tram panoramico', 15), A('evening', 'Tramonto da una terrazza pubblica', 0)],
  natura: [A('morning', 'Escursione facile nei dintorni di {city}', 0), A('afternoon', 'Parco o giardino botanico', 6), A('evening', 'Tramonto sul lago o in collina', 0), A('morning', 'Sentiero panoramico con picnic', 5), A('afternoon', 'Giro in barca o funivia', 28), A('evening', 'Passeggiata al chiaro di luna nel parco', 0)],
  cucina: [A('morning', 'Mercato locale e assaggi di {city}', 10), A('afternoon', 'Pranzo con piatto tipico', 22), A('evening', 'Cena in un ristorante di cucina locale', 38), A('morning', 'Visita a una panetteria o caseificio', 8), A('afternoon', 'Degustazione di specialità e dolci', 18), A('evening', 'Cena in una trattoria consigliata dai locali', 30)],
  shopping: [A('morning', 'Via dello shopping e negozi di {city}', 0), A('afternoon', 'Concept store e botteghe locali', 0), A('evening', 'Mercatino serale o negozi aperti fino a tardi', 0), A('morning', 'Mercato dell\'artigianato', 0), A('afternoon', 'Grandi magazzini e boutique', 0), A('evening', 'Souvenir e prodotti tipici', 10)],
  libri: [A('morning', 'Librerie storiche di {city}', 0), A('afternoon', 'Biblioteca o libreria-caffè', 5), A('evening', 'Lettura in un caffè letterario', 8), A('morning', 'Mercato dei libri usati', 0), A('afternoon', 'Casa-museo di uno scrittore', 12), A('evening', 'Presentazione o evento in libreria', 0)],
  sport: [A('morning', 'Corsa o bici lungo il fiume o il lago', 0), A('afternoon', 'Noleggio bici o attività sportiva all\'aperto', 25), A('evening', 'Piscina o stabilimento sportivo', 12), A('morning', 'Escursione sportiva nei dintorni', 0), A('afternoon', 'Lezione di prova (arrampicata, paddle...)', 35), A('evening', 'Stretching e passeggiata veloce', 0)],
  musica: [A('morning', 'Negozio di dischi e luoghi della musica', 0), A('afternoon', 'Visita a un teatro o a una sala da concerto', 15), A('evening', 'Concerto o serata live', 45), A('morning', 'Museo degli strumenti musicali', 14), A('afternoon', 'Prove aperte o musicisti di strada in centro', 0), A('evening', 'Jazz club o locale con musica dal vivo', 30)],
  relax: [A('morning', 'Mattinata lenta, colazione e giornale', 0), A('afternoon', 'Spa o terme', 45), A('evening', 'Cena tranquilla e passeggiata', 0), A('morning', 'Yoga o stretching in un parco', 0), A('afternoon', 'Pomeriggio in riva al lago o in un giardino', 0), A('evening', 'Massaggio o bagno termale serale', 55)],
};
const FREE: Record<Slot, string> = { morning: 'Mattinata libera tra le vie di {city}', afternoon: 'Pomeriggio libero in un parco o al fiume', evening: 'Passeggiata serale gratuita in centro' };
export const SLOT_TIME: Record<Slot, string> = { morning: '10:00', afternoon: '15:00', evening: '20:00' };
const SLOT_ORDER: Slot[] = ['morning', 'afternoon', 'evening'];

export type Item = { slot: Slot; title: string; cost: number; interest?: InterestKey; free?: boolean };
export type Day = { n: number; items: Item[] };
export type Itinerary = {
  destId: string; destName: string; nights: number; people: number; level: Level;
  days: Day[];
  lodging: { perNight: number; total: number; level: Level };
  flight: number; flightEach: number; food: number; activities: number; total: number;
  budget: number; fits: boolean; swapped: number;
  notes: Reason[];
};
export type BuildInput = { destination: string; nights: number; interests: string[]; budget: number; people?: number; flight?: number };

function slotsFor(i: number, days: number): Slot[] {
  if (days === 1) return ['morning', 'afternoon', 'evening'];
  if (i === 0) return ['afternoon', 'evening'];
  if (i === days - 1) return ['morning', 'afternoon'];
  return ['morning', 'afternoon', 'evening'];
}

function compose(d: DestMeta, nights: number, people: number, order: InterestKey[]): Day[] {
  const days = nights + 1, used = new Set<string>(), count: Partial<Record<InterestKey, number>> = {};
  let k = 0;
  const out: Day[] = [];
  for (let i = 0; i < days; i++) {
    const items: Item[] = [];
    for (const slot of slotsFor(i, days)) {
      let chosen: Item | null = null;
      for (let tries = 0; tries < order.length && !chosen; tries++) {
        const key = order[(k + tries) % order.length];
        const pool = ACTS[key].filter((a) => a.slot === slot && !used.has(key + a.title));
        if (pool.length) {
          const a = pool[(count[key] ?? 0) % pool.length];
          used.add(key + a.title); count[key] = (count[key] ?? 0) + 1;
          chosen = { slot, title: a.title, cost: Math.round(a.cost * scale(d) * people), interest: key };
        }
      }
      k++;
      items.push(chosen ?? { slot, title: FREE[slot], cost: 0, free: true });
    }
    items.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    out.push({ n: i + 1, items });
  }
  return out;
}

const sumActs = (days: Day[]) => days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.cost, 0), 0);

export function buildItinerary(inp: BuildInput): Itinerary {
  const d = destMeta(inp.destination) ?? DEST_META[0];
  const nights = Math.max(0, Math.round(inp.nights)), people = Math.max(1, inp.people ?? 1), days = nights + 1;
  const budget = Math.max(0, inp.budget);
  const flightEach = inp.flight ?? d.flight, flight = flightEach * people;
  const food = Math.round(d.daily * people * days);
  // ordine degli interessi: quelli scelti, più apprezzati dalla destinazione per primi; completo con i punti forti della destinazione
  const sel = inp.interests.filter((x): x is InterestKey => (INTEREST_KEYS as string[]).includes(x));
  const wOf = (k: InterestKey) => d.w[INTEREST_KEYS.indexOf(k)];
  const order = [...sel].sort((a, b) => wOf(b) - wOf(a));
  if (order.length < 3) INTEREST_KEYS.filter((k) => !order.includes(k)).sort((a, b) => wOf(b) - wOf(a)).slice(0, 3 - order.length).forEach((k) => order.push(k));

  const notes: Reason[] = [{ t: 'Prezzi indicativi, verifica prima di prenotare', a: [] }];
  let chosen: { level: Level; days: Day[]; swapped: number; total: number; fits: boolean } | null = null;
  const base = compose(d, nights, people, order);
  const totalOf = (level: Level, ds: Day[]) => Math.round(flight + lodgingPerNight(d, level, people) * nights + food + sumActs(ds));
  for (const level of LEVELS) {
    const total = totalOf(level, base);
    if (total <= budget) { chosen = { level, days: base, swapped: 0, total, fits: true }; break; }
  }
  if (!chosen) {
    // livello più economico + sostituisco le voci a pagamento più care con alternative gratuite
    const ds: Day[] = base.map((x) => ({ n: x.n, items: x.items.map((i) => ({ ...i })) }));
    let swapped = 0;
    const flat = ds.flatMap((x) => x.items).filter((i) => i.cost > 0).sort((a, b) => b.cost - a.cost);
    let total = totalOf('budget', ds);
    for (const it of flat) {
      if (total <= budget) break;
      it.title = FREE[it.slot]; it.cost = 0; it.free = true; it.interest = undefined; swapped++;
      total = totalOf('budget', ds);
    }
    chosen = { level: 'budget', days: ds, swapped, total, fits: total <= budget };
    if (swapped) notes.push({ t: 'Per restare nel budget ho sostituito {0} attività a pagamento con alternative gratuite', a: [String(swapped)] });
  }
  const { level, days: finalDays } = chosen;
  const lodgingTotal = lodgingPerNight(d, level, people) * nights;
  // nome città nei titoli
  const dd = finalDays.map((x) => ({ n: x.n, items: x.items.map((i) => ({ ...i, title: i.title.replace('{city}', d.name) })) }));
  if (level === 'budget' && chosen.fits) notes.push({ t: 'Alloggio economico scelto per rientrare nel budget', a: [] });
  if (!chosen.fits) {
    notes.push({ t: 'Il viaggio supera il budget di circa {0}', a: ['$' + Math.round(chosen.total - budget)] });
    // alternative più economiche
    let n = nights;
    while (n > 0) { n--; const dm = destMeta(d.id)!; if (Math.round(flight + lodgingPerNight(dm, 'budget', people) * n + dm.daily * people * (n + 1)) <= budget) break; }
    if (n < nights && n >= 1) notes.push({ t: 'Alternativa: riduci il viaggio a {0} notti', a: [String(n)] });
    const cheaper = DEST_META.filter((x) => x.id !== d.id).map((x) => ({ x, c: estimateCost(x, nights, people, 'budget') })).sort((a, b) => a.c - b.c)[0];
    if (cheaper && cheaper.c < chosen.total) notes.push({ t: 'Alternativa più economica: {0} (circa {1})', a: [cheaper.x.name, '$' + cheaper.c] });
    notes.push({ t: 'Oppure aumenta il budget o scegli date in bassa stagione', a: [] });
  }
  return {
    destId: d.id, destName: d.name, nights, people, level, days: dd,
    lodging: { perNight: lodgingPerNight(d, level, people), total: lodgingTotal, level },
    flight, flightEach, food, activities: sumActs(dd), total: chosen.total, budget, fits: chosen.fits, swapped: chosen.swapped, notes,
  };
}

// ---------------------------------------------------------------- calendario e budget

export const addDaysKey = (start: string, n: number): string => {
  const [y, m, dd] = start.split('-').map(Number);
  const d = new Date(y, m - 1, dd + n, 12);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const nightsBetween = (start: string, end: string): number => {
  const a = new Date(start + 'T12:00:00').getTime(), b = new Date(end + 'T12:00:00').getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86400000)) : 0;
};
export const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T12:00:00').getTime());
export const tripId = (destId: string, start: string) => `${destId}-${start}`;

export type TripEvent = { day: string; time: string; title: string; dur: number; place: string; ref: string };
/** Eventi di calendario di un itinerario (ref 'trip:<id>' per evitare duplicati). */
export function tripEvents(it: Itinerary, start: string): TripEvent[] {
  const ref = 'trip:' + tripId(it.destId, start);
  const evs: TripEvent[] = [];
  it.days.forEach((d, i) => d.items.forEach((x) => evs.push({ day: addDaysKey(start, i), time: SLOT_TIME[x.slot], title: `${it.destName}: ${x.title}`, dur: 120, place: it.destName, ref })));
  return evs;
}

export type BudgetInput = { balance: number; avgNet: number; avgExpense: number; emergencySaved: number; monthsUntil?: number };
export type BudgetSuggestion = { amount: number; efTarget: number; efSaved: number; efOk: boolean };
/** Budget prudente: una parte del saldo + il risparmio medio dei mesi che mancano al viaggio. Il fondo emergenza (3 mesi di spese) non viene mai toccato. */
export function suggestBudget(i: BudgetInput): BudgetSuggestion {
  const months = Math.min(6, Math.max(1, i.monthsUntil ?? 1));
  const efTarget = Math.round(Math.max(0, i.avgExpense) * 3), efSaved = Math.max(0, i.emergencySaved);
  const efOk = efSaved >= efTarget;
  const fromBalance = Math.max(0, i.balance) * (efOk ? 0.3 : 0.15);
  const fromSavings = Math.max(0, i.avgNet) * months * 0.8;
  const amount = Math.round((fromBalance + fromSavings) / 10) * 10;
  return { amount, efTarget, efSaved, efOk };
}
