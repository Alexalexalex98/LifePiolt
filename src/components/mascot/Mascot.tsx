import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { bodyTones, mix, type Expression } from '@/lib/mascot';

const LX = 75, RX = 125, EY = 122;
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
    default: return <G>{oval(LX, EY, 8.5, 14.5)}{oval(RX, EY, 8.5, 14.5)}</G>;
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
          <Path d="M93.0 52.0 C94.8 52.0 96.5 52.0 98.3 52.1 C100.0 52.2 101.8 52.4 103.5 52.6 C105.2 52.8 107.0 52.9 108.8 53.2 C110.5 53.5 112.3 53.8 114.0 54.2 C115.7 54.6 117.5 55.0 119.2 55.4 C120.9 55.8 122.6 56.3 124.3 56.9 C126.0 57.5 127.7 58.1 129.4 58.7 C131.1 59.3 132.7 60.0 134.3 60.7 C135.9 61.4 137.4 62.2 139.0 63.0 C140.6 63.8 142.1 64.6 143.6 65.4 C145.1 66.2 146.6 67.2 148.1 68.1 C149.6 69.0 151.0 70.0 152.3 71.0 C153.7 72.0 154.9 73.0 156.2 74.1 C157.5 75.2 158.8 76.3 160.0 77.4 C161.2 78.5 162.3 79.7 163.4 80.9 C164.5 82.1 165.6 83.3 166.6 84.5 C167.6 85.7 168.6 87.0 169.5 88.3 C170.4 89.6 171.3 90.8 172.1 92.1 C172.9 93.4 173.6 94.8 174.3 96.1 C175.0 97.4 175.6 98.8 176.2 100.2 C176.8 101.6 177.4 102.9 177.8 104.3 C178.2 105.7 178.6 107.1 178.9 108.5 C179.2 109.9 179.5 111.3 179.7 112.7 C179.9 114.1 180.0 114.5 180.0 117.0 C180.0 119.5 180.0 124.8 179.9 127.6 C179.8 130.4 179.7 131.8 179.5 133.7 C179.3 135.6 179.2 137.3 179.0 138.9 C178.8 140.5 178.5 142.0 178.2 143.4 C177.9 144.8 177.5 146.2 177.1 147.5 C176.7 148.8 176.3 150.1 175.9 151.3 C175.5 152.5 174.9 153.6 174.4 154.7 C173.9 155.8 173.3 156.9 172.7 157.9 C172.1 158.9 171.4 159.9 170.7 160.9 C170.0 161.9 169.4 162.8 168.6 163.7 C167.8 164.6 166.9 165.4 166.1 166.2 C165.2 167.0 164.4 167.8 163.5 168.6 C162.6 169.3 161.6 170.0 160.6 170.7 C159.6 171.4 158.6 172.1 157.5 172.7 C156.4 173.3 155.3 173.9 154.1 174.5 C152.9 175.1 151.7 175.6 150.4 176.1 C149.1 176.6 147.8 177.1 146.4 177.5 C145.0 177.9 143.7 178.3 142.2 178.7 C140.7 179.1 139.1 179.4 137.5 179.7 C135.9 180.0 134.3 180.2 132.5 180.5 C130.7 180.8 128.9 181.0 126.9 181.2 C124.9 181.4 122.9 181.5 120.6 181.6 C118.3 181.7 116.4 181.8 113.0 181.9 C109.6 182.0 104.3 182.0 100.0 182.0 C95.7 182.0 90.4 182.0 87.0 181.9 C83.6 181.8 81.7 181.7 79.4 181.6 C77.1 181.5 75.1 181.4 73.1 181.2 C71.1 181.0 69.3 180.8 67.5 180.5 C65.7 180.2 64.1 180.0 62.5 179.7 C60.9 179.4 59.3 179.1 57.8 178.7 C56.3 178.3 55.0 177.9 53.6 177.5 C52.2 177.1 50.9 176.6 49.6 176.1 C48.3 175.6 47.1 175.1 45.9 174.5 C44.7 173.9 43.6 173.3 42.5 172.7 C41.4 172.1 40.4 171.4 39.4 170.7 C38.4 170.0 37.4 169.3 36.5 168.6 C35.6 167.8 34.8 167.0 33.9 166.2 C33.0 165.4 32.2 164.6 31.4 163.7 C30.6 162.8 30.0 161.9 29.3 160.9 C28.6 159.9 27.9 158.9 27.3 157.9 C26.7 156.9 26.1 155.8 25.6 154.7 C25.1 153.6 24.6 152.5 24.1 151.3 C23.7 150.1 23.3 148.8 22.9 147.5 C22.5 146.2 22.1 144.8 21.8 143.4 C21.5 142.0 21.2 140.5 21.0 138.9 C20.8 137.3 20.6 135.6 20.5 133.7 C20.4 131.8 20.2 130.4 20.1 127.6 C20.0 124.8 20.0 119.5 20.0 117.0 C20.0 114.5 19.9 114.1 20.0 112.7 C20.1 111.3 20.2 109.9 20.3 108.5 C20.4 107.1 20.6 105.7 20.8 104.3 C21.0 102.9 21.4 101.6 21.7 100.2 C22.0 98.8 22.4 97.4 22.8 96.1 C23.2 94.8 23.8 93.4 24.3 92.1 C24.8 90.8 25.4 89.6 26.0 88.3 C26.6 87.0 27.4 85.7 28.1 84.5 C28.8 83.3 29.6 82.1 30.4 80.9 C31.2 79.7 32.1 78.5 33.0 77.4 C33.9 76.3 34.9 75.2 35.9 74.1 C36.9 73.0 38.0 72.0 39.1 71.0 C40.2 70.0 41.4 69.0 42.6 68.1 C43.8 67.2 45.0 66.2 46.2 65.4 C47.5 64.6 48.8 63.8 50.1 63.0 C51.5 62.2 52.9 61.4 54.3 60.7 C55.7 60.0 57.1 59.3 58.6 58.7 C60.1 58.1 61.6 57.5 63.1 56.9 C64.6 56.3 66.2 55.8 67.8 55.4 C69.4 55.0 71.0 54.6 72.6 54.2 C74.2 53.8 75.9 53.5 77.6 53.2 C79.3 52.9 80.9 52.8 82.6 52.6 C84.3 52.4 86.1 52.2 87.8 52.1 C89.5 52.0 91.2 52.0 93.0 52.0 Z" fill="url(#body)" />
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
            <Eyes e={expr} ink={tones.eye} blink={blink} glint="#fff" />
          </G>
        ) : null}
        {Math.abs(sin) < 0.35 ? <Extras e={expr} tone={tones.glow} ink={tones.eye} /> : null}
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -size * 0.15, top: -size * 0.15, width: size * 1.3, height: size * 1.3, borderRadius: size, borderWidth: 3, borderColor: tones.glow, opacity: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }] }} />
    </Animated.View>
  );
}
