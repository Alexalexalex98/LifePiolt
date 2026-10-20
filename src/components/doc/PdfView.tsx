import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/T';
import { pdfHtml } from '@/lib/presentation';
import { bytesToBase64, readUriBytes } from '@/lib/readUri';

/** Legge il file come base64 (solo app: sul web si usa direttamente l'indirizzo). */
async function toBase64(uri: string): Promise<string> {
  try { return await new File(uri).base64(); }
  catch {
    return bytesToBase64(await readUriBytes(uri));
  }
}

/** Visualizza un PDF dentro l'app (pagine scorrevoli, zoom a pizzico). Sul web usa il lettore del browser. */
export function PdfView({ uri, dark = true }: { uri: string; dark?: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    setHtml(null); setErr(false);
    toBase64(uri).then((b) => { if (alive) setHtml(pdfHtml(b, { dark })); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [uri, dark]);

  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Frame: any = 'iframe';
    return <View style={{ flex: 1, backgroundColor: '#0b0e14' }}><Frame src={uri} title="PDF" style={{ border: 0, width: '100%', height: '100%' }} /></View>;
  }
  if (err) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Non riesco a leggere questo file.</Text></View>;
  if (!html) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>;
  return <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: dark ? '#0b0e14' : '#e9edf3' }} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} scalesPageToFit />;
}
