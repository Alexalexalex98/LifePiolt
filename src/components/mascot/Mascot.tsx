import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { EYES_OF, bodyTones, mix, type Expression } from '@/lib/mascot';

const LX = 76, RX = 124, EY = 128;
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
    case 'understood': return <G>{oval(LX, EY, 9, 15.5, 0, true)}{oval(RX, EY, 9, 15.5, 0, true)}</G>;
    case 'doubtful': return <G>{oval(LX, EY + 6, 5, 6, 0)}{oval(RX, EY, 7, 12, 0, true)}</G>;
    case 'surprised': return <G>{oval(LX, EY, 9.5, 17, 0, true)}{oval(RX, EY, 9.5, 17, 0, true)}</G>;
    case 'sad': return <G>{oval(LX, EY + 4, 7.5, 9, -18, true)}{oval(RX, EY + 4, 7.5, 9, 18, true)}</G>;
    case 'working': return <G>{oval(LX, EY + 2, 7, 8)}{oval(RX, EY + 2, 7, 8)}<Path d={`M${LX - 9} ${EY - 17} L${LX + 8} ${EY - 18}`} stroke={ink} strokeWidth={3.5} strokeLinecap="round" /><Path d={`M${RX + 9} ${EY - 17} L${RX - 8} ${EY - 18}`} stroke={ink} strokeWidth={3.5} strokeLinecap="round" /></G>;
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
    default: return <G>{oval(LX, EY, 8.5, 14.5)}{oval(RX, EY, 8.5, 14.5)}</G>;
  }
}

function Extras({ e, tone, ink }: { e: Expression; tone: string; ink: string }) {
  switch (e) {
    case 'ok': return <Path d="M146 38 l10 11 l22 -26" stroke={tone} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'no': return <Path d="M148 22 l26 26 M174 22 l-26 26" stroke={tone} strokeWidth={8} strokeLinecap="round" fill="none" />;
    case 'bored': return <G fill={tone}><Circle cx={150} cy={40} r={4} /><Circle cx={164} cy={40} r={4} /><Circle cx={178} cy={40} r={4} /></G>;
    case 'suspicious': return <Path d="M62 88 L92 94 M138 94 L108 88" stroke={ink} strokeWidth={5} strokeLinecap="round" />;
    case 'curious': return <SvgText x={150} y={56} fontSize={38} fontWeight="900" fill={tone}>?</SvgText>;
    case 'shock': return <G stroke={tone} strokeWidth={5} strokeLinecap="round"><Path d="M24 56 l12 8 M18 82 l14 0 M176 56 l-12 8 M182 82 l-14 0 M100 20 l0 14" /></G>;
    case 'embarrassed': return <G><Path d="M156 58 q-9 16 0 22 q9 -6 0 -22 Z" fill={tone} /><Ellipse cx={54} cy={140} rx={12} ry={8} fill={tone} opacity={0.35} /><Ellipse cx={146} cy={140} rx={12} ry={8} fill={tone} opacity={0.35} /></G>;
    case 'grimace': return <Path d="M140 34 q8 -10 16 0 t16 0" stroke={tone} strokeWidth={5} strokeLinecap="round" fill="none" />;
    case 'sorry': return <G fill={tone}><Path d="M158 52 q-8 14 0 19 q8 -5 0 -19 Z" /><Path d="M60 40 q8 -10 16 0 q-8 6 -16 0 Z" /></G>;
    case 'wait': return <G stroke={tone} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none"><Path d="M150 18 h24 M150 54 h24 M154 18 q0 18 10 18 q10 0 10 -18 M154 54 q0 -18 10 -18 q10 0 10 18" /></G>;
    case 'worried': return <G stroke={tone} strokeWidth={4} strokeLinecap="round"><Path d="M60 72 l8 -6 M140 66 l8 6 M156 40 l0 12" /></G>;
    case 'relaxed': return <Path d="M150 52 q4 -28 28 -30 q0 26 -28 30 Z" fill={tone} />;
    case 'hungry': return <G><Circle cx={162} cy={40} r={14} fill={tone} /><G fill={ink} opacity={0.7}><Circle cx={157} cy={36} r={2.4} /><Circle cx={166} cy={42} r={2.4} /><Circle cx={158} cy={46} r={2} /></G></G>;
    case 'cold': return <G stroke={tone} strokeWidth={4} strokeLinecap="round"><Path d="M162 20 v28 M148 28 l28 12 M176 28 l-28 12" /><Path d="M34 90 l-8 6 l8 6 M166 90 l8 6 l-8 6" /></G>;
    case 'morning': return <G><Circle cx={160} cy={36} r={13} fill={tone} /><G stroke={tone} strokeWidth={4} strokeLinecap="round"><Path d="M160 10 v6 M138 36 h6 M182 36 h-6 M144 20 l4 4 M176 20 l-4 4" /></G></G>;
    case 'night': return <G fill={tone}><Path d="M150 20 a18 18 0 1 0 22 26 a14 14 0 1 1 -22 -26 Z" /><Path d={star(30, 38, 6)} /><Path d={star(176, 70, 5)} /></G>;
    case 'coffee': return <G><Path d="M142 26 h30 v22 a12 12 0 0 1 -12 12 h-6 a12 12 0 0 1 -12 -12 Z" fill={tone} /><Path d="M172 32 h6 a7 7 0 0 1 0 16 h-6" stroke={tone} strokeWidth={4} fill="none" /><Path d="M150 10 q-5 6 0 12 M162 8 q-5 6 0 12" stroke={tone} strokeWidth={3} strokeLinecap="round" fill="none" /></G>;
    case 'alarm': return <G><Circle cx={160} cy={40} r={16} fill={tone} /><Path d="M160 30 v10 l8 4" stroke={ink} strokeWidth={3} strokeLinecap="round" fill="none" /><Circle cx={146} cy={22} r={6} fill={tone} /><Circle cx={174} cy={22} r={6} fill={tone} /></G>;
    case 'late': return <G stroke={tone} strokeWidth={5} strokeLinecap="round"><Path d="M14 80 h22 M10 100 h26 M14 120 h22" /></G>;
    case 'workout': return <G fill={tone}><Rect x={140} y={26} width={8} height={22} rx={3} /><Rect x={178} y={26} width={8} height={22} rx={3} /><Rect x={150} y={34} width={26} height={6} rx={2} /></G>;
    case 'water': return <G><Path d="M148 20 h26 l-4 34 h-18 Z" fill={tone} opacity={0.85} /><Path d="M151 34 h20" stroke="#fff" strokeWidth={3} opacity={0.7} /></G>;
    case 'eating': return <G stroke={tone} strokeWidth={4} strokeLinecap="round" fill="none"><Path d="M146 18 v36 M140 18 v14 q6 6 12 0 v-14" /><Path d="M172 18 q10 8 0 26 v10" /></G>;
    case 'money': return <G><Circle cx={160} cy={38} r={15} fill={tone} /><Circle cx={160} cy={38} r={9} stroke={ink} strokeWidth={2.5} fill="none" opacity={0.6} /><Path d="M154 38 l4 5 l9 -11" stroke={ink} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.8} /></G>;
    case 'saved': return <G fill={tone}><Circle cx={160} cy={36} r={13} /><Circle cx={184} cy={56} r={8} /><Path d={star(138, 24, 7)} /></G>;
    case 'travel': return <Path d="M140 44 l36 -22 l8 4 l-26 22 l4 14 l-6 2 l-8 -12 l-10 6 z" fill={tone} />;
    case 'reading': return <G fill={tone}><Path d="M140 28 q14 -6 24 2 v26 q-10 -8 -24 -2 Z" /><Path d="M188 28 q-14 -6 -24 2 v26 q10 -8 24 -2 Z" opacity={0.8} /></G>;
    case 'music': return <G fill={tone}><Ellipse cx={146} cy={50} rx={7} ry={5} /><Rect x={150} y={20} width={3.5} height={30} /><Ellipse cx={174} cy={44} rx={7} ry={5} /><Rect x={178} y={14} width={3.5} height={30} /><Path d="M150 20 l31 -6 v8 l-31 6 Z" /></G>;
    case 'calendar': return <G><Rect x={142} y={20} width={34} height={34} rx={6} fill={tone} /><Rect x={142} y={20} width={34} height={10} rx={4} fill={ink} opacity={0.55} /><Path d="M150 38 h6 M162 38 h6 M150 46 h6 M162 46 h6" stroke="#fff" strokeWidth={3} strokeLinecap="round" /></G>;
    case 'goal': return <G fill={tone}><Path d="M144 18 h32 v16 a16 16 0 0 1 -32 0 Z" /><Rect x={156} y={50} width={8} height={8} /><Rect x={148} y={58} width={24} height={6} rx={2} /><Path d="M144 24 h-8 q0 14 10 16 M176 24 h8 q0 14 -10 16" stroke={tone} strokeWidth={3} fill="none" /></G>;
    case 'birthday': return <G><Rect x={142} y={36} width={36} height={20} rx={5} fill={tone} /><Rect x={158} y={22} width={4} height={14} fill={ink} opacity={0.6} /><Path d="M160 10 q-5 8 0 12 q5 -4 0 -12 Z" fill={tone} /></G>;
    case 'vacation': return <G fill={tone}><Path d="M150 52 q-4 -26 26 -34 q2 24 -26 34 Z" /><Path d="M150 52 q-24 -6 -20 -30 q22 4 20 30 Z" opacity={0.8} /></G>;
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
export function Mascot({ size = 140, color, expression = 'neutral', animated = true, ritual = true, shake = false, style }: { size?: number; color: string; expression?: Expression; animated?: boolean; ritual?: boolean; /** il solletico: ride e trema */ shake?: boolean; style?: StyleProp<ViewStyle> }) {
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
  const wiggle = useRef(new Animated.Value(0)).current;
  const expRef = useRef(expression); expRef.current = expression;

  useEffect(() => { setExpr(shake ? 'laughing' : expression); }, [expression, shake]);
  useEffect(() => {
    if (!shake) { wiggle.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 180, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shake, wiggle]);
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
    <Animated.View accessibilityRole="image" accessibilityLabel="Theia" style={[{ width: size, height: size }, style, { transform: [{ translateY: ty }, { rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) }, { scaleX: sx }, { scaleY: sy }] }]}>
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
          <Path d="M89.0 34.0 C89.6 34.0 90.1 34.1 90.9 34.2 C91.7 34.4 92.9 34.6 94.0 34.9 C95.1 35.2 96.4 35.6 97.7 36.0 C99.0 36.4 100.5 36.9 102.0 37.5 C103.5 38.1 105.0 38.7 106.6 39.4 C108.2 40.1 109.9 40.9 111.6 41.7 C113.3 42.5 115.0 43.4 116.7 44.3 C118.4 45.2 120.2 46.2 122.0 47.3 C123.8 48.3 125.6 49.5 127.4 50.6 C129.2 51.8 130.9 53.0 132.7 54.2 C134.5 55.5 136.3 56.8 138.1 58.1 C139.9 59.4 141.6 60.7 143.3 62.1 C145.0 63.5 146.7 64.9 148.3 66.3 C150.0 67.7 151.6 69.2 153.2 70.7 C154.8 72.2 156.2 73.6 157.7 75.1 C159.2 76.6 160.6 78.1 162.0 79.6 C163.4 81.1 164.7 82.5 165.9 84.0 C167.1 85.5 168.3 86.9 169.4 88.3 C170.5 89.7 171.5 91.1 172.4 92.5 C173.3 93.9 174.2 95.2 175.0 96.5 C175.8 97.8 176.5 99.0 177.1 100.2 C177.7 101.4 178.2 102.5 178.6 103.5 C179.0 104.5 179.4 105.5 179.6 106.3 C179.8 107.0 179.9 106.1 180.0 108.0 C180.1 109.9 180.0 115.1 179.9 117.8 C179.8 120.5 179.7 122.4 179.5 124.4 C179.3 126.5 179.2 128.3 178.9 130.1 C178.7 131.9 178.3 133.6 178.0 135.2 C177.7 136.8 177.2 138.4 176.8 139.9 C176.4 141.4 175.9 142.9 175.4 144.3 C174.9 145.7 174.4 147.1 173.8 148.4 C173.2 149.7 172.6 151.1 171.9 152.3 C171.2 153.6 170.6 154.8 169.8 155.9 C169.1 157.1 168.2 158.1 167.4 159.2 C166.6 160.3 165.7 161.4 164.8 162.4 C163.9 163.4 162.9 164.3 161.9 165.2 C160.9 166.1 159.9 167.1 158.8 167.9 C157.7 168.8 156.6 169.5 155.4 170.3 C154.2 171.1 153.1 171.8 151.8 172.5 C150.6 173.2 149.2 173.9 147.9 174.5 C146.6 175.1 145.1 175.8 143.7 176.3 C142.3 176.9 140.8 177.3 139.3 177.8 C137.8 178.3 136.2 178.7 134.5 179.1 C132.8 179.5 131.2 179.8 129.4 180.1 C127.6 180.4 125.8 180.7 123.8 180.9 C121.8 181.1 119.9 181.3 117.7 181.5 C115.5 181.7 113.5 181.8 110.6 181.9 C107.6 182.0 103.5 182.0 100.0 182.0 C96.5 182.0 92.4 182.0 89.4 181.9 C86.5 181.8 84.5 181.7 82.3 181.5 C80.1 181.3 78.2 181.1 76.2 180.9 C74.2 180.7 72.4 180.4 70.6 180.1 C68.8 179.8 67.2 179.5 65.5 179.1 C63.9 178.7 62.2 178.3 60.7 177.8 C59.2 177.3 57.7 176.9 56.3 176.3 C54.9 175.8 53.5 175.1 52.1 174.5 C50.8 173.9 49.5 173.2 48.2 172.5 C47.0 171.8 45.8 171.1 44.6 170.3 C43.4 169.5 42.3 168.8 41.2 167.9 C40.1 167.1 39.1 166.1 38.1 165.2 C37.1 164.3 36.1 163.4 35.2 162.4 C34.3 161.4 33.4 160.3 32.6 159.2 C31.8 158.1 30.9 157.1 30.2 155.9 C29.4 154.8 28.8 153.6 28.1 152.3 C27.4 151.1 26.8 149.7 26.2 148.4 C25.6 147.1 25.1 145.7 24.6 144.3 C24.1 142.9 23.6 141.4 23.2 139.9 C22.8 138.4 22.4 136.8 22.0 135.2 C21.6 133.6 21.4 131.9 21.1 130.1 C20.9 128.3 20.7 126.5 20.5 124.4 C20.3 122.4 20.2 120.5 20.1 117.8 C20.0 115.1 20.0 109.9 20.0 108.0 C20.0 106.1 20.0 107.0 20.1 106.3 C20.2 105.5 20.3 104.5 20.5 103.5 C20.7 102.5 21.0 101.4 21.3 100.2 C21.6 99.0 22.1 97.8 22.5 96.5 C22.9 95.2 23.4 93.9 24.0 92.5 C24.6 91.1 25.2 89.7 25.9 88.3 C26.6 86.9 27.4 85.5 28.2 84.0 C29.0 82.5 29.9 81.1 30.8 79.6 C31.7 78.1 32.7 76.6 33.7 75.1 C34.7 73.6 35.8 72.2 36.9 70.7 C38.0 69.2 39.2 67.7 40.4 66.3 C41.6 64.9 42.8 63.5 44.1 62.1 C45.4 60.7 46.7 59.4 48.0 58.1 C49.3 56.8 50.7 55.5 52.1 54.2 C53.5 53.0 54.8 51.8 56.2 50.6 C57.6 49.5 59.1 48.3 60.5 47.3 C61.9 46.2 63.4 45.2 64.8 44.3 C66.2 43.4 67.6 42.5 69.0 41.7 C70.4 40.9 71.8 40.1 73.2 39.4 C74.6 38.7 75.9 38.1 77.2 37.5 C78.5 36.9 79.7 36.4 80.9 36.0 C82.1 35.6 83.2 35.2 84.3 34.9 C85.3 34.6 86.4 34.4 87.2 34.2 C88.0 34.1 88.4 34.0 89.0 34.0 Z" fill="url(#body)" />
        </G>
        {front ? (
          <G transform={`translate(${-sin * 20} 0)`} opacity={Math.min(1, cos * 2)}>
            <Path d="M38 104 Q40 76 78 62" stroke="#fff" strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.5} />
            <Path d={star(56, 78, 12)} fill="#fff" opacity={0.98} />
          </G>
        ) : null}
        <Ellipse cx={132} cy={150} rx={30} ry={11} fill="#fff" opacity={0.12} />
        {front ? (
          <G transform={`translate(${100 + sin * 62} 0) scale(${Math.max(0.12, cos)} 1) translate(-100 0)`} opacity={Math.min(1, cos * 3)}>
            <Eyes e={EYES_OF[expr] ?? expr} ink={tones.eye} blink={blink} glint="#fff" />
          </G>
        ) : null}
        {Math.abs(sin) < 0.35 ? <Extras e={expr} tone={tones.glow} ink={tones.eye} /> : null}
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -size * 0.15, top: -size * 0.15, width: size * 1.3, height: size * 1.3, borderRadius: size, borderWidth: 3, borderColor: tones.glow, opacity: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }] }} />
    </Animated.View>
  );
}
