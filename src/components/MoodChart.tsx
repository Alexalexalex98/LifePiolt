import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import type { DayCtx } from '@/lib/moodAnalysis';

export type Overlay = 'none' | 'rain' | 'events' | 'sleep' | 'spend' | 'steps' | 'stress';
export const overlays: { id: Overlay; label: string; get: (d: DayCtx) => number | undefined; color: string; unit: string }[] = [
  { id: 'rain', label: 'Pioggia', get: (d) => d.rain, color: '#7bb8e0', unit: 'mm' },
  { id: 'events', label: 'Impegni', get: (d) => d.events, color: '#8fb3ff', unit: '' },
  { id: 'sleep', label: 'Sonno', get: (d) => d.sleep, color: '#c9b6ff', unit: 'h' },
  { id: 'spend', label: 'Spese', get: (d) => d.spend, color: '#ffb84f', unit: 'CHF' },
  { id: 'steps', label: 'Passi', get: (d) => d.steps, color: '#7be0b0', unit: '' },
  { id: 'stress', label: 'Stress', get: (d) => d.stress, color: '#ff9d9d', unit: '' },
];

/** Umore (linea, scala 1–5) con un secondo dato sovrapposto (barre tenui) per vedere a occhio cosa si muove insieme. */
export function MoodChart({ days, keys, overlay, h = 150 }: { days: DayCtx[]; keys: string[]; overlay: Overlay; h?: number }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const padL = 22, padR = 8, padT = 8, padB = 18;
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = (i: number) => padL + (keys.length <= 1 ? iw / 2 : (i / (keys.length - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - 1) / 4) * ih;
  const byDay = new Map(days.map((d) => [d.day, d]));
  let path = ''; let pen = false;
  const dots: { i: number; v: number }[] = [];
  keys.forEach((k, i) => { const d = byDay.get(k); if (!d) { pen = false; return; } path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.mood).toFixed(1)} `; pen = true; dots.push({ i, v: d.mood }); });
  const ov = overlays.find((o) => o.id === overlay);
  const ovVals = ov ? keys.map((k) => { const d = byDay.get(k); return d ? ov.get(d) : undefined; }) : [];
  const ovMax = Math.max(1e-9, ...ovVals.filter((v): v is number => v != null));
  const bw = Math.max(2, iw / keys.length - 2);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h, direction: 'ltr' }}>
      <Svg style={{ direction: 'ltr' }} width={w} height={h}>
        {[1, 2, 3, 4, 5].map((v) => <Line key={v} x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke={t.border} strokeWidth={v === 3.5 ? 0 : 0.6} />)}
        <Line x1={padL} x2={w - padR} y1={y(3.5)} y2={y(3.5)} stroke={t.positive} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        {[1, 3, 5].map((v) => <SvgText key={v} x={2} y={y(v) + 4} fontSize={10} fill={t.muted}>{v}</SvgText>)}
        {ov && ovVals.map((v, i) => (v == null ? null : <Rect key={i} x={x(i) - bw / 2} y={padT + ih - (v / ovMax) * ih} width={bw} height={(v / ovMax) * ih} fill={ov.color} opacity={0.28} rx={1.5} />))}
        <Path d={path} stroke={t.text} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {dots.map((p) => <Circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.6} fill={t.text} />)}
        <SvgText x={padL} y={h - 3} fontSize={10} fill={t.muted}>{keys[0]?.slice(8)}/{keys[0]?.slice(5, 7)}</SvgText>
        <SvgText x={w - padR} y={h - 3} fontSize={10} fill={t.muted} textAnchor="end">oggi</SvgText>
      </Svg>
    </View>
  );
}
