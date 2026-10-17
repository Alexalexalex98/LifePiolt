import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

export type ChartLine = { data: (number | null)[]; color: string; width?: number; dash?: boolean; opacity?: number };

/** Grafico a linee con scala comune, fasce orizzontali e barre (per RSI, MACD, confronti). Si ferma agli ultimi dati. */
export function AnalysisChart({ lines, height = 180, bands, bars, hlines, grid }: { lines: ChartLine[]; height?: number; bands?: { from: number; to: number; color: string }[]; bars?: { data: number[]; pos: string; neg: string }; hlines?: { y: number; color: string }[]; grid?: string }) {
  const [w, setW] = useState(0);
  const pad = 6;
  const all = [...lines.flatMap((l) => l.data.filter((x): x is number => x !== null)), ...(bars?.data ?? []), ...(hlines?.map((h) => h.y) ?? []), ...(bands?.flatMap((b) => [b.from, b.to]) ?? [])];
  const n = Math.max(...lines.map((l) => l.data.length), bars?.data.length ?? 0, 2);
  const min = all.length ? Math.min(...all) : 0, max = all.length ? Math.max(...all) : 1, range = max - min || 1;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && all.length > 1 ? (
        <Svg width={w} height={height} style={{ direction: 'ltr' }}>
          {bands?.map((b, i) => <Rect key={'b' + i} x={0} y={y(b.to)} width={w} height={Math.max(0, y(b.from) - y(b.to))} fill={b.color} />)}
          {grid ? [0.25, 0.5, 0.75].map((f) => <Line key={f} x1={0} x2={w} y1={pad + f * (height - pad * 2)} y2={pad + f * (height - pad * 2)} stroke={grid} strokeWidth={1} />) : null}
          {hlines?.map((h, i) => <Line key={'h' + i} x1={0} x2={w} y1={y(h.y)} y2={y(h.y)} stroke={h.color} strokeWidth={1} strokeDasharray="4 4" />)}
          {bars?.data.map((v, i) => { const y0 = y(0), y1 = y(v); return <Rect key={'r' + i} x={x(i) - Math.max(0.6, w / n / 2.4)} width={Math.max(1.2, w / n / 1.2)} y={Math.min(y0, y1)} height={Math.abs(y1 - y0)} fill={v >= 0 ? bars.pos : bars.neg} />; })}
          {lines.map((l, k) => {
            let d = '';
            let pen = false;
            l.data.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i + (n - l.data.length)).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
            return <Path key={k} d={d} fill="none" stroke={l.color} strokeWidth={l.width ?? 2} strokeOpacity={l.opacity ?? 1} strokeDasharray={l.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />;
          })}
        </Svg>
      ) : null}
    </View>
  );
}
