import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Grafico ad area a tutta larghezza (stile app di investimento): linea sottile con sfumatura sotto. */
export function AreaChart({ data, color, height = 150 }: { data: number[]; color: string; height?: number }) {
  const [w, setW] = useState(0);
  const pad = 6;
  let line = '', area = '';
  if (w > 0 && data.length > 1) {
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    const x = (i: number) => (i / (data.length - 1)) * w;
    const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
    line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    area = `${line} L${w},${height} L0,${height} Z`;
  }
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && line ? (
        <Svg width={w} height={height} style={{ direction: 'ltr' }}>
          <Defs>
            <LinearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#ag)" />
          <Path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}
