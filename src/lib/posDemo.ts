import { buildPayLink } from './payments.ts';

/** Casse di esempio (simulano un POS): ognuna mostra un QR con negozio, cosa si compra e prezzo in LifePoints. */
export type PosItem = { id: string; shop: string; item: string; lp: number; place: string };
export const POS_ITEMS: PosItem[] = [
  { id: 'caffe', shop: 'Bar Centrale', item: 'Cappuccino e cornetto', lp: 6, place: 'Lugano' },
  { id: 'cena', shop: 'Ristorante Lago', item: 'Cena per due', lp: 84, place: 'Como' },
  { id: 'sport', shop: 'Sport Vallemaggia', item: 'Scarpe da corsa', lp: 129, place: 'Locarno' },
  { id: 'spesa', shop: 'Mercato Verde', item: 'Spesa settimanale', lp: 47, place: 'Bellinzona' },
];
export const posLink = (p: PosItem) => buildPayLink({ to: p.shop, amount: p.lp, mode: 'lp', item: p.item });
