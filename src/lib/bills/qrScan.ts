/** QR-bill svizzero: lettura del codice da una foto (in locale, senza inviare nulla) e controllo del contenuto. */

/** Il contenuto di un QR-bill: inizia con SPC e ha almeno 29 righe. Restituisce il testo pulito oppure null. */
export function swissQrFrom(raw?: string | null): string | null {
  if (!raw) return null;
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const i = lines.findIndex((l) => l.trim() === 'SPC');
  if (i < 0) return null;
  const rest = lines.slice(i);
  const end = rest.findIndex((l) => l.trim() === 'EPD');
  const q = end >= 0 ? rest.slice(0, end + 1) : rest;
  return q.length >= 29 && /^02\d\d$/.test((q[1] ?? '').trim()) ? q.join('\n') : null;
}

/** Cerca un QR-bill nella foto della fattura. Su qualsiasi problema restituisce null (poi si legge con l'AI o a mano). */
export async function scanQrFromImage(uri: string): Promise<string | null> {
  try {
    const { scanFromURLAsync } = await import('expo-camera');
    const found = await scanFromURLAsync(uri, ['qr']);
    for (const f of found) { const q = swissQrFrom(f.data); if (q) return q; }
    return null;
  } catch { return null; }
}
