import { Asset } from 'expo-asset';
import { useEffect, useRef } from 'react';

import { makeStory, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useNet, type Post } from '@/store/network';

const M = {
  pizza: require('../../assets/seed/pizza.jpg'), galeone: require('../../assets/seed/galeone.jpg'), colazione: require('../../assets/seed/colazione.jpg'),
  autoNotte: require('../../assets/seed/auto-notte.jpg'), barSera: require('../../assets/seed/bar-sera.jpg'), aperitivo: require('../../assets/seed/aperitivo.jpg'),
  cappuccino: require('../../assets/seed/cappuccino.jpg'), freccette: require('../../assets/seed/freccette.jpg'), birra: require('../../assets/seed/birra.jpg'),
  voloNotte: require('../../assets/seed/volo-notte.mp4'), spiaggia: require('../../assets/seed/spiaggia-tramonto.mp4'), roma: require('../../assets/seed/roma-tramonto.mp4'),
  spazio: require('../../assets/seed/spazio.mp4'), colosseo: require('../../assets/seed/colosseo.mp4'), positano: require('../../assets/seed/positano.mp4'), newYork: require('../../assets/seed/new-york.mp4'),
} as const;
type Key = keyof typeof M;

const H = 3600000;
/** Post di altre persone con foto e video, per vedere Home e Swipe pieni. Solo in modalità demo; i tuoi li pubblichi tu. */
const POSTS: { id: number; author: string; tag: string; media: 'photo' | 'video'; k: Key; text: string; h: number; likes: number }[] = [
  { id: 201, author: 'Davide R.', tag: 'Viaggi', media: 'video', k: 'voloNotte', text: 'Atterraggio al tramonto: la città si accende sotto l’ala.', h: 2, likes: 52 },
  { id: 101, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'pizza', text: 'Cena da pizzeria: margherita contro salame piccante. Voi quale scegliete?', h: 3, likes: 71 },
  { id: 202, author: 'Federica L.', tag: 'Viaggi', media: 'video', k: 'spiaggia', text: 'Tramonto rosa sulla spiaggia: palme, onde e niente fretta.', h: 4, likes: 88 },
  { id: 102, author: 'Davide R.', tag: 'Viaggi', media: 'photo', k: 'galeone', text: 'Sul ponte dei cannoni di un vecchio galeone: secchi di legno, funi e palle di cannone ancora al loro posto.', h: 5, likes: 39 },
  { id: 203, author: 'Marco T.', tag: 'Viaggi', media: 'video', k: 'roma', text: 'Roma dall’alto all’ora d’oro: il fiume, i ponti e la cupola di San Pietro.', h: 6, likes: 95 },
  { id: 103, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'colazione', text: 'Colazione vicino alla vetrata: cornetto caldo e caffè prima di iniziare la giornata.', h: 7, likes: 33 },
  { id: 204, author: 'Elena F.', tag: 'Mind', media: 'video', k: 'spazio', text: 'Cinque minuti per guardare lontano: dalla cometa alla Terra. Aiuta a rimettere le cose in prospettiva.', h: 8, likes: 64 },
  { id: 104, author: 'Tommaso V.', tag: 'Viaggi', media: 'photo', k: 'autoNotte', text: 'Ultima tappa del viaggio, parcheggio di notte. Domani si riparte.', h: 9, likes: 21 },
  { id: 105, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'barSera', text: 'Il locale a lume di candela dopo cena: luci blu, piante e un angolo tranquillo.', h: 11, likes: 47 },
  { id: 205, author: 'Chiara N.', tag: 'Viaggi', media: 'video', k: 'colosseo', text: 'Il Colosseo si accende di rosso mentre cala il sole.', h: 12, likes: 77 },
  { id: 106, author: 'Chiara N.', tag: 'Serate', media: 'photo', k: 'aperitivo', text: 'Aperitivo: cocktail con la schiuma, olive e assaggi da dividere.', h: 14, likes: 58 },
  { id: 206, author: 'Sophie M.', tag: 'Viaggi', media: 'video', k: 'positano', text: 'Positano vista dal mare: case colorate appese alla montagna.', h: 16, likes: 120 },
  { id: 107, author: 'Luca Ferri', tag: 'Caffè', media: 'photo', k: 'cappuccino', text: 'Latte art a foglia: la costanza paga anche con il caffè.', h: 18, likes: 44 },
  { id: 207, author: 'Giulia M.', tag: 'Viaggi', media: 'video', k: 'newYork', text: 'New York al tramonto: il ponte e lo skyline dall’alto.', h: 20, likes: 83 },
  { id: 108, author: 'Tommaso V.', tag: 'Giochi', media: 'photo', k: 'freccette', text: 'Serata freccette al pub con i dardi nuovi. Sfida aperta a chi vuole.', h: 22, likes: 29 },
  { id: 109, author: 'Davide R.', tag: 'Amici', media: 'photo', k: 'birra', text: 'Serata all’aperto con gli amici sotto le lucine: la birra è la parte meno importante.', h: 26, likes: 61 },
];
/** Momenti (Recap) di chi segui. */
const STORIES: { id: string; author: string; k: Key; kind: 'photo' | 'video'; h: number; text?: string }[] = [
  { id: 'seed-st-g1', author: 'Giulia M.', k: 'colazione', kind: 'photo', h: 1.2 }, { id: 'seed-st-g2', author: 'Giulia M.', k: 'spiaggia', kind: 'video', h: 1 }, { id: 'seed-st-g3', author: 'Giulia M.', k: 'freccette', kind: 'photo', h: 0.6 },
  { id: 'seed-st-m1', author: 'Marco T.', k: 'pizza', kind: 'photo', h: 2.5 }, { id: 'seed-st-m2', author: 'Marco T.', k: 'roma', kind: 'video', h: 2 },
  { id: 'seed-st-s1', author: 'Sara B.', k: 'cappuccino', kind: 'photo', h: 3 },
  { id: 'seed-st-e1', author: 'Elena F.', k: 'spazio', kind: 'video', h: 4 },
  { id: 'seed-st-so1', author: 'Sophie M.', k: 'positano', kind: 'video', h: 5 },
];

async function resolve(): Promise<Record<Key, string>> {
  const keys = Object.keys(M) as Key[];
  const assets = await Asset.loadAsync(keys.map((k) => M[k] as number));
  const out = {} as Record<Key, string>;
  keys.forEach((k, i) => { out[k] = assets[i].localUri ?? assets[i].uri; });
  return out;
}

/** In modalità demo mette in Home, Swipe e Recap i contenuti di altre persone; a ogni avvio aggiorna i percorsi dei file. */
export function useSeedMedia() {
  const demo = useApp((s) => s.demo);
  const done = useRef(false);
  useEffect(() => {
    if (!demo || done.current) return;
    done.current = true;
    void resolve().then((uris) => {
      const now = Date.now();
      const st = useNet.getState();
      const have = new Map(st.posts.map((p) => [p.id, p]));
      const fresh: Post[] = POSTS.map((p) => ({ id: p.id, author: p.author, text: p.text, media: p.media, tag: p.tag, likes: have.get(p.id)?.likes ?? p.likes, ts: have.get(p.id)?.ts ?? now - p.h * H, uri: uris[p.k] }));
      const keepPosts = st.posts.filter((p) => !POSTS.some((x) => x.id === p.id));
      const oldS = new Map((st.stories ?? []).map((s) => [s.id, s]));
      const stories: Story[] = STORIES.flatMap((s) => {
        const prev = oldS.get(s.id);
        const made = makeStory({ id: s.id, author: s.author, now: prev?.ts ?? now - s.h * H, kind: s.kind, uri: uris[s.k], ...(s.text ? { text: s.text } : {}) });
        return made ? [prev ? { ...made, views: prev.views } : made] : [];
      });
      st.patch({ posts: [...fresh, ...keepPosts], stories: [...(st.stories ?? []).filter((s) => !s.id.startsWith('seed-st-')), ...stories] });
    }).catch(() => { done.current = false; });
  }, [demo]);
}
