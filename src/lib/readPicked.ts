import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { decodeBytes } from '@/lib/csvImport';

type Asset = { uri: string; file?: unknown };

/** Legge un file scelto con il selettore (web: oggetto File; telefono: expo-file-system) e lo decodifica (UTF-8 o Windows-1252). */
export async function readPickedText(a: Asset): Promise<string> {
  if (Platform.OS === 'web') {
    const f = a.file as Blob | undefined;
    const buf = f && typeof f.arrayBuffer === 'function' ? await f.arrayBuffer() : await (await fetch(a.uri)).arrayBuffer();
    return decodeBytes(buf);
  }
  try {
    return decodeBytes(await new File(a.uri).arrayBuffer());
  } catch {
    return decodeBytes(await (await fetch(a.uri)).arrayBuffer());
  }
}
