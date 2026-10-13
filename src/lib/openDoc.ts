import { Directory, File, Paths } from 'expo-file-system';
import { Linking, Platform, Share } from 'react-native';

import { go } from '@/lib/nav';
import { kindOfFile } from '@/lib/presentation';
import { buildSamplePdf, sampleLines } from '@/lib/samplePdf';
import { toast } from '@/store/toast';

/** Un PDF dimostrativo per i file di esempio (nome → file nella cache, o indirizzo temporaneo sul web). */
async function sampleUri(name: string): Promise<string> {
  const bytes = buildSamplePdf(name.replace(/\.pdf$/i, ''), sampleLines(name));
  if (Platform.OS === 'web') return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const dir = new Directory(Paths.cache, 'samples');
  if (!dir.exists) dir.create();
  const f = new File(dir, `${name.replace(/[^a-z0-9._-]+/gi, '_')}`);
  if (!f.exists) { f.create(); f.write(bytes); }
  return f.uri;
}

/**
 * Apre un documento nell'app: i PDF e le immagini si leggono qui; i file di esempio senza contenuto diventano un PDF dimostrativo;
 * gli altri tipi si passano al sistema. Mai un link che non si apre senza dire perché.
 */
export async function openDocument(d: { uri?: string | null; name: string; mime?: string | null }): Promise<void> {
  const kind = kindOfFile(d.name, d.mime);
  let uri = d.uri ?? '';
  try {
    if (!uri) {
      if (kind !== 'pdf') { toast('Questo è un file di esempio senza contenuto: carica un tuo file per aprirlo'); return; }
      uri = await sampleUri(d.name);
    }
    if (kind === 'pdf' || kind === 'image') { go('docView', { uri, name: d.name }); return; }
    try { await Linking.openURL(uri); } catch { await Share.share({ message: d.name, url: uri }); }
  } catch {
    toast('Non riesco ad aprire questo file');
  }
}
