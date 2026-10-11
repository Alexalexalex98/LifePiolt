import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from 'react-native';

import { KB_HIDDEN, resolveKeyboard, type KbCoords, type KbState } from '@/lib/keyboardInset';

export type KeyboardInset = KbState & { /** durata consigliata dell'animazione (ms) */ duration: number };

/**
 * Quanto la tastiera software copre il fondo dello schermo. Funziona con edge-to-edge (Android 15+/SDK 57) dove
 * `adjustResize` non ridimensiona più la finestra, e su iOS (tastiere fluttuanti incluse).
 * Ascolta show/hide e i cambi di altezza (barra suggerimenti, emoji). Sul web non c'è tastiera software: resta sempre nascosta.
 */
export function useKeyboardInset(): KeyboardInset {
  const win = useWindowDimensions();
  const [ev, setEv] = useState<{ c: KbCoords; d: number } | null>(null);
  // altezza della finestra a tastiera chiusa (serve a capire se il sistema l'ha già ridimensionata)
  const [baseH, setBaseH] = useState(win.height);
  useEffect(() => { if (!ev) setBaseH(win.height); }, [ev, win.height, win.width]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const on = (e: KeyboardEvent) => setEv({ c: e?.endCoordinates, d: e?.duration || 0 });
    const off = () => setEv(null);
    const subs = [
      Keyboard.addListener('keyboardWillShow', on),
      Keyboard.addListener('keyboardDidShow', on),
      Keyboard.addListener('keyboardWillHide', off),
      Keyboard.addListener('keyboardDidHide', off),
      ...(Platform.OS === 'ios' ? [Keyboard.addListener('keyboardWillChangeFrame', on)] : []),
    ];
    // già aperta quando il componente nasce (es. campo con autoFocus)
    try { const m = Keyboard.metrics?.(); if (m && m.height > 0) setEv({ c: m, d: 0 }); } catch { /* facoltativo */ }
    return () => subs.forEach((s) => s.remove());
  }, []);

  const state = ev ? resolveKeyboard(ev.c, { os: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', winW: win.width, winH: win.height, baseWinH: baseH }) : KB_HIDDEN;
  return { ...state, duration: ev?.d || 0 };
}
