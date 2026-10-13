/** Lettura dell'esportazione dati di Instagram (formato JSON). Funzioni pure: niente file system, niente UI. */

export type IgPost = { id: string; caption: string; ts: number; media: string[] };
export type IgProfile = { name?: string; bio?: string; username?: string };
export type IgParsed = { profile: IgProfile; posts: IgPost[] };

const IMG = /\.(jpe?g|png|webp|heic|gif)$/i;
const VID = /\.(mp4|mov|m4v|webm)$/i;
export const isImagePath = (p: string) => IMG.test(p);
export const isVideoPath = (p: string) => VID.test(p);

/** Instagram scrive il testo UTF-8 come se fosse latin1 ("PerchÃ©"): lo rimette a posto. */
export function fixMojibake(s: string): string {
  if (!/[Â-ô][\u0080-¿]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
    if (bytes.some((b, i) => b > 255 || (s.charCodeAt(i) > 255))) return s;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { return s; }
}

/** Percorsi dei file JSON che servono (così non si decomprime tutto). */
export function wantedJson(path: string): boolean {
  const p = path.toLowerCase();
  if (!p.endsWith('.json')) return false;
  return /(^|\/)(posts_\d+|personal_information|profile_user)\.json$/.test(p) || /\/(content|media|your_instagram_activity\/media)\/posts_\d+\.json$/.test(p);
}

const asArr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const rec = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});
const str = (x: unknown) => (typeof x === 'string' ? fixMojibake(x).trim() : '');

/** Interpreta i JSON già letti (percorso → testo). Ignora i file che non riconosce. */
export function parseInstagram(files: Record<string, string>): IgParsed {
  const profile: IgProfile = {};
  const posts: IgPost[] = [];
  const seen = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    let json: unknown;
    try { json = JSON.parse(text); } catch { continue; }
    const low = path.toLowerCase();
    if (/personal_information\.json$/.test(low)) {
      const d = rec(rec(asArr(rec(json).profile_user)[0]).string_map_data);
      const v = (k: string) => str(rec(d[k]).value);
      profile.name = v('Name') || profile.name;
      profile.bio = v('Bio') || profile.bio;
      profile.username = v('Username') || profile.username;
      continue;
    }
    if (!/posts_\d+\.json$/.test(low)) continue;
    for (const raw of asArr(rec(json).media ? [json] : json)) {
      const e = rec(raw);
      const items = asArr(e.media).map(rec);
      const media = items.map((m) => str(m.uri)).filter((u) => u && (isImagePath(u) || isVideoPath(u)));
      if (!media.length) continue;
      const first = items[0] ?? {};
      const caption = str(e.title) || str(first.title);
      const sec = Number(first.creation_timestamp ?? e.creation_timestamp ?? 0);
      const id = media[0];
      if (seen.has(id)) continue;
      seen.add(id);
      posts.push({ id, caption, ts: sec > 0 ? sec * 1000 : 0, media });
    }
  }
  posts.sort((a, b) => b.ts - a.ts);
  return { profile, posts };
}

/** Cerca nello ZIP il file corrispondente al percorso scritto nel JSON (le cartelle iniziali possono cambiare). */
export function resolveEntry(names: string[], uri: string): string | null {
  if (names.includes(uri)) return uri;
  const hit = names.find((n) => n.endsWith('/' + uri));
  return hit ?? null;
}
