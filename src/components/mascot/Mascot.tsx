import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { bodyTones, mix, type Expression } from '@/lib/mascot';

const LX = 78, RX = 122, EY = 108;
const star = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`;

const heart = (x: number, y: number, k = 1) => `M${x} ${y + 8 * k} C${x - 17 * k} ${y - 4 * k} ${x - 9 * k} ${y - 16 * k} ${x} ${y - 7 * k} C${x + 9 * k} ${y - 16 * k} ${x + 17 * k} ${y - 4 * k} ${x} ${y + 8 * k} Z`;
const spiral = (cx: number, cy: number) => { let d = ''; for (let i = 0; i <= 28; i++) { const a = i * 0.45, r = 1.2 + a * 1.45; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `; } return d; };

function Eyes({ e, ink, blink, glint }: { e: Expression; ink: string; blink: boolean; glint: string }) {
  const arc = (cx: number, up: boolean, w = 5) => <Path d={up ? `M${cx - 12} ${EY + 5} Q${cx} ${EY - 10} ${cx + 12} ${EY + 5}` : `M${cx - 12} ${EY + 1} Q${cx} ${EY + 9} ${cx + 12} ${EY + 1}`} stroke={ink} strokeWidth={w} strokeLinecap="round" fill="none" />;
  const oval = (cx: number, cy: number, rx: number, ry: number, rot = 0, g = false) => (
    <G rotation={rot} origin={`${cx}, ${cy}`}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={ink} />
      {g ? <><Circle cx={cx + rx * 0.28} cy={cy - ry * 0.42} r={Math.max(2.4, rx * 0.38)} fill={glint} /><Circle cx={cx - rx * 0.3} cy={cy + ry * 0.38} r={Math.max(1.2, rx * 0.15)} fill={glint} opacity={0.8} /></> : null}
    </G>
  );
  if (blink && ['neutral', 'thinking', 'understood', 'doubtful', 'surprised', 'sad', 'working', 'idea', 'nervous'].includes(e)) return <G>{arc(LX, false, 4)}{arc(RX, false, 4)}</G>;
  switch (e) {
    case 'happy': return <G>{arc(LX, true)}{arc(RX, true)}</G>;
    case 'celebrating': return <G>{arc(LX, true, 6)}{arc(RX, true, 6)}</G>;
    case 'sleepy': return <G><Path d={`M${LX - 12} ${EY + 4} Q${LX} ${EY + 10} ${LX + 12} ${EY + 3}`} stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" /><Path d={`M${RX - 12} ${EY + 3} Q${RX} ${EY + 10} ${RX + 12} ${EY + 4}`} stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" /></G>;
    case 'thinking': return <G>{oval(LX - 4, EY - 6, 6.5, 10, 0, true)}{oval(RX - 2, EY - 12, 6.5, 10, 0, true)}</G>;
    case 'understood': return <G>{oval(LX, EY, 9.5, 16, 0, true)}{oval(RX, EY, 9.5, 16, 0, true)}</G>;
    case 'doubtful': return <G>{oval(LX, EY + 6, 5, 6, 0)}{oval(RX, EY, 7, 12, 0, true)}</G>;
    case 'surprised': return <G>{oval(LX, EY, 10, 17, 0, true)}{oval(RX, EY, 10, 17, 0, true)}</G>;
    case 'sad': return <G>{oval(LX, EY + 4, 7.5, 9, -18, true)}{oval(RX, EY + 4, 7.5, 9, 18, true)}</G>;
    case 'working': return <G>{oval(LX, EY + 2, 7, 8)}{oval(RX, EY + 2, 7, 8)}<Path d={`M${LX - 10} ${EY - 11} L${LX + 8} ${EY - 5}`} stroke={ink} strokeWidth={4} strokeLinecap="round" /><Path d={`M${RX + 10} ${EY - 11} L${RX - 8} ${EY - 5}`} stroke={ink} strokeWidth={4} strokeLinecap="round" /></G>;
    case 'love': return <G><Path d={heart(LX, EY, 1)} fill={ink} /><Path d={heart(RX, EY, 1)} fill={ink} /></G>;
    case 'laughing': return <G>{arc(LX, true, 6)}{arc(RX, true, 6)}</G>;
    case 'wink': return <G>{arc(LX, true)}{oval(RX, EY, 7, 12, 0, true)}</G>;
    case 'angry': return <G>{oval(LX, EY + 3, 7, 8)}{oval(RX, EY + 3, 7, 8)}<Path d={`M${LX - 11} ${EY - 14} L${LX + 9} ${EY - 4}`} stroke={ink} strokeWidth={5} strokeLinecap="round" /><Path d={`M${RX + 11} ${EY - 14} L${RX - 9} ${EY - 4}`} stroke={ink} strokeWidth={5} strokeLinecap="round" /></G>;
    case 'crying': return <G>{oval(LX, EY + 2, 7.5, 9, -16, true)}{oval(RX, EY + 2, 7.5, 9, 16, true)}</G>;
    case 'blushing': return <G>{oval(LX + 4, EY - 4, 7, 11, 0, true)}{oval(RX + 4, EY - 4, 7, 11, 0, true)}</G>;
    case 'cool': return <G><Rect x={LX - 20} y={EY - 11} width={36} height={22} rx={9} fill={ink} /><Rect x={RX - 16} y={EY - 11} width={36} height={22} rx={9} fill={ink} /><Rect x={LX + 14} y={EY - 6} width={RX - LX - 12} height={4} fill={ink} /></G>;
    case 'sleeping': return <G><Path d={`M${LX - 12} ${EY + 2} Q${LX} ${EY + 11} ${LX + 12} ${EY + 2}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /><Path d={`M${RX - 12} ${EY + 2} Q${RX} ${EY + 11} ${RX + 12} ${EY + 2}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /></G>;
    case 'confused': return <G><Path d={spiral(LX, EY)} stroke={ink} strokeWidth={3.4} fill="none" strokeLinecap="round" /><Path d={spiral(RX, EY)} stroke={ink} strokeWidth={3.4} fill="none" strokeLinecap="round" /></G>;
    case 'idea': return <G>{oval(LX, EY, 8, 13, 0, true)}{oval(RX, EY, 8, 13, 0, true)}</G>;
    case 'proud': return <G><Path d={`M${LX - 12} ${EY} Q${LX} ${EY - 13} ${LX + 12} ${EY}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /><Path d={`M${RX - 12} ${EY} Q${RX} ${EY - 13} ${RX + 12} ${EY}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /></G>;
    case 'shy': return <G>{oval(LX - 4, EY + 6, 6.5, 8, -14, true)}{oval(RX - 4, EY + 6, 6.5, 8, -14, true)}<Path d={`M${RX - 12} ${EY - 8} L${RX + 6} ${EY - 11}`} stroke={ink} strokeWidth={3.5} strokeLinecap="round" /></G>;
    case 'excited': return <G><Path d={star(LX, EY, 13)} fill={ink} /><Path d={star(RX, EY, 13)} fill={ink} /></G>;
    case 'nervous': return <G>{oval(LX, EY + 2, 7, 11, 0, true)}{oval(RX, EY + 2, 7, 11, 0, true)}</G>;
    case 'thanks': return <G><Path d={`M${LX - 12} ${EY + 8} Q${LX} ${EY - 4} ${LX + 12} ${EY + 8}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /><Path d={`M${RX - 12} ${EY + 8} Q${RX} ${EY - 4} ${RX + 12} ${EY + 8}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" /></G>;
    case 'goodbye': return <G>{arc(LX, true)}{oval(RX, EY, 7, 12, 0, true)}</G>;
    default: return <G>{oval(LX, EY, 8.5, 15)}{oval(RX, EY, 8.5, 15)}</G>;
  }
}

function Extras({ e, tone, ink }: { e: Expression; tone: string; ink: string }) {
  switch (e) {
    case 'love': return <Path d={heart(160, 44, 0.9)} fill={tone} />;
    case 'laughing': return <G fill={tone}><Path d="M52 136 q-7 12 0 16 q7 -4 0 -16 Z" /><Path d="M148 136 q-7 12 0 16 q7 -4 0 -16 Z" /></G>;
    case 'wink': return <Path d={star(162, 42, 11)} fill={tone} />;
    case 'angry': return <G fill={tone} opacity={0.75}><Circle cx={30} cy={36} r={8} /><Circle cx={44} cy={26} r={6} /><Circle cx={170} cy={36} r={8} /><Circle cx={156} cy={26} r={6} /></G>;
    case 'crying': return <G fill={tone}><Path d="M64 128 q-8 14 0 19 q8 -5 0 -19 Z" /><Path d="M136 128 q-8 14 0 19 q8 -5 0 -19 Z" /></G>;
    case 'blushing': return <G fill={tone} opacity={0.35}><Ellipse cx={58} cy={134} rx={12} ry={8} /><Ellipse cx={142} cy={134} rx={12} ry={8} /></G>;
    case 'sleeping': return <G fill={tone}><SvgText x={140} y={52} fontSize={24} fontWeight="900">z</SvgText><SvgText x={156} y={36} fontSize={30} fontWeight="900">z</SvgText><SvgText x={172} y={18} fontSize={36} fontWeight="900">z</SvgText></G>;
    case 'confused': return <Path d="M140 34 q8 -10 16 0 t16 0" stroke={tone} strokeWidth={5} strokeLinecap="round" fill="none" />;
    case 'idea': return <G><Circle cx={160} cy={34} r={13} fill={tone} /><Rect x={154} y={46} width={12} height={8} rx={2} fill={ink} opacity={0.6} /></G>;
    case 'excited': return <G fill={tone}><Path d={star(30, 40, 11)} /><Path d={star(172, 36, 11)} /><Path d={star(168, 150, 7)} /></G>;
    case 'nervous': return <Path d="M150 70 q-9 16 0 22 q9 -6 0 -22 Z" fill={tone} />;
    case 'goodbye': return <G stroke={tone} strokeWidth={5} strokeLinecap="round" fill="none"><Path d="M168 84 q10 10 0 20" /><Path d="M180 76 q16 18 0 36" /></G>;
    case 'understood': return <Path d={star(160, 40, 13)} fill={tone} />;
    case 'doubtful': return <SvgText x={150} y={56} fontSize={38} fontWeight="900" fill={tone}>?</SvgText>;
    case 'working': return <G fill={tone}><Circle cx={148} cy={34} r={5} /><Circle cx={164} cy={34} r={5} /><Circle cx={180} cy={34} r={5} /></G>;
    case 'celebrating': return <G fill={tone}><Rect x={14} y={42} width={10} height={5} rx={2} rotation={-35} origin="19, 44" /><Rect x={172} y={40} width={10} height={5} rx={2} rotation={30} origin="177, 42" /><Circle cx={30} cy={24} r={3.5} /><Circle cx={170} cy={20} r={3.5} /><Rect x={96} y={4} width={9} height={5} rx={2} rotation={15} origin="100, 6" /></G>;
    default: return null;
  }
}

/**
 * Theia, la mascotte: una piccola sfera luminosa disegnata in vettoriale. Prende il colore dell'app, respira, sbatte gli occhi e cambia espressione.
 * Quando il colore cambia fa la sua piccola scena (si schiaccia, salta, gira su sé stessa, si illumina e festeggia) e poi torna all'espressione richiesta.
 */
export function Mascot({ size = 140, color, expression = 'neutral', animated = true, ritual = true, style }: { size?: number; color: string; expression?: Expression; animated?: boolean; ritual?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const live = animated && !reduce;
  const [shown, setShown] = useState(color);
  const [expr, setExpr] = useState<Expression>(expression);
  const [blink, setBlink] = useState(false);
  const [yaw, setYaw] = useState(0);
  const prev = useRef(color);
  const breathe = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current; // 0 a terra, 1 in alto
  const squash = useRef(new Animated.Value(0)).current; // 0 normale, 1 schiacciata
  const spin = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const expRef = useRef(expression); expRef.current = expression;

  useEffect(() => { setExpr(expression); }, [expression]);
  // rotazione su sé stessa: l'angolo (in radianti) guida occhi, riflesso e luce, così gira come una sfera e non come uno specchio
  useEffect(() => { const id = spin.addListener(({ value }) => setYaw(value * Math.PI * 2)); return () => spin.removeListener(id); }, [spin]);

  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [live, breathe]);

  useEffect(() => {
    if (!live) return;
    let h: ReturnType<typeof setTimeout>;
    const next = () => { h = setTimeout(() => { setBlink(true); h = setTimeout(() => { setBlink(false); next(); }, 130); }, 2400 + Math.random() * 2600); };
    next();
    return () => clearTimeout(h);
  }, [live]);

  useEffect(() => {
    if (color === prev.current) return;
    const from = prev.current; prev.current = color;
    if (!live || !ritual) { setShown(color); return; }
    // la scena del cambio colore
    setExpr('surprised');
    const tween = new Animated.Value(0);
    const sub = tween.addListener(({ value }) => setShown(mix(from, color, value)));
    Animated.parallel([
      Animated.timing(tween, { toValue: 1, duration: 650, delay: 250, useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(squash, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(hop, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(spin, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(hop, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.spring(squash, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([Animated.delay(480), Animated.timing(burst, { toValue: 1, duration: 520, useNativeDriver: true })]),
    ]).start(() => { tween.removeListener(sub); setShown(color); spin.setValue(0); burst.setValue(0); });
    const h1 = setTimeout(() => setExpr('celebrating'), 640);
    const h2 = setTimeout(() => setExpr(expRef.current), 1900);
    return () => { clearTimeout(h1); clearTimeout(h2); };
  }, [color, live, ritual, squash, hop, spin, burst]);

  const tones = useMemo(() => bodyTones(shown), [shown]);
  const sin = Math.sin(yaw), cos = Math.cos(yaw), front = cos > 0.02;
  const sy = Animated.add(breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, -0.2] }));
  const sx = Animated.add(breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.13] }));
  const ty = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.22] });

  return (
    <Animated.View accessibilityRole="image" accessibilityLabel="Theia" style={[{ width: size, height: size }, style, { transform: [{ translateY: ty }, { scaleX: sx }, { scaleY: sy }] }]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="body" cx={`${38 - sin * 26}%`} cy="28%" rx="85%" ry="85%" fx={`${38 - sin * 26}%`} fy="28%">
            <Stop offset="0" stopColor={tones.light} /><Stop offset="0.55" stopColor={tones.base} /><Stop offset="1" stopColor={tones.shade} />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0.35" stopColor={tones.glow} stopOpacity="0.5" /><Stop offset="1" stopColor={tones.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={112} r={98} fill="url(#glow)" opacity={0.55} />
        <Ellipse cx={100} cy={184} rx={54} ry={7} fill="#000" opacity={0.2} />
        <G transform={`translate(100 0) scale(${1 - 0.05 * Math.abs(sin)} 1) translate(-100 0)`}>
          <Path d="M86 22 C128 18 179 56 179 114 C179 158 147 182 100 182 C51 182 21 158 21 118 C21 68 50 26 86 22 Z" fill="url(#body)" />
        </G>
        {front ? (
          <G transform={`translate(${-sin * 20} 0)`} opacity={Math.min(1, cos * 2)}>
            <Path d="M44 78 Q48 46 82 34" stroke="#fff" strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.5} />
            <Path d={star(58, 60, 12)} fill="#fff" opacity={0.98} />
          </G>
        ) : null}
        <Ellipse cx={132} cy={150} rx={30} ry={11} fill="#fff" opacity={0.12} />
        {front ? (
          <G transform={`translate(${100 + sin * 62} 0) scale(${Math.max(0.12, cos)} 1) translate(-100 0)`} opacity={Math.min(1, cos * 3)}>
            <Eyes e={expr} ink={tones.eye} blink={blink} glint="#fff" />
          </G>
        ) : null}
        {Math.abs(sin) < 0.35 ? <Extras e={expr} tone={tones.glow} ink={tones.eye} /> : null}
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -size * 0.15, top: -size * 0.15, width: size * 1.3, height: size * 1.3, borderRadius: size, borderWidth: 3, borderColor: tones.glow, opacity: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }] }} />
    </Animated.View>
  );
}
