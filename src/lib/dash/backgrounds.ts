/** Sfondi pronti della Dashboard (modulo PURO): sfumature e tinte unite, pensate per far risaltare le schede dei widget. */
export type Preset = { id: string; name: string; colors: string[]; /** da dove a dove va la sfumatura, 0-1 */ from: [number, number]; to: [number, number] };

const G = (id: string, name: string, colors: string[], from: [number, number] = [0, 0], to: [number, number] = [1, 1]): Preset => ({ id, name, colors, from, to });

export const PRESETS: Preset[] = [
  G('aurora', 'Aurora', ['#0b1d3a', '#14506b', '#1f8a70']),
  G('tramonto', 'Tramonto', ['#2a1038', '#7a2a5c', '#e0703c']),
  G('oceano', 'Oceano', ['#06223f', '#0e5a8a', '#2fb5c7']),
  G('foresta', 'Foresta', ['#0b2118', '#17533a', '#6aa56a']),
  G('lavanda', 'Lavanda', ['#1a1442', '#4b3b9a', '#a68ad8']),
  G('rosa', 'Rosa', ['#2d0f26', '#8a2f66', '#f08fa8']),
  G('sabbia', 'Sabbia', ['#2b2218', '#7d6342', '#d9b98a']),
  G('menta', 'Menta', ['#082a2a', '#177d78', '#8ce0c4']),
  G('notte', 'Notte', ['#05070d', '#101a33', '#1b2c57'], [0.5, 0], [0.5, 1]),
  G('brace', 'Brace', ['#1c0a08', '#6b1d14', '#ff7a3d'], [0.5, 0], [0.5, 1]),
  G('grafite', 'Grafite', ['#0c0e12', '#1d2128', '#2d333d'], [0.5, 0], [0.5, 1]),
  G('cielo', 'Cielo', ['#0a1f44', '#2d63b8', '#9cc8f0'], [0.5, 0], [0.5, 1]),
  G('blu', 'Blu', ['#10264f', '#10264f']),
  G('verde', 'Verde', ['#12372a', '#12372a']),
  G('viola', 'Viola', ['#2c1b55', '#2c1b55']),
  G('bordeaux', 'Bordeaux', ['#4a1422', '#4a1422']),
];
export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export type Bg = { kind: 'none' | 'photo' | 'preset'; photo?: string; preset?: string };
/** Cosa mostrare: se la foto manca o il modello non esiste si torna allo sfondo normale. */
export function resolveBg(bg: Bg | undefined, legacyPhoto?: string): { kind: 'none' } | { kind: 'photo'; uri: string } | { kind: 'preset'; preset: Preset } {
  if (bg?.kind === 'photo' && bg.photo) return { kind: 'photo', uri: bg.photo };
  if (bg?.kind === 'preset' && bg.preset && PRESET_BY_ID[bg.preset]) return { kind: 'preset', preset: PRESET_BY_ID[bg.preset] };
  if ((!bg || bg.kind === 'none') && legacyPhoto) return { kind: 'photo', uri: legacyPhoto };
  return { kind: 'none' };
}
