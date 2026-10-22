import { useApp } from '@/store/app';

/** Dove compare la mascotte: `core` = nei posti dove serve (chat, pulsante, attesa, benvenuto, adesivi); `extra` = anche nelle decorazioni (pagine vuote, Dashboard…). */
export function useMascot(level: 'core' | 'extra'): boolean {
  const mode = useApp((s) => s.mascot ?? 'everywhere');
  return level === 'core' ? mode !== 'off' : mode === 'everywhere';
}
