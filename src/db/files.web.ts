import type { FileEntry } from './space.ts';

export function listAppFiles(): FileEntry[] { return []; }
export function deleteFiles(_uris: string[]): { deleted: number; failed: number } { return { deleted: 0, failed: 0 }; }
export function diskSpace(): { available: number; total: number } | null {
  return null;
}
