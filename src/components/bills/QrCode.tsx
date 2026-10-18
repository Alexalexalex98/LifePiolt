import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

/** Disegna un codice QR dal testo (livello M, come chiede il QR-bill svizzero). Con `swissCross` mette la croce svizzera al centro. */
export function QrCode({ value, size = 220, swissCross }: { value: string; size?: number; swissCross?: boolean }) {
  const cells = useMemo(() => {
    try {
      const q = qrcode(0, 'M');
      q.addData(value, 'Byte');
      q.make();
      const n = q.getModuleCount();
      const out: { x: number; y: number }[] = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push({ x: c, y: r });
      return { n, out };
    } catch { return null; }
  }, [value]);
  if (!cells) return null;
  const quiet = 4, total = cells.n + quiet * 2, u = size / total;
  const c = size / 2, box = size * (7 / 46), arm = box * 0.62, th = box * 0.2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#fff" />
      {cells.out.map((p) => <Rect key={`${p.x}-${p.y}`} x={(p.x + quiet) * u} y={(p.y + quiet) * u} width={u + 0.4} height={u + 0.4} fill="#000" />)}
      {swissCross ? (
        <>
          <Rect x={c - box / 2 - 2} y={c - box / 2 - 2} width={box + 4} height={box + 4} fill="#fff" />
          <Rect x={c - box / 2} y={c - box / 2} width={box} height={box} fill="#000" />
          <Rect x={c - th / 2} y={c - arm / 2} width={th} height={arm} fill="#fff" />
          <Rect x={c - arm / 2} y={c - th / 2} width={arm} height={th} fill="#fff" />
        </>
      ) : null}
    </Svg>
  );
}
