import { fmtNumber } from '@/i18n/format';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';
import Svg, { G, Line, Path, Polyline, Rect, Circle, Text as SvgText } from 'react-native-svg';

import type { ChartSpec } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { niceMax } from '@/lib/dataTable';
import { Icon } from '@/lib/icons';
import { endAlign } from '@/lib/rtl';

const COLORS = ['#4f7cff', '#1f9d6b', '#e0a030', '#d64545', '#8a5cf6', '#13a8c4', '#e0709c', '#7a8794'];
export const seriesColor = (i: number) => COLORS[i % COLORS.length];
const fmtN = (v: number) => fmtNumber(v, { maximumFractionDigits: Math.abs(v) >= 1000 ? 1 : 2 });
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '.' : s);

/** Grafico (barre, linee o torta) disegnato in SVG dai dati inseriti da chi assume. */
export function DataChart({ spec, tableOpen = false }: { spec: ChartSpec; tableOpen?: boolean }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const [table, setTable] = useState(tableOpen);
  const n = spec.labels.length;
  const k = spec.series.length;
  const unit = spec.unit ? ` ${spec.unit}` : '';
  const h = 190, padL = 42, padR = 10, padT = 14, padB = 26;
  const plotW = Math.max(40, w - padL - padR), plotH = h - padT - padB;
  const all = spec.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all, 0)), min = Math.min(0, ...all);
  const range = max - min || 1;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;
  const ticks = [min, min + range / 2, max];
  const slot = n ? plotW / n : plotW;

  let body: React.ReactNode = null;
  if (spec.type === 'pie') {
    const vals = (spec.series[0]?.values ?? []).map((v) => Math.max(0, v));
    const tot = vals.reduce((s, v) => s + v, 0) || 1;
    const r = 78, cx = w / 2, cy = 90;
    let a0 = -Math.PI / 2;
    body = (
      <>
        <Svg style={{ direction: 'ltr' }} width="100%" height={180} viewBox={`0 0 ${w} 180`}>
          {vals.map((v, i) => {
            const a1 = a0 + (v / tot) * Math.PI * 2;
            const full = v / tot > 0.9999;
            const p = full ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
              : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
            a0 = a1;
            return v > 0 ? <Path key={i} d={p} fill={seriesColor(i)} stroke={t.card} strokeWidth={1.5} /> : null;
          })}
        </Svg>
        <View style={{ gap: 4, marginTop: 4 }}>
          {vals.map((v, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: seriesColor(i) }} />
              <Text style={{ color: t.text, fontSize: 12, flex: 1 }}>{spec.labels[i]}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{fmtN(spec.series[0].values[i])}{unit} · {Math.round((v / tot) * 100)}%</Text>
            </View>
          ))}
        </View>
      </>
    );
  } else {
    const maxChars = Math.max(3, Math.floor(slot / 5.2));
    body = (
      <>
        <Svg style={{ direction: 'ltr' }} width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
          {ticks.map((v, i) => (
            <G key={i}>
              <Line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} stroke={t.border} strokeWidth={1} />
              <SvgText x={padL - 5} y={y(v) + 3} fontSize={9} fill={t.muted} textAnchor="end">{fmtN(v)}</SvgText>
            </G>
          ))}
          {spec.type === 'bar' && spec.labels.map((_, i) => {
            const gw = Math.min(slot * 0.78, 46 * k), bw = gw / k, gx = padL + slot * i + (slot - gw) / 2;
            return spec.series.map((s, j) => {
              const v = s.values[i] ?? 0, top = y(Math.max(v, 0)), bot = y(Math.min(v, 0));
              return (
                <G key={`${i}-${j}`}>
                  <Rect x={gx + bw * j + 0.5} y={top} width={Math.max(1, bw - 1)} height={Math.max(1, bot - top)} rx={2} fill={seriesColor(j)} />
                  {n * k <= 8 && <SvgText x={gx + bw * j + bw / 2} y={top - 3} fontSize={8} fill={t.muted} textAnchor="middle">{fmtN(v)}</SvgText>}
                </G>
              );
            });
          })}
          {spec.type === 'line' && spec.series.map((s, j) => {
            const pts = s.values.map((v, i) => [padL + slot * i + slot / 2, y(v)] as const);
            return (
              <G key={j}>
                <Polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke={seriesColor(j)} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={seriesColor(j)} />)}
              </G>
            );
          })}
          {spec.labels.map((l, i) => <SvgText key={i} x={padL + slot * i + slot / 2} y={h - 9} fontSize={9} fill={t.muted} textAnchor="middle">{cut(l, maxChars)}</SvgText>)}
        </Svg>
        {k > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
            {spec.series.map((s, j) => <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: seriesColor(j) }} /><Text style={{ color: t.text, fontSize: 12 }}>{s.name}</Text></View>)}
          </View>
        )}
      </>
    );
  }

  return (
    <View onLayout={(e) => setW(Math.max(200, Math.round(e.nativeEvent.layout.width - 24)))} style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 12, marginBottom: 12 }}>
      {spec.title ? <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>{spec.title}{spec.unit ? <Text style={{ color: t.muted, fontWeight: '400' }}>  ({spec.unit})</Text> : null}</Text> : null}
      {body}
      <Pressable onPress={() => setTable(!table)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Icon name="poll" size={14} color={t.accent} />
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{table ? 'Nascondi tabella dei dati' : 'Mostra tabella dei dati'}</Text>
      </Pressable>
      {table && (
        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: t.border }}>
          <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
            <Text style={{ flex: 1.4, color: t.muted, fontSize: 11 }} />
            {spec.series.map((s, j) => <Text key={j} style={{ flex: 1, color: t.muted, fontSize: 11, fontWeight: '700', textAlign: endAlign() }} numberOfLines={1}>{s.name}</Text>)}
          </View>
          {spec.labels.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, borderTopWidth: 1, borderTopColor: t.item }}>
              <Text style={{ flex: 1.4, color: t.text, fontSize: 12 }} numberOfLines={1}>{l}</Text>
              {spec.series.map((s, j) => <Text key={j} style={{ flex: 1, color: t.text, fontSize: 12, textAlign: endAlign() }}>{fmtN(s.values[i] ?? 0)}</Text>)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
