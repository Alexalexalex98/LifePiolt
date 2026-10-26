/**
 * La casa di Theia (modulo PURO): stanze da arredare, mobili da comprare con le «stelline», mobili che col tempo si consumano e case più grandi.
 * Le stelline si GUADAGNANO facendo le cose vere dell'app (non si comprano con soldi veri, non sono LifePoints, non si convertono): niente acquisti, niente pressioni.
 * L'usura è solo estetica: un mobile consumato si può riparare o cambiare, ma non fa mai stare male Theia né toglie nulla.
 */
export type BaseKind = 'sofa' | 'bed' | 'table' | 'desk' | 'bench' | 'rug' | 'plant' | 'lamp' | 'art' | 'shelf' | 'wardrobe';
/** Mobili e oggetti in più, tutti in vista frontale (disegnati in src/components/pet/extraArt.tsx). */
export type ExtraKind = 'armchair' | 'chair' | 'pouf' | 'nightstand' | 'sidetable' | 'tvstand' | 'dresser' | 'stool' | 'basket' | 'aquarium' | 'dogbed' | 'fridge' | 'bookcase' | 'coatrack' | 'guitar' | 'cattree' | 'piano' | 'mirror' | 'clock' | 'poster' | 'wtv' | 'curtain' | 'sconce';
export type Kind = BaseKind | ExtraKind;
export const EXTRA_KINDS: ExtraKind[] = ['armchair', 'chair', 'pouf', 'nightstand', 'sidetable', 'tvstand', 'dresser', 'stool', 'basket', 'aquarium', 'dogbed', 'fridge', 'bookcase', 'coatrack', 'guitar', 'cattree', 'piano', 'mirror', 'clock', 'poster', 'wtv', 'curtain', 'sconce'];
export const isExtra = (k: Kind): k is ExtraKind => (EXTRA_KINDS as string[]).includes(k);
/** Nella stessa stanza, due oggetti della stessa zona occupano lo stesso punto: il nuovo prende il posto del vecchio. */
const ZONE: Partial<Record<Kind, string>> = {
  armchair: 'B', chair: 'B', pouf: 'B', nightstand: 'B', sidetable: 'B', tvstand: 'B', dresser: 'B', stool: 'B', basket: 'B', aquarium: 'B', dogbed: 'B',
  plant: 'C', wardrobe: 'C', fridge: 'C', bookcase: 'C', coatrack: 'C', guitar: 'C', cattree: 'C', piano: 'C',
  mirror: 'W', clock: 'W', poster: 'W', wtv: 'W',
};
export const zoneOf = (k: Kind): string => ZONE[k] ?? k;
export type Quality = 0 | 1 | 2;
export type RoomId = 'living' | 'bedroom' | 'kitchen' | 'studio' | 'terrace';
export const ROOMS: { id: RoomId; name: string; slots: Kind[] }[] = [
  { id: 'living', name: 'Salotto', slots: ['sofa', 'rug', 'plant', 'lamp', 'art', 'shelf', 'armchair', 'pouf', 'sidetable', 'tvstand', 'basket', 'aquarium', 'dogbed', 'bookcase', 'guitar', 'cattree', 'piano', 'coatrack', 'wtv', 'mirror', 'clock', 'poster', 'sconce', 'curtain'] },
  { id: 'bedroom', name: 'Camera', slots: ['bed', 'wardrobe', 'rug', 'lamp', 'art', 'nightstand', 'dresser', 'chair', 'stool', 'basket', 'coatrack', 'mirror', 'clock', 'poster', 'sconce', 'curtain'] },
  { id: 'kitchen', name: 'Cucina', slots: ['table', 'rug', 'plant', 'art', 'shelf', 'chair', 'stool', 'basket', 'sidetable', 'fridge', 'coatrack', 'clock', 'poster', 'curtain'] },
  { id: 'studio', name: 'Studio', slots: ['desk', 'shelf', 'lamp', 'plant', 'art', 'chair', 'stool', 'dresser', 'pouf', 'bookcase', 'guitar', 'piano', 'clock', 'poster', 'mirror', 'sconce', 'curtain'] },
  { id: 'terrace', name: 'Terrazza', slots: ['bench', 'plant', 'lamp', 'rug', 'art', 'chair', 'stool', 'sidetable', 'basket', 'dogbed', 'cattree', 'clock'] },
];
export const KIND_NAME: Record<Kind, string> = { sofa: 'Divano', bed: 'Letto', table: 'Tavolo', desk: 'Scrivania', bench: 'Panchina', rug: 'Tappeto', plant: 'Pianta', lamp: 'Lampada', art: 'Quadro', shelf: 'Mensola', wardrobe: 'Armadio',
  armchair: 'Poltrona', chair: 'Sedia', pouf: 'Pouf', nightstand: 'Comodino', sidetable: 'Tavolino', tvstand: 'Mobile TV', dresser: 'Cassettiera', stool: 'Sgabello', basket: 'Cesta', aquarium: 'Acquario', dogbed: 'Cuccia', fridge: 'Frigorifero', bookcase: 'Libreria', coatrack: 'Appendiabiti', guitar: 'Chitarra', cattree: 'Tiragraffi', piano: 'Pianoforte', mirror: 'Specchio', clock: 'Orologio', poster: 'Poster', wtv: 'Televisore', curtain: 'Tende', sconce: 'Applique' };
export const QUALITY_NAME = ['Semplice', 'Bello', 'Di pregio'] as const;
const BASE_PRICE: Record<Kind, number> = { sofa: 40, bed: 40, table: 30, desk: 30, bench: 25, rug: 20, plant: 12, lamp: 15, art: 15, shelf: 18, wardrobe: 35,
  armchair: 28, chair: 14, pouf: 12, nightstand: 16, sidetable: 14, tvstand: 30, dresser: 32, stool: 10, basket: 8, aquarium: 34, dogbed: 18, fridge: 38, bookcase: 36, coatrack: 14, guitar: 26, cattree: 24, piano: 60, mirror: 16, clock: 12, poster: 10, wtv: 32, curtain: 20, sconce: 12 };
const QMULT = [1, 3, 8], DURABILITY_DAYS = [14, 35, 80];

export type Item = { id: string; kind: Kind; quality: Quality; name: string; price: number; days: number };
export const itemId = (k: Kind, q: Quality) => `${k}:${q}`;
export const ITEMS: Item[] = (Object.keys(KIND_NAME) as Kind[]).flatMap((k) => ([0, 1, 2] as Quality[]).map((q) => ({ id: itemId(k, q), kind: k, quality: q, name: `${KIND_NAME[k]} ${QUALITY_NAME[q].toLowerCase()}`, price: BASE_PRICE[k] * QMULT[q]!, days: DURABILITY_DAYS[q]! })));
export const itemOf = (id: string) => ITEMS.find((i) => i.id === id);

/** Case: ogni salto dà più stanze. Si sale di casa con le stelline e con il livello di Theia. */
export type House = { tier: number; name: string; rooms: RoomId[]; price: number; level: number };
export const HOUSES: House[] = [
  { tier: 0, name: 'Monolocale', rooms: ['living'], price: 0, level: 1 },
  { tier: 1, name: 'Bilocale', rooms: ['living', 'bedroom'], price: 400, level: 3 },
  { tier: 2, name: 'Appartamento', rooms: ['living', 'bedroom', 'kitchen'], price: 1200, level: 6 },
  { tier: 3, name: 'Attico', rooms: ['living', 'bedroom', 'kitchen', 'studio', 'terrace'], price: 3000, level: 10 },
];

export type Owned = { uid: string; item: string; boughtAt: number; repairedAt?: number };
export type HomeState = { coins: number; owned: Owned[]; placed: Record<string, Record<string, string>>; tier: number };
export const newHome = (): HomeState => ({ coins: 30, owned: [], placed: {}, tier: 0 });

/** Base delle stelline per ogni cosa. L'utente NON vede mai quanto vale cosa: così non si fa solo la cosa che rende di più. */
export const COINS: Record<string, number> = { snack: 3, water: 2, fit: 5, love: 2, pet: 0, activity: 4, visit: 1 };
export type EarnLog = { k: string; ts: number }[];
/**
 * Quante stelline arrivano ADESSO per questa cosa: calano se si ripete sempre la stessa (oggi e nell'ultima settimana) e c'è un piccolo premio
 * per la varietà. Nessun numero viene mostrato: conta fare cose diverse, non inseguire il massimo.
 */
export function rewardFor(kind: string, log: EarnLog, now: number): number {
  const base = COINS[kind] ?? 0; if (base <= 0) return 0;
  const day = 86400000, d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const same = log.filter((x) => x.k === kind);
  const today = same.filter((x) => x.ts >= d0.getTime()).length, week = same.filter((x) => x.ts >= now - 7 * day).length;
  const kindsToday = new Set(log.filter((x) => x.ts >= d0.getTime()).map((x) => x.k)).size;
  const factor = Math.max(0.12, Math.pow(0.8, today)) * Math.max(0.35, 1 - 0.035 * week);
  const variety = kindsToday >= 3 ? 1 : 0;
  return Math.max(0, Math.round(base * factor) + variety);
}

const DAY = 86400000;
/** Usura in % (0 = nuovo, 100 = da cambiare). Parte dall'acquisto o dall'ultima riparazione. */
export function wearOf(o: Owned, now: number): number {
  const it = itemOf(o.item); if (!it) return 0;
  return Math.min(100, Math.round(((now - (o.repairedAt ?? o.boughtAt)) / DAY / it.days) * 100));
}
export const repairCost = (it: Item) => Math.ceil(it.price * 0.4);

export type Result = { ok: boolean; state: HomeState; reason?: string };
const uid = (now: number, n: number) => `${now.toString(36)}${n}`;

export function buy(s: HomeState, id: string, now: number): Result {
  const it = itemOf(id);
  if (!it) return { ok: false, state: s, reason: 'Oggetto non trovato' };
  if (s.coins < it.price) return { ok: false, state: s, reason: `Ti servono ${it.price - s.coins} stelline in più` };
  return { ok: true, state: { ...s, coins: s.coins - it.price, owned: [...s.owned, { uid: uid(now, s.owned.length), item: id, boughtAt: now }] } };
}
export function repair(s: HomeState, ownedUid: string, now: number): Result {
  const o = s.owned.find((x) => x.uid === ownedUid), it = o && itemOf(o.item);
  if (!o || !it) return { ok: false, state: s, reason: 'Oggetto non trovato' };
  const c = repairCost(it);
  if (s.coins < c) return { ok: false, state: s, reason: `Ti servono ${c - s.coins} stelline in più` };
  return { ok: true, state: { ...s, coins: s.coins - c, owned: s.owned.map((x) => (x.uid === ownedUid ? { ...x, repairedAt: now } : x)) } };
}
/** Mette un oggetto nello slot della stanza (un oggetto sta in una sola stanza alla volta). */
export function place(s: HomeState, room: RoomId, ownedUid: string): Result {
  const o = s.owned.find((x) => x.uid === ownedUid), it = o && itemOf(o.item);
  const r = ROOMS.find((x) => x.id === room);
  if (!o || !it || !r) return { ok: false, state: s, reason: 'Oggetto non trovato' };
  if (!r.slots.includes(it.kind)) return { ok: false, state: s, reason: 'Non c\'è posto per questo oggetto qui' };
  const placed: HomeState['placed'] = {};
  for (const [rid, slots] of Object.entries(s.placed)) placed[rid] = Object.fromEntries(Object.entries(slots).filter(([, u]) => u !== ownedUid));
  /* se nella stanza c'e' gia' un oggetto nello stesso punto, lascia il posto al nuovo */
  const here = Object.fromEntries(Object.entries(placed[room] ?? {}).filter(([k]) => k === it.kind || zoneOf(k as Kind) !== zoneOf(it.kind)));
  placed[room] = { ...here, [it.kind]: ownedUid };
  return { ok: true, state: { ...s, placed } };
}
export function unplace(s: HomeState, room: RoomId, kind: Kind): HomeState {
  const slots = { ...(s.placed[room] ?? {}) }; delete slots[kind];
  return { ...s, placed: { ...s.placed, [room]: slots } };
}
/** Vende (cambia) un oggetto: ne ritorna un quarto del prezzo, così cambiare non è mai una perdita secca. */
export function sell(s: HomeState, ownedUid: string): Result {
  const o = s.owned.find((x) => x.uid === ownedUid), it = o && itemOf(o.item);
  if (!o || !it) return { ok: false, state: s, reason: 'Oggetto non trovato' };
  const placed: HomeState['placed'] = {};
  for (const [rid, slots] of Object.entries(s.placed)) placed[rid] = Object.fromEntries(Object.entries(slots).filter(([, u]) => u !== ownedUid));
  return { ok: true, state: { ...s, coins: s.coins + Math.floor(it.price / 4), owned: s.owned.filter((x) => x.uid !== ownedUid), placed } };
}
export function upgrade(s: HomeState, level: number): Result {
  const next = HOUSES[s.tier + 1];
  if (!next) return { ok: false, state: s, reason: 'Hai già la casa più grande' };
  if (level < next.level) return { ok: false, state: s, reason: `Serve il livello ${next.level} di Theia` };
  if (s.coins < next.price) return { ok: false, state: s, reason: `Ti servono ${next.price - s.coins} stelline in più` };
  return { ok: true, state: { ...s, coins: s.coins - next.price, tier: next.tier } };
}
export const houseOf = (s: HomeState) => HOUSES[s.tier] ?? HOUSES[0]!;
