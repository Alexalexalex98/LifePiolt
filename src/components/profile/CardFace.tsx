import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text as RNText, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { CARD_RATIO, fieldText, scaleEl, snapRot, strokePath, type CardData, type CardDesign, type El, type FontId, type Side, type Stroke } from '@/lib/profile/card';
import { qrMatrix, qrPath } from '@/lib/profile/qr';

const BASE_W = 320;
/** Solo font di sistema (nessun pacchetto font installato): ogni piattaforma usa il suo carattere equivalente. */
export const fontFamily = (f: FontId): string | undefined => {
  switch (f) {
    case 'serif': return Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
    case 'mono': return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Menlo, Consolas, monospace' });
    case 'rounded': return Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'ui-rounded, "Avenir Next", system-ui, sans-serif' });
    default: return undefined;
  }
};

export function QrView({ text, size, color }: { text: string; size: number; color: string }) {
  const q = useMemo(() => { const m = qrMatrix(text); return m ? qrPath(m, 1) : null; }, [text]);
  if (!q) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${q.size} ${q.size}`}>
      <SvgRect x={0} y={0} width={q.size} height={q.size} fill="#ffffff" />
      <Path d={q.d} fill={color} />
    </Svg>
  );
}

export type FaceProps = {
  side: Side; design: CardDesign; data: CardData; width: number; qrText?: string;
  selectedId?: string | null; onSelect?: (id: string | null) => void; onMove?: (id: string, x: number, y: number) => void;
  /** ridimensiona e ruota con le maniglie (come Canva) */ onPatch?: (id: string, p: Partial<El>) => void;
  /** livello di disegno interattivo sopra il resto */
  overlay?: React.ReactNode; draftStroke?: Stroke | null; hideQr?: boolean;
};

/** Una faccia del biglietto (85x55): sfondo, elementi, tratti. Gli elementi si trascinano se `onMove` è presente. */
export function CardFace({ side, data, width, qrText, selectedId, onSelect, onMove, onPatch, overlay, draftStroke, design, hideQr }: FaceProps) {
  const height = width / CARD_RATIO;
  const k = width / BASE_W;
  const bg = side.bg;
  const strokes = draftStroke ? [...side.strokes, draftStroke] : side.strokes;
  const angle = (bg.angle * Math.PI) / 180;
  const grad = { start: { x: 0.5 - Math.cos(angle) / 2, y: 0.5 - Math.sin(angle) / 2 }, end: { x: 0.5 + Math.cos(angle) / 2, y: 0.5 + Math.sin(angle) / 2 } };
  return (
    <View style={{ width, height, borderRadius: Math.max(6, width * 0.03), overflow: 'hidden', backgroundColor: bg.c1 }} accessible accessibilityLabel={`Biglietto da visita di ${data.name}`}>
      {bg.kind === 'gradient' && <LinearGradient colors={[bg.c1, bg.c2]} {...grad} style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }} />}
      {onSelect ? <Pressable style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }} onPress={() => onSelect(null)} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      {side.els.map((e) => (
        <Element key={e.id} e={e} data={data} W={width} H={height} k={k} qrText={design.qr || e.t === 'qr' ? qrText : undefined} selected={selectedId === e.id} onSelect={onSelect} onMove={onMove} onPatch={onPatch} hideQr={hideQr} />
      ))}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {strokes.map((s, i) => <Path key={i} d={strokePath(s.pts, width, height)} stroke={s.color} strokeWidth={s.width * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
        </Svg>
      </View>
      {overlay}
    </View>
  );
}

function Element({ e, data, W, H, k, qrText, selected, onSelect, onMove, onPatch, hideQr }: { onPatch?: (id: string, p: Partial<El>) => void; e: El; data: CardData; W: number; H: number; k: number; qrText?: string; selected: boolean; onSelect?: (id: string | null) => void; onMove?: (id: string, x: number, y: number) => void; hideQr?: boolean }) {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [moved, setMoved] = useState(false);
  const interactive = !!onMove;
  const handlers = interactive ? {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (ev: GestureResponderEvent) => { drag.current = { sx: ev.nativeEvent.pageX, sy: ev.nativeEvent.pageY, ox: e.x, oy: e.y }; setMoved(false); onSelect?.(e.id); },
    onResponderMove: (ev: GestureResponderEvent) => {
      const d = drag.current; if (!d) return;
      const nx = Math.min(1, Math.max(0, d.ox + (ev.nativeEvent.pageX - d.sx) / W));
      const ny = Math.min(1, Math.max(0, d.oy + (ev.nativeEvent.pageY - d.sy) / H));
      setMoved(true); onMove?.(e.id, nx, ny);
    },
    onResponderRelease: () => { drag.current = null; },
    onResponderTerminationRequest: () => false,
  } : {};
  const frame = selected && interactive ? { borderWidth: 1.5, borderColor: '#4f8cff', borderStyle: 'dashed' as const, borderRadius: 4 } : null;
  void moved;
  const pos = { position: 'absolute' as const, start: e.x * W, top: e.y * H, opacity: e.op ?? 1, transform: e.rot ? [{ rotate: `${e.rot}deg` }] : undefined };
  const handles = selected && interactive && onPatch ? <Handles e={e} onPatch={onPatch} W={W} /> : null;
  if (e.t === 'field' || e.t === 'text') {
    const text = e.t === 'field' ? fieldText(e.field, data) : e.text;
    if (!text && !interactive) return null;
    return (
      <View {...handlers} style={[pos, frame, { maxWidth: W * (1 - e.x) - 2, minWidth: 16 }]} accessibilityLabel={text || undefined}>
        <RNText numberOfLines={e.t === 'field' && e.field === 'skills' ? 2 : 1} style={{ color: e.color, fontSize: e.size * k, fontFamily: fontFamily(e.font), fontWeight: e.bold ? '800' : '500', opacity: text ? 1 : 0.35 }}>{text || '(vuoto)'}</RNText>
        {handles}
      </View>
    );
  }
  if (e.t === 'image') {
    const w = e.w * W;
    return <View {...handlers} style={[pos, frame, { width: w, height: w }]}><View style={{ width: w, height: w, borderRadius: e.round ? w / 2 : 4, overflow: 'hidden' }}><Image source={{ uri: e.uri }} style={{ width: w, height: w }} contentFit="cover" /></View>{handles}</View>;
  }
  if (e.t === 'shape') {
    const w = e.w * W, h = e.h * H;
    return <View {...handlers} style={[pos, frame, { width: w, height: h, backgroundColor: e.color, borderRadius: e.shape === 'circle' ? Math.max(w, h) / 2 : e.shape === 'line' ? h : 3 }]}>{handles}</View>;
  }
  if (e.t === 'qr') {
    if (hideQr || !qrText) return interactive ? <View {...handlers} style={[pos, frame, { width: e.w * W, height: e.w * W, backgroundColor: '#fff', borderRadius: 3 }]}>{handles}</View> : null;
    return <View {...handlers} style={[pos, frame]}><QrView text={qrText} size={e.w * W} color={e.color} />{handles}</View>;
  }
  return null;
}

/** Maniglie dell'elemento scelto: l'angolo in basso a destra ridimensiona, il cerchio in alto ruota (si aggancia a 0, 90, 180). */
function Handles({ e, onPatch, W }: { e: El; onPatch: (id: string, p: Partial<El>) => void; W: number }) {
  const start = useRef<{ x: number; el: El; rot: number } | null>(null);
  const eRef = useRef(e); eRef.current = e;
  const dot = { position: 'absolute' as const, width: 22, height: 22, borderRadius: 11, backgroundColor: '#4f8cff', borderWidth: 2, borderColor: '#fff' };
  const mk = (kind: 'size' | 'rot') => ({
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (ev: GestureResponderEvent) => { ev.stopPropagation?.(); start.current = { x: ev.nativeEvent.pageX, el: eRef.current, rot: eRef.current.rot ?? 0 }; },
    onResponderMove: (ev: GestureResponderEvent) => {
      const s = start.current; if (!s) return;
      const dx = ev.nativeEvent.pageX - s.x;
      if (kind === 'size') onPatch(s.el.id, scaleEl(s.el, Math.max(0.2, 1 + dx / (W * 0.45))));
      else onPatch(s.el.id, { rot: snapRot(s.rot + dx * 0.8) } as Partial<El>);
    },
    onResponderRelease: () => { start.current = null; },
  });
  return (
    <>
      <View {...mk('size')} accessibilityRole="adjustable" accessibilityLabel="Ridimensiona" style={[dot, { end: -12, bottom: -12 }]} />
      <View {...mk('rot')} accessibilityRole="adjustable" accessibilityLabel="Ruota" style={[dot, { alignSelf: 'center', top: -30, backgroundColor: '#7a5cff' }]} />
    </>
  );
}

/** Biglietto che si gira con un tocco (fronte/retro). Con "riduci animazioni" il cambio è immediato. */
export function FlipCard({ design, data, width, qrText, onFlip }: { design: CardDesign; data: CardData; width: number; qrText?: string; onFlip?: (s: 'front' | 'back') => void }) {
  const reduce = useReduceMotion();
  const [face, setFace] = useState<'front' | 'back'>('front');
  const sx = useRef(new Animated.Value(1)).current;
  const busy = useRef(false);
  useEffect(() => () => sx.stopAnimation(), [sx]);
  const flip = () => {
    if (busy.current) return;
    const next = face === 'front' ? 'back' : 'front';
    if (reduce) { setFace(next); onFlip?.(next); return; }
    busy.current = true;
    Animated.timing(sx, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setFace(next); onFlip?.(next);
      Animated.timing(sx, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(() => { busy.current = false; });
    });
  };
  const h = width / CARD_RATIO;
  return (
    <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={face === 'front' ? 'Biglietto da visita, fronte. Tocca per girarlo' : 'Biglietto da visita, retro. Tocca per girarlo'} style={{ width, height: h }}>
      <Animated.View style={{ width, height: h, transform: [{ scaleX: sx }], shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8, borderRadius: Math.max(6, width * 0.03) }}>
        <CardFace side={face === 'front' ? design.front : design.back} design={design} data={data} width={width} qrText={qrText} />
      </Animated.View>
    </Pressable>
  );
}
