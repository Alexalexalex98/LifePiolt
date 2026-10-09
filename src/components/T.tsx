/**
 * <Text> e <TextInput> dell'app: traducono da soli i testi (la chiave è il testo italiano) e applicano "Testo più grande".
 * Si importano da qui al posto che da 'react-native'. Nessun alias di Metro: funziona uguale su iPhone, Android e web.
 */
import { Children, createElement, isValidElement, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

import { translateText } from '@/i18n/core';
import { localizeMonths } from '@/i18n/format';
import { snapshotTextScale, subscribeTextScale } from '@/lib/textScaleState';

/** Traduce un testo; se il catalogo non lo conosce, almeno localizza i nomi dei mesi italiani (etichette salvate come "Ottobre 2026"). */
const tx = (s: string) => { const o = translateText(s); return o === s ? localizeMonths(s) : o; };

/** Traduce i figli di tipo stringa (anche dentro array); lascia intatti gli elementi React. */
export function trChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return tx(children);
  if (Array.isArray(children)) {
    // "{n} impegni": prima provo a tradurre le parti, ma se l'insieme è un modello noto lo traduco intero
    const flat = children.every((c) => typeof c === 'string' || typeof c === 'number') ? children.join('') : null;
    if (flat !== null) { const whole = tx(flat); if (whole !== flat) return whole; }
    return Children.map(children, (c) => (typeof c === 'string' ? tx(c) : isValidElement(c) ? c : c));
  }
  return children;
}

export function Text(props: TextProps & { ref?: unknown }) {
  const k = useSyncExternalStore(subscribeTextScale, snapshotTextScale, snapshotTextScale);
  const children = trChildren(props.children);
  let style = props.style;
  if (k !== 1 && style) {
    const flat = StyleSheet.flatten(style) as { fontSize?: number; lineHeight?: number } | undefined;
    if (flat && typeof flat.fontSize === 'number') style = [style, { fontSize: flat.fontSize * k, ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * k } : null) }] as never;
  }
  return createElement(RNText, { ...props, style, children } as TextProps);
}
Text.displayName = 'Text';

export function TextInput(props: TextInputProps & { ref?: unknown }) {
  const placeholder = typeof props.placeholder === 'string' ? translateText(props.placeholder) : props.placeholder;
  return createElement(RNTextInput, { ...props, placeholder } as TextInputProps);
}
TextInput.displayName = 'TextInput';

export default Text;
