import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { basename, type FileEntry } from './space.ts';

/** File dell'app (telefono): allegati delle chat in Documenti/chat, cache, file di database. Sul web non c'e' nulla da elencare. */
function walk(dir: Directory, group: FileEntry['group'], out: FileEntry[], depth = 0) {
  if (depth > 4) return;
  let items: (Directory | File)[] = [];
  try { items = dir.list(); } catch { return; }
  for (const it of items) {
    try {
      if (it instanceof Directory) { if (it.name === 'SQLite') continue; walk(it, group, out, depth + 1); }
      else out.push({ uri: it.uri, name: basename(it.uri), bytes: it.size ?? 0, group });
    } catch { /* file sparito nel frattempo */ }
  }
}

export function listAppFiles(): FileEntry[] {
  if (Platform.OS === 'web') return [];
  const out: FileEntry[] = [];
  try { const chat = new Directory(Paths.document, 'chat'); if (chat.exists) walk(chat, 'attachments', out); } catch { /* ignore */ }
  try { walk(new Directory(Paths.cache), 'cache', out); } catch { /* ignore */ }
  return out;
}

export function deleteFiles(uris: string[]): { deleted: number; failed: number } {
  let deleted = 0, failed = 0;
  for (const u of uris) { try { const f = new File(u); if (f.exists) f.delete(); deleted++; } catch { failed++; } }
  return { deleted, failed };
}

export function diskSpace(): { available: number; total: number } | null {
  if (Platform.OS === 'web') return null;
  try { return { available: Paths.availableDiskSpace, total: Paths.totalDiskSpace }; } catch { return null; }
}
