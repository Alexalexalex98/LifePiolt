/**
 * Sostituisce 'react-native' per tutto il codice in src/ (vedi metro.config.js): identico, tranne <Text>.
 * "Testo più grande" moltiplica fontSize/lineHeight di OGNI testo dell'app, anche quelli con dimensione fissa.
 * Questo file non deve importare altri moduli di src/ (importa 'react-native' vero perché è l'unica origine esclusa dall'alias).
 */
import { createElement, useSyncExternalStore } from 'react';
import { Pressable as NativePressable, StyleSheet, Text as NativeText, type PressableProps, type TextProps } from 'react-native';

import { toast } from '../store/toast';
import { getTextScaleFactor, setTextScaleFactor, snapshotTextScale, subscribeTextScale } from './textScaleState';

export * from 'react-native';

const subscribe = subscribeTextScale;
const snapshot = snapshotTextScale;
export { setTextScaleFactor, getTextScaleFactor };

export default Text;

export function Text(props: TextProps & { ref?: unknown }) {
  const k = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (k === 1 || !props.style) return createElement(NativeText, props);
  const flat = StyleSheet.flatten(props.style) as { fontSize?: number; lineHeight?: number } | undefined;
  if (!flat || typeof flat.fontSize !== 'number') return createElement(NativeText, props);
  const scaled = { fontSize: flat.fontSize * k, ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * k } : null) };
  return createElement(NativeText, { ...props, style: [props.style, scaled] } as TextProps);
}
Text.displayName = 'Text';


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
