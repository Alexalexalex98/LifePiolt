import { useColorScheme } from 'react-native';

import { palettes, type Palette } from '@/constants/theme';
import { useApp } from '@/store/app';

export function useTheme(): Palette {
  const appearance = useApp((s) => s.appearance);
  const system = useColorScheme();
  const light = appearance === 'Chiaro' || (appearance === 'Sistema' && system === 'light');
  const base = light ? palettes.light : palettes.dark;
  const highContrast = useApp((s) => s.accessibility.highContrast);
  return highContrast ? { ...base, muted: light ? '#2b3340' : '#dbe2ec', border: light ? '#8a96a8' : '#4a5872' } : base;
}
