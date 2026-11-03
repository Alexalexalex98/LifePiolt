/** Codice a barre -> alimento (modulo PURO). I dati vengono da Open Food Facts: archivio libero e gratuito, senza chiavi. Valori per 100 g, come nel nostro database. */
export type OffFood = { id: string; name: string; kcal: number; p: number; c: number; f: number; fib?: number; sat?: number; sug?: number; salt?: number; portion: number; cat: string; /** A–E, se Open Food Facts lo conosce */ nutriscore?: string; /** 1–4: quanto è lavorato */ nova?: number };

export const isBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());
export const offUrl = (code: string) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code.trim())}.json?fields=product_name,brands,nutriments,serving_quantity,nutriscore_grade,nova_group`;

const n = (v: unknown): number | undefined => { const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN; return Number.isFinite(x) ? x : undefined; };
const r1 = (x: number) => Math.round(x * 10) / 10;

export function parseOff(code: string, json: unknown): OffFood | null {
  const j = json as { status?: number; product?: { nutriscore_grade?: string; nova_group?: unknown; product_name?: string; brands?: string; serving_quantity?: unknown; nutriments?: Record<string, unknown> } } | null;
  const p = j?.product;
  if (!p || j?.status === 0) return null;
  const m = p.nutriments ?? {};
  let kcal = n(m['energy-kcal_100g']);
  if (kcal == null) { const kj = n(m['energy_100g']); if (kj != null) kcal = kj / 4.184; }
  const pr = n(m['proteins_100g']), c = n(m['carbohydrates_100g']), f = n(m['fat_100g']);
  if (kcal == null || (pr == null && c == null && f == null)) return null;
  const name = [p.product_name?.trim(), p.brands?.split(',')[0]?.trim()].filter(Boolean).join(' · ') || `Prodotto ${code}`;
  const fib = n(m['fiber_100g']), sat = n(m['saturated-fat_100g']), sug = n(m['sugars_100g']), salt = n(m['salt_100g']);
  const serving = n(p.serving_quantity);
  return {
    id: `off-${code.trim()}`, name, kcal: Math.round(kcal), p: r1(pr ?? 0), c: r1(c ?? 0), f: r1(f ?? 0),
    ...(fib != null ? { fib: r1(fib) } : {}), ...(sat != null ? { sat: r1(sat) } : {}), ...(sug != null ? { sug: r1(sug) } : {}), ...(salt != null ? { salt: r1(salt) } : {}),
    portion: serving && serving > 0 ? Math.round(serving) : 100, cat: 'Prodotti confezionati',
    ...(/^[a-e]$/i.test(p.nutriscore_grade ?? '') ? { nutriscore: p.nutriscore_grade!.toUpperCase() } : {}), ...(n(p.nova_group) && n(p.nova_group)! >= 1 && n(p.nova_group)! <= 4 ? { nova: n(p.nova_group)! } : {}),
  };
}
