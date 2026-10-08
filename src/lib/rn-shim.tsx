/**
 * Sostituisce 'react-native' per tutto il codice in src/ (vedi metro.config.js): identico, tranne <Text>.
 * "Testo più grande" moltiplica fontSize/lineHeight di OGNI testo dell'app, anche quelli con dimensione fissa.
 * Questo file non deve importare altri moduli di src/ (importa 'react-native' vero perché è l'unica origine esclusa dall'alias).
 */
import { createElement, useSyncExternalStore } from 'react';
import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';

export * from 'react-native';

let factor = 1;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => factor;

export function setTextScaleFactor(k: number) {
  if (k === factor) return;
  factor = k;
  listeners.forEach((l) => l());
}
export const getTextScaleFactor = () => factor;

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
