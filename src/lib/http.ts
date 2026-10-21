import { Platform } from 'react-native';

/**
 * Scarica un testo da internet. Sul telefono usa XMLHttpRequest: il `fetch` di Expo cerca il modulo nativo «ExpoFetchModule», che in Expo Go
 * può mancare e fa comparire la schermata rossa «Cannot find native module». Sul web si usa fetch.
 */
export async function httpGetText(url: string, timeoutMs = 9000, headers: Record<string, string> = {}): Promise<string> {
  if (Platform.OS === 'web') {
    const ctl = new AbortController();
    const h = setTimeout(() => ctl.abort(), timeoutMs);
    try { const r = await fetch(url, { signal: ctl.signal, headers }); if (!r.ok) throw new Error(String(r.status)); return await r.text(); } finally { clearTimeout(h); }
  }
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.timeout = timeoutMs;
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(x.responseText) : reject(new Error(String(x.status))));
    x.onerror = () => reject(new Error('rete non raggiungibile'));
    x.ontimeout = () => reject(new Error('tempo scaduto'));
    x.send();
  });
}
