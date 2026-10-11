/**
 * Calcolo PURO di quanto la tastiera software copre lo schermo (nessun import dall'app: si prova con node:test).
 *
 * Perché serve: con edge-to-edge (SDK 57, Android 15+) `adjustResize` non ridimensiona più la finestra e
 * KeyboardAvoidingView non fa nulla su Android. Si legge quindi l'altezza dagli eventi della tastiera e si
 * riserva lo spazio con un padding, evitando di contarlo due volte se il sistema ha già ridimensionato la finestra.
 */

export type KbCoords = { height?: number; screenY?: number; screenX?: number; width?: number } | null | undefined;
export type KbEnv = {
  os: 'ios' | 'android' | 'web';
  winW: number;
  winH: number;
  /** altezza della finestra misurata con la tastiera chiusa (per capire se il sistema l'ha già ridimensionata) */
  baseWinH?: number;
};
export type KbState = {
  /** la tastiera è a schermo */
  visible: boolean;
  /** spazio da riservare in fondo (px/dp): 0 se il sistema ha già ridimensionato, se è fluttuante o se non c'è */
  height: number;
  /** altezza grezza riportata dalla tastiera */
  raw: number;
  /** tastiera fluttuante/divisa (iPad, Android multi-finestra): non copre il fondo, non si riserva spazio */
  floating: boolean;
  /** il sistema ha già ridimensionato la finestra: niente padding aggiuntivo */
  resized: boolean;
};

export const KB_HIDDEN: KbState = { visible: false, height: 0, raw: 0, floating: false, resized: false };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function resolveKeyboard(e: KbCoords, env: KbEnv): KbState {
  const raw = e && num(e.height) ? Math.max(0, e.height) : 0;
  if (raw < 1) return KB_HIDDEN;
  // iPad con tastiera mobile: più stretta dello schermo e staccata dal fondo
  const floating = env.os === 'ios' && !!e && num(e.width) && env.winW > 0 && e.width < env.winW * 0.8;
  if (floating) return { visible: true, height: 0, raw, floating: true, resized: false };
  // iOS: la posizione reale dello schermo è più precisa (barra di completamento, tastiera hardware); Android: l'altezza degli insets IME
  let covered = raw;
  if (env.os === 'ios' && e && num(e.screenY) && e.screenY > 0 && env.winH > 0 && e.screenY < env.winH) covered = Math.max(0, env.winH - e.screenY);
  // finestra già rimpicciolita dal sistema (adjustResize che funziona): non raddoppiare lo spazio
  const shrink = num(env.baseWinH) && env.winH > 0 ? env.baseWinH - env.winH : 0;
  const resized = env.os === 'android' && shrink >= covered * 0.6;
  return { visible: true, height: resized ? 0 : Math.round(covered), raw, floating: false, resized };
}

/** Padding in fondo alla barra di scrittura: con tastiera aperta basta lo spazio della tastiera, a riposo serve l'area sicura. */
export function restingBottom(kb: Pick<KbState, 'visible' | 'floating'>, safeBottom: number): number {
  return kb.visible && !kb.floating ? 0 : Math.max(0, safeBottom);
}

/** Altezza massima di un foglio modale: non deve finire sotto la barra di stato quando la tastiera è aperta. */
export function sheetMaxHeight(winH: number, topInset: number, lift: number, ratio = 0.82): number {
  const byRatio = winH * ratio;
  const byRoom = winH - lift - topInset - 16;
  return Math.max(160, Math.min(byRatio, byRoom));
}

/** Altezza di un campo che cresce con il testo (contentH = altezza del contenuto senza padding): da `minLines` a `maxLines` righe, poi scorre. */
export function growHeight(contentH: number, lineH: number, padV: number, minLines = 1, maxLines = 5): number {
  const lo = lineH * minLines + padV, hi = lineH * maxLines + padV;
  const h = num(contentH) ? contentH + padV : lo;
  return Math.round(Math.min(hi, Math.max(lo, h)));
}

/** Dato lo stato precedente e il nuovo, dice se serve riportare la lista in fondo (la tastiera si è aperta o ha cambiato altezza). */
export function shouldScrollToEnd(prev: Pick<KbState, 'visible' | 'height'>, next: Pick<KbState, 'visible' | 'height'>): boolean {
  return next.visible && (!prev.visible || next.height !== prev.height);
}
