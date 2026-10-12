import { useNet } from '@/store/network';
import type { Product } from '@/lib/shop';

/** Annunci di esempio di due negozi (Anna Conti, Roberto Sala): così il Marketplace ha prodotti da vedere fin dall'inizio. */
export function sampleProducts(): Product[] {
  const mk = (shop: string, items: [string, string, number, number][]) => items.map(([name, desc, price, stock], i) => ({ id: `ds-${shop.replace(/\W/g, '')}-${i}`, shop, name, desc, price, stock, color: ['#6c8cff', '#e0866b', '#4fb58a', '#c9a24a', '#a46bd6', '#4fa7c9'][i % 6], ts: Date.now() - i * 86400000 }));
  return [
    ...mk('Anna Conti', [
      ['Scarpe da corsa leggere', 'Tomaia traspirante e suola ammortizzata: pensate per le uscite di tutti i giorni.', 120, 8],
      ['Calze tecniche (3 paia)', 'Cotone e fibra elastica, senza cuciture che danno fastidio.', 18, 30],
      ['Borraccia in acciaio 750 ml', 'Mantiene fresco per 24 ore, tappo antigoccia.', 22, 15],
      ['Zaino da corsa 10 L', 'Due tasche frontali per borracce e tasca impermeabile per il telefono.', 65, 5],
    ]),
    ...mk('Roberto Sala', [
      ['Quaderno agenda 2027', 'Una pagina per giorno, copertina rigida e segnalibro.', 24, 40],
      ['Penna stilografica', 'Pennino medio, ricaricabile con cartucce standard.', 35, 12],
      ['Set di 6 evidenziatori', 'Colori tenui, non macchiano il retro del foglio.', 9, 60],
    ]),
  ];
}

/** Una sola volta per telefono: aggiunge gli annunci di esempio (non tocca quelli già presenti). */
export function ensureSampleShops(): void {
  const st = useNet.getState();
  if (st.sampleShops) return;
  const have = new Set((st.products ?? []).map((p) => p.id));
  useNet.setState({ products: [...(st.products ?? []), ...sampleProducts().filter((p) => !have.has(p.id))], sampleShops: true });
}
