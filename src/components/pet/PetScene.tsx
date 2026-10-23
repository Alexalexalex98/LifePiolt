import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Il «salotto» di Theia: cambia con l'ora (giorno, sera, notte). Solo disegno: nessun testo, niente da leggere. */
export type Phase = 'day' | 'evening' | 'night';
export const phaseOf = (hour: number): Phase => (hour >= 7 && hour < 18 ? 'day' : hour >= 18 && hour < 21 ? 'evening' : 'night');
const SKY: Record<Phase, [string, string]> = { day: ['#8fd3ff', '#d9f1ff'], evening: ['#ff9d6c', '#ffd7a8'], night: ['#0b1230', '#1b2650'] };
const FLOOR: Record<Phase, string> = { day: '#e8c9a0', evening: '#cf9a74', night: '#2a2f55' };
const WALL: Record<Phase, [string, string]> = { day: ['#f7efe4', '#efe0cc'], evening: ['#f1d2b6', '#e2b894'], night: ['#1c2347', '#232b57'] };

export function PetScene({ phase, accent }: { phase: Phase; accent: string }) {
  const night = phase === 'night';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={WALL[phase]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 700" preserveAspectRatio="xMidYMid slice">
        {/* pavimento */}
        <Rect x={0} y={470} width={360} height={230} fill={FLOOR[phase]} />
        <Rect x={0} y={466} width={360} height={8} fill={night ? '#3a4275' : '#00000012'} />
        {/* finestra */}
        <G>
          <Rect x={34} y={150} width={120} height={150} rx={14} fill={night ? '#3a4275' : '#fff'} />
          <Rect x={42} y={158} width={104} height={134} rx={9} fill={SKY[phase][0]} />
          <Rect x={42} y={225} width={104} height={67} rx={9} fill={SKY[phase][1]} opacity={0.9} />
          {night ? <><Path d="M118 188 a16 16 0 1 0 14 22 a12 12 0 1 1 -14 -22 Z" fill="#fff6c9" /><Circle cx={70} cy={188} r={2.2} fill="#fff" /><Circle cx={92} cy={210} r={1.8} fill="#fff" /><Circle cx={64} cy={238} r={1.6} fill="#fff" /></> : <Circle cx={phase === 'day' ? 112 : 70} cy={phase === 'day' ? 195 : 260} r={16} fill={phase === 'day' ? '#ffe27a' : '#ffb35c'} />}
          <Rect x={92} y={158} width={4} height={134} fill={night ? '#3a4275' : '#fff'} />
          <Rect x={42} y={222} width={104} height={4} fill={night ? '#3a4275' : '#fff'} />
        </G>
        {/* mensola con un quadretto */}
        <Rect x={206} y={190} width={110} height={8} rx={3} fill={night ? '#3a4275' : '#c9a57c'} />
        <Rect x={222} y={146} width={34} height={44} rx={5} fill={accent} opacity={0.85} />
        <Rect x={268} y={162} width={26} height={28} rx={5} fill={night ? '#56608f' : '#fff'} />
        {/* pianta */}
        <G>
          <Path d="M296 470 q-30 -40 -4 -96 q26 40 4 96 Z" fill="#4fae7b" />
          <Path d="M296 470 q-6 -44 36 -74 q8 44 -36 74 Z" fill="#6cc796" />
          <Path d="M296 470 q-44 -20 -48 -64 q40 8 48 64 Z" fill="#3f9b6a" />
          <Path d="M278 470 h36 l-6 40 h-24 Z" fill={night ? '#6b4f46' : '#b8765a'} />
        </G>
        {/* tappeto */}
        <Ellipse cx={180} cy={560} rx={120} ry={26} fill={accent} opacity={night ? 0.28 : 0.22} />
        <Ellipse cx={180} cy={560} rx={84} ry={17} fill={accent} opacity={night ? 0.2 : 0.18} />
      </Svg>
    </View>
  );
}
