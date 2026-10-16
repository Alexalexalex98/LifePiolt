/**
 * Menù delle attività (modulo PURO). Chi offre da mangiare o da bere carica il menù (foto, screenshot o PDF) e può
 * scrivere i singoli piatti con il prezzo. Un post, una foto o un video si possono legare a un piatto: così
 * si capisce cos'è e quanto costa, per tutti, senza sorprese.
 */
export const MENU_CATS = ['Antipasti', 'Primi', 'Secondi', 'Pizze', 'Dolci', 'Bevande', 'Altro'] as const;
export type MenuCat = (typeof MENU_CATS)[number];
export type MenuItem = { id: string; name: string; price: number; cat: MenuCat; desc?: string };
export type MenuFile = { id: string; name: string; uri: string; mime?: string; ts: number };
export type Menu = { files: MenuFile[]; items: MenuItem[]; updatedAt: number };
export const EMPTY_MENU: Menu = { files: [], items: [], updatedAt: 0 };

export const MAX_ITEMS = 200;
export const MAX_FILES = 12;
export const MAX_NAME = 70;
export const MAX_DESC = 160;

/** «12,50», «12.5» o «12» -> 12.5; non valido -> null. Da 0,10 a 9999. */
export function parsePrice(raw: string): number | null {
  const t = raw.trim().replace(/\s*(chf|fr\.?)$/i, '').replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(parseFloat(t) * 100) / 100;
  return n >= 0.1 && n <= 9999 ? n : null;
}
/** «12 CHF» o «12,50 CHF»: i prezzi di un locale sono quelli in cassa, non LifePoints. */
export function priceLabel(price: number): string {
  const s = Number.isInteger(price) ? String(price) : price.toFixed(2).replace('.', ',');
  return `${s} CHF`;
}

export function validateItem(name: string, priceText: string, desc = ''): { ok: true; name: string; price: number; desc?: string } | { ok: false; error: string } {
  const n = name.trim();
  if (!n) return { ok: false, error: 'Scrivi il nome del piatto' };
  if (n.length > MAX_NAME) return { ok: false, error: `Il nome è troppo lungo (massimo ${MAX_NAME} caratteri)` };
  const price = parsePrice(priceText);
  if (price == null) return { ok: false, error: 'Scrivi il prezzo, per esempio 12,50' };
  const d = desc.trim().slice(0, MAX_DESC);
  return { ok: true, name: n, price, ...(d ? { desc: d } : {}) };
}

/** Piatti raggruppati per categoria, nell'ordine del menù; dentro ogni gruppo come scritti. */
export function groupByCat(items: MenuItem[]): { cat: MenuCat; items: MenuItem[] }[] {
  return MENU_CATS.map((cat) => ({ cat, items: items.filter((x) => x.cat === cat) })).filter((g) => g.items.length > 0);
}
export const hasMenu = (m: Menu | undefined): boolean => !!m && (m.files.length > 0 || m.items.length > 0);
export const findItem = (m: Menu | undefined, id: string | undefined): MenuItem | undefined => (m && id ? m.items.find((x) => x.id === id) : undefined);
/** Riga breve per un post legato a un piatto: «Tagliolini al tartufo · 26 CHF». */
export const itemLine = (it: MenuItem): string => `${it.name} · ${priceLabel(it.price)}`;
