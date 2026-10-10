import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { isRtlLayout } from '@/lib/rtl';

/** Stesse icone del prototipo (tracciati SVG originali). */
export const iconMarkup: Record<string, string> = {
  ai: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.4 3.4-7 7.5-7s7.5 2.6 7.5 7"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  lifehealth: '<path d="M12 21s-7-4.3-9.5-8.7C.8 8.8 2 5 5.5 4.2 8 3.6 10 5 12 7c2-2 4-3.4 6.5-2.8C22 5 23.2 8.8 21.5 12.3 19 16.7 12 21 12 21z"/>',
  lifenetwork: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M7.9 7.6L10.6 16M16.1 7.6L13.4 16M8.3 6h7.4"/>',
  lifefinance: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
  lifenotes: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  lifetravel: '<path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  lifedrive: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
  lifetask: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l2.5 2.5L16 9"/>',
  lifepointsPage: '<path d="M12 2l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 15.9 6.4 19.1l1.4-6.3-4.8-4.3 6.4-.6z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  heart: '<path d="M12 21s-7.5-4.6-10.1-9.2C.3 8.6 1.6 4.8 5.2 4.1c2.2-.4 4.3.7 6.8 3 2.5-2.3 4.6-3.4 6.8-3 3.6.7 4.9 4.5 3.3 7.7C19.5 16.4 12 21 12 21z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',

  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  'trend-up': '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  'trend-down': '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  archive: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  'bell-off': '<path d="M13.73 21a2 2 0 01-3.46 0M18.63 13A17.9 17.9 0 0118 8M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14M18 8a6 6 0 00-9.33-5M1 1l22 22"/>',
  camera: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  mic: '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>',
  play: '<path d="M6 4l14 8-14 8V4z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  checksquare: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  square: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  forward: '<path d="M15 14l5-5-5-5"/><path d="M4 20v-7a4 4 0 014-4h12"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  video: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  sad: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>',
  wow: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="16" r="1.5"/><path d="M9 9h.01M15 9h.01"/>',
  like: '<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  share: '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><path d="M16 6l-4-4-4 4M12 2v13"/>',
  block: '<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>',
  repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>',
  puzzle: '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.61a2.404 2.404 0 01-1.705.707 2.402 2.402 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 11-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 00-.289-.877l-1.568-1.568A2.402 2.402 0 011.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 103.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0112 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 113.237 3.237c-.464.18-.894.527-.967 1.02z"/>',
  contact: '<path d="M16 2H6a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z"/><circle cx="11" cy="10" r="2.5"/><path d="M6.5 17c.6-2 2.4-3 4.5-3s3.9 1 4.5 3"/>',
  location: '<path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  tasks: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
  poll: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  note: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  search2: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  euro: '<path d="M4 10h12M4 14h12M19 6a8 8 0 100 12"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'more-h': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  sparkle: '<path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
};

type El = { tag: string; attrs: Record<string, string> };

const cache = new Map<string, El[]>();
function parse(markup: string): El[] {
  const hit = cache.get(markup);
  if (hit) return hit;
  const out: El[] = [];
  const re = /<(path|circle|rect|line)\s+([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const attrs: Record<string, string> = {};
    const ar = /([a-zA-Z-]+)="([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[2]))) attrs[a[1]] = a[2];
    out.push({ tag: m[1], attrs });
  }
  cache.set(markup, out);
  return out;
}

/** Icone che indicano una direzione: in scrittura da destra a sinistra vanno specchiate (unico punto: Icon). */
const DIRECTIONAL = new Set(['arrow-left', 'arrow-right', 'chevron-right', 'forward', 'reply', 'send']);
export function Icon({ name, size = 20, color = '#fff', fill = 'none', stroke = 1.8 }: {
  name: string; size?: number; color?: string; fill?: string; stroke?: number;
}) {
  const els = parse(iconMarkup[name] ?? '');
  const flip = DIRECTIONAL.has(name) && isRtlLayout();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={flip ? { transform: [{ scaleX: -1 }] } : undefined} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {els.map((e, i) => {
        const a = e.attrs;
        if (e.tag === 'path') return <Path key={i} d={a.d} fill={fill} />;
        if (e.tag === 'circle') return <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill={fill} />;
        if (e.tag === 'rect') return <Rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} fill={fill} />;
        return <Line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
      })}
    </Svg>
  );
}

/** Colori d'area del prototipo */
export const areaColors: Record<string, string> = {
  lifefinance: '#7be0b0', stocks: '#7be0b0', portfolio: '#7be0b0', lifeforecast: '#7be0b0', taxdecl: '#7be0b0',
  lifehealth: '#6ec9dd', lifetravel: '#e0c97b',
  lifenetwork: '#c9b6ff', userProfile: '#c9b6ff', businessCard: '#c9b6ff', ideaProfile: '#c9b6ff', lifepointsPage: '#c9b6ff',
  lifenotes: '#8fb3ff', lifedrive: '#a8b2c0',
};

import { useTheme } from '@/hooks/use-theme';

/** Icona che prende il colore dal tema (di default il testo; `muted` per il colore attenuato). */
export function Ico({ name, size = 18, color, muted, fill = 'none', stroke = 1.9 }: { name: string; size?: number; color?: string; muted?: boolean; fill?: string; stroke?: number }) {
  const t = useTheme();
  return <Icon name={name} size={size} color={color ?? (muted ? t.muted : t.text)} fill={fill} stroke={stroke} />;
}
