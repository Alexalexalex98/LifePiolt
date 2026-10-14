/** Foto del piatto (modulo PURO): prompt per la lettura esterna, lettura della risposta e abbinamento agli alimenti del database. */
import { searchFoods, type Food } from './nutrition.ts';

export const MEAL_PROMPT = 'Guarda la foto del piatto e riconosci ogni alimento visibile (anche condimenti, pane, bevande). Stima i grammi di ciascuno nella porzione mostrata. Rispondi SOLO con un elenco JSON del tipo [{"nome":"Riso bianco cotto","grammi":150}], con nomi comuni in italiano e senza altro testo. Se non vedi cibo rispondi [].';

export type Detected = { name: string; grams: number };
export type Resolved = Detected & { food: Food | null };

/** Legge la risposta: JSON (anche dentro un blocco di codice) oppure righe «Nome: 120 g». */
export function parseMealReply(text: string): Detected[] {
  const t = (text ?? '').trim();
  if (!t) return [];
  const json = t.match(/\[[\s\S]*\]/);
  if (json) {
    try {
      const arr = JSON.parse(json[0]) as unknown;
      if (Array.isArray(arr)) {
        const out: Detected[] = [];
        for (const x of arr as Record<string, unknown>[]) {
          const name = String(x?.nome ?? x?.name ?? x?.alimento ?? '').trim();
          const g = Number(String(x?.grammi ?? x?.grams ?? x?.g ?? '').replace(',', '.'));
          if (name && Number.isFinite(g) && g > 0) out.push({ name, grams: Math.min(2000, Math.round(g)) });
        }
        return out;
      }
    } catch { /* si prova con le righe */ }
  }
  const out: Detected[] = [];
  for (const line of t.split('\n')) {
    const m = line.replace(/^[\s\-*•\d.)]+/, '').match(/^(.{2,60}?)\s*[:\-–(]\s*(?:circa|ca\.?|~)?\s*(\d{1,4}(?:[.,]\d+)?)\s*(?:g|gr|grammi)\b/i);
    if (m) out.push({ name: m[1].trim(), grams: Math.min(2000, Math.round(Number(m[2].replace(',', '.')))) });
  }
  return out;
}

/** Abbina ogni nome all'alimento più vicino; senza corrispondenza `food` è null e lo sceglie l'utente. */
export function resolveItems(list: Detected[]): Resolved[] {
  return list.map((d) => ({ ...d, food: searchFoods(d.name, 1)[0] ?? null }));
}
