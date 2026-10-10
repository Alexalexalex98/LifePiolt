import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect as SvgRect } from 'react-native-svg';

import { Text } from '@/components/T';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t as tr, translateText } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import type { TourStep } from '@/lib/tour';

import { measureTarget, sameRect, type Rect } from './registry';

const PAD = 6;
const RADIUS = 16;
const SCRIM = '#04060bd9'; // circa 85% di nero-blu

type Props = {
  steps: TourStep[];
  index: number;
  name: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** ultimo passo: chiude (e, se c'è, esegue l'azione) */
  onDone: (openPage?: string) => void;
  onUnlockAll?: () => void;
  doneLabel?: string;
};

/**
 * Overlay a schermo intero: oscura tutto (niente distrazioni, i tocchi non passano) e lascia un "buco" arrotondato
 * sull'elemento evidenziato. Il callout ha titolo, testo e pulsanti; è un dialogo accessibile (annuncio, focus, tastiera).
 */
export function TourOverlay({ steps, index, name, onNext, onBack, onSkip, onDone, onUnlockAll, doneLabel = 'Inizia' }: Props) {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { width: W, height: H } = useWindowDimensions();
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const focusRef = useRef<View>(null);

  // misura il bersaglio ora e poi spesso: segue scroll, rotazione, tastiera e cambi di layout
  useEffect(() => {
    let alive = true;
    setRect(null);
    const run = async () => {
      const r = await measureTarget(step?.target);
      if (alive) setRect((prev) => (sameRect(prev, r) ? prev : r));
    };
    void run();
    const h = setInterval(run, 350);
    return () => { alive = false; clearInterval(h); };
  }, [step?.target, step?.id, W, H]);

  const title = step.title.includes('{0}') ? tr(step.title, name) : step.title;

  // annuncio per screen reader e focus sul pulsante principale
  useEffect(() => {
    const msg = `${translateText(title)}. ${translateText(step.text)}`;
    try { AccessibilityInfo.announceForAccessibility?.(msg); } catch { /* ignore */ }
    const h = setTimeout(() => {
      const node = focusRef.current;
      if (!node) return;
      try {
        if (Platform.OS === 'web') (node as unknown as { focus?: () => void }).focus?.();
        else { const tag = findNodeHandle(node); if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag); }
      } catch { /* ignore */ }
    }, 120);
    return () => clearTimeout(h);
  }, [step.id, title, step.text]);

  // buco: arrotondato, lievemente più grande dell'elemento, dentro la finestra; se il bersaglio non si vede, nessun buco
  const hole = useMemo(() => {
    if (!rect) return null;
    const x = Math.max(4, rect.x - PAD), y = Math.max(4, rect.y - PAD);
    const w = Math.min(W - 4, rect.x + rect.w + PAD) - x, h = Math.min(H - 4, rect.y + rect.h + PAD) - y;
    if (w < 8 || h < 8 || rect.x > W || rect.y > H || rect.x + rect.w < 0 || rect.y + rect.h < 0) return null;
    return { x, y, w, h };
  }, [rect, W, H]);

  const maxW = Math.min(W - 32, 440);
  const gap = 14;
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const wrapStyle = !hole
    ? { top: insets.top + 16, bottom: insets.bottom + 16, justifyContent: 'center' as const }
    : below
      ? { top: hole.y + hole.h + gap, bottom: insets.bottom + 12, justifyContent: 'flex-start' as const }
      : { top: insets.top + 12, bottom: H - hole.y + gap, justifyContent: 'flex-end' as const };

  const total = steps.length;
  const primaryLabel = last ? (step.cta ? step.cta.label : doneLabel) : 'Avanti';
  const btn = (kind: 'primary' | 'ghost') => ({
    minHeight: 46, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: kind === 'primary' ? th.accent : th.chip, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: th.border,
  });

  return (
    <Modal visible transparent animationType={reduce ? 'none' : 'fade'} statusBarTranslucent onRequestClose={onSkip}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal importantForAccessibility="yes">
        {/* scrim con buco: blocca ogni tocco */}
        <Pressable accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={() => {}}>
          <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <Mask id="tourHole" x="0" y="0" width={W} height={H} maskUnits="userSpaceOnUse">
                <SvgRect x="0" y="0" width={W} height={H} fill="#fff" />
                {hole ? <SvgRect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} ry={RADIUS} fill="#000" /> : null}
              </Mask>
            </Defs>
            <SvgRect x="0" y="0" width={W} height={H} fill={SCRIM} mask="url(#tourHole)" />
            {hole ? <SvgRect x={hole.x - 2} y={hole.y - 2} width={hole.w + 4} height={hole.h + 4} rx={RADIUS + 2} ry={RADIUS + 2} fill="none" stroke={th.accent} strokeOpacity={0.28} strokeWidth={6} /> : null}
            {hole ? <SvgRect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} ry={RADIUS} fill="none" stroke={th.accent} strokeWidth={2} /> : null}
          </Svg>
        </Pressable>

        {/* callout */}
        <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, alignItems: 'center', ...wrapStyle }}>
          <View
            accessible={false}
            {...(Platform.OS === 'web' ? ({ role: 'dialog', 'aria-modal': true, 'aria-label': translateText(title) } as object) : null)}
            style={{ width: '100%', maxWidth: maxW, flexShrink: 1, backgroundColor: th.sheet, borderColor: th.sheetBorder, borderWidth: 1, borderRadius: 22, padding: 18, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessible accessibilityLabel={tr('Passo {0} di {1}', index + 1, total)}>
                {steps.map((s, i) => (
                  <View key={s.id} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? th.accent : th.border }} />
                ))}
              </View>
              <Text style={{ color: th.muted, fontSize: 12, fontWeight: '600' }}>{tr('Passo {0} di {1}', index + 1, total)}</Text>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              <Text accessibilityRole="header" style={{ color: th.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
              <Text style={{ color: th.muted, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{step.text}</Text>
              {step.bullets?.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
                  <View style={{ marginTop: 3 }}><Icon name="check" size={14} color={th.accent} stroke={2.4} /></View>
                  <Text style={{ color: th.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{b}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {index > 0 ? (
                <Pressable onPress={onBack} accessibilityRole="button" style={({ pressed }) => [btn('ghost'), { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 15 }}>Indietro</Text>
                </Pressable>
              ) : null}
              <Pressable ref={focusRef} onPress={() => (last ? onDone(step.cta?.page) : onNext())} accessibilityRole="button" style={({ pressed }) => [btn('primary'), { flexGrow: 1, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ color: th.onAccent, fontWeight: '800', fontSize: 15 }}>{primaryLabel}</Text>
              </Pressable>
            </View>
            {last && step.cta ? (
              <Pressable onPress={() => onDone()} accessibilityRole="button" style={({ pressed }) => [btn('ghost'), { marginTop: 8, opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 15 }}>Più tardi</Text>
              </Pressable>
            ) : null}
            {last && step.offerUnlockAll && onUnlockAll ? (
              <Pressable onPress={onUnlockAll} accessibilityRole="button" style={({ pressed }) => [btn('ghost'), { marginTop: 8, opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 15 }}>Sblocca tutto ora</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', marginTop: 10, minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: th.muted, fontSize: 13, textDecorationLine: 'underline' }}>Salta il tour</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
