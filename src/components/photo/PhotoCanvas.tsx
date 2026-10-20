import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import { SKSL, UNIFORM_ORDER, geoMatrix, outputSize, uniformValues, type Geo, type PhotoParams } from '@/lib/photoShader';

const effect = Skia.RuntimeEffect.Make(SKSL);

/** Anteprima in diretta: la foto passa dallo stesso shader che poi produce il file finale. */
export default function PhotoCanvas({ uri, params, geo, boxW, boxH, seed = 0.37 }: { uri: string; params: PhotoParams; geo: Geo; boxW: number; boxH: number; seed?: number }) {
  const img = useImage(uri);
  const iw = img?.width() ?? 1, ih = img?.height() ?? 1;
  const size = useMemo(() => {
    const o = outputSize(iw, ih, geo, 100000);
    const k = Math.min(boxW / o.w, boxH / o.h);
    return { w: Math.max(1, Math.floor(o.w * k)), h: Math.max(1, Math.floor(o.h * k)) };
  }, [iw, ih, geo, boxW, boxH]);
  const m = geoMatrix(iw, ih, geo, size.w, size.h);
  const values = uniformValues(params, size.w, size.h, seed);
  const uniforms = useMemo(() => Object.fromEntries(UNIFORM_ORDER.map((k, i) => [k, values[i]])), [values.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!img || !effect) return <View style={{ width: size.w, height: size.h }} />;
  return (
    <Canvas style={{ width: size.w, height: size.h }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={img} fit="none" tx="clamp" ty="clamp" transform={[{ matrix: [m.a, m.c, 0, m.e, m.b, m.d, 0, m.f, 0, 0, 1, 0, 0, 0, 0, 1] }]} />
        </Shader>
      </Fill>
    </Canvas>
  );
}
