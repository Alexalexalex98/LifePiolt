import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

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

export function Icon({ name, size = 20, color = '#fff', fill = 'none', stroke = 1.8 }: {
  name: string; size?: number; color?: string; fill?: string; stroke?: number;
}) {
  const els = parse(iconMarkup[name] ?? '');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
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
