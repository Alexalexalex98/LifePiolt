/** Scontrino fotografato: risposta dell'AI -> movimento. Modulo PURO e testabile. */
export const RECEIPT_PROMPT = 'Questa è la foto di uno scontrino o di una ricevuta di pagamento. Leggi il nome del negozio, la data e il TOTALE pagato (non i singoli articoli, non il resto). Rispondi SOLO con un JSON del tipo {"negozio":"Coop Lugano","data":"2026-10-19","totale":32.30,"valuta":"CHF"}. La data è AAAA-MM-GG; il totale è un numero con il punto decimale e senza apostrofi. Se non è uno scontrino rispondi {}.';

export type Receipt = { shop: string; date: string | null; total: number; currency: string };

export function parseReceipt(text: string): Receipt | null {
  const m = /\{[\s\S]*\}/.exec(text ?? '');
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const total = Number(String(o.totale ?? o.total ?? '').replace(/['’\s]/g, '').replace(',', '.'));
    const shop = String(o.negozio ?? o.shop ?? o.merchant ?? '').replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(total) || total <= 0 || total > 1e6 || !shop) return null;
    const d = String(o.data ?? o.date ?? '').trim();
    return { shop: shop.slice(0, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null, total: Math.round(total * 100) / 100, currency: String(o.valuta ?? o.currency ?? 'CHF').toUpperCase().slice(0, 3) || 'CHF' };
  } catch { return null; }
}

/** «19.10.2026», «19/10/26» o «2026-10-19» -> AAAA-MM-GG, oppure null. */
export function isoFromInput(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(t);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = Number(m[2]), d = Number(m[1]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}
