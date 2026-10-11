// fetch con retry/backoff, rispetto di Retry-After e distinzione errori fatali (chiave errata, credito esaurito).
export class ProviderError extends Error {
  constructor(msg, { fatal = false, status = 0 } = {}) { super(msg); this.fatal = fatal; this.status = status; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, init, { retries = 5, baseDelay = 1500, timeoutMs = 90000, label = 'API' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      lastErr = new ProviderError(`${label}: rete non raggiungibile (${e.message})`);
      if (attempt < retries) { await sleep(baseDelay * 2 ** attempt); continue; }
      throw lastErr;
    }
    if (res.ok) return res.json();
    const body = await res.text().catch(() => '');
    const msg = `${label}: HTTP ${res.status} ${body.slice(0, 300)}`;
    if (res.status === 401 || res.status === 403 || res.status === 402) throw new ProviderError(msg, { fatal: true, status: res.status });
    if (res.status === 400 && /credit|billing|quota/i.test(body)) throw new ProviderError(msg, { fatal: true, status: res.status });
    const retryable = res.status === 429 || res.status === 456 || res.status >= 500;
    if (!retryable) throw new ProviderError(msg, { status: res.status });
    lastErr = new ProviderError(msg, { status: res.status });
    const ra = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : baseDelay * 2 ** attempt;
    if (attempt < retries) await sleep(Math.min(wait, 60000));
  }
  throw lastErr;
}
