/** Carica Skia solo quando serve e senza rompere l'app se non c'è (per esempio in una build vecchia che non lo include). */
type SkiaModule = typeof import('@shopify/react-native-skia');
let cached: SkiaModule | null | undefined;
export function loadSkia(): SkiaModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@shopify/react-native-skia') as SkiaModule;
    cached = m && m.Skia ? m : null;
  } catch { cached = null; }
  return cached;
}
