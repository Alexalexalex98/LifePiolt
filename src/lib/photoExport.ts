import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

import { loadSkia } from '@/lib/skiaSafe';
import { SKSL, geoMatrix, outputSize, uniformValues, type Geo, type PhotoParams } from '@/lib/photoShader';

export type Base = { uri: string; width: number; height: number };
/** Foto pronta da ritoccare: dritta (l'orientamento della fotocamera è già applicato) e non enorme. */
export async function prepareBase(uri: string, maxSide = 2400): Promise<Base> {
  const first = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 1 });
  const big = Math.max(first.width, first.height);
  if (big <= maxSide) return { uri: first.uri, width: first.width, height: first.height };
  const resized = await manipulateAsync(first.uri, [{ resize: first.width >= first.height ? { width: maxSide } : { height: maxSide } }], { format: SaveFormat.JPEG, compress: 1 });
  return { uri: resized.uri, width: resized.width, height: resized.height };
}

/** Applica ritocchi e inquadratura alla foto e la salva (JPEG) nella cache: è il file che si pubblica. null = Skia non disponibile o errore. */
export async function renderEdited(base: Base, p: PhotoParams, g: Geo, maxSide = 2048, quality = 92): Promise<string | null> {
  const Sk = loadSkia();
  if (!Sk) return null;
  try {
    const { Skia, TileMode, FilterMode, MipmapMode, ImageFormat } = Sk;
    const data = await Skia.Data.fromURI(base.uri);
    const img = Skia.Image.MakeImageFromEncoded(data);
    const effect = Skia.RuntimeEffect.Make(SKSL);
    if (!img || !effect) return null;
    const out = outputSize(img.width(), img.height(), g, maxSide);
    const m = geoMatrix(img.width(), img.height(), g, out.w, out.h);
    const shader = img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None, Skia.Matrix([m.a, m.c, m.e, m.b, m.d, m.f, 0, 0, 1]));
    const rt = effect.makeShaderWithChildren(uniformValues(p, out.w, out.h), [shader]);
    const surface = Skia.Surface.MakeOffscreen(out.w, out.h);
    if (!surface) return null;
    const paint = Skia.Paint(); paint.setShader(rt);
    surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, out.w, out.h), paint);
    surface.flush();
    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, quality);
    const f = new File(Paths.cache, `foto-${Date.now().toString(36)}.jpg`);
    f.create({ overwrite: true }); f.write(bytes);
    return f.uri;
  } catch { return null; }
}
