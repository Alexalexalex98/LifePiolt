import type { ComponentType, JSX } from 'react';
import { Circle, Defs, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { ExtraKind } from '@/lib/petHome';

/**
 * Mobili e oggetti in più, tutti in VISTA FRONTALE (nessuna prospettiva): ognuno ha tre qualità (semplice, bello, di pregio) con colori e dettagli diversi.
 * Zone della stanza (riquadro 360×600, pavimento a y=458): B = pavimento al centro (x 165-245), C = pavimento a destra (x 250-345), W = parete a sinistra (x 12-132, y 268-345).
 */
export type Ctx = {
  q: 0 | 1 | 2; accent: string; base: string; gold: string | null; id: string;
  shade: (c: string, t: number) => string;
  Shadow: ComponentType<{ cx: number; cy: number; rx: number }>;
  Gloss: ComponentType<{ x: number; y: number; w: number; h: number; o?: number }>;
  G2: ComponentType<{ id: string; c: string; t?: number; b?: number }>;
};

export function extraBody(kind: ExtraKind, c: Ctx): JSX.Element {
  const { q, base, gold, id, shade, Shadow, Gloss, G2, accent } = c;
  const d = shade(base, -0.28), l = shade(base, 0.32);
  const wood = q === 2 ? '#6b4326' : q === 1 ? '#b98f5f' : '#c8a074';
  const fab = q === 0 ? '#a9b3bd' : q === 1 ? accent : '#7a56b0';
  switch (kind) {
    case 'armchair': return (
      <G><Defs><G2 id={`${id}a`} c={fab} /></Defs><Shadow cx={205} cy={460} rx={44} />
        <Rect x={170} y={392} width={70} height={52} rx={18} fill={`url(#${id}a)`} /><Rect x={162} y={410} width={18} height={44} rx={9} fill={shade(fab, -0.1)} /><Rect x={230} y={410} width={18} height={44} rx={9} fill={shade(fab, -0.1)} />
        <Rect x={178} y={420} width={54} height={28} rx={11} fill={shade(fab, 0.18)} /><Gloss x={184} y={424} w={40} h={7} />
        {[170, 234].map((x) => <Rect key={x} x={x} y={450} width={7} height={11} rx={3} fill={gold ?? wood} />)}
        {q >= 1 ? <Rect x={188} y={400} width={30} height={20} rx={8} fill="#ffd75e" opacity={0.95} /> : null}
      </G>);
    case 'chair': return (
      <G><Shadow cx={205} cy={460} rx={32} />
        <Rect x={178} y={382} width={54} height={8} rx={4} fill={wood} /><Rect x={180} y={386} width={6} height={44} rx={3} fill={wood} /><Rect x={224} y={386} width={6} height={44} rx={3} fill={wood} />
        <Rect x={178} y={382} width={54} height={36} rx={8} fill={fab} opacity={q === 0 ? 0 : 0.9} />
        <Rect x={176} y={428} width={58} height={12} rx={6} fill={shade(fab, 0.1)} /><Rect x={182} y={440} width={6} height={20} rx={2} fill={wood} /><Rect x={222} y={440} width={6} height={20} rx={2} fill={wood} />
        <Line x1={190} y1={392} x2={190} y2={420} stroke={wood} strokeWidth={4} /><Line x1={205} y1={392} x2={205} y2={420} stroke={wood} strokeWidth={4} /><Line x1={220} y1={392} x2={220} y2={420} stroke={wood} strokeWidth={4} />
        {gold ? <Rect x={176} y={428} width={58} height={12} rx={6} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      </G>);
    case 'pouf': return (
      <G><Defs><G2 id={`${id}a`} c={fab} /></Defs><Shadow cx={205} cy={460} rx={34} />
        <Rect x={176} y={420} width={58} height={38} rx={19} fill={`url(#${id}a)`} />
        <Ellipse cx={205} cy={424} rx={26} ry={6} fill={shade(fab, 0.25)} />{q >= 1 ? <Path d="M180 440 q25 8 50 0" stroke={shade(fab, -0.25)} strokeWidth={2} fill="none" /> : null}
        {gold ? <Circle cx={205} cy={424} r={3} fill={gold} /> : null}
      </G>);
    case 'nightstand': return (
      <G><Shadow cx={205} cy={460} rx={32} /><Defs><G2 id={`${id}a`} c={wood} /></Defs>
        <Rect x={176} y={410} width={58} height={46} rx={5} fill={`url(#${id}a)`} /><Rect x={172} y={404} width={66} height={8} rx={3} fill={shade(wood, 0.2)} />
        <Rect x={182} y={416} width={46} height={16} rx={3} fill={shade(wood, -0.08)} /><Rect x={182} y={434} width={46} height={16} rx={3} fill={shade(wood, -0.08)} />
        <Circle cx={205} cy={424} r={2.4} fill={gold ?? d} /><Circle cx={205} cy={442} r={2.4} fill={gold ?? d} />
        {q >= 1 ? <><Rect x={184} y={388} width={5} height={16} fill="#8a8f9c" /><Path d="M178 390 l8 -16 h14 l8 16 Z" fill={q === 1 ? '#ffe9a8' : '#fff3c4'} /></> : null}
      </G>);
    case 'sidetable': return (
      <G><Shadow cx={205} cy={460} rx={30} />
        <Ellipse cx={205} cy={414} rx={30} ry={7} fill={shade(wood, -0.15)} /><Ellipse cx={205} cy={411} rx={30} ry={7} fill={shade(wood, 0.15)} />
        <Rect x={202} y={414} width={6} height={40} fill={wood} /><Ellipse cx={205} cy={456} rx={18} ry={4} fill={shade(wood, -0.1)} />
        {q >= 1 ? <><Rect x={196} y={396} width={8} height={14} rx={3} fill="#7fb6e0" /><Circle cx={200} cy={392} r={5} fill="#ff7a8c" /><Circle cx={206} cy={394} r={4} fill="#ffd75e" /></> : null}
        {gold ? <Ellipse cx={205} cy={411} rx={30} ry={7} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      </G>);
    case 'tvstand': return (
      <G><Shadow cx={205} cy={460} rx={46} /><Defs><G2 id={`${id}a`} c={wood} /></Defs>
        <Rect x={160} y={426} width={92} height={30} rx={5} fill={`url(#${id}a)`} /><Rect x={166} y={432} width={38} height={18} rx={3} fill={shade(wood, -0.1)} /><Rect x={208} y={432} width={38} height={18} rx={3} fill={shade(wood, -0.1)} />
        <Rect x={168} y={456} width={6} height={8} fill={d} /><Rect x={238} y={456} width={6} height={8} fill={d} />
        <Rect x={168} y={376} width={76} height={46} rx={4} fill="#1b1f2b" /><Rect x={172} y={380} width={68} height={38} rx={2} fill={q === 0 ? '#27324a' : '#4f7fd4'} />
        {q >= 1 ? <Path d="M172 408 q20 -20 40 -4 q16 -12 28 6 v8 h-68 Z" fill="#52b583" opacity={0.8} /> : null}<Rect x={198} y={420} width={16} height={5} fill="#1b1f2b" />
        {gold ? <Rect x={160} y={426} width={92} height={30} rx={5} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      </G>);
    case 'dresser': return (
      <G><Shadow cx={205} cy={460} rx={42} /><Defs><G2 id={`${id}a`} c={wood} /></Defs>
        <Rect x={164} y={392} width={84} height={64} rx={5} fill={`url(#${id}a)`} /><Rect x={160} y={386} width={92} height={9} rx={3} fill={shade(wood, 0.22)} />
        {[400, 418, 436].map((y) => <Rect key={y} x={170} y={y} width={72} height={14} rx={3} fill={shade(wood, -0.08)} />)}
        {[407, 425, 443].map((y) => <Circle key={y} cx={206} cy={y} r={2.6} fill={gold ?? d} />)}
        <Rect x={168} y={456} width={7} height={8} fill={d} /><Rect x={237} y={456} width={7} height={8} fill={d} />
        {q >= 1 ? <><Rect x={172} y={366} width={26} height={22} rx={2} fill="#fff" /><Rect x={175} y={369} width={20} height={16} fill="#9fd6f5" /><Circle cx={228} cy={378} r={8} fill="#c47a5a" /><Path d="M228 372 q-6 -12 0 -16 q6 6 0 16 Z" fill="#52b583" /></> : null}
      </G>);
    case 'stool': return (
      <G><Shadow cx={205} cy={460} rx={24} />
        <Ellipse cx={205} cy={414} rx={24} ry={6} fill={fab} /><Rect x={181} y={414} width={48} height={7} rx={3} fill={shade(fab, -0.15)} />
        <Rect x={186} y={420} width={5} height={38} fill={wood} transform="rotate(8 188 440)" /><Rect x={219} y={420} width={5} height={38} fill={wood} transform="rotate(-8 222 440)" /><Rect x={196} y={420} width={5} height={38} fill={shade(wood, -0.1)} />
        {gold ? <Ellipse cx={205} cy={414} rx={24} ry={6} fill="none" stroke={gold} strokeWidth={1.4} /> : null}
      </G>);
    case 'fridge': return (
      <G><Shadow cx={296} cy={462} rx={48} /><Defs><G2 id={`${id}a`} c={q === 0 ? '#e9edf2' : q === 1 ? shade(accent, 0.3) : '#c9ced6'} t={0.12} b={0.16} /></Defs>
        <Rect x={256} y={310} width={80} height={150} rx={10} fill={`url(#${id}a)`} /><Rect x={258} y={380} width={76} height={3} fill={shade(base, -0.25)} />
        <Rect x={322} y={330} width={4} height={30} rx={2} fill={gold ?? '#8a8f9c'} /><Rect x={322} y={394} width={4} height={40} rx={2} fill={gold ?? '#8a8f9c'} />
        <Gloss x={264} y={320} w={14} h={50} o={0.35} />{q >= 1 ? <><Rect x={270} y={340} width={14} height={14} fill="#ffd75e" /><Rect x={288} y={350} width={14} height={12} fill="#ff7a8c" /></> : null}
        <Rect x={264} y={458} width={8} height={7} fill={d} /><Rect x={320} y={458} width={8} height={7} fill={d} />
      </G>);
    case 'bookcase': return (
      <G><Shadow cx={296} cy={462} rx={50} /><Defs><G2 id={`${id}a`} c={wood} /></Defs>
        <Rect x={252} y={300} width={88} height={158} rx={5} fill={`url(#${id}a)`} /><Rect x={258} y={306} width={76} height={146} fill={shade(wood, -0.25)} />
        {[350, 398].map((y) => <Rect key={y} x={258} y={y} width={76} height={5} fill={shade(wood, 0.1)} />)}
        {[[262, 318, 8, 30, '#d95550'], [271, 322, 7, 26, '#4f7fd4'], [279, 316, 9, 32, '#e2b64a'], [289, 320, 7, 28, '#4fae7b'], [262, 366, 9, 30, '#7a56b0'], [272, 370, 7, 26, '#ff9d6e'], [282, 364, 8, 32, '#4f7fd4'], [262, 414, 8, 32, '#e2b64a'], [271, 418, 9, 28, '#d95550']].map(([x, y, w, h, col], i) => <Rect key={i} x={x as number} y={y as number} width={w as number} height={h as number} rx={1.5} fill={col as string} />)}
        {q >= 1 ? <><Circle cx={316} cy={336} r={9} fill="#fff" /><Path d="M316 328 q-8 -14 0 -20 q8 8 0 20 Z" fill="#52b583" /></> : null}
        {gold ? <Rect x={252} y={300} width={88} height={158} rx={5} fill="none" stroke={gold} strokeWidth={1.8} /> : null}
      </G>);
    case 'coatrack': return (
      <G><Shadow cx={304} cy={462} rx={26} />
        <Rect x={302} y={316} width={5} height={142} rx={2} fill={wood} /><Ellipse cx={304} cy={458} rx={20} ry={5} fill={shade(wood, -0.1)} />
        {[[304, 326, -22], [304, 326, 22], [304, 346, -18], [304, 346, 18]].map(([x, y, dx], i) => <Path key={i} d={`M${x} ${y} l${dx} -12`} stroke={gold ?? shade(wood, -0.2)} strokeWidth={3.5} strokeLinecap="round" />)}
        {q >= 1 ? <><Path d="M282 330 q-10 30 0 54 h14 q8 -24 -2 -54 Z" fill={q === 1 ? '#4f7fd4' : '#7a56b0'} /><Path d="M326 330 q6 20 -2 36 h-10 q-4 -18 4 -36 Z" fill="#d95550" /></> : null}
      </G>);
    case 'basket': return (
      <G><Shadow cx={205} cy={460} rx={26} />
        <Path d="M178 430 h54 l-6 28 q-1 4 -5 4 h-32 q-4 0 -5 -4 Z" fill={q === 0 ? '#c9a46b' : q === 1 ? '#b98f5f' : '#8a5a3a'} />
        {[438, 448].map((y) => <Line key={y} x1={181} y1={y} x2={229} y2={y} stroke={shade(base, -0.25)} strokeWidth={2} opacity={0.5} />)}
        <Ellipse cx={205} cy={430} rx={27} ry={5} fill={shade(base, -0.2)} />
        {q >= 1 ? <Path d="M184 428 q8 -22 22 -14 q14 -10 20 14 Z" fill={q === 1 ? '#ffd75e' : '#c9a0e8'} /> : <Path d="M186 428 q8 -14 20 -8 q12 -8 18 8 Z" fill="#e9e1d0" />}
      </G>);
    case 'mirror': return (
      <G><Rect x={46} y={278} width={56} height={74} rx={28} fill="#000" opacity={0.14} transform="translate(3 4)" />
        <Rect x={44} y={276} width={56} height={74} rx={28} fill={gold ?? wood} /><Rect x={50} y={282} width={44} height={62} rx={22} fill="#cfe9f7" />
        <Path d="M56 330 l22 -40" stroke="#fff" strokeWidth={5} opacity={0.6} strokeLinecap="round" /><Path d="M70 336 l14 -22" stroke="#fff" strokeWidth={3} opacity={0.4} strokeLinecap="round" />
      </G>);
    case 'clock': return (
      <G><Circle cx={72} cy={306} r={28} fill="#000" opacity={0.14} transform="translate(3 4)" />
        <Circle cx={72} cy={306} r={28} fill={gold ?? wood} /><Circle cx={72} cy={306} r={22} fill="#fffdf6" />
        {[0, 90, 180, 270].map((a) => <Line key={a} x1={72} y1={286} x2={72} y2={291} stroke="#333" strokeWidth={2} transform={`rotate(${a} 72 306)`} />)}
        <Line x1={72} y1={306} x2={72} y2={294} stroke="#222" strokeWidth={3} strokeLinecap="round" /><Line x1={72} y1={306} x2={82} y2={310} stroke="#222" strokeWidth={2.4} strokeLinecap="round" /><Circle cx={72} cy={306} r={2.4} fill={q === 2 ? '#d95550' : '#222'} />
      </G>);
    case 'poster': return (
      <G><Rect x={30} y={272} width={62} height={80} rx={3} fill="#000" opacity={0.14} transform="translate(3 4)" />
        <Rect x={28} y={270} width={62} height={80} rx={3} fill={q === 2 ? '#e2b64a' : q === 1 ? shade(accent, -0.1) : '#f4efe6'} /><Rect x={34} y={276} width={50} height={68} fill={q === 0 ? '#ffffff' : '#fff8e8'} />
        <Circle cx={59} cy={304} r={13} fill={q === 0 ? '#9fd6f5' : '#ff9d6e'} /><Path d="M34 344 q14 -26 28 -6 q10 -14 22 6 Z" fill={q === 0 ? '#7aa56d' : '#4fae7b'} />
      </G>);
    case 'wtv': return (
      <G><Rect x={22} y={282} width={96} height={58} rx={5} fill="#000" opacity={0.18} transform="translate(3 4)" />
        <Rect x={20} y={280} width={96} height={58} rx={5} fill="#1b1f2b" /><Rect x={24} y={284} width={88} height={50} rx={2} fill={q === 0 ? '#27324a' : '#4f7fd4'} />
        {q >= 1 ? <Path d="M24 322 q22 -26 44 -6 q22 -16 44 6 v12 h-88 Z" fill="#52b583" opacity={0.75} /> : null}{gold ? <Rect x={20} y={280} width={96} height={58} rx={5} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      </G>);
    case 'curtain': return (
      <G>
        <Rect x={232} y={258} width={112} height={6} rx={3} fill={gold ?? wood} />
        <Path d="M236 262 q16 4 14 40 q-4 36 -2 70 h-16 Z" fill={q === 0 ? '#e9dcc4' : q === 1 ? shade(accent, 0.1) : '#7a1f2e'} /><Path d="M340 262 q-16 4 -14 40 q4 36 2 70 h16 Z" fill={q === 0 ? '#e9dcc4' : q === 1 ? shade(accent, 0.1) : '#7a1f2e'} />
        <Path d="M242 270 q4 40 0 98 M332 270 q-4 40 0 98" stroke="#000" strokeWidth={2} opacity={0.12} fill="none" />
      </G>);
    case 'sconce': return (
      <G><Ellipse cx={124} cy={296} rx={26} ry={24} fill="#ffe9a8" opacity={0.22} />
        <Rect x={116} y={300} width={16} height={5} rx={2} fill={gold ?? '#8a7a68'} /><Path d="M112 300 l6 -22 h12 l6 22 Z" fill={q === 0 ? '#f2e6c4' : q === 1 ? shade(accent, 0.4) : '#f6ead0'} />
      </G>);
    case 'aquarium': return (
      <G><Shadow cx={205} cy={460} rx={36} />
        <Rect x={170} y={430} width={70} height={28} rx={4} fill={wood} /><Rect x={168} y={388} width={74} height={44} rx={5} fill="#bfe6ff" opacity={0.7} /><Rect x={172} y={398} width={66} height={30} fill="#7fc4e8" opacity={0.7} />
        <Ellipse cx={192} cy={412} rx={8} ry={4} fill="#ff9d6e" /><Path d="M199 412 l7 -4 v8 Z" fill="#ff9d6e" /><Ellipse cx={220} cy={420} rx={6} ry={3} fill="#ffd75e" /><Path d="M214 420 l-6 -3 v6 Z" fill="#ffd75e" />
        <Path d="M180 428 q4 -14 8 0 M226 428 q-4 -16 -8 0" stroke="#3f9b6a" strokeWidth={3} fill="none" /><Rect x={168} y={386} width={74} height={4} rx={2} fill={gold ?? shade(wood, -0.2)} />
      </G>);
    case 'guitar': return (
      <G><Shadow cx={304} cy={462} rx={22} />
        <Rect x={298} y={326} width={6} height={50} rx={2} fill="#6b4326" /><Rect x={296} y={318} width={10} height={12} rx={2} fill="#3a2c20" />
        <Ellipse cx={301} cy={398} rx={22} ry={26} fill={q === 0 ? '#d9a76a' : q === 1 ? '#c25a3b' : '#2b1a12'} /><Ellipse cx={301} cy={430} rx={26} ry={26} fill={q === 0 ? '#d9a76a' : q === 1 ? '#c25a3b' : '#2b1a12'} />
        <Circle cx={301} cy={418} r={8} fill="#1b1209" /><Rect x={288} y={446} width={26} height={4} rx={2} fill="#f6e7c1" /><Gloss x={286} y={388} w={14} h={30} o={0.25} />
        <Rect x={282} y={456} width={38} height={4} rx={2} fill={wood} />{gold ? <Circle cx={301} cy={418} r={10} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      </G>);
    case 'cattree': return (
      <G><Shadow cx={296} cy={462} rx={36} />
        <Rect x={270} y={448} width={52} height={12} rx={4} fill={q === 0 ? '#c9a46b' : '#b98f5f'} /><Rect x={292} y={350} width={9} height={100} fill="#d7c29a" />{[366, 384, 402, 420].map((y) => <Line key={y} x1={292} y1={y} x2={301} y2={y} stroke="#b59a6a" strokeWidth={2} />)}
        <Rect x={266} y={392} width={60} height={9} rx={4} fill={fab} /><Rect x={276} y={338} width={44} height={9} rx={4} fill={fab} /><Rect x={262} y={332} width={14} height={14} rx={7} fill={shade(fab, 0.2)} opacity={0} />
        <Ellipse cx={298} cy={332} rx={14} ry={9} fill="#f1b27a" /><Path d="M286 326 l4 -9 l5 6 M310 326 l-4 -9 l-5 6" fill="#f1b27a" stroke="#f1b27a" strokeWidth={2} />
        {gold ? <Rect x={266} y={392} width={60} height={9} rx={4} fill="none" stroke={gold} strokeWidth={1.4} /> : null}
      </G>);
    case 'dogbed': return (
      <G><Shadow cx={205} cy={460} rx={38} />
        <Rect x={166} y={436} width={78} height={24} rx={12} fill={q === 0 ? '#b98f5f' : q === 1 ? shade(accent, -0.1) : '#6b4326'} /><Rect x={174} y={440} width={62} height={14} rx={7} fill={q === 0 ? '#e9dcc4' : '#ffffff'} />
        {q >= 1 ? <Path d="M186 446 q8 -16 20 -8 q10 -10 22 8 Z" fill="#c9a0e8" opacity={0.9} /> : null}
        {gold ? <Rect x={166} y={436} width={78} height={24} rx={12} fill="none" stroke={gold} strokeWidth={1.5} /> : null}
      </G>);
    case 'piano': return (
      <G><Shadow cx={296} cy={462} rx={52} /><Defs><G2 id={`${id}a`} c={q === 0 ? '#3a3f4d' : q === 1 ? '#262a36' : '#111319'} t={0.25} b={0.1} /></Defs>
        <Rect x={248} y={366} width={96} height={86} rx={6} fill={`url(#${id}a)`} /><Rect x={248} y={366} width={96} height={8} rx={3} fill="#4a5063" />
        <Rect x={254} y={420} width={84} height={22} rx={2} fill="#f6f2ea" />{Array.from({ length: 12 }, (_, i) => <Line key={i} x1={261 + i * 6.8} y1={420} x2={261 + i * 6.8} y2={442} stroke="#bbb" strokeWidth={0.8} />)}
        {Array.from({ length: 8 }, (_, i) => <Rect key={i} x={258 + i * 6.8 + (i > 2 ? 6.8 : 0)} y={420} width={4} height={13} fill="#111" />)}
        <Rect x={254} y={376} width={84} height={36} rx={3} fill="#1a1d27" />{q >= 1 ? <Rect x={268} y={384} width={56} height={20} fill="#f6f2ea" opacity={0.9} /> : null}
        <Rect x={254} y={452} width={8} height={14} fill="#111" /><Rect x={330} y={452} width={8} height={14} fill="#111" />{gold ? <Rect x={248} y={366} width={96} height={86} rx={6} fill="none" stroke={gold} strokeWidth={1.8} /> : null}
      </G>);
  }
}
