/**
 * Tipi condivisi della pipeline delle abitudini dalla posizione. Modulo PURO (nessun alias '@/', nessun react-native):
 * tutto gira sul telefono e si testa con node. I dati di posizione sono SENSIBILI: non escono mai dal telefono
 * (vedi docs/habits.md e la voce "Luoghi e spostamenti" del catalogo dati).
 */

/** Punto grezzo di posizione. `ts` in millisecondi. */
export type GeoPoint = { ts: number; lat: number; lng: number; accuracy: number; speed?: number | null };

/** Sosta: periodo in cui si e' rimasti nello stesso posto. `placeId` e' assegnato dal clustering. */
export type Stay = { start: number; end: number; lat: number; lng: number; n: number; placeId?: string };

export type Mode = 'piedi' | 'bici' | 'auto' | 'mezzi' | 'sconosciuto';
export type Confidence = 'alta' | 'media' | 'bassa';

/** Spostamento tra due soste consecutive. */
export type Trip = {
  start: number; end: number;
  from?: string; to?: string;
  distM: number;
  mode: Mode; modeConf: Confidence;
  /** punti campionati nel tragitto (0 = solo partenza e arrivo noti) */
  samples: number;
};

export type PlaceKind = 'casa' | 'lavoro' | 'palestra' | 'studio' | 'negozio' | 'altro';

export type Place = {
  id: string;
  lat: number; lng: number;
  /** raggio che contiene il 90% delle soste, in metri */
  radius: number;
  visits: number;
  totalMs: number;
  first: number; last: number;
  /** scelta dell'utente: ha sempre la precedenza sull'etichetta dedotta */
  name?: string;
  kind?: PlaceKind;
  confirmed?: boolean;
};

export type Inferred = { kind: PlaceKind; name?: string; why: string; basedOn: number; confidence: Confidence };

export type Settings = {
  /** coordinate arrotondate a ~100 m prima di salvarle */
  coarsen: boolean;
};

export const DAY_MS = 86400000;
export const HOUR_MS = 3600000;
export const MIN_MS = 60000;
