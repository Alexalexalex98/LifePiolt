/**
 * Solo web (vedi metro.config.js): sostituisce 'react-native' per il codice in src/ ri-esportandolo invariato, tranne <Pressable>.
 * <Text> e <TextInput> ora arrivano da '@/components/T' (traduzione + "Testo più grande"), quindi qui non si tocca più Text.
 * Questo file non deve importare altri moduli di src/ oltre al toast.
 */
import { createElement } from 'react';
import { Pressable as NativePressable, StyleSheet, type PressableProps } from 'react-native';

import { toast } from '../store/toast';

export * from 'react-native';

/* ---------- Pressable: area tattile minima, feedback al tocco, niente pulsanti "morti" ---------- */
const DEFAULT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

function guard<A extends unknown[]>(fn?: ((...a: A) => unknown) | null) {
  if (!fn) return fn ?? undefined;
  return (...a: A) => {
    try {
      const r = fn(...a);
      if (r && typeof (r as Promise<unknown>).then === 'function') (r as Promise<unknown>).then(undefined, () => toast('Qualcosa non ha funzionato'));
    } catch (e) {
      console.warn('azione fallita', e);
      toast('Qualcosa non ha funzionato');
    }
  };
}

/** Come il Pressable di react-native, con: hitSlop di 6pt se non indicato, opacità al tocco (se lo stile non gestisce già "pressed"), eccezioni degli handler mostrate come avviso. */
export function Pressable(props: PressableProps & { ref?: unknown }) {
  const { onPress, onLongPress, hitSlop, style, disabled, ...rest } = props;
  let st = style;
  if (typeof style !== 'function' && (onPress || onLongPress) && !disabled) {
    const flat = StyleSheet.flatten(style as never) as { flex?: number; position?: string } | undefined;
    // sfondi a tutto schermo (overlay di sheet, ecc.) non devono lampeggiare
    if (!(flat && (flat.flex === 1 || flat.position === 'absolute'))) st = ({ pressed }: { pressed: boolean }) => [style as never, pressed ? { opacity: 0.6 } : null];
  }
  return createElement(NativePressable, { ...rest, disabled, hitSlop: hitSlop ?? DEFAULT_SLOP, onPress: guard(onPress), onLongPress: guard(onLongPress), style: st } as PressableProps);
}
Pressable.displayName = 'Pressable';
