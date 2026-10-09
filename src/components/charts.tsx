import { Text } from '@/components/T';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { formatCHF } from '@/lib/format';

export function sparkPoints(vals: number[], w: number, h: number, pad: number): string {
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
  const n = vals.length, stepX = n > 1 ? (w - 2 * pad) / (n - 1) : 0;
  return vals.map((v, i) => `${(pad + stepX * i).toFixed(1)},${(pad + (1 - (v - min) / range) * (h - 2 * pad)).toFixed(1)}`).join(' ');
}

export function Spark({ data, w = 140, h = 34, color = '#f4f6f8', pad = 4, stroke = 2.4 }: {
  data: number[]; w?: number; h?: number; color?: string; pad?: number; stroke?: number;
}) {
  if (data.length < 2) return <View style={{ width: w, height: h }} />;
  return (
    <Svg style={{ direction: 'ltr' }} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polyline points={sparkPoints(data, w, h, pad)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LineChart({ data, color = '#f4f6f8', height = 150, padL = 38, grid = '#222a36', label = '#8e98a8', fmt = formatCHF, width = 300 }: {
  data: number[]; color?: string; height?: number; padL?: number; grid?: string; label?: string; fmt?: (n: number) => string; width?: number;
}) {
  if (data.length < 2) return null;
  const w = width, h = 140, padR = 10, padT = 10, padB = 14;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1, n = data.length;
  const plotW = w - padL - padR, plotH = h - padT - padB, stepX = plotW / (n - 1);
  const pts = data.map((v, i) => [padL + stepX * i, padT + (1 - (v - min) / range) * plotH] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${padL},${h - padB} ${line} ${pts[pts.length - 1][0].toFixed(1)},${h - padB}`;
  const ticks = [max, (max + min) / 2, min];
  return (
    <Svg style={{ direction: 'ltr' }} viewBox={`0 0 ${w} ${h}`} width="100%" height={height}>
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {ticks.map((v, i) => {
        const y = padT + (1 - (v - min) / range) * plotH;
        return (
          <G key={i}>
            <Line x1={padL} y1={y} x2={w - padR} y2={y} stroke={grid} strokeWidth={1} />
            <SvgText x={0} y={y + 3} fontSize={9} fill={label}>{fmt(v)}</SvgText>
          </G>
        );
      })}
      <Polygon points={area} fill="url(#g)" />
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r={3.2} fill={color} />)}
    </Svg>
  );
}

export function Donut({ parts, size = 132, hole = 22, holeColor }: {
  parts: { p: number; c: string }[]; size?: number; hole?: number; holeColor: string;
}) {
  const r = size / 2, ir = r - hole;
  let acc = 0;
  const total = parts.reduce((s, x) => s + x.p, 0) || 1;
  const arc = (a0: number, a1: number) => {
    const p = (a: number, rad: number) => [r + rad * Math.sin(a), r - rad * Math.cos(a)];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r), [x2, y2] = p(a1, ir), [x3, y3] = p(a0, ir);
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ir},${ir} 0 ${large} 0 ${x3},${y3} Z`;
  };
  return (
    <Svg style={{ direction: 'ltr' }} width={size} height={size}>
      {parts.map((s, i) => {
        const a0 = (acc / total) * Math.PI * 2;
        acc += s.p;
        const a1 = Math.min((acc / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
        return <Path key={i} d={arc(a0, a1)} fill={s.c} />;
      })}
      <Circle cx={r} cy={r} r={ir} fill={holeColor} />
    </Svg>
  );
}

export function Bars({ data, color, hi, height = 70 }: { data: number[]; color: string; hi: string; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height, direction: 'ltr' }}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, height: `${Math.max(10, (v / max) * 100)}%`, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: v === max ? hi : color }} />
      ))}
    </View>
  );
}

export function Flame({ streak, size = 40 }: { streak: number; size?: number }) {
  const color = streak > 0 ? '#ff9d4d' : '#3a4150';
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg style={{ direction: 'ltr' }} viewBox="0 0 24 24" width={size} height={size}>
        <Path fill={color} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingTop: size * 0.18 }}>
        <SvgLabel text={String(streak)} size={size * 0.32} />
      </View>
    </View>
  );
}

function SvgLabel({ text, size }: { text: string; size: number }) {
  return <Text style={{ color: '#0e1219', fontWeight: '800', fontSize: size }}>{text}</Text>;
}


/** Storico (linea piena) + previsione (tratteggiata) + fascia di incertezza all'80% + linea dell'obiettivo. */
export function TrendChart({ pts, forecast, color, h = 70, target, range, showLabels }: {
  pts: { d: string; v: number }[];
  forecast?: { pts: { d: string; v: number }[]; lo: number[]; hi: number[] } | null;
  color: string; h?: number; target?: number; range?: [number, number]; showLabels?: boolean;
}) {
  if (pts.length < 2) return null;
  const w = 300, padX = 4, padY = 6;
  const hist = pts.slice(-30);
  const fc = forecast?.pts ?? [];
  const all = [...hist.map((p) => p.v), ...fc.map((p) => p.v), ...(forecast?.lo ?? []), ...(forecast?.hi ?? [])];
  if (target != null) all.push(target);
  if (range) all.push(range[0], range[1]);
  const max = Math.max(...all), min = Math.min(...all), span = max - min || 1;
  const n = hist.length + fc.length;
  const X = (i: number) => padX + ((w - 2 * padX) * i) / Math.max(1, n - 1);
  const Y = (v: number) => padY + (1 - (v - min) / span) * (h - 2 * padY);
  const line = hist.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const base = hist.length - 1;
  const fcLine = fc.length ? [`${X(base).toFixed(1)},${Y(hist[base].v).toFixed(1)}`, ...fc.map((p, i) => `${X(base + 1 + i).toFixed(1)},${Y(p.v).toFixed(1)}`)].join(' ') : '';
  const band = fc.length && forecast
    ? [`${X(base).toFixed(1)},${Y(hist[base].v).toFixed(1)}`, ...forecast.hi.map((v, i) => `${X(base + 1 + i).toFixed(1)},${Y(v).toFixed(1)}`), ...forecast.lo.map((v, i) => `${X(base + fc.length - i).toFixed(1)},${Y(v).toFixed(1)}`)].join(' ')
    : '';
  return (
    <Svg style={{ direction: 'ltr' }} viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {range && <Polygon points={`${padX},${Y(range[1])} ${w - padX},${Y(range[1])} ${w - padX},${Y(range[0])} ${padX},${Y(range[0])}`} fill={color} opacity={0.08} />}
      {target != null && <Line x1={padX} y1={Y(target)} x2={w - padX} y2={Y(target)} stroke={color} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />}
      {band ? <Polygon points={band} fill={color} opacity={0.16} /> : null}
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {fcLine ? <Polyline points={fcLine} fill="none" stroke={color} strokeWidth={2.2} strokeDasharray="5 4" strokeLinecap="round" opacity={0.9} /> : null}
      <Circle cx={X(base)} cy={Y(hist[base].v)} r={3.4} fill={color} />
      {fc.length ? <Circle cx={X(n - 1)} cy={Y(fc[fc.length - 1].v)} r={3} fill="none" stroke={color} strokeWidth={1.6} /> : null}
      {showLabels && fc.length ? <SvgText x={X(base) + 4} y={h - 1} fontSize={8} fill={color} opacity={0.8}>oggi</SvgText> : null}
    </Svg>
  );
}
