import { makeRecording } from '@/lib/recordings';
import { useLive } from '@/store/live';
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

const NAMES = ['Giulia Moretti', 'Marco Valli', 'Elena Serra', 'Tommaso Vitali', 'Federica Lorenzi', 'Sophie Marchand', 'Luca Bernasconi', 'Chiara Bianchi', 'Andrea Fontana', 'Sara Ferrari', 'Paolo Gianini', 'Martina Rossi', 'Davide Pellegrini', 'Alice Conti', 'Nicola Galli', 'Valentina Riva', 'Matteo Colombo', 'Irene Lombardi', 'Stefano Greco', 'Laura Mancini', 'Simone Costa', 'Elisa Barbieri', 'Fabio Moretti', 'Anna Santoro', 'Gabriele Rinaldi', 'Silvia Caruso', 'Roberto Ferri', 'Marta Gatti', 'Daniele Leone', 'Giorgia Sala', 'Emanuele Testa', 'Beatrice Villa', 'Riccardo Fabbri', 'Camilla Serra', 'Filippo Neri', 'Veronica Basile', 'Lorenzo Marini', 'Ilaria Monti', 'Pietro Orlando', 'Noemi Cattaneo'];

/** Demo: per ogni mio seminario l'elenco degli iscritti ha tanti nomi quanti ne dice il contatore (con chi ha pagato e quanto). I dati veri non si toccano. */
export function ensureSampleParticipants(me: string, demo: boolean): void {
  if (!demo) return;
  const st = useNet.getState();
  const cur = { ...(st.participants ?? {}) };
  let changed = false;
  for (const sem of st.seminars) {
    if (sem.host !== me || !sem.joined) continue;
    const key = `seminar:${sem.id}`;
    const list = [...(cur[key] ?? [])];
    if (list.length >= sem.joined) continue;
    const have = new Set(list.map((x) => x.name));
    const base = (sem.ts ?? Date.now() - 5 * 86400000);
    for (let i = 0; list.length < sem.joined && i < NAMES.length * 2; i++) {
      const name = NAMES[(i + sem.id) % NAMES.length];
      if (have.has(name) || name === me) continue;
      have.add(name);
      list.push({ name, paid: sem.price, paidAt: Math.min(Date.now() - 3600000, base + (list.length + 1) * 6 * 3600000) });
    }
    cur[key] = list.sort((a, b) => b.paidAt - a.paidAt);
    changed = true;
  }
  if (changed) useNet.setState({ participants: cur });
}

/** Demo: due registrazioni di esempio (una mia, una di un seminario già concluso di un'altra persona) per vedere profilo, accesso e blocchi. Senza video: sono segnaposto. */
export function ensureSampleRecordings(me: string, demo: boolean): void {
  if (!demo) return;
  const live = useLive.getState();
  if ((live.recordings ?? []).length) return;
  const sems = useNet.getState().seminars;
  const mine = sems.find((x) => x.host === me);
  const past = sems.find((x) => x.host !== me && (x.startsAt ?? Infinity) < Date.now());
  if (mine) live.addRecording(makeRecording({ key: `seminar:${mine.id}`, kind: 'seminar', title: mine.title, host: me, startedAt: Date.now() - 6 * 86400000, endedAt: Date.now() - 6 * 86400000 + (mine.durationMin ?? 60) * 60000, access: 'buyers' }));
  if (past) live.addRecording(makeRecording({ key: `seminar:${past.id}`, kind: 'seminar', title: past.title, host: past.host, startedAt: past.startsAt ?? Date.now() - 86400000, endedAt: (past.startsAt ?? Date.now() - 86400000) + (past.durationMin ?? 60) * 60000, access: 'buyers' }));
}
