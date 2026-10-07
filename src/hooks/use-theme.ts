import { useColorScheme } from 'react-native';

import { palettes, type Palette } from '@/constants/theme';
import { useStore } from '@/store';

export function useTheme(): Palette {
  const mode = useStore((s) => s.theme);
  const system = useColorScheme();
  const resolved = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  return palettes[resolved];
}
