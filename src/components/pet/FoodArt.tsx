import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { ArtId } from '@/lib/petFood';

const Grad = ({ id, a, b }: { id: string; a: string; b: string }) => (
  <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient>
);
const Gloss = ({ x, y, w = 10, h = 5, r = -30 }: { x: number; y: number; w?: number; h?: number; r?: number }) => <Ellipse cx={x} cy={y} rx={w} ry={h} fill="#fff" opacity={0.45} transform={`rotate(${r} ${x} ${y})`} />;

/** Il cibo e le bevande di Theia, disegnati a mano in vettoriale (nessuna emoji). */
export function FoodArt({ id, size = 56 }: { id: ArtId; size?: number }) {
  const g = `fa-${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <Grad id={g} a="#ffffff" b="#000000" />
      </Defs>
      <Ellipse cx={32} cy={57} rx={18} ry={3.5} fill="#000" opacity={0.18} />
      {ART[id]}
    </Svg>
  );
}

const ART: Record<ArtId, JSX.Element> = {
  apple: (
    <G>
      <Defs><Grad id="ap" a="#ff7a6b" b="#d62f3c" /></Defs>
      <Path d="M32 18 C20 12 8 22 10 36 C12 50 22 56 32 52 C42 56 52 50 54 36 C56 22 44 12 32 18 Z" fill="url(#ap)" />
      <Path d="M32 18 C32 12 34 8 38 6" stroke="#6b4a2b" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M36 12 C42 6 50 8 52 12 C46 16 40 16 36 12 Z" fill="#5fbf6a" />
      <Gloss x={20} y={28} w={5} h={9} r={20} />
    </G>
  ),
  banana: (
    <G>
      <Defs><Grad id="ba" a="#ffe566" b="#f1b72a" /></Defs>
      <Path d="M12 24 C20 46 40 52 54 36 C56 34 58 36 56 40 C44 58 18 58 8 28 C8 24 11 22 12 24 Z" fill="url(#ba)" />
      <Path d="M10 24 C8 20 10 16 14 18" stroke="#7a5a2b" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M52 38 L57 38" stroke="#7a5a2b" strokeWidth={3} strokeLinecap="round" />
      <Gloss x={26} y={46} w={9} h={2.5} r={20} />
    </G>
  ),
  carrot: (
    <G>
      <Defs><Grad id="ca" a="#ffa04d" b="#e86a1c" /></Defs>
      <Path d="M44 18 L14 52 C12 54 14 56 16 55 L48 26 C52 22 48 14 44 18 Z" fill="url(#ca)" />
      <Path d="M28 38 l5 -4 M22 46 l5 -4 M36 30 l5 -4" stroke="#c9540f" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M44 18 C40 8 34 6 30 8 C34 10 36 14 40 20 Z" fill="#5fbf6a" />
      <Path d="M46 20 C52 12 58 12 60 14 C56 16 52 18 50 24 Z" fill="#4aa857" />
    </G>
  ),
  salad: (
    <G>
      <Path d="M8 34 C8 54 56 54 56 34 Z" fill="#f4f4f1" />
      <Path d="M8 34 H56" stroke="#d9d9d3" strokeWidth={2} />
      <Circle cx={20} cy={30} r={11} fill="#6cc96f" />
      <Circle cx={34} cy={26} r={13} fill="#4fb35c" />
      <Circle cx={46} cy={31} r={10} fill="#7fd682" />
      <Circle cx={28} cy={22} r={5} fill="#e5483f" />
      <Circle cx={42} cy={22} r={4} fill="#e5483f" />
      <Path d="M16 30 q6 -6 12 0 M30 26 q7 -7 14 0" stroke="#3a8f48" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  egg: (
    <G>
      <Defs><Grad id="eg" a="#fffdf6" b="#ead9bd" /></Defs>
      <Path d="M32 8 C44 8 52 28 52 38 C52 50 44 56 32 56 C20 56 12 50 12 38 C12 28 20 8 32 8 Z" fill="url(#eg)" />
      <Gloss x={24} y={24} w={4} h={8} r={20} />
    </G>
  ),
  yogurt: (
    <G>
      <Path d="M16 20 H48 L44 54 C44 56 42 57 40 57 H24 C22 57 20 56 20 54 Z" fill="#fff" />
      <Path d="M16 20 H48 L47 28 H17 Z" fill="#ff8fb0" />
      <Rect x={14} y={14} width={36} height={8} rx={3} fill="#e8e8f2" />
      <Path d="M24 36 q8 6 16 0" stroke="#ff8fb0" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Gloss x={22} y={40} w={2.5} h={8} r={0} />
    </G>
  ),
  nuts: (
    <G>
      <Ellipse cx={22} cy={40} rx={11} ry={9} fill="#c98e55" transform="rotate(-20 22 40)" />
      <Ellipse cx={42} cy={38} rx={11} ry={9} fill="#b87b44" transform="rotate(20 42 38)" />
      <Ellipse cx={32} cy={26} rx={11} ry={9} fill="#d9a066" />
      <Path d="M26 24 q6 -4 12 0 M16 40 q6 -4 12 0 M36 38 q6 -4 12 0" stroke="#8a5a2c" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  fish: (
    <G>
      <Defs><Grad id="fi" a="#8ecbff" b="#4a90d9" /></Defs>
      <Path d="M8 32 C18 16 40 16 50 32 C40 48 18 48 8 32 Z" fill="url(#fi)" />
      <Path d="M50 32 L60 22 L60 42 Z" fill="#4a90d9" />
      <Circle cx={20} cy={29} r={2.6} fill="#fff" /><Circle cx={20.6} cy={29} r={1.2} fill="#1a2233" />
      <Path d="M28 24 q4 8 0 16 M36 25 q4 7 0 14" stroke="#fff" strokeWidth={1.6} fill="none" opacity={0.55} strokeLinecap="round" />
    </G>
  ),
  bread: (
    <G>
      <Defs><Grad id="br" a="#e2a45e" b="#b97a35" /></Defs>
      <Path d="M10 30 C6 16 20 8 32 8 C44 8 58 16 54 30 C58 32 56 54 50 54 H14 C8 54 6 32 10 30 Z" fill="url(#br)" />
      <Path d="M22 22 q4 -4 8 0 M34 20 q4 -4 8 0 M28 32 q4 -4 8 0" stroke="#f3d29b" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  pizza: (
    <G>
      <Path d="M8 14 C28 6 44 6 56 14 L32 58 Z" fill="#f2c264" />
      <Path d="M8 14 C28 6 44 6 56 14 L54 18 C42 11 26 11 10 18 Z" fill="#d89a3c" />
      <Circle cx={26} cy={26} r={5} fill="#d6403a" /><Circle cx={40} cy={26} r={5} fill="#d6403a" /><Circle cx={33} cy={40} r={5} fill="#d6403a" />
      <Circle cx={33} cy={26} r={2} fill="#5fbf6a" />
    </G>
  ),
  cheese: (
    <G>
      <Defs><Grad id="ch" a="#ffe27a" b="#f2b933" /></Defs>
      <Path d="M6 40 L52 14 C56 12 60 14 60 18 V44 C60 48 58 50 54 50 H10 C6 50 4 44 6 40 Z" fill="url(#ch)" />
      <Circle cx={22} cy={42} r={4} fill="#e0a21f" /><Circle cx={40} cy={36} r={3.4} fill="#e0a21f" /><Circle cx={50} cy={44} r={3} fill="#e0a21f" />
    </G>
  ),
  fries: (
    <G>
      <Path d="M18 8 L20 34 M26 6 L27 34 M34 8 L34 34 M42 6 L41 34 M48 10 L46 34" stroke="#f6c744" strokeWidth={5} strokeLinecap="round" />
      <Path d="M12 30 H52 L48 56 C48 58 46 58 44 58 H20 C18 58 16 58 16 56 Z" fill="#e5483f" />
      <Path d="M14 40 H50" stroke="#fff" strokeWidth={3} opacity={0.85} />
    </G>
  ),
  burger: (
    <G>
      <Path d="M8 30 C8 14 56 14 56 30 Z" fill="#d89a4a" />
      <Circle cx={22} cy={20} r={1.4} fill="#fbe7b6" /><Circle cx={32} cy={17} r={1.4} fill="#fbe7b6" /><Circle cx={42} cy={21} r={1.4} fill="#fbe7b6" />
      <Path d="M8 32 C14 38 20 30 26 36 C32 30 38 38 44 32 C50 38 56 32 56 32 V34 H8 Z" fill="#6cc96f" />
      <Rect x={8} y={34} width={48} height={8} rx={4} fill="#7a4a2a" />
      <Path d="M8 42 H56 L52 46 L46 42" fill="#ffd34d" />
      <Path d="M8 44 H56 C56 54 50 56 44 56 H20 C14 56 8 54 8 44 Z" fill="#d89a4a" />
    </G>
  ),
  donut: (
    <G>
      <Defs><Grad id="do" a="#e9b274" b="#c98a4a" /></Defs>
      <Circle cx={32} cy={32} r={22} fill="url(#do)" />
      <Path d="M12 30 C14 16 50 14 52 30 C52 36 46 34 44 38 C40 44 36 38 32 42 C28 38 22 44 18 38 C16 34 12 36 12 30 Z" fill="#ff8fb5" />
      <Circle cx={32} cy={32} r={6.5} fill="#2b3350" opacity={0.0} />
      <Circle cx={32} cy={30} r={6} fill="#c98a4a" />
      <Path d="M20 24 l3 -1 M40 22 l3 2 M26 40 l2 2 M42 36 l3 1 M30 18 l-1 3" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  candy: (
    <G>
      <Circle cx={32} cy={32} r={13} fill="#ff5f9e" />
      <Path d="M20 24 L8 18 L10 32 Z M44 40 L56 46 L54 32 Z" fill="#ffa2c8" />
      <Path d="M22 36 C28 24 36 40 42 28" stroke="#fff" strokeWidth={2.6} fill="none" strokeLinecap="round" opacity={0.85} />
      <Gloss x={26} y={26} w={4} h={2.4} r={-30} />
    </G>
  ),
  icecream: (
    <G>
      <Path d="M20 30 H44 L32 58 Z" fill="#e0a35e" />
      <Path d="M24 34 L36 46 M30 32 L40 44 M20 38 L28 50" stroke="#b97a35" strokeWidth={1.4} />
      <Circle cx={32} cy={24} r={13} fill="#ffb3d1" />
      <Circle cx={24} cy={20} r={8} fill="#fff1c8" />
      <Circle cx={40} cy={20} r={8} fill="#b5e8ff" />
      <Circle cx={32} cy={10} r={4} fill="#e5483f" />
    </G>
  ),
  water: (
    <G>
      <Defs><Grad id="wa" a="#a8e4ff" b="#3aa8e0" /></Defs>
      <Path d="M14 12 H50 L46 54 C46 57 44 58 42 58 H22 C20 58 18 57 18 54 Z" fill="#dff3ff" opacity={0.7} />
      <Path d="M16 24 H48 L45 54 C45 56 44 57 42 57 H22 C20 57 19 56 19 54 Z" fill="url(#wa)" />
      <Path d="M16 24 q8 -4 16 0 t16 0" stroke="#fff" strokeWidth={2} fill="none" opacity={0.7} />
      <Gloss x={24} y={38} w={2.4} h={9} r={0} />
    </G>
  ),
  tea: (
    <G>
      <Path d="M10 24 H46 V40 C46 50 40 56 28 56 C16 56 10 50 10 40 Z" fill="#fff" />
      <Path d="M10 28 H46 V32 H10 Z" fill="#c98a4a" opacity={0.85} />
      <Path d="M46 28 C58 28 58 44 46 44" stroke="#fff" strokeWidth={4} fill="none" />
      <Path d="M20 18 q-3 -5 0 -9 M28 18 q-3 -5 0 -9 M36 18 q-3 -5 0 -9" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.7} />
    </G>
  ),
  milk: (
    <G>
      <Path d="M20 14 L26 6 H38 L44 14 V54 C44 56 42 58 40 58 H24 C22 58 20 56 20 54 Z" fill="#fff" />
      <Path d="M20 14 H44 V22 H20 Z" fill="#8fc3ff" />
      <Rect x={26} y={30} width={12} height={14} rx={3} fill="#cfe6ff" />
      <Gloss x={24} y={38} w={1.8} h={9} r={0} />
    </G>
  ),
  juice: (
    <G>
      <Defs><Grad id="ju" a="#ffb347" b="#f08a1f" /></Defs>
      <Path d="M14 14 H50 L46 54 C46 57 44 58 42 58 H22 C20 58 18 57 18 54 Z" fill="#fff4e0" opacity={0.7} />
      <Path d="M16 22 H48 L45 54 C45 56 44 57 42 57 H22 C20 57 19 56 19 54 Z" fill="url(#ju)" />
      <Circle cx={46} cy={16} r={8} fill="#ffb347" /><Path d="M46 10 V22 M40 16 H52" stroke="#fff3d1" strokeWidth={1.6} />
      <Path d="M40 8 L50 2" stroke="#e5483f" strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  soda: (
    <G>
      <Defs><Grad id="so" a="#6b4a3a" b="#2b1a14" /></Defs>
      <Path d="M14 14 H50 L46 54 C46 57 44 58 42 58 H22 C20 58 18 57 18 54 Z" fill="#fff" opacity={0.25} />
      <Path d="M16 20 H48 L45 54 C45 56 44 57 42 57 H22 C20 57 19 56 19 54 Z" fill="url(#so)" />
      <Circle cx={26} cy={30} r={2} fill="#fff" opacity={0.7} /><Circle cx={36} cy={38} r={1.6} fill="#fff" opacity={0.7} /><Circle cx={30} cy={46} r={1.8} fill="#fff" opacity={0.7} />
      <Path d="M36 14 L44 2" stroke="#e5483f" strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  energy: (
    <G>
      <Defs><Grad id="en" a="#3d4a66" b="#1a2233" /></Defs>
      <Rect x={20} y={10} width={24} height={46} rx={6} fill="url(#en)" />
      <Rect x={20} y={8} width={24} height={6} rx={3} fill="#c9d1de" />
      <Path d="M34 20 L26 34 H32 L30 46 L40 30 H33 Z" fill="#ffd34d" />
    </G>
  ),
};
