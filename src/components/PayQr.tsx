import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { qrMatrix } from '@/lib/profile/qr';

/** QR di pagamento (bianco e nero, con margine: si legge anche sul tema scuro). */
export function PayQr({ text, size = 220 }: { text: string; size?: number }) {
  const m = qrMatrix(text);
  if (!m) return <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 12 }} />;
  const n = m.length, quiet = 3, cell = size / (n + quiet * 2);
  return (
    <View accessibilityLabel="QR di pagamento" style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' }}>
      <Svg width={size} height={size} style={{ direction: 'ltr' }}>
        {m.flatMap((row, y) => row.map((on, x) => (on ? <Rect key={`${x}-${y}`} x={(x + quiet) * cell} y={(y + quiet) * cell} width={cell + 0.4} height={cell + 0.4} fill="#000" /> : null)))}
      </Svg>
    </View>
  );
}
