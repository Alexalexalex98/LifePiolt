import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { bodyTones, mix, type Expression } from '@/lib/mascot';

const LX = 78, RX = 122, EY = 108;
const star = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`;

function Eyes({ e, ink, blink, glint }: { e: Expression; ink: string; blink: boolean; glint: string }) {
  const arc = (cx: number, up: boolean, w = 5) => <Path d={up ? `M${cx - 12} ${EY + 5} Q${cx} ${EY - 10} ${cx + 12} ${EY + 5}` : `M${cx - 12} ${EY + 1} Q${cx} ${EY + 9} ${cx + 12} ${EY + 1}`} stroke={ink} strokeWidth={w} strokeLinecap="round" fill="none" />;
  const oval = (cx: number, cy: number, rx: number, ry: number, rot = 0, g = false) => (
    <G rotation={rot} origin={`${cx}, ${cy}`}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={ink} />
      {g ? <Circle cx={cx + rx * 0.3} cy={cy - ry * 0.4} r={Math.max(2, rx * 0.34)} fill={glint} /> : null}
    </G>
  );
  if (blink && !['happy', 'celebrating', 'sleepy'].includes(e)) return <G>{arc(LX, false, 4)}{arc(RX, false, 4)}</G>;
  switch (e) {
    case 'happy': return <G>{arc(LX, true)}{arc(RX, true)}</G>;
    case 'celebrating': return <G>{arc(LX, true, 6)}{arc(RX, true, 6)}</G>;
    case 'sleepy': return <G><Path d={`M${LX - 12} ${EY + 4} Q${LX} ${EY + 10} ${LX + 12} ${EY + 3}`} stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" /><Path d={`M${RX - 12} ${EY + 3} Q${RX} ${EY + 10} ${RX + 12} ${EY + 4}`} stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" /></G>;
    case 'thinking': return <G>{oval(LX - 4, EY - 6, 6.5, 10, 0, true)}{oval(RX - 2, EY - 12, 6.5, 10, 0, true)}</G>;
    case 'understood': return <G>{oval(LX, EY, 8.5, 14, 0, true)}{oval(RX, EY, 8.5, 14, 0, true)}</G>;
    case 'doubtful': return <G>{oval(LX, EY + 6, 5, 6, 0)}{oval(RX, EY, 7, 12, 0, true)}</G>;
    case 'surprised': return <G>{oval(LX, EY, 9, 15, 0, true)}{oval(RX, EY, 9, 15, 0, true)}</G>;
    case 'sad': return <G>{oval(LX, EY + 4, 7.5, 9, -18, true)}{oval(RX, EY + 4, 7.5, 9, 18, true)}</G>;
    case 'working': return <G>{oval(LX, EY + 2, 7, 8)}{oval(RX, EY + 2, 7, 8)}<Path d={`M${LX - 10} ${EY - 11} L${LX + 8} ${EY - 5}`} stroke={ink} strokeWidth={4} strokeLinecap="round" /><Path d={`M${RX + 10} ${EY - 11} L${RX - 8} ${EY - 5}`} stroke={ink} strokeWidth={4} strokeLinecap="round" /></G>;
    default: return <G>{oval(LX, EY, 7, 12)}{oval(RX, EY, 7, 12)}</G>;
  }
}

function Extras({ e, tone }: { e: Expression; tone: string }) {
  switch (e) {
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
  const prev = useRef(color);
  const breathe = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current; // 0 a terra, 1 in alto
  const squash = useRef(new Animated.Value(0)).current; // 0 normale, 1 schiacciata
  const spin = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const expRef = useRef(expression); expRef.current = expression;

  useEffect(() => { setExpr(expression); }, [expression]);

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
  const sy = Animated.add(breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, -0.2] }));
  const sx = Animated.add(breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.13] }));
  const flip = spin.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.06, -1, 0.06, 1] });
  const ty = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.22] });

  return (
    <Animated.View accessibilityRole="image" accessibilityLabel="Theia" style={[{ width: size, height: size }, style, { transform: [{ translateY: ty }, { scaleX: Animated.multiply(sx, flip) }, { scaleY: sy }] }]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="body" cx="38%" cy="28%" rx="85%" ry="85%" fx="38%" fy="28%">
            <Stop offset="0" stopColor={tones.light} /><Stop offset="0.55" stopColor={tones.base} /><Stop offset="1" stopColor={tones.shade} />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0.35" stopColor={tones.glow} stopOpacity="0.5" /><Stop offset="1" stopColor={tones.glow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={112} r={98} fill="url(#glow)" opacity={0.55} />
        <Ellipse cx={100} cy={184} rx={54} ry={7} fill="#000" opacity={0.2} />
        <Path d="M100 22 C142 22 176 62 176 114 C176 156 146 180 100 180 C54 180 24 156 24 114 C24 62 58 22 100 22 Z" fill="url(#body)" />
        <Path d="M54 66 Q62 42 90 34" stroke="#fff" strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.55} />
        <Path d={star(60, 62, 9)} fill="#fff" opacity={0.95} />
        <Eyes e={expr} ink={tones.eye} blink={blink} glint="#fff" />
        <Extras e={expr} tone={tones.glow} />
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -size * 0.15, top: -size * 0.15, width: size * 1.3, height: size * 1.3, borderRadius: size, borderWidth: 3, borderColor: tones.glow, opacity: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }] }} />
    </Animated.View>
  );
}
