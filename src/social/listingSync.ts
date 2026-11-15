import { loadListings, publishListing, removeListing, updateListing } from '@/lib/peopleApi';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { usePrefs } from '@/store/prefs';

import { authorOf, diffMine, mergeListings, toListing, type Vis } from './listings.ts';
import { socialSession } from './socialApi';

/**
 * Collega idee, servizi e seminari al server, ognuno con il suo pubblico (tutti / solo chi mi segue / tutti tranne chi mi segue):
 *  - quello che crei qui e ti appartiene viene pubblicato online;
 *  - se lo modifichi, cambia anche sul server; se lo elimini, si toglie;
 *  - quello degli altri che il server ti lascia vedere arriva nelle tue liste (e sparisce se l'autore lo chiude a te).
 * In demo, senza account o senza server non succede niente. Gli elementi di esempio restano sul telefono.
 */
type Item = Record<string, unknown> & { remoteId?: string; authorId?: string; visibility?: Vis };
const KINDS = [['idea', 'ideas'], ['seminar', 'seminars'], ['service', 'providers']] as const;
const prev: Record<string, Item[]> = {};
const publishing = new Set<string>();
const idOf = (kind: string, it: Item) => (kind === 'service' ? String(it.name) : String(it.id));

/** Le liste come le vedo io; per i servizi la scheda di dettaglio (descrizione, cosa si ottiene...) sta in un'altra mappa e si unisce qui. */
const view = (key: 'ideas' | 'seminars' | 'providers'): Item[] => {
  const n = useNet.getState(); const rows = n[key] as unknown as Item[];
  return key === 'providers' ? rows.map((p) => ({ ...p, info: (n.serviceInfo ?? {})[String(p.name)] })) : rows;
};
export const snapshotListings = () => { for (const [, key] of KINDS) prev[key] = view(key); };

/** Pubblica, aggiorna e toglie quello che è cambiato sul telefono (solo i miei contenuti). */
export async function syncListings(): Promise<void> {
  if (useApp.getState().demo) { snapshotListings(); return; }
  const s = await socialSession(); if (!s) return;
  for (const [kind, key] of KINDS) {
    const cur = view(key); const d = diffMine(prev[key] ?? cur, cur, kind, s.name);
    prev[key] = cur;
    for (const it of d.publish) {
      const k = `${kind}:${idOf(kind, it)}`; if (publishing.has(k)) continue; publishing.add(k);
      const l = toListing(kind, it);
      void publishListing({ ...l, audience: it.visibility ?? usePrefs.getState().listingAudience }).then((r) => {
        publishing.delete(k); if (!r.ok) return;
        const rows = useNet.getState()[key] as unknown as Item[];
        const next = rows.map((x) => (idOf(kind, x) === idOf(kind, it) && !x.remoteId && authorOf(kind, x) === s.name ? { ...x, remoteId: r.data.id, authorId: r.data.author_id } : x));
        useNet.getState().patch({ [key]: next } as never); prev[key] = view(key);
      });
    }
    for (const it of d.update) { const l = toListing(kind, it); void updateListing(it.remoteId as string, { title: l.title, body: l.body, payload: l.payload, audience: it.visibility ?? 'public' }); }
    for (const id of d.remove) void removeListing(id);
  }
}

/** Scarica i contenuti che il server mostra a questo utente e li unisce alle liste. */
export async function pullListings(): Promise<void> {
  if (useApp.getState().demo) return;
  const s = await socialSession(); if (!s) return;
  const r = await loadListings(); if (!r.ok) return;
  const net = useNet.getState();
  for (const [kind, key] of KINDS) {
    const cur = net[key] as unknown as Item[]; let merged = mergeListings(cur, r.data, kind, s.name);
    if (key === 'providers') {
      // la scheda di dettaglio dei servizi degli altri va nella mappa dei dettagli, non dentro l'elemento
      const infos: Record<string, unknown> = {};
      merged = merged.map((p) => { if (p.info && authorOf('service', p) !== s.name) { infos[String(p.name)] = p.info; const { info: _i, ...rest } = p as Item & { info?: unknown }; void _i; return rest as Item; } return p; });
      if (Object.keys(infos).length) useNet.getState().patch({ serviceInfo: { ...(useNet.getState().serviceInfo ?? {}), ...infos } } as never);
    }
    if (JSON.stringify(merged) !== JSON.stringify(cur)) { useNet.getState().patch({ [key]: merged } as never); prev[key] = view(key); }
  }
}
