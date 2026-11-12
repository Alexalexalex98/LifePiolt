/** Collegamenti che arrivano da fuori (altri utenti, AI, notizie): si aprono solo quelli sicuri (modulo PURO, nessun alias '@/').
 *  Ammessi: https, http, mailto, tel, sms, geo e mappe. Mai file:, javascript:, data:, intent: o schemi di altre app. */
const OK = new Set(['https:', 'http:', 'mailto:', 'tel:', 'sms:', 'geo:', 'maps:']);
// caratteri di controllo e invisibili che si usano per nascondere uno schema («java\tscript:»)
const HIDDEN = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202f\\ufeff]', 'g');
export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(HIDDEN, '').trim();
  if (!s || s.length > 2048) return null;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (!m) return /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s) ? `https://${s}` : null; // «esempio.it/pagina» senza schema
  const scheme = `${m[1]!.toLowerCase()}:`;
  if (!OK.has(scheme)) return null;
  if (scheme === 'http:' || scheme === 'https:') {
    const host = /^https?:\/\/([^/?#]*)/i.exec(s)?.[1];
    if (!host || host.includes('@') || /\s/.test(host)) return null; // niente «banca.it@evil.com» ingannevoli
  }
  return s;
}
/** Solo https su un dominio preciso (o un suo sottodominio): per le pagine caricate dentro l'app. */
export function onDomain(url: string, domains: string[]): boolean {
  const m = /^https:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(url); if (!m) return false;
  const h = m[1]!.toLowerCase(); return domains.some((d) => h === d || h.endsWith(`.${d}`));
}
