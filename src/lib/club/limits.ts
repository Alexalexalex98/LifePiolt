import type { LessonKind } from './types.ts';

/** Limiti di dimensione dei file caricati dal creatore (restano nella memoria del telefono: nessun upload). */
export const MAX_MB: Record<LessonKind | 'image', number> = { video: 200, audio: 60, pdf: 50, testo: 0, file: 50, link: 0, image: 10 };

export const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

/** Messaggio di errore se il file e' troppo grande, altrimenti null. */
export function checkSize(kind: LessonKind | 'image', bytes: number | undefined | null): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  const max = MAX_MB[kind];
  if (max > 0 && bytes > max * 1048576) return `Il file pesa ${mb(bytes)} MB: il limite per questo tipo è ${max} MB. Comprimilo e riprova (col server i limiti saranno molto più alti).`;
  return null;
}

/** MIME accettati dal selettore per tipo di lezione. */
export const PICK_TYPES: Record<'audio' | 'pdf' | 'file', string[]> = {
  audio: ['audio/*'],
  pdf: ['application/pdf'],
  file: ['*/*'],
};

/** Tipo di lezione dedotto da un MIME o dal nome del file. */
export function kindFromFile(name: string, mime?: string): LessonKind {
  const m = (mime ?? '').toLowerCase(), n = name.toLowerCase();
  if (m.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg)$/.test(n)) return 'audio';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  return 'file';
}
