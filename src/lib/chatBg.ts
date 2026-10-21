/** Sfondo di una chat (modulo PURO): un colore tinta unita (come prima), un modello di sfumatura oppure una foto. Si salva come testo: «verde», «preset:tramonto», «photo:file:///…». */
import { PRESET_BY_ID, type Preset } from './dash/backgrounds.ts';

export type Wall = { kind: 'color'; key: string } | { kind: 'preset'; preset: Preset } | { kind: 'photo'; uri: string };

export const presetWall = (id: string) => `preset:${id}`;
export const photoWall = (uri: string) => `photo:${uri}`;

export function parseWall(key: string | undefined): Wall {
  const k = key ?? 'default';
  if (k.startsWith('photo:') && k.length > 6) return { kind: 'photo', uri: k.slice(6) };
  if (k.startsWith('preset:') && PRESET_BY_ID[k.slice(7)]) return { kind: 'preset', preset: PRESET_BY_ID[k.slice(7)] };
  return { kind: 'color', key: k.startsWith('photo:') || k.startsWith('preset:') ? 'default' : k };
}
/** Un nome breve da mostrare accanto alla voce «Sfondo». */
export function wallLabel(key: string | undefined, colorLabel: (k: string) => string | undefined): string {
  const w = parseWall(key);
  if (w.kind === 'photo') return 'La tua foto';
  if (w.kind === 'preset') return w.preset.name;
  return colorLabel(w.key) ?? 'LifePilot';
}
