import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type Palette } from '@/constants/theme';
import { useApp } from '@/store/app';

/** Palette attiva: scuro / chiaro / sistema, con la variante ad alto contrasto vera (non solo due colori ritoccati). */
export function useTheme(): Palette {
  const appearance = useApp((s) => s.appearance);
  const highContrast = useApp((s) => s.accessibility.highContrast);
  const system = useColorScheme();
  const light = appearance === 'Chiaro' || (appearance === 'Sistema' && system === 'light');
  return useMemo(() => (light ? (highContrast ? palettes.lightHC : palettes.light) : (highContrast ? palettes.darkHC : palettes.dark)) as Palette, [light, highContrast]);
}

export const useIsLight = () => useTheme().mode === 'light';
