import { hashStr, mulberry32, monthNames } from '@/lib/format';

export type Destination = { id: string; name: string; type: 'city' | 'summer' | 'winter' };
export const destinations: Destination[] = [
  { id: 'zurigo', name: 'Zurigo', type: 'city' }, { id: 'ginevra', name: 'Ginevra', type: 'city' }, { id: 'lugano', name: 'Lugano', type: 'summer' },
  { id: 'lucerna', name: 'Lucerna', type: 'summer' }, { id: 'berna', name: 'Berna', type: 'city' }, { id: 'basilea', name: 'Basilea', type: 'city' },
  { id: 'interlaken', name: 'Interlaken', type: 'summer' }, { id: 'zermatt', name: 'Zermatt', type: 'winter' }, { id: 'stmoritz', name: 'St. Moritz', type: 'winter' },
  { id: 'montreux', name: 'Montreux', type: 'summer' }, { id: 'parigi', name: 'Parigi', type: 'city' }, { id: 'newyork', name: 'New York', type: 'city' },
];

export type Hotel = { name: string; tier: 'comfort' | 'speed' | 'budget'; price: number; rating: number; reviews: number; distance: number };
export const hotelPool: Hotel[] = [
  { name: 'Grand Palazzo', tier: 'comfort', price: 420, rating: 4.9, reviews: 210, distance: 1.5 },
  { name: 'Ocean View Suites', tier: 'comfort', price: 310, rating: 4.9, reviews: 340, distance: 0.8 },
  { name: 'The Fern Boutique', tier: 'comfort', price: 245, rating: 4.8, reviews: 512, distance: 1.2 },
  { name: 'Downtown Central', tier: 'speed', price: 135, rating: 4.4, reviews: 610, distance: 0.3 },
  { name: 'Quick Stay Express', tier: 'speed', price: 110, rating: 4.3, reviews: 430, distance: 0.4 },
  { name: 'Central Budget Inn', tier: 'budget', price: 79, rating: 4.1, reviews: 890, distance: 2.1 },
  { name: 'Smart Saver Rooms', tier: 'budget', price: 58, rating: 3.9, reviews: 670, distance: 2.8 },
  { name: "Traveler's Hub Hostel", tier: 'budget', price: 45, rating: 4.0, reviews: 1200, distance: 1.9 },
];

export const travelStyles = [{ id: 'budget', label: 'Risparmio' }, { id: 'comfort', label: 'Comfort' }, { id: 'speed', label: 'Ottimizza tempo' }] as const;
export const styleLabel = (s: string) => travelStyles.find((x) => x.id === s)?.label ?? s;

/** Mese (1-12) a `off` mesi da quello corrente */
export const monthNumFromOffset = (off: number) => ((new Date().getMonth() + off) % 12) + 1;
export const monthLabel = (off: number) => monthNames[monthNumFromOffset(off) - 1];
export const yearLabel = (off: number) => { const d = new Date(); d.setMonth(d.getMonth() + off); return d.getFullYear(); };

export function seasonMultiplier(type: Destination['type'], m: number): number {
  const winter = [12, 1, 2, 3], summer = [6, 7, 8], low = [11];
  if (type === 'winter') return winter.includes(m) ? 1.35 : summer.includes(m) ? 0.8 : low.includes(m) ? 0.75 : 1.0;
  if (type === 'summer') return summer.includes(m) ? 1.3 : winter.includes(m) ? 0.85 : low.includes(m) ? 0.8 : 1.0;
  return winter.includes(m) ? 1.05 : summer.includes(m) ? 1.1 : low.includes(m) ? 0.85 : 1.0;
}

export function hotelScore(h: Hotel, style: string): number {
  let base = h.tier === style ? 68 : 38;
  if (style === 'comfort') base += h.rating * 6.3;
  if (style === 'budget') base += Math.max(0, 1 - h.price / 450) * 31;
  if (style === 'speed') base += Math.max(0, 1 - h.distance / 3) * 31;
  return Math.max(1, Math.min(99, Math.round(base)));
}

export const topicToCity: Record<string, string> = { Business: 'zurigo', Finance: 'zurigo', Study: 'berna', Fitness: 'interlaken', Health: 'interlaken', Mind: 'montreux', Casa: 'lucerna', Viaggi: 'zermatt', Legal: 'ginevra', General: 'lugano' };

export function genFlight(cityId: string, monthOffset: number) {
  const rng = mulberry32(hashStr(`flight-${cityId}-${monthOffset}`));
  return { price: Math.round(60 + rng() * 180), outDep: 7 + Math.floor(rng() * 4), duration: 45 + Math.floor(rng() * 30) };
}

export const activitiesByStyle: Record<string, string[]> = {
  comfort: ['Colazione con calma in hotel', 'Visita guidata ai luoghi simbolo', 'Pranzo in un ristorante consigliato', 'Pomeriggio libero o spa', 'Cena in un locale caratteristico'],
  budget: ['Colazione veloce', 'Giro a piedi tra i quartieri gratuiti', 'Pranzo in un mercato locale', 'Museo con ingresso gratuito o scontato', 'Cena economica consigliata'],
  speed: ['Sveglia presto, colazione rapida', '2-3 attrazioni principali in mattinata', 'Pranzo veloce vicino al prossimo punto', 'Altre 2 attrazioni nel pomeriggio', 'Cena e riposo per il giorno dopo'],
};
