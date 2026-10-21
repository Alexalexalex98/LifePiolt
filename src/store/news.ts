import { create } from 'zustand';

import { FEEDS } from '@/lib/news/feeds';
import { mergeNews, parseFeed, type NewsItem } from '@/lib/news/rss';
import { persisted } from './persist';

type State = {
  items: NewsItem[];
  updatedAt: number;
  /** quante fonti hanno risposto all'ultimo aggiornamento, e su quante */
  ok: number;
  total: number;
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const STALE_MS = 3 * 60_000;
let inflight: Promise<void> | null = null;

async function getText(url: string): Promise<string> {
  const ctl = new AbortController();
  const h = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } }); if (!r.ok) throw new Error(String(r.status)); return await r.text(); } finally { clearTimeout(h); }
}

/** Le notizie dei feed gratuiti: si aggiornano quando apri l'app, ogni pochi minuti mentre guardi la pagina, e a richiesta. Le ultime restano salvate per quando manca la rete. */
export const useNews = create<State>()(
  persisted<State>('news', (set, get) => ({
    items: [], updatedAt: 0, ok: 0, total: FEEDS.length, loading: false,
    refresh: async (force) => {
      if (inflight) return inflight;
      if (!force && Date.now() - get().updatedAt < STALE_MS) return;
      set({ loading: true });
      inflight = (async () => {
        const res = await Promise.all(FEEDS.map(async (f) => { try { return parseFeed(await getText(f.url), f.name); } catch { return null; } }));
        const good = res.filter((x): x is NewsItem[] => !!x && x.length > 0);
        if (good.length) set({ items: mergeNews(good), updatedAt: Date.now(), ok: good.length, total: FEEDS.length });
        else set({ ok: 0, total: FEEDS.length });
      })().finally(() => { inflight = null; set({ loading: false }); });
      return inflight;
    },
  }), (s) => ({ items: s.items, updatedAt: s.updatedAt, ok: s.ok, total: s.total })),
);
