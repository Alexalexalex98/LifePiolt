import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Image as SvgImage, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Phase } from '@/components/pet/PetScene';
import { isExtra, type Kind, type Quality, type RoomId } from '@/lib/petHome';
import { extraBody } from '@/components/pet/extraArt';

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
const shade = (c: string, t: number) => mix(c, t >= 0 ? '#ffffff' : '#000000', Math.abs(t));
/** Materiali: semplice (neutri), bello (nel colore di Theia), di pregio (colori ricchi e dettagli dorati). */
const MAT: Partial<Record<Kind, [string, string | null, string]>> = {
  sofa: ['#9aa3ad', null, '#2f8f6b'], bed: ['#d4dae0', null, '#7a56b0'], table: ['#c8a074', null, '#ebe7de'], desk: ['#c8a074', null, '#6b4326'], bench: ['#b98f5f', null, '#f1efe8'],
  wardrobe: ['#c8a074', null, '#8a5a3a'], rug: ['#c9b79c', null, '#b34a4a'], plant: ['#c47a5a', null, '#e2b64a'], lamp: ['#d9c9a0', null, '#e2b64a'], art: ['#a8845a', null, '#e2b64a'], shelf: ['#c8a074', null, '#6b4326'],
};
const baseOf = (k: Kind, q: Quality, accent: string) => { const m = MAT[k] ?? ['#c8a074', null, '#6b4326']; return q === 0 ? m[0] : q === 1 ? accent : m[2]; };

/** Gradiente verticale chiaro→scuro con id univoco per oggetto. */
function G2({ id, c, t = 0.28, b = 0.22 }: { id: string; c: string; t?: number; b?: number }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={shade(c, t)} /><Stop offset="1" stopColor={shade(c, -b)} />
    </LinearGradient>
  );
}
const Shadow = ({ cx, cy, rx }: { cx: number; cy: number; rx: number }) => <Ellipse cx={cx} cy={cy} rx={rx} ry={Math.max(6, rx * 0.1)} fill="#000" opacity={0.2} />;
const Gloss = ({ x, y, w, h, o = 0.3 }: { x: number; y: number; w: number; h: number; o?: number }) => <Ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="#fff" opacity={o} />;

/** Mobili disegnati a mano (immagini) in VISTA FRONTALE: dove c'è lo sprite si usa quello, altrimenti il disegno vettoriale (anch'esso frontale). x/y/w/h = riquadro nella stanza, appoggiato al pavimento. */
const SPRITES: Record<string, { src: number; x: number; y: number; w: number; h: number }> = {
  'bed:0': { src: require('../../../assets/pet/bed-0.png'), x: 23.8, y: 342.0, w: 112.4, h: 120.0 },
  'bed:1': { src: require('../../../assets/pet/bed-1.png'), x: 18.0, y: 366.3, w: 124.0, h: 95.7 },
  'bed:2': { src: require('../../../assets/pet/bed-2.png'), x: 30.4, y: 342.0, w: 99.3, h: 120.0 },
  'table:0': { src: require('../../../assets/pet/table-0.png'), x: 5.0, y: 371.7, w: 150.0, h: 90.3 },
  'table:1': { src: require('../../../assets/pet/table-1.png'), x: 14.0, y: 342.0, w: 132.1, h: 120.0 },
  'table:2': { src: require('../../../assets/pet/table-2.png'), x: 11.5, y: 342.0, w: 137.1, h: 120.0 },
  'desk:0': { src: require('../../../assets/pet/desk-0.png'), x: 17.2, y: 342.0, w: 125.5, h: 120.0 },
  'desk:1': { src: require('../../../assets/pet/desk-1.png'), x: 15.0, y: 342.0, w: 130.1, h: 120.0 },
  'desk:2': { src: require('../../../assets/pet/desk-2.png'), x: 5.0, y: 356.5, w: 150.0, h: 105.5 },
  'bench:0': { src: require('../../../assets/pet/bench-0.png'), x: 6.0, y: 355.5, w: 148.0, h: 106.5 },
  'bench:1': { src: require('../../../assets/pet/bench-1.png'), x: 6.0, y: 349.1, w: 148.0, h: 112.9 },
  'bench:2': { src: require('../../../assets/pet/bench-2.png'), x: 7.5, y: 342.0, w: 144.9, h: 120.0 },
  'armchair:0': { src: require('../../../assets/pet/armchair-0.png'), x: 167.0, y: 384.5, w: 76.0, h: 77.5 },
  'armchair:1': { src: require('../../../assets/pet/armchair-1.png'), x: 167.0, y: 388.7, w: 76.0, h: 73.3 },
  'armchair:2': { src: require('../../../assets/pet/armchair-2.png'), x: 168.6, y: 376.0, w: 72.9, h: 86.0 },
  'wardrobe:0': { src: require('../../../assets/pet/wardrobe-0.png'), x: 241.0, y: 303.6, w: 110.0, h: 158.4 },
  'sofa:0': { src: require('../../../assets/pet/sofa-0.png'), x: 2, y: 375, w: 150, h: 87 },
  'sofa:1': { src: require('../../../assets/pet/sofa-1.png'), x: 0, y: 372, w: 156, h: 90 },
  'sofa:2': { src: require('../../../assets/pet/sofa-2.png'), x: 0, y: 387, w: 156, h: 75 },
};

function Art({ kind, q, accent, wear }: { kind: Kind; q: Quality; accent: string; wear: number }) {
  const base = baseOf(kind, q, accent);
  const gold = q === 2 ? '#f2c94c' : null;
  const d = shade(base, -0.28), l = shade(base, 0.32);
  const id = `${kind}${q}`;
  const wood = q === 2 ? '#6b4326' : '#b98f5f';
  let body: JSX.Element;
  const sp = SPRITES[`${kind}:${q}`];
  if (sp) {
    body = (
      <G>
        <Shadow cx={sp.x + sp.w / 2} cy={461} rx={sp.w * 0.46} />
        <SvgImage x={sp.x} y={sp.y} width={sp.w} height={sp.h} href={sp.src} preserveAspectRatio="xMidYMax meet" />
      </G>
    );
  } else if (isExtra(kind)) {
    body = extraBody(kind, { q, accent, base, gold, id, shade, Shadow, Gloss, G2 });
  } else switch (kind) {
    case 'sofa': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} /><G2 id={`${id}b`} c={base} t={0.4} b={0.05} /><G2 id={`${id}c`} c={d} t={0.1} b={0.3} /></Defs>
        <Shadow cx={80} cy={458} rx={78} />
        <Rect x={20} y={366} width={112} height={56} rx={22} fill={`url(#${id}a)`} />
        {q === 2 ? [40, 62, 84, 106].map((x) => <Circle key={x} cx={x} cy={394} r={3} fill={gold!} />) : null}
        <Rect x={12} y={402} width={128} height={52} rx={18} fill={`url(#${id}c)`} />
        <Rect x={22} y={388} width={54} height={36} rx={14} fill={`url(#${id}b)`} /><Rect x={76} y={388} width={54} height={36} rx={14} fill={`url(#${id}b)`} />
        <Gloss x={30} y={392} w={36} h={10} /><Gloss x={84} y={392} w={36} h={10} />
        <Rect x={4} y={384} width={30} height={70} rx={15} fill={`url(#${id}a)`} /><Rect x={118} y={384} width={30} height={70} rx={15} fill={`url(#${id}a)`} />
        <Gloss x={8} y={388} w={20} h={12} o={0.28} /><Gloss x={122} y={388} w={20} h={12} o={0.28} />
        {[18, 126].map((x) => <Rect key={x} x={x} y={450} width={9} height={11} rx={3} fill={gold ?? wood} />)}
        {q >= 1 ? <><Rect x={30} y={376} width={26} height={28} rx={9} fill={shade(q === 1 ? '#ffd75e' : '#f3d9a4', 0)} transform="rotate(-10 43 390)" /><Rect x={98} y={378} width={24} height={26} rx={9} fill={q === 1 ? '#ffffff' : '#c9a0e8'} transform="rotate(8 110 390)" opacity={0.95} /></> : null}
      </G>); break;
    case 'bed': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} /><G2 id={`${id}w`} c={wood} /><G2 id={`${id}q`} c={q === 0 ? '#ffffff' : shade(base, 0.1)} t={0.06} b={0.18} /></Defs>
        <Shadow cx={96} cy={460} rx={92} />
        <Rect x={12} y={352} width={20} height={106} rx={9} fill={`url(#${id}w)`} />
        {q === 2 ? <><Rect x={12} y={352} width={20} height={6} rx={3} fill={gold!} /><Rect x={150} y={366} width={10} height={90} fill={gold!} /><Path d="M12 352 q86 -34 158 14 v26 q-80 -36 -158 -12 Z" fill="#ffffff" opacity={0.35} /></> : null}
        <Rect x={22} y={406} width={150} height={48} rx={12} fill={`url(#${id}w)`} />
        <Rect x={26} y={388} width={142} height={42} rx={14} fill="#f6f2ea" />
        <Rect x={40} y={378} width={46} height={26} rx={12} fill="#ffffff" /><Rect x={40} y={378} width={46} height={26} rx={12} fill="#000" opacity={0.05} />
        {q >= 1 ? <Rect x={92} y={374} width={42} height={26} rx={12} fill="#ffffff" /> : null}
        <Rect x={72} y={398} width={100} height={46} rx={14} fill={`url(#${id}q)`} />
        {q >= 1 ? [92, 118, 144].map((x) => <Line key={x} x1={x} y1={402} x2={x} y2={440} stroke={shade(base, -0.2)} strokeWidth={1.4} opacity={0.5} />) : null}
        <Gloss x={80} y={402} w={70} h={10} o={0.35} />
        <Rect x={26} y={452} width={9} height={11} rx={3} fill={gold ?? wood} /><Rect x={158} y={452} width={9} height={11} rx={3} fill={gold ?? wood} />
      </G>); break;
    case 'table': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} t={0.22} b={0.16} /><G2 id={`${id}w`} c={wood} /></Defs>
        <Shadow cx={90} cy={460} rx={64} />
        <Rect x={82} y={424} width={16} height={34} rx={6} fill={`url(#${id}w)`} /><Ellipse cx={90} cy={458} rx={30} ry={6} fill={shade(wood, -0.1)} />
        <Ellipse cx={90} cy={422} rx={66} ry={19} fill={shade(base, -0.18)} /><Ellipse cx={90} cy={417} rx={66} ry={19} fill={`url(#${id}a)`} />
        {q >= 1 ? <Path d="M24 417 q66 -22 132 0 q-2 14 -10 20 q-56 14 -112 0 q-8 -6 -10 -20 Z" fill={q === 1 ? '#fff' : '#ffffff'} opacity={0.5} /> : null}
        {q >= 1 ? <><Ellipse cx={72} cy={406} rx={9} ry={5} fill="#fff" /><Rect x={68} y={392} width={8} height={14} rx={3} fill="#7fb6e0" /><Circle cx={72} cy={388} r={6} fill="#ff7a8c" /><Circle cx={78} cy={391} r={4.5} fill="#ffd75e" /></> : null}
        {q === 2 ? <><Ellipse cx={116} cy={414} rx={11} ry={6} fill="#e8b24a" /><Circle cx={112} cy={410} r={4} fill="#d95550" /><Circle cx={120} cy={411} r={4} fill="#a8d560" /></> : null}
        {gold ? <Ellipse cx={90} cy={417} rx={66} ry={19} fill="none" stroke={gold} strokeWidth={2.4} /> : null}
        <Gloss x={46} y={404} w={50} h={9} o={0.3} />
      </G>); break;
    case 'desk': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} t={0.22} b={0.14} /><G2 id={`${id}w`} c={shade(base, -0.1)} /></Defs>
        <Shadow cx={86} cy={460} rx={80} />
        <Rect x={16} y={426} width={10} height={32} rx={4} fill={`url(#${id}w)`} /><Rect x={142} y={426} width={10} height={32} rx={4} fill={`url(#${id}w)`} />
        <Rect x={118} y={430} width={34} height={26} rx={5} fill={shade(base, -0.12)} />{gold ? <Circle cx={135} cy={443} r={2.6} fill={gold} /> : <Circle cx={135} cy={443} r={2.2} fill={d} />}
        <Path d="M10 424 l12 -14 h124 l12 14 Z" fill={`url(#${id}a)`} /><Rect x={10} y={424} width={148} height={8} rx={3} fill={shade(base, -0.2)} />
        <Gloss x={30} y={413} w={80} h={6} o={0.28} />
        {q >= 1 ? <><Path d="M58 410 l8 -26 h46 l8 26 Z" fill="#2b3350" /><Path d="M64 408 l6 -20 h38 l6 20 Z" fill="#7fb6e0" /><Rect x={62} y={408} width={52} height={5} rx={2} fill="#d5d9e2" /></> : <Rect x={64} y={394} width={44} height={16} rx={3} fill="#4f6fa5" />}
        {q >= 1 ? <><Rect x={26} y={398} width={12} height={12} rx={3} fill="#fff" /><Rect x={28} y={400} width={8} height={4} fill="#c9a0e8" /><Path d="M132 410 v-22 q10 -6 12 4" stroke="#8a8f9c" strokeWidth={3} fill="none" /><Path d="M140 390 q10 -2 10 6 h-14 Z" fill="#ffd75e" /></> : null}
        {q >= 1 ? <><Rect x={74} y={434} width={34} height={18} rx={8} fill={shade(accent, 0.1)} /><Rect x={80} y={448} width={22} height={9} rx={4} fill="#2b3350" /></> : null}
      </G>); break;
    case 'bench': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} t={0.22} b={0.16} /></Defs>
        <Shadow cx={86} cy={460} rx={74} />
        <Rect x={22} y={430} width={8} height={28} rx={3} fill={shade(base, -0.28)} /><Rect x={140} y={430} width={8} height={28} rx={3} fill={shade(base, -0.28)} />
        <Rect x={14} y={398} width={140} height={14} rx={6} fill={`url(#${id}a)`} /><Rect x={14} y={380} width={140} height={14} rx={6} fill={`url(#${id}a)`} />
        <Rect x={14} y={416} width={144} height={16} rx={7} fill={`url(#${id}a)`} />
        {q === 2 ? <Path d="M20 400 q8 -10 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#fff" strokeWidth={2} fill="none" opacity={0.7} /> : null}
        {q >= 1 ? <><Rect x={30} y={406} width={34} height={14} rx={7} fill={q === 1 ? '#ffd75e' : '#2aa6a0'} /><Rect x={104} y={406} width={34} height={14} rx={7} fill={q === 1 ? '#ffffff' : '#2aa6a0'} /></> : null}
        <Gloss x={30} y={418} w={90} h={5} o={0.3} />
      </G>); break;
    case 'wardrobe': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={base} t={0.2} b={0.18} /></Defs>
        <Shadow cx={296} cy={462} rx={52} />
        <Rect x={250} y={296} width={92} height={162} rx={10} fill={`url(#${id}a)`} />
        <Rect x={250} y={296} width={92} height={10} rx={5} fill={shade(base, 0.25)} />
        <Rect x={258} y={312} width={36} height={136} rx={6} fill={shade(base, q >= 1 ? 0.18 : 0.1)} /><Rect x={298} y={312} width={36} height={136} rx={6} fill={shade(base, q >= 1 ? 0.18 : 0.1)} />
        {q >= 1 ? <><Rect x={262} y={318} width={28} height={70} rx={4} fill="#cfe9f7" opacity={0.7} /><Path d="M264 380 l20 -50" stroke="#fff" strokeWidth={4} opacity={0.5} /></> : null}
        <Circle cx={289} cy={380} r={3.4} fill={gold ?? shade(base, -0.4)} /><Circle cx={303} cy={380} r={3.4} fill={gold ?? shade(base, -0.4)} />
        {gold ? <Rect x={250} y={296} width={92} height={162} rx={10} fill="none" stroke={gold} strokeWidth={2} /> : null}
        <Rect x={262} y={456} width={10} height={9} rx={3} fill={shade(base, -0.4)} /><Rect x={320} y={456} width={10} height={9} rx={3} fill={shade(base, -0.4)} />
      </G>); break;
    case 'rug': body = (
      <G>
        <Defs><RadialGradient id={`${id}r`} cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={shade(base, 0.3)} /><Stop offset="1" stopColor={shade(base, -0.12)} /></RadialGradient></Defs>
        <Ellipse cx={180} cy={534} rx={q === 0 ? 100 : 120} ry={q === 0 ? 22 : 29} fill="#000" opacity={0.14} />
        <Ellipse cx={180} cy={529} rx={q === 0 ? 100 : 120} ry={q === 0 ? 22 : 29} fill={`url(#${id}r)`} />
        <Ellipse cx={180} cy={529} rx={q === 0 ? 70 : 90} ry={q === 0 ? 14 : 19} fill="none" stroke={q === 2 ? '#f6e7c1' : '#ffffff'} strokeWidth={q === 0 ? 3 : 5} opacity={0.75} />
        {q >= 1 ? <Ellipse cx={180} cy={529} rx={56} ry={11} fill="none" stroke={shade(base, -0.3)} strokeWidth={3} opacity={0.6} strokeDasharray="4 5" /> : null}
        {q === 2 ? <><Ellipse cx={180} cy={529} rx={120} ry={29} fill="none" stroke="#f2c94c" strokeWidth={2.4} /><Path d="M180 512 l12 17 l-12 17 l-12 -17 Z" fill="#f6e7c1" opacity={0.85} /></> : null}
      </G>); break;
    case 'plant': body = (
      <G>
        <Defs><G2 id={`${id}p`} c={q === 2 ? '#e2b64a' : q === 1 ? '#ffffff' : '#c47a5a'} t={0.18} b={0.2} /></Defs>
        <Shadow cx={316} cy={462} rx={32} />
        {q === 2 ? [0, 1, 2, 3, 4].map((i) => <Path key={i} d={`M316 424 q${-52 + i * 26} -${60 + (i % 2) * 18} ${-30 + i * 15} -${96 - (i % 2) * 8} q${40 - i * 12} ${46} ${30 - i * 15} ${96 - (i % 2) * 8} Z`} fill={i % 2 ? '#3f9b6a' : '#52b583'} opacity={0.96} />) : null}
        {q === 1 ? <><Path d="M316 426 q-34 -30 -22 -88 q34 34 22 88 Z" fill="#3f9b6a" /><Path d="M316 426 q-6 -44 42 -72 q10 48 -42 72 Z" fill="#52b583" /><Path d="M316 426 q-52 -14 -56 -62 q46 8 56 62 Z" fill="#6cc796" /><Path d="M316 426 q24 -26 20 -64 q-28 18 -20 64 Z" fill="#8fe0b0" /></> : null}
        {q === 0 ? <><Path d="M316 428 q-22 -34 -6 -70 q26 30 6 70 Z" fill="#4fae7b" /><Path d="M316 428 q18 -28 38 -34 q-2 30 -38 34 Z" fill="#6cc796" /></> : null}
        <Path d="M296 428 h40 l-7 32 q-1 4 -5 4 h-16 q-4 0 -5 -4 Z" fill={`url(#${id}p)`} />
        <Ellipse cx={316} cy={428} rx={20} ry={5} fill={shade(q === 2 ? '#e2b64a' : '#8a5a3a', -0.3)} />
      </G>); break;
    case 'lamp': body = (
      <G>
        <Defs><RadialGradient id={`${id}g`} cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor="#ffe9a8" stopOpacity="0.55" /><Stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></RadialGradient></Defs>
        <Ellipse cx={266} cy={372} rx={70} ry={64} fill={`url(#${id}g)`} />
        <Shadow cx={268} cy={462} rx={22} />
        <Ellipse cx={268} cy={458} rx={20} ry={5} fill={gold ?? '#7a6a58'} />
        <Rect x={265} y={376} width={5} height={82} rx={2} fill={gold ?? '#8a7a68'} />
        <Path d="M244 378 l16 -42 h20 l16 42 Z" fill={q === 0 ? '#f2e6c4' : q === 1 ? shade(accent, 0.4) : '#f6ead0'} />
        <Path d="M252 378 l10 -40 h12 l10 40 Z" fill="#fff" opacity={0.35} />
        {gold ? <Ellipse cx={268} cy={378} rx={24} ry={4} fill={gold} /> : null}
        {q === 2 ? [250, 268, 286].map((x) => <Path key={x} d={`M${x} 382 v10 q-3 5 0 8`} stroke="#bfe6ff" strokeWidth={2} fill="none" />) : null}
      </G>); break;
    case 'art': body = (
      <G>
        <Defs><G2 id={`${id}f`} c={q === 2 ? '#e2b64a' : q === 1 ? shade(accent, -0.1) : '#a8845a'} t={0.3} b={0.2} /><LinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#bfe6ff" /><Stop offset="1" stopColor="#e9f6ff" /></LinearGradient></Defs>
        <Rect x={140} y={280} width={86} height={66} rx={5} fill="#000" opacity={0.14} transform="translate(3 4)" />
        <Rect x={140} y={280} width={86} height={66} rx={5} fill={`url(#${id}f)`} />
        <Rect x={148} y={288} width={70} height={50} rx={2} fill={`url(#${id}s)`} />
        <Path d="M148 338 q18 -30 36 -8 q14 -22 34 8 Z" fill={q === 0 ? '#7aa56d' : '#4fae7b'} /><Path d="M148 338 q26 -16 70 0 Z" fill={q === 0 ? '#5f8f55' : '#3f9b6a'} />
        <Circle cx={204} cy={302} r={8} fill="#ffd75e" />{q >= 1 ? <><Ellipse cx={168} cy={300} rx={10} ry={4} fill="#fff" opacity={0.9} /><Ellipse cx={176} cy={302} rx={8} ry={3.5} fill="#fff" opacity={0.9} /></> : null}
        {gold ? <Rect x={140} y={280} width={86} height={66} rx={5} fill="none" stroke="#fff3c4" strokeWidth={1.4} opacity={0.8} /> : null}
      </G>); break;
    case 'shelf': body = (
      <G>
        <Defs><G2 id={`${id}a`} c={q === 0 ? '#c8a074' : q === 1 ? shade(accent, -0.05) : '#6b4326'} t={0.2} b={0.2} /></Defs>
        <Rect x={236} y={336} width={104} height={9} rx={3} fill="#000" opacity={0.18} transform="translate(0 4)" />
        <Rect x={236} y={336} width={104} height={9} rx={3} fill={`url(#${id}a)`} />
        {q === 2 ? <><Rect x={236} y={296} width={104} height={9} rx={3} fill={`url(#${id}a)`} /><Rect x={236} y={296} width={7} height={49} fill={`url(#${id}a)`} /><Rect x={333} y={296} width={7} height={49} fill={`url(#${id}a)`} /></> : null}
        {[[246, 312, 8, 24, '#d95550'], [255, 306, 9, 30, '#4f7fd4'], [265, 314, 8, 22, '#e2b64a'], [274, 308, 9, 28, '#4fae7b']].map(([x, y, w, h, c], i) => <Rect key={i} x={x as number} y={y as number} width={w as number} height={h as number} rx={2} fill={c as string} />)}
        <Circle cx={312} cy={322} r={12} fill={q === 0 ? '#c9ae8f' : '#ffffff'} /><Circle cx={312} cy={322} r={12} fill={q === 0 ? '#00000010' : shade(accent, 0.3)} opacity={0.5} />
        {q >= 1 ? <Path d="M312 312 q-10 -16 -2 -26 q10 12 2 26 Z M312 312 q10 -14 20 -12 q-6 14 -20 12 Z" fill="#52b583" /> : null}
      </G>); break;
  }
  const w = Math.min(100, Math.max(0, wear));
  return (
    <G opacity={1 - w * 0.003}>
      {body}
      {w >= 40 ? <Rect x={0} y={250} width={360} height={240} fill="#5a4636" opacity={w / 520} /> : null}
      {w >= 70 ? <G stroke="#3a2c20" strokeWidth={1.6} opacity={0.55}><Path d={kind === 'rug' ? 'M150 530 l10 -6 l8 8' : kind === 'sofa' ? 'M70 416 l8 12 l-6 8' : kind === 'bed' ? 'M96 424 l10 8 l-4 8' : kind === 'plant' ? 'M310 440 l6 8' : 'M120 430 l8 10 l-6 6'} fill="none" /></G> : null}
    </G>
  );
}

export function RoomView({ room, phase, accent, placed, tier }: { room: RoomId; phase: Phase; accent: string; placed: Placed; tier: number }) {
  const night = phase === 'night', eve = phase === 'evening';
  const [w, setW] = useState(0);
  const order: Kind[] = ['art', 'shelf', 'mirror', 'clock', 'poster', 'wtv', 'curtain', 'sconce', 'wardrobe', 'fridge', 'bookcase', 'piano', 'guitar', 'cattree', 'coatrack', 'rug', 'bed', 'sofa', 'table', 'desk', 'bench', 'armchair', 'chair', 'pouf', 'nightstand', 'sidetable', 'tvstand', 'dresser', 'stool', 'basket', 'aquarium', 'dogbed', 'plant', 'lamp'];
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
