import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';

/** Cursore grande e facile: si trascina ovunque sulla barra, due tocchi sul nome lo riportano a zero. */
export function EditSlider({ label, hint, value, min, max, zero, dot, onChange, onCommit }: { label: string; hint?: string; value: number; min: number; max: number; /** valore «nessuna modifica» */ zero: number; dot?: string; onChange: (v: number) => void; onCommit: () => void }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState(false);
  const wRef = useRef(0); wRef.current = w;
  const start = useRef(value);
  const last = useRef(0);
  const cb = useRef({ onChange, onCommit, min, max, zero }); cb.current = { onChange, onCommit, min, max, zero };
  const tick = useRef(false);
  const fromX = (x: number) => { const r = Math.max(0, Math.min(1, x / Math.max(1, wRef.current))); const v = Math.round(cb.current.min + r * (cb.current.max - cb.current.min)); return Math.abs(v - cb.current.zero) <= 2 ? cb.current.zero : v; };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { setDrag(true); tick.current = false; const v = fromX(e.nativeEvent.locationX); start.current = v; cb.current.onChange(v); },
    onPanResponderMove: (_e, g) => {
      const r = start.current - cb.current.min; const base = (r / (cb.current.max - cb.current.min)) * wRef.current;
      const v = fromX(base + g.dx); cb.current.onChange(v);
      const atZero = v === cb.current.zero; if (atZero && !tick.current && Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); tick.current = atZero;
    },
    onPanResponderRelease: () => { setDrag(false); cb.current.onCommit(); }, onPanResponderTerminate: () => { setDrag(false); cb.current.onCommit(); },
  })).current;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const z = pct(zero), p = pct(value);
  const changed = value !== zero;
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => { const n = Date.now(); if (n - last.current < 320) { onChange(zero); onCommit(); } last.current = n; }} accessibilityRole="button" accessibilityLabel={`${translateText(label)}: ${translateText('due tocchi per azzerare')}`} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
          <Text style={{ color: changed ? t.text : t.muted, fontSize: 14, fontWeight: '700' }}>{translateText(label)}</Text>
        </Pressable>
        <Text style={{ color: changed ? t.accent : t.muted, fontSize: 14, fontWeight: '800', minWidth: 40, textAlign: 'right' }}>{value > 0 && min < 0 ? '+' : ''}{value}</Text>
      </View>
      {drag && hint ? <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 1 }}>{translateText(hint)}</Text> : null}
      <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="adjustable" accessibilityLabel={translateText(label)} accessibilityValue={{ min, max, now: value }} style={{ height: 34, justifyContent: 'center' }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.item }} />
        <View style={{ position: 'absolute', height: 4, borderRadius: 2, backgroundColor: t.accent, left: `${Math.min(z, p)}%`, width: `${Math.abs(p - z)}%` }} />
        {min < 0 ? <View style={{ position: 'absolute', left: `${z}%`, width: 2, height: 12, marginLeft: -1, backgroundColor: t.muted, opacity: 0.6 }} /> : null}
        <View style={{ position: 'absolute', left: `${p}%`, width: 24, height: 24, marginLeft: -12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: changed ? t.accent : t.muted, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 3, transform: [{ scale: drag ? 1.18 : 1 }] }} />
      </View>
    </View>
  );
}
