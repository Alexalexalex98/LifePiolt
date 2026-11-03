/** Esporta il diario dei pasti in CSV (si apre con Excel o Fogli Google). Modulo PURO. */
type MealLike = { ts: number; name: string; grams: number; macros: { kcal: number; p: number; c: number; f: number; fib?: number; sug?: number; sat?: number; salt?: number } };
const esc = (s: string) => (/[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const day = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hm = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function mealsToCsv(meals: MealLike[]): string {
  const head = ['Data', 'Ora', 'Pasto', 'Grammi', 'Calorie', 'Proteine g', 'Carboidrati g', 'Grassi g', 'Fibre g', 'Zuccheri g'];
  const rows = [...meals].sort((a, b) => a.ts - b.ts).map((m) => [day(m.ts), hm(m.ts), esc(m.name), String(Math.round(m.grams)), String(Math.round(m.macros.kcal)), String(m.macros.p), String(m.macros.c), String(m.macros.f), String(m.macros.fib ?? ''), String(m.macros.sug ?? '')].join(','));
  return [head.join(','), ...rows].join('\n');
}
