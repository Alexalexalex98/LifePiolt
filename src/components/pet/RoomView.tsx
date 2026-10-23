import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { Phase } from '@/components/pet/PetScene';
import type { Kind, Quality, RoomId } from '@/lib/petHome';

/**
 * Una stanza di Theia: pareti, pavimento e mobili disegnati in vettoriale. I mobili hanno tre qualità (semplice, bello, di pregio) e si consumano:
 * con l'usura si scuriscono e compaiono crepe. Coordinate in un riquadro 360×600 ancorato in basso, così il pavimento sta sempre sotto Theia.
 */
export type Placed = Partial<Record<Kind, { quality: Quality; wear: number }>>;
const WALL: Record<RoomId, [string, string]> = { living: ['#f3e7d4', '#e8d6bb'], bedroom: ['#e6dcf0', '#d3c5e6'], kitchen: ['#f4efd2', '#e6dfb0'], studio: ['#dfe9ef', '#c9d9e3'], terrace: ['#bfe3f7', '#e1f3fb'] };
const FLOOR: Record<RoomId, string> = { living: '#d9b98a', bedroom: '#c9ab88', kitchen: '#e2cba5', studio: '#bfa27c', terrace: '#b9b2a6' };
const NIGHT_DIM = '#0b1230';

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(r1! + (r2! - r1!) * t)}${h(g1! + (g2! - g1!) * t)}${h(b1! + (b2! - b1!) * t)}`;
}
const pal = (q: Quality, accent: string) => (q === 0 ? { m: '#b09273', d: '#8f7658', l: '#c9ae8f', t: '#00000000' } : q === 1 ? { m: accent, d: mix(accent, '#000000', 0.3), l: mix(accent, '#ffffff', 0.35), t: '#00000000' } : { m: mix(accent, '#ffffff', 0.12), d: mix(accent, '#000000', 0.25), l: mix(accent, '#ffffff', 0.5), t: '#f2c94c' });

function Art({ kind, q, accent, wear }: { kind: Kind; q: Quality; accent: string; wear: number }) {
  const c = pal(q, accent);
  const gold = c.t !== '#00000000';
  let body: JSX.Element;
  switch (kind) {
    case 'sofa': body = <G><Rect x={14} y={392} width={124} height={50} rx={12} fill={c.m} /><Rect x={22} y={374} width={108} height={36} rx={12} fill={c.l} /><Rect x={6} y={396} width={24} height={46} rx={10} fill={c.d} /><Rect x={122} y={396} width={24} height={46} rx={10} fill={c.d} /><Rect x={20} y={440} width={8} height={14} fill="#5a4636" /><Rect x={124} y={440} width={8} height={14} fill="#5a4636" />{q > 0 ? <Circle cx={52} cy={398} r={13} fill={c.d} /> : null}{gold ? <Rect x={14} y={430} width={124} height={4} rx={2} fill={c.t} /> : null}</G>; break;
    case 'bed': body = <G><Rect x={14} y={390} width={150} height={62} rx={8} fill={c.d} /><Rect x={14} y={372} width={14} height={80} rx={6} fill={c.m} /><Rect x={28} y={402} width={134} height={40} rx={10} fill={c.l} /><Rect x={32} y={392} width={40} height={20} rx={9} fill="#fff" opacity={0.9} /><Rect x={76} y={410} width={86} height={32} rx={8} fill={c.m} />{gold ? <Rect x={14} y={372} width={14} height={6} fill={c.t} /> : null}</G>; break;
    case 'table': body = <G><Ellipse cx={90} cy={420} rx={62} ry={14} fill={c.l} /><Rect x={84} y={420} width={12} height={36} fill={c.d} /><Ellipse cx={90} cy={456} rx={26} ry={5} fill={c.d} />{q > 0 ? <><Circle cx={74} cy={412} r={7} fill="#fff" opacity={0.85} /><Circle cx={108} cy={414} r={5} fill={c.m} /></> : null}{gold ? <Ellipse cx={90} cy={420} rx={62} ry={14} fill="none" stroke={c.t} strokeWidth={2} /> : null}</G>; break;
    case 'desk': body = <G><Rect x={14} y={410} width={140} height={10} rx={3} fill={c.l} /><Rect x={20} y={420} width={10} height={36} fill={c.d} /><Rect x={138} y={420} width={10} height={36} fill={c.d} /><Rect x={60} y={380} width={50} height={32} rx={4} fill="#2b3350" /><Rect x={64} y={384} width={42} height={24} rx={2} fill={q > 0 ? c.m : '#4f6fa5'} />{gold ? <Rect x={14} y={410} width={140} height={3} fill={c.t} /> : null}</G>; break;
    case 'bench': body = <G><Rect x={18} y={420} width={130} height={14} rx={5} fill={c.m} /><Rect x={18} y={396} width={130} height={14} rx={5} fill={c.l} /><Rect x={28} y={434} width={8} height={22} fill={c.d} /><Rect x={130} y={434} width={8} height={22} fill={c.d} /></G>; break;
    case 'wardrobe': body = <G><Rect x={252} y={300} width={86} height={156} rx={8} fill={c.m} /><Rect x={294} y={306} width={2} height={144} fill={c.d} /><Circle cx={288} cy={380} r={3} fill={gold ? c.t : c.d} /><Circle cx={302} cy={380} r={3} fill={gold ? c.t : c.d} /><Rect x={252} y={300} width={86} height={8} rx={4} fill={c.l} /></G>; break;
    case 'rug': body = <G><Ellipse cx={180} cy={528} rx={q === 0 ? 100 : 118} ry={q === 0 ? 24 : 30} fill={c.m} /><Ellipse cx={180} cy={528} rx={q === 0 ? 70 : 88} ry={q === 0 ? 15 : 20} fill={c.l} />{q > 0 ? <Ellipse cx={180} cy={528} rx={52} ry={11} fill={c.d} opacity={0.5} /> : null}{gold ? <Ellipse cx={180} cy={528} rx={118} ry={30} fill="none" stroke={c.t} strokeWidth={2.5} /> : null}</G>; break;
    case 'plant': body = <G><Path d="M296 456 h36 l-6 -34 h-24 Z" fill={q === 0 ? '#b8765a' : c.d} /><Path d="M314 424 q-26 -34 -4 -78 q24 34 4 78 Z" fill="#4fae7b" /><Path d="M314 424 q-4 -38 32 -62 q6 38 -32 62 Z" fill="#6cc796" /><Path d="M314 424 q-40 -16 -44 -54 q36 6 44 54 Z" fill="#3f9b6a" />{q > 1 ? <Path d="M314 424 q22 -18 22 -52 q-26 14 -22 52 Z" fill="#8fe0b0" /> : null}</G>; break;
    case 'lamp': body = <G><Rect x={262} y={360} width={4} height={96} fill={c.d} /><Ellipse cx={264} cy={456} rx={16} ry={4} fill={c.d} /><Path d="M244 366 l20 -34 l20 34 Z" fill={q === 0 ? '#f2e6c4' : c.l} /><Ellipse cx={264} cy={368} rx={36} ry={30} fill="#ffe9a8" opacity={0.18} />{gold ? <Line x1={244} y1={366} x2={284} y2={366} stroke={c.t} strokeWidth={2.5} /> : null}</G>; break;
    case 'art': body = <G><Rect x={142} y={284} width={78} height={58} rx={5} fill={q === 0 ? '#8f7658' : c.d} /><Rect x={148} y={290} width={66} height={46} rx={3} fill="#cfe9f7" /><Path d="M148 336 q22 -34 40 -10 q14 -18 26 10 Z" fill={q > 0 ? c.m : '#7aa56d'} /><Circle cx={198} cy={304} r={7} fill="#ffd75e" />{gold ? <Rect x={142} y={284} width={78} height={58} rx={5} fill="none" stroke={c.t} strokeWidth={2.5} /> : null}</G>; break;
    case 'shelf': body = <G><Rect x={232} y={330} width={100} height={8} rx={3} fill={c.d} /><Rect x={242} y={304} width={24} height={26} rx={4} fill={c.m} /><Rect x={272} y={314} width={18} height={16} rx={3} fill={c.l} /><Circle cx={312} cy={320} r={10} fill={q > 0 ? c.m : '#c9ae8f'} />{gold ? <Rect x={232} y={330} width={100} height={3} fill={c.t} /> : null}</G>; break;
  }
  const w = Math.min(100, Math.max(0, wear));
  return (
    <G opacity={1 - w * 0.0035}>
      {body}
      {w >= 40 ? <Rect x={0} y={250} width={360} height={220} fill="#4a3a2a" opacity={w / 400} /> : null}
      {w >= 70 ? <G stroke="#3a2c20" strokeWidth={1.6} opacity={0.6}><Path d={kind === 'rug' ? 'M150 528 l10 -6 l8 8' : kind === 'sofa' ? 'M70 410 l8 12 l-6 8' : kind === 'bed' ? 'M90 420 l10 8 l-4 8' : kind === 'plant' ? 'M312 440 l6 8' : 'M120 420 l8 10 l-6 6'} fill="none" /></G> : null}
    </G>
  );
}

export function RoomView({ room, phase, accent, placed, tier }: { room: RoomId; phase: Phase; accent: string; placed: Placed; tier: number }) {
  const night = phase === 'night', eve = phase === 'evening';
  const [w, setW] = useState(0);
  const order: Kind[] = ['art', 'shelf', 'wardrobe', 'rug', 'bed', 'sofa', 'table', 'desk', 'bench', 'plant', 'lamp'];
  if (room === 'living' || room === 'bedroom' || room === 'kitchen' || room === 'studio' || room === 'terrace') { /* tutte le stanze usano lo stesso riquadro */ }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? <Svg width={w} height={(w * 380) / 360} style={{ position: 'absolute', bottom: 0, left: 0 }} viewBox="0 220 360 380">
        <Rect x={0} y={0} width={360} height={600} fill={WALL[room][0]} />
        <Rect x={0} y={250} width={360} height={210} fill={WALL[room][1]} />
        {/* finestra o vista */}
        {room === 'terrace' ? (
          <G>
            <Rect x={0} y={250} width={360} height={205} fill={night ? '#16204a' : eve ? '#ffb88a' : '#aee0fa'} />
            <Path d="M0 410 h30 v-60 h24 v60 h20 v-90 h30 v90 h30 v-40 h26 v40 h32 v-110 h26 v110 h28 v-70 h24 v70 h90 v45 h-360 Z" fill={night ? '#0e1636' : '#8fb3cf'} opacity={0.8} />
            <Rect x={0} y={452} width={360} height={5} fill="#caa57c" /><G stroke="#9a7a58" strokeWidth={3}>{[20, 70, 120, 170, 220, 270, 320].map((x) => <Line key={x} x1={x} y1={420} x2={x} y2={456} />)}</G><Line x1={0} y1={420} x2={360} y2={420} stroke="#9a7a58" strokeWidth={4} />
          </G>
        ) : (
          <G>
            <Rect x={238} y={262} width={100} height={110} rx={10} fill={night ? '#3a4275' : '#fff'} />
            <Rect x={246} y={270} width={84} height={94} rx={6} fill={night ? '#16204a' : eve ? '#ffb88a' : '#9fd6f5'} />
            {night ? <Path d="M296 290 a12 12 0 1 0 10 16 a9 9 0 1 1 -10 -16 Z" fill="#fff6c9" /> : <Circle cx={310} cy={290} r={11} fill={eve ? '#ffb35c' : '#ffe27a'} />}
            <Rect x={286} y={270} width={3} height={94} fill={night ? '#3a4275' : '#fff'} /><Rect x={246} y={314} width={84} height={3} fill={night ? '#3a4275' : '#fff'} />
          </G>
        )}
        {/* pavimento */}
        <Rect x={0} y={455} width={360} height={145} fill={FLOOR[room]} />
        <Rect x={0} y={451} width={360} height={7} fill="#00000018" />
        {room !== 'terrace' && tier >= 3 ? <Rect x={0} y={250} width={360} height={6} fill="#f2c94c" opacity={0.5} /> : null}
        {order.map((k) => (placed[k] ? <Art key={k} kind={k} q={placed[k]!.quality} accent={accent} wear={placed[k]!.wear} /> : null))}
        {/* luce serale o notturna sopra a tutto */}
        {night ? <Rect x={0} y={0} width={360} height={600} fill={NIGHT_DIM} opacity={0.38} /> : eve ? <Rect x={0} y={0} width={360} height={600} fill="#ff8a3d" opacity={0.1} /> : null}
      </Svg> : null}
    </View>
  );
}
