/**
 * Passaggio di foto/video tra il compositore dei post e l'editor (lo stesso dei recap).
 * Filtri e ritocchi sono veli non distruttivi (valgono anche per i video): si salvano accanto al post.
 */
import type { NetMedia } from './netMedia.ts';
import { cleanVideoFx, type VideoFx } from './videoFx.ts';
import { isAdjusted, type Adjust, type FilterId, type StoryFit } from './stories.ts';

export type PostFx = { filter?: FilterId; adj?: Adjust; fit?: StoryFit; video?: VideoFx };
type Payload = { items: NetMedia[]; fx?: PostFx };
let input: Payload | null = null;
let result: Payload | null = null;
export const setEditorInput = (p: Payload) => { input = p; };
export const takeEditorInput = (): Payload | null => { const p = input; input = null; return p; };
export const setEditorResult = (p: Payload) => { result = p; };
export const takeEditorResult = (): Payload | null => { const p = result; result = null; return p; };
/** Tiene solo ciò che cambia davvero qualcosa. */
export function cleanFx(fx?: PostFx | null): PostFx | undefined {
  if (!fx) return undefined;
  const out: PostFx = {};
  if (fx.filter && fx.filter !== 'none') out.filter = fx.filter;
  if (fx.adj && isAdjusted(fx.adj)) out.adj = fx.adj;
  if (fx.fit === 'contain') out.fit = 'contain';
  const v = cleanVideoFx(fx.video); if (v) out.video = v;
  return Object.keys(out).length ? out : undefined;
}
