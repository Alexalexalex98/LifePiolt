/** Frigo virtuale e lista della spesa (modulo PURO): scorte, scontrino, consumi, confronto con il piano. Le quantità dei pezzi sono stime (1 pezzo = una porzione tipica). */
import { FOOD, searchFoods, type Food } from './nutrition.ts';

export type Unit = 'g' | 'ml' | 'pz';
export type PantryItem = { id: string; name: string; foodId?: string; qty: number; unit: Unit; /** sotto questa quantità finisce nella lista della spesa */ min: number; addedAt: number };
export type ShopItem = { id: string; name: string; qty?: number; unit?: Unit; done: boolean; /** aggiunto da solo perché stava finendo */ auto?: boolean; foodId?: string };
export type Line = { name: string; qty: number; unit: Unit };

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const r1 = (n: number) => Math.round(n * 10) / 10;

/** L'alimento del database più simile al nome sullo scontrino (o nulla se non c'è un riscontro). */
export function matchFood(name: string): Food | undefined {
  const q = norm(name).replace(/\b(bio|conf|kg|gr?|ml|cl|lt?|pz|x\d+)\b/g, ' ').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 3) return undefined;
  return searchFoods(q, 1)[0];
}

/** Grammi (o ml) di una scorta; i pezzi valgono una porzione tipica dell'alimento. */
export const stockGrams = (it: Pick<PantryItem, 'qty' | 'unit' | 'foodId'>): number => (it.unit === 'pz' ? it.qty * (it.foodId ? FOOD(it.foodId)?.portion ?? 100 : 100) : it.qty);

export function defaultMin(qty: number, unit: Unit): number { return unit === 'pz' ? 1 : Math.max(20, Math.round(qty * 0.2)); }

/** Aggiunge una riga alle scorte: se c'è già lo stesso alimento (o lo stesso nome) somma la quantità. */
export function addStock(items: PantryItem[], line: Line, id: string, now: number): PantryItem[] {
  const food = matchFood(line.name);
  const key = norm(line.name);
  const i = items.findIndex((x) => x.unit === line.unit && ((food && x.foodId === food.id) || norm(x.name) === key));
  if (i >= 0) return items.map((x, k) => (k === i ? { ...x, qty: r1(x.qty + line.qty) } : x));
  return [{ id, name: line.name.trim().slice(0, 60), ...(food ? { foodId: food.id } : {}), qty: r1(line.qty), unit: line.unit, min: defaultMin(line.qty, line.unit), addedAt: now }, ...items];
}

/** Toglie dalle scorte ciò che si è mangiato (grammi di un alimento). Non va mai sotto zero. */
export function consume(items: PantryItem[], foodId: string, grams: number): PantryItem[] {
  let left = grams;
  const out = items.map((x) => {
    if (x.foodId !== foodId || left <= 0) return x;
    const have = stockGrams(x);
    const take = Math.min(have, left); left -= take;
    const qty = x.unit === 'pz' ? r1(x.qty - take / (FOOD(foodId)?.portion ?? 100)) : r1(x.qty - take);
    return { ...x, qty: Math.max(0, qty) };
  });
  return out;
}

export const lowStock = (items: PantryItem[]): PantryItem[] => items.filter((x) => x.qty <= x.min);

/** Ciò che sta finendo entra nella lista della spesa (una volta sola, senza doppioni). Ritorna la lista nuova e cosa è stato aggiunto. */
export function syncShopping(shop: ShopItem[], items: PantryItem[], newId: () => string): { shop: ShopItem[]; added: ShopItem[] } {
  const have = new Set(shop.filter((s) => !s.done).map((s) => norm(s.name)));
  const added: ShopItem[] = [];
  for (const it of lowStock(items)) {
    if (have.has(norm(it.name))) continue;
    const s: ShopItem = { id: newId(), name: it.name, unit: it.unit, qty: it.unit === 'pz' ? 6 : Math.max(it.min * 4, 250), done: false, auto: true, ...(it.foodId ? { foodId: it.foodId } : {}) };
    added.push(s); have.add(norm(it.name));
  }
  return { shop: [...added, ...shop], added };
}

/* ---------------------------------------------------------------- scontrino: righe dei prodotti */
export const RECEIPT_ITEMS_PROMPT = 'Questo è uno scontrino di un supermercato (Coop, Migros, Denner, Lidl, Aldi, Esselunga…). Trascrivi i prodotti alimentari e le bevande RIGA PER RIGA, copiando il nome ESATTAMENTE come è stampato (puoi solo sciogliere le abbreviazioni ovvie, es. "affett" → "affettato"). NON inventare, NON correggere a tuo gusto, NON indovinare: se una riga non si legge con sicurezza, saltala. Regole: 1) il campo "n" contiene SOLO il nome del prodotto: mai prezzi, mai numeri, mai pesi o volumi (quelli vanno in "q" e "u"), mai codici articolo. 2) I numeri a fine riga sono prezzi o codici: ignorali, non sono quantità. 3) "q" è la quantità comprata: "2 x" o "x2" = 2 pezzi; se la riga dice il peso o volume (500 g, 750g, 1 kg, 1 l, 300 ml) usa quello con "g" o "ml" (1 kg = 1000 g, 1 l = 1000 ml); altrimenti 1 con "pz". 4) Salta le righe che non sono prodotti da mangiare o bere: totale, subtotale, IVA/MwSt, resto, contanti/carta, sacchetti, depositi, sconti, buoni, Cumulus/Supercard/punti, data, ora, indirizzo, detersivi, igiene. 5) Una riga = una voce: se lo stesso prodotto compare due volte, scrivilo due volte. Rispondi SOLO con JSON compatto, niente altro testo: {"p":[{"n":"nome","q":numero,"u":"g"|"ml"|"pz"}]}.';
export const FRIDGE_PROMPT = 'Foto del contenuto di un frigo o di una dispensa. Elenca SOLO gli alimenti che vedi chiaramente. Rispondi SOLO con JSON compatto, niente altro testo: {"p":[{"n":"nome breve","q":numero stimato,"u":"g"|"ml"|"pz"}]}. Usa "pz" per ciò che si conta (uova, yogurt, mele) e una stima in g o ml per il resto. Non inventare ciò che non si vede.';

/** Ripulisce il nome letto da uno scontrino: pesi e volumi diventano quantita', via prezzi, codici e sigle dei supermercati. */
export function tidyReceiptLine(name: string, qty: number, unit: Unit): { name: string; qty: number; unit: Unit } {
  let n = name.replace(/\s+/g, ' ').trim(); let q = qty; let u = unit;
  const w = /(?:^|\s)(\d+(?:[.,]\d+)?)\s?(kg|g|gr|ml|cl|l|lt)\b/i.exec(n);
  if (w) {
    const v = Number(w[1]!.replace(',', '.')); const k = w[2]!.toLowerCase();
    const grams = k === 'kg' ? v * 1000 : k === 'g' || k === 'gr' ? v : 0; const mls = k === 'l' || k === 'lt' ? v * 1000 : k === 'cl' ? v * 10 : k === 'ml' ? v : 0;
    if (u === 'pz' && q === 1 && (grams || mls)) { q = grams || mls; u = grams ? 'g' : 'ml'; }
    n = n.replace(w[0], ' ');
  }
  n = n.replace(/^(kg|pz|x\d+|\d+\s?x)\s+/i, '').replace(/\b(prix garantie|free from|ips|m-budget|naturaplan|qualit[ay]|bio\s?:)\b\s*/gi, '').replace(/\s+\d+([.,]\d+)?\s*[a-z]?$/i, '').replace(/\s+/g, ' ').trim();
  return { name: n ? n[0]!.toUpperCase() + n.slice(1) : n, qty: q, unit: u };
}

export function parseReceiptItems(text: string): Line[] {
  const m = /\{[\s\S]*\}/.exec(text ?? ''); if (!m) return [];
  try {
    const o = JSON.parse(m[0]) as { prodotti?: unknown; items?: unknown };
    const list = (o.prodotti ?? o.items ?? (o as { p?: unknown }).p) as { nome?: unknown; name?: unknown; n?: unknown; quantita?: unknown; qty?: unknown; q?: unknown; unita?: unknown; unit?: unknown; u?: unknown }[] | undefined;
    if (!Array.isArray(list)) return [];
    return list.slice(0, 80).map((x) => {
      let name = String(x.nome ?? x.name ?? x.n ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const qty = Number(String(x.quantita ?? x.qty ?? x.q ?? 1).replace(',', '.'));
      const u = String(x.unita ?? x.unit ?? x.u ?? 'pz').toLowerCase();
      const unit: Unit = u === 'g' || u === 'kg' ? 'g' : u === 'ml' || u === 'l' || u === 'lt' ? 'ml' : 'pz';
      const mult = u === 'kg' || u === 'l' || u === 'lt' ? 1000 : 1;
      const t = tidyReceiptLine(name, Number.isFinite(qty) && qty > 0 ? Math.min(100000, qty * mult) : 1, unit);
      return t;
    }).filter((l) => l.name.length >= 3 && /[a-zà-ú]{3}/i.test(l.name));
  } catch { return []; }
}

/**
 * Dopo la lettura con i modelli aperti: conviene proporre di rifarla con Google Gemini? Solo se la lettura sembra debole
 * (pochi prodotti per un frigo, tante voci generiche o doppie). Se la lettura è buona non si propone niente.
 */
const GENERIC = /^(altro|altri|cibo|cibi|alimento|alimenti|prodotto|prodotti|vari|varie|roba|confezione|scatola|barattolo|bottiglia|contenitore|sacchetto)$/i;
export function googleMayBeBetter(what: 'receipt' | 'fridge', lines: Line[]): boolean {
  const names = lines.map((l) => l.name.trim().toLowerCase()).filter(Boolean);
  const minItems = what === 'fridge' ? 4 : 3;
  if (names.length < minItems) return true;
  const generic = names.filter((n) => GENERIC.test(n)).length;
  const dup = names.length - new Set(names).size;
  return generic / names.length >= 0.25 || dup / names.length >= 0.3;
}

/** Una lista scritta a mano («2 latte, 500 g pasta, uova») -> righe. */
export function parseTypedList(text: string): Line[] {
  return text.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = /^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml|pz)?\s+(.+)$/i.exec(p) ?? /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml|pz)?$/i.exec(p);
    if (!m) return { name: p, qty: 1, unit: 'pz' as Unit };
    const isFirst = /^\d/.test(p);
    const qty = Number((isFirst ? m[1] : m[2]).replace(',', '.')); const u = ((isFirst ? m[2] : m[3]) ?? '').toLowerCase(); const name = isFirst ? m[3] : m[1];
    const unit: Unit = u === 'kg' || u === 'g' || u === 'gr' ? 'g' : u === 'l' || u === 'lt' || u === 'ml' ? 'ml' : 'pz';
    return { name: name.trim(), qty: u === 'kg' || u === 'l' || u === 'lt' ? qty * 1000 : qty, unit };
  });
}

/* ---------------------------------------------------------------- piano contro mangiato */
export type Planned = { foodId: string; grams: number };
export type Eaten = { foodId?: string; grams: number; items?: { foodId: string; grams: number }[] };
export type Diff = { foodId: string; name: string; planned: number; eaten: number; diff: number };

/** Cosa era previsto e cosa è stato mangiato, alimento per alimento (i pasti senza alimenti riconosciuti non entrano nel confronto). */
export function compareDay(planned: Planned[], eaten: Eaten[]): { rows: Diff[]; unmatchedMeals: number } {
  const p = new Map<string, number>(), e = new Map<string, number>();
  for (const x of planned) p.set(x.foodId, (p.get(x.foodId) ?? 0) + x.grams);
  let unmatched = 0;
  for (const m of eaten) {
    const list = m.items?.length ? m.items : m.foodId ? [{ foodId: m.foodId, grams: m.grams }] : [];
    if (!list.length) unmatched++;
    for (const it of list) e.set(it.foodId, (e.get(it.foodId) ?? 0) + it.grams);
  }
  const ids = new Set([...p.keys(), ...e.keys()]);
  const rows = [...ids].map((id) => ({ foodId: id, name: FOOD(id)?.name ?? id, planned: Math.round(p.get(id) ?? 0), eaten: Math.round(e.get(id) ?? 0), diff: Math.round((e.get(id) ?? 0) - (p.get(id) ?? 0)) }))
    .filter((r) => Math.abs(r.diff) >= 10 || r.planned !== r.eaten).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { rows, unmatchedMeals: unmatched };
}
