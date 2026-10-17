import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type Palette } from '@/constants/theme';
import { readable } from '@/lib/a11y';
import { customize } from '@/lib/themeCustom';
import { setLiveTheme } from '@/lib/liveTheme';
import { useApp } from '@/store/app';

/** Palette attiva: scuro / chiaro / sistema, con la variante ad alto contrasto vera (non solo due colori ritoccati). */
export function useTheme(): Palette {
  const appearance = useApp((s) => s.appearance);
  const highContrast = useApp((s) => s.accessibility.highContrast);
  const custom = useApp((s) => s.custom);
  const system = useColorScheme();
  const light = appearance === 'Chiaro' || (appearance === 'Sistema' && system === 'light');
  return useMemo(() => { const p = customize((light ? (highContrast ? palettes.lightHC : palettes.light) : (highContrast ? palettes.darkHC : palettes.dark)) as Palette & { mode: string }, custom, highContrast) as Palette; setLiveTheme(p.accent, custom?.sections); return p; }, [light, highContrast, custom]);
}

export const useIsLight = () => useTheme().mode === 'light';

/** Rende leggibile (4.5:1) un colore "d'area" sul fondo card del tema attivo: `const ink = useInk(); <Text style={{ color: ink(c) }}>`. */
export function useInk() {
  const t = useTheme();
  return useMemo(() => (c: string) => readable(c, t.card), [t.card]);
}
