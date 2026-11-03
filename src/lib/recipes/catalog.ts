/** Il catalogo: ricette scritte a mano (data/*) + le ricette storiche con i passaggi ricavati dal metodo. Le scritte a mano sostituiscono quelle storiche con lo stesso nome. */
import { RECIPES } from '../fitness/foodDb.ts';
import { FOOD } from '../fitness/nutrition.ts';
import { itemName, parseBook, slug, stepsFromMethod, type FullRecipe, type RCat } from './book.ts';
import { C1 } from './data/c1.ts';
import { C2 } from './data/c2.ts';
import { C3 } from './data/c3.ts';

const SOURCES: string[] = [C1, C2, C3];

const catOf = (name: string, items: string): RCat => {
  const x = (name + ' ' + items).toLowerCase();
  if (/\b(torta|crostata|tiramis|budino|biscott|panna cotta|gelato|dolce|crema pasticcera|cheesecake|muffin|plumcake|ciambella|brownie|cannol|zabaione|semifreddo|strudel|frittelle|crêpe|crepes|pancake|waffle|granita)\b/.test(x)) return 'Dolci';
  if (/\b(pizza|focaccia|pane|piadina|grissini|calzone|panino)\b/.test(name.toLowerCase())) return 'Pane e pizza';
  if (/\b(zuppa|minestra|minestrone|vellutata|crema di|passato|ribollita|brodo|stracciatella)\b/.test(name.toLowerCase())) return 'Zuppe';
  if (/\b(risotto|pasta|spaghetti|penne|lasagn|gnocchi|ravioli|tortell|cannelloni|tagliatelle|rigatoni|fusilli|orecchiette|bucatini|carbonara|amatriciana|gricia|trofie|polenta|riso|paccheri|linguine|maccheroni|strozzapreti|crespelle|pizzoccheri|farro|orzotto|cous|bulgur|quinoa)\b/.test(name.toLowerCase())) return 'Primi';
  if (/\b(insalata|contorno|patate|verdure|melanzane|zucchine|peperon|spinaci|carciofi|finocchi|funghi|asparagi|fagiolini|broccoli|cavol|carote|zucca|bietol|cicoria|friarielli|pomodori|caponata|giardiniera)\b/.test(name.toLowerCase()) && !/\b(pollo|carne|tonno|manzo|maiale|salmone)\b/.test(x)) return 'Contorni';
  if (/\b(frullato|smoothie|colazione|porridge|overnight|granola|toast|yogurt|uova strapazzate)\b/.test(name.toLowerCase())) return 'Colazione';
  if (/\b(salsa|sugo|pesto|ragù|ragu|besciamella|maionese|vinaigrette)\b/.test(name.toLowerCase())) return 'Salse';
  if (/\b(bruschetta|crostini|tartine|antipasto|caprese|carpaccio|tagliere|olive|supplì|arancini|frittata|involtini)\b/.test(name.toLowerCase())) return 'Antipasti';
  if (/\b(bowl|poke|wrap|burger|hamburger|piatto unico|tacos|burrito|sandwich)\b/.test(name.toLowerCase())) return 'Piatti unici';
  return 'Secondi';
};

function legacy(): FullRecipe[] {
  return RECIPES.map((r) => {
    const names = r.items.map((i) => FOOD(i.foodId)?.name ?? '').filter(Boolean);
    const { steps, prep, cook } = stepsFromMethod(r.method, names, 1);
    return { id: r.id, name: r.name, cat: catOf(r.name, names.join(' ')), diff: (r.method.length > 110 || r.items.length > 8 ? 2 : 1) as 1 | 2, prep, cook, servings: 1, tags: [], items: r.items.map((i) => ({ foodId: i.foodId, grams: i.grams })), steps, tools: [], basic: true };
  });
}

const parsed = SOURCES.map((s, i) => parseBook(s, 'rc-'));
export const BOOK_MISSING: string[] = parsed.flatMap((p) => p.missing);
export const BOOK_ERRORS: string[] = parsed.flatMap((p) => p.errors);
const written = parsed.flatMap((p) => p.recipes);
const writtenNames = new Set(written.map((r) => slug(r.name)));
export const CATALOG: FullRecipe[] = [...written, ...legacy().filter((r) => !writtenNames.has(slug(r.name)))];
export const CATALOG_BY_ID = new Map(CATALOG.map((r) => [r.id, r]));
export const WRITTEN_COUNT = written.length;
void itemName;
