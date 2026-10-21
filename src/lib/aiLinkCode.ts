/** Codice di collegamento al server AI (modulo PURO): si copia da un dispositivo e si incolla sull'altro, così indirizzo e token si inseriscono una volta sola. */
const PREFIX = 'LPAI1.';

export function encodeLinkCode(url: string, token: string): string {
  return PREFIX + btoa(JSON.stringify({ u: url.trim(), t: token.trim() }));
}

/** Legge un codice: torna indirizzo e token, oppure null se non è un codice valido. */
export function decodeLinkCode(code: string): { url: string; token: string } | null {
  const c = code.trim();
  if (!c.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(atob(c.slice(PREFIX.length).replace(/\s+/g, ''))) as { u?: unknown; t?: unknown };
    if (typeof o.u !== 'string' || typeof o.t !== 'string') return null;
    if (!/^https:\/\/\S+$/.test(o.u) || !o.t) return null;
    return { url: o.u, token: o.t };
  } catch { return null; }
}
