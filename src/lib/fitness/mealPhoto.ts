/** Foto del piatto (modulo PURO): prompt per la lettura esterna, lettura della risposta e abbinamento agli alimenti del database. */
import { searchFoods, type Food } from './nutrition.ts';

export const MEAL_PROMPT = 'Guarda la foto del piatto e riconosci ogni alimento visibile (anche condimenti, salse, pane, bevande). Conta con attenzione ogni singolo prodotto, anche se è dentro una scatola, aperto, parzialmente coperto o in secondo piano; se ci sono più pezzi uguali (per esempio due panini) scrivi una voce sola con i grammi totali e il numero nel nome, come «Big Mac x2». Stima i grammi di ciascuno nella porzione mostrata e i suoi valori nutrizionali per quella porzione (non per 100 g). Rispondi SOLO con un elenco JSON del tipo [{"nome":"Riso bianco cotto","grammi":150,"kcal":195,"proteine":4,"carboidrati":42,"grassi":0.5}], con nomi comuni in italiano e senza altro testo. Se è un prodotto di una catena, indica la sua porzione standard. Se non vedi cibo rispondi [].';

export type Est = { kcal: number; p: number; c: number; f: number };
export type Detected = { name: string; grams: number; est?: Est };
/** `source`: 'db' = valori del nostro database, 'ai' = stima dell'AI per quella porzione */
export type Resolved = Detected & { food: Food | null; source?: 'db' | 'ai' };

const num = (v: unknown): number | null => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
function readEst(x: Record<string, unknown>): Est | undefined {
  const kcal = num(x.kcal ?? x.calorie), p = num(x.proteine ?? x.protein ?? x.p), c = num(x.carboidrati ?? x.carbs ?? x.c), f = num(x.grassi ?? x.fat ?? x.f);
  if (kcal === null || kcal <= 0 || kcal > 4000) return undefined;
  return { kcal: Math.round(kcal), p: Math.round((p ?? 0) * 10) / 10, c: Math.round((c ?? 0) * 10) / 10, f: Math.round((f ?? 0) * 10) / 10 };
}

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
          if (name && Number.isFinite(g) && g > 0) { const est = readEst(x); out.push({ name, grams: Math.min(2000, Math.round(g)), ...(est ? { est } : {}) }); }
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

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
/** Il database vale solo se il nome coincide davvero (tutte le parole del nome rilevato sono nell'alimento): altrimenti meglio la stima dell'AI. */
const solidMatch = (name: string, f: Food) => { const w = words(name); const h = words(f.name + ' ' + (f.tags ?? '')); return w.length > 0 && w.every((x) => h.some((y) => y.startsWith(x) || x.startsWith(y))); };

/** Alimento ricavato dalla stima dell'AI (valori per 100 g, con id stabile per poterlo ritrovare in diario). */
export function foodFromEstimate(d: Detected): Food | null {
  if (!d.est || d.grams <= 0) return null;
  const k = 100 / d.grams, r1 = (n: number) => Math.round(n * 10) / 10;
  return { id: `ai-${slug(d.name)}-${Math.round(d.est.kcal * k)}`, name: d.name, kcal: Math.round(d.est.kcal * k), p: r1(d.est.p * k), c: r1(d.est.c * k), f: r1(d.est.f * k), portion: d.grams };
}

/** Abbina ogni nome all'alimento del database se coincide; altrimenti usa la stima dell'AI; senza niente `food` e' null e sceglie l'utente. */
export function resolveItems(list: Detected[]): Resolved[] {
  return list.map((d) => {
    const hit = searchFoods(d.name, 3).find((f) => solidMatch(d.name, f));
    if (hit) return { ...d, food: hit, source: 'db' as const };
    const ai = foodFromEstimate(d);
    if (ai) return { ...d, food: ai, source: 'ai' as const };
    const loose = searchFoods(d.name, 1)[0] ?? null;
    return { ...d, food: loose, ...(loose ? { source: 'db' as const } : {}) };
  });
}
