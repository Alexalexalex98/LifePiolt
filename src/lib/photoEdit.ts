/**
 * Modifiche alla foto del recap (modulo PURO): calcolo dei ritagli e traduzione di una richiesta scritta
 * («più luminosa e calda, in formato quadrato») nelle modifiche che l'app sa fare. Quello che richiede
 * un'intelligenza artificiale per le immagini (togliere un oggetto, cambiare lo sfondo) NON si finge: si dice.
 */
import type { Adjust, FilterId } from './stories.ts';

export type Ratio = '1:1' | '4:5' | '9:16' | '3:4' | '16:9';
export const RATIOS: { id: Ratio; label: string; w: number; h: number }[] = [
  { id: '9:16', label: 'Storia 9:16', w: 9, h: 16 }, { id: '4:5', label: 'Verticale 4:5', w: 4, h: 5 }, { id: '1:1', label: 'Quadrato', w: 1, h: 1 }, { id: '3:4', label: 'Foto 3:4', w: 3, h: 4 }, { id: '16:9', label: 'Largo 16:9', w: 16, h: 9 },
];
export type Op =
  | { k: 'adj'; d: Partial<Adjust> }
  | { k: 'filter'; id: FilterId }
  | { k: 'rotate'; deg: 90 | -90 | 180 }
  | { k: 'flip' }
  | { k: 'crop'; ratio: Ratio }
  | { k: 'zoom'; f: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ritaglio centrato con le proporzioni volute, il più grande possibile (se `zoom` > 1 si stringe ancora). */
export function cropRect(w: number, h: number, ratio: Ratio, zoom = 1): { originX: number; originY: number; width: number; height: number } {
  const r = RATIOS.find((x) => x.id === ratio) ?? RATIOS[0];
  const target = r.w / r.h;
  let cw = w, ch = w / target;
  if (ch > h) { ch = h; cw = h * target; }
  const z = clamp(zoom, 1, 4);
  cw = cw / z; ch = ch / z;
  return { originX: Math.round((w - cw) / 2), originY: Math.round((h - ch) / 2), width: Math.round(cw), height: Math.round(ch) };
}
/** Stringe al centro, mantenendo le proporzioni attuali. */
export function zoomRect(w: number, h: number, f: number): { originX: number; originY: number; width: number; height: number } {
  const z = clamp(f, 1, 4);
  const cw = w / z, ch = h / z;
  return { originX: Math.round((w - cw) / 2), originY: Math.round((h - ch) / 2), width: Math.round(cw), height: Math.round(ch) };
}
/** Somma ai ritocchi, sempre nei limiti. */
export function addAdjust(a: Adjust, d: Partial<Adjust>): Adjust {
  return { bright: r2(clamp(a.bright + (d.bright ?? 0), -1, 1)), warm: r2(clamp(a.warm + (d.warm ?? 0), -1, 1)), fade: r2(clamp(a.fade + (d.fade ?? 0), 0, 1)), vign: r2(clamp(a.vign + (d.vign ?? 0), 0, 1)) };
}

const has = (t: string, ...w: string[]) => w.some((x) => t.includes(x));
export type Parsed = { ops: Op[]; unsupported: string[] };

/** «Rendila più calda e luminosa, quadrata» -> modifiche. Capisce frasi semplici in italiano. */
export function parseEdit(raw: string): Parsed {
  const t = ` ${raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')} `;
  const ops: Op[] = [];
  const unsupported: string[] = [];
  const more = has(t, ' piu ', ' molto ', ' tanto ');
  const less = has(t, ' meno ', ' poco ');
  const amt = has(t, ' molto ', ' tanto ', ' tantissimo ') ? 0.5 : 0.3;
  // luminosità
  if (has(t, 'lumin', 'chiar', 'illumina', 'schiaris')) ops.push({ k: 'adj', d: { bright: less ? -amt : amt } });
  if (has(t, 'scur', 'buio', 'buia', 'oscur')) ops.push({ k: 'adj', d: { bright: -amt } });
  // temperatura
  if (has(t, 'calda', 'caldo', 'calore', 'tramonto', 'dorat')) ops.push({ k: 'adj', d: { warm: amt } });
  if (has(t, 'fredd', 'gelid', 'ghiacc')) ops.push({ k: 'adj', d: { warm: -amt } });
  // atmosfera
  if (has(t, 'vintage', 'retro', 'sbiadit', 'pellicola', 'nostalg')) { ops.push({ k: 'adj', d: { fade: 0.35, warm: 0.2 } }); }
  if (has(t, 'drammatic', 'cinema', 'film', 'intens', 'vignett')) ops.push({ k: 'adj', d: { vign: 0.5, bright: -0.1 } });
  if (has(t, 'sognant', 'morbid', 'delicat', 'soft', 'dolce')) ops.push({ k: 'adj', d: { fade: 0.3, bright: 0.15 } });
  // filtri
  if (has(t, 'neon', 'viola')) ops.push({ k: 'filter', id: 'neon' });
  if (has(t, 'notte', 'notturn')) ops.push({ k: 'filter', id: 'notte' });
  if (has(t, 'rosa')) ops.push({ k: 'filter', id: 'rosa' });
  if (has(t, 'seppia')) ops.push({ k: 'filter', id: 'seppia' });
  if (has(t, 'originale', 'senza filtr', 'togli il filtro', 'toglilo')) ops.push({ k: 'filter', id: 'none' });
  // geometria
  if (has(t, 'ruota', 'girala', 'giralo', 'gira ')) ops.push({ k: 'rotate', deg: has(t, 'sinistra', 'antiorar') ? -90 : has(t, '180', 'sottosopra') ? 180 : 90 });
  if (has(t, 'specchia', 'speculare', 'rifletti', 'ribalta')) ops.push({ k: 'flip' });
  if (has(t, 'quadrat', '1:1', '1 a 1')) ops.push({ k: 'crop', ratio: '1:1' });
  else if (has(t, '4:5', 'ritratto')) ops.push({ k: 'crop', ratio: '4:5' });
  else if (has(t, '9:16', 'storia', 'verticale')) ops.push({ k: 'crop', ratio: '9:16' });
  else if (has(t, '16:9', 'larga', 'panoramic', 'orizzontal')) ops.push({ k: 'crop', ratio: '16:9' });
  else if (has(t, '3:4')) ops.push({ k: 'crop', ratio: '3:4' });
  if (has(t, 'zoom', 'ingrandisc', 'avvicina', 'stringi')) ops.push({ k: 'zoom', f: more ? 1.6 : 1.3 });
  // cose che servirebbero a un'AI per le immagini
  if (has(t, 'togli', 'rimuovi', 'cancella', 'elimina') && !has(t, 'filtro')) unsupported.push('togliere o cancellare qualcosa dalla foto');
  if (has(t, 'sfondo', 'cielo', 'sostituisci', 'aggiungi un', 'aggiungi una', 'persona', 'cambia il colore')) unsupported.push('cambiare lo sfondo o aggiungere elementi');
  if (has(t, 'bianco e nero', 'bianconero', 'grigio', 'monocrom')) unsupported.push('il bianco e nero');
  if (has(t, 'nitid', 'definizione', 'sfoca', 'sfocatura', 'rumore')) unsupported.push('nitidezza e sfocatura');
  // dedup di regolazioni dello stesso tipo: la somma si fa applicando
  return { ops, unsupported: [...new Set(unsupported)] };
}

/** Frasi da suggerire all'utente, già comprensibili dall'app. */
export const EDIT_SUGGESTIONS = ['Più luminosa e calda', 'Effetto vintage', 'Look drammatico', 'Più fredda e morbida', 'Ritaglia quadrata', 'Ruota a destra', 'Specchia', 'Zoom al centro'];
