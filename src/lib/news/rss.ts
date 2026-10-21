/** Lettura dei feed RSS/Atom (modulo PURO, senza DOM): titolo, link, data e immagine di ogni notizia. */
export type NewsItem = { id: string; title: string; link: string; ts: number; source: string; image?: string };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};
const attr = (block: string, name: string, a: string): string => {
  const m = block.match(new RegExp(`<${name}\\s[^>]*?${a}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? m[1].replace(/&amp;/g, '&') : '';
};
function imageOf(block: string): string | undefined {
  const cands = [attr(block, 'media:content', 'url'), attr(block, 'media:thumbnail', 'url'), (block.match(/<enclosure\s[^>]*?type=["']image[^>]*>/i)?.[0].match(/url=["']([^"']+)["']/i) ?? [])[1] ?? '', (decodeEntitiesOnly(block).match(/<img[^>]+src=["']([^"']+)["']/i) ?? [])[1] ?? ''];
  const u = cands.find((x) => /^https?:\/\//i.test(x));
  return u ? u.replace(/&amp;/g, '&') : undefined;
}
const decodeEntitiesOnly = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Legge un feed: ogni <item> (RSS) o <entry> (Atom). Le notizie senza titolo o link si scartano. */
export function parseFeed(xml: string, source: string, now = Date.now()): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) link = attr(b, 'link', 'href');
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const raw = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const d = raw ? Date.parse(raw) : NaN;
    const ts = Number.isFinite(d) ? Math.min(d, now) : now;
    out.push({ id: `${source}|${link}`, title, link, ts, source, image: imageOf(b) });
  }
  return out;
}

/** Unisce più fonti: più recenti prima, senza doppioni, al massimo `max`; se più notizie sono di fila della stessa fonte le alterna. */
export function mergeNews(lists: NewsItem[][], max = 40): NewsItem[] {
  const seen = new Set<string>();
  const all = lists.flat().filter((n) => { const k = n.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  return all.sort((a, b) => b.ts - a.ts).slice(0, max);
}

export function agoText(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return 'ora';
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  return `${Math.round(h / 24)} g fa`;
}
