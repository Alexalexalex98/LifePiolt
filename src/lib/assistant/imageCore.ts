/** Regole pure degli allegati immagine di Theia. */
export const MAX_IMAGES = 4;
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

/** Dimensioni dopo il ridimensionamento: il lato lungo non supera `max`; nessun ingrandimento. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(w, h);
  if (!longest || longest <= max) return { width: w, height: h, scaled: false };
  const k = max / longest;
  return { width: Math.round(w * k), height: Math.round(h * k), scaled: true };
}

/** Quante immagini si possono ancora aggiungere. */
export const roomLeft = (current: number, max = MAX_IMAGES) => Math.max(0, max - current);
