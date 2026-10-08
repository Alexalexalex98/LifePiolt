import { createElement, useSyncExternalStore, type ComponentType } from 'react';
import { StyleSheet, type TextProps } from 'react-native';

import { TEXT_LG_SCALE } from '@/constants/theme';
import { useApp } from '@/store/app';

/**
 * "Testo più grande" deve valere per TUTTA l'app, anche per i <Text> con fontSize fisso:
 * si sostituisce l'export `Text` di react-native con un wrapper che moltiplica fontSize e lineHeight.
 * Il fattore arriva da accessibility.textLg; senza l'opzione il wrapper non tocca lo stile.
 */
let factor = 1;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => factor;

function sync() {
  const k = useApp.getState().accessibility.textLg ? TEXT_LG_SCALE : 1;
  if (k !== factor) { factor = k; listeners.forEach((l) => l()); }
}

let installed = false;
export function installTextScale() {
  if (installed) return;
  installed = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = require('react-native');
    const Orig = RN.Text as ComponentType<TextProps>;
    function ScaledText(props: TextProps) {
      const k = useSyncExternalStore(subscribe, snapshot, snapshot);
      if (k === 1 || !props.style) return createElement(Orig, props);
      const flat = StyleSheet.flatten(props.style) as { fontSize?: number; lineHeight?: number } | undefined;
      if (!flat || typeof flat.fontSize !== 'number') return createElement(Orig, props);
      const scaled = { fontSize: flat.fontSize * k, ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * k } : null) };
      return createElement(Orig, { ...props, style: [props.style, scaled] });
    }
    ScaledText.displayName = 'Text';
    Object.defineProperty(RN, 'Text', { configurable: true, enumerable: true, get: () => ScaledText });
    sync();
    useApp.subscribe(sync);
  } catch (e) {
    console.warn('textScale non installato', e);
  }
}
export const textScaleFactor = () => factor;
