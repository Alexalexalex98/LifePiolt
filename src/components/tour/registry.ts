import type { RefObject } from 'react';
import type { View } from 'react-native';

/** Rettangolo di un bersaglio in coordinate della finestra (quelle di measureInWindow). */
export type Rect = { x: number; y: number; w: number; h: number };

const targets = new Map<string, RefObject<View | null>[]>();

export function registerTarget(id: string, ref: RefObject<View | null>) {
  const list = targets.get(id) ?? [];
  if (!list.includes(ref)) list.push(ref);
  targets.set(id, list);
}

export function unregisterTarget(id: string, ref: RefObject<View | null>) {
  const list = (targets.get(id) ?? []).filter((r) => r !== ref);
  if (list.length) targets.set(id, list);
  else targets.delete(id);
}

export const hasTarget = (id: string | undefined): boolean => !!id && (targets.get(id)?.length ?? 0) > 0;

function measureOne(ref: RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 350);
    try {
      node.measureInWindow((x, y, w, h) => {
        if (done) return;
        done = true; clearTimeout(timer);
        resolve(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0 ? { x, y, w, h } : null);
      });
    } catch { if (!done) { done = true; clearTimeout(timer); resolve(null); } }
  });
}

/** Misura il bersaglio (se ce ne sono più d'uno con lo stesso id vale il primo visibile, partendo dall'ultimo montato). */
export async function measureTarget(id: string | undefined): Promise<Rect | null> {
  if (!id) return null;
  const list = (targets.get(id) ?? []).slice().reverse();
  for (const ref of list) {
    const r = await measureOne(ref);
    if (r) return r;
  }
  return null;
}

export const sameRect = (a: Rect | null, b: Rect | null) => (a === b) || (!!a && !!b && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.w) === Math.round(b.w) && Math.round(a.h) === Math.round(b.h));
