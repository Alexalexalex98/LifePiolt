/**
 * Piano alimentare scritto da Theia (modulo PURO e testabile). L'AI intervista l'utente, poi scrive il piano in un blocco
 * [[PIANO {...}]] a fine risposta; qui lo si legge, lo si controlla (porzioni e valori assurdi si scartano) e lo si trasforma
 * in giorni di pasti con alimenti del database (o alimenti nuovi con i valori stimati dall'AI). Non e' un piano dietetico.
 */
import { FOODS, FOOD, searchFoods, type Food } from './nutrition.ts';
import type { PlanDay, PlanItem, PlanMeal, Slot } from './mealPlan.ts';
import { kcalOf } from './mealPlan.ts';

export type AiPlanMeta = { title: string; kcal?: number; notes?: string; createdAt: number };
export type AiPlanResult = { days: Map<number, PlanDay>; meta: Partial<AiPlanMeta>; custom: Food[]; warnings: string[] };

const RE = /\[\[\s*PIANO\s*:?\s*(\{[\s\S]*?\})\s*\]\]/i;
/** Separa il testo da dire all'utente dal blocco del piano (se c'e'). */
export function extractMealPlan(reply: string): { text: string; json: unknown | null; broken: boolean } {
  const m = RE.exec(reply);
  if (!m) return { text: reply, json: null, broken: /\[\[\s*PIANO/i.test(reply) };
  const text = reply.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
  try { return { text, json: JSON.parse(m[1]), broken: false }; } catch { return { text, json: null, broken: true }; }
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s: string) => norm(s).replace(/ /g, '-').slice(0, 40);
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const SLOTS: [RegExp, Slot][] = [[/coll?azione|breakfast|mattina presto/, 'colazione'], [/spunt|snack|metà mattina|meta mattina/, 'spuntino'], [/pranzo|lunch/, 'pranzo'], [/merenda|pomeriggio/, 'merenda'], [/cena|dinner|sera/, 'cena']];
export function slotOf(s: unknown): Slot | null { const n = norm(String(s ?? '')); for (const [re, slot] of SLOTS) if (re.test(n)) return slot; return null; }

/** Collega un ingrediente scritto dall'AI a un alimento del database (se i valori sono compatibili) o ne crea uno nuovo. */
function resolveFood(name: string, k: number | null, p: number | null, c: number | null, f: number | null, grams: number, custom: Map<string, Food>): string | null {
  const words = norm(name).split(' ').filter((w) => w.length >= 4);
  const covers = (f: Food) => { const hay = norm(`${f.name} ${f.tags ?? ''}`).split(/[\s-]+/); return words.every((w) => hay.some((h) => h === w || h.startsWith(w) || w.startsWith(h) && h.length >= 4)); };
  const hit = searchFoods(name, 6).find(covers);
  const aiOk = k != null && k >= 0 && k <= 900 && (p ?? 0) >= 0 && (c ?? 0) >= 0 && (f ?? 0) >= 0 && (p ?? 0) + (c ?? 0) + (f ?? 0) <= 105;
  if (hit && (!aiOk ? norm(hit.name).startsWith(norm(name).split(' ')[0] ?? '') : true) && (!aiOk || (hit.kcal > 0 ? Math.abs(hit.kcal - (k as number)) / Math.max(hit.kcal, 1) <= 0.35 : (k as number) <= 20))) return hit.id;
  if (!aiOk) return null;
  const id = `ai-${slug(name)}`;
  const known = FOOD(id) ?? custom.get(id);
  if (known) return id;
  custom.set(id, { id, name: name.replace(/^./, (x) => x.toUpperCase()), kcal: Math.round(k as number), p: Math.round((p ?? 0) * 10) / 10, c: Math.round((c ?? 0) * 10) / 10, f: Math.round((f ?? 0) * 10) / 10, portion: Math.max(10, Math.round(grams / 5) * 5) });
  return id;
}

/** Legge il piano: giorni 0-6 (lunedi' = 0). Ritorna solo i giorni presenti: chi chiama decide come unirli al piano esistente. */
export function parseAiPlan(json: unknown): AiPlanResult {
  const warnings: string[] = []; const custom = new Map<string, Food>(); const days = new Map<number, PlanDay>();
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const list = Array.isArray(o.giorni) ? o.giorni : Array.isArray(o.days) ? o.days : [];
  const kcal = num(o.kcal);
  const meta: Partial<AiPlanMeta> = { title: str(o.titolo ?? o.title, 80) || undefined, kcal: kcal && kcal >= 800 && kcal <= 6000 ? Math.round(kcal) : undefined, notes: str(o.note ?? o.notes, 600) || undefined };
  list.slice(0, 7).forEach((d, idx) => {
    const dd = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    const g = num(dd.g ?? dd.giorno ?? dd.day); const wd = g != null && g >= 0 && g <= 6 ? Math.round(g) : idx;
    const meals = Array.isArray(dd.pasti) ? dd.pasti : Array.isArray(dd.meals) ? dd.meals : [];
    const day: PlanDay = []; const used = new Map<Slot, number>();
    for (const m of meals.slice(0, 8)) {
      const mm = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      const slot = slotOf(mm.s ?? mm.slot ?? mm.pasto);
      const rows = Array.isArray(mm.i) ? mm.i : Array.isArray(mm.items) ? mm.items : Array.isArray(mm.ingredienti) ? mm.ingredienti : [];
      if (!slot) { warnings.push('pasto senza tipo'); continue; }
      const items: PlanItem[] = [];
      for (const r of rows.slice(0, 14)) {
        const rr = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
        const name = str(rr.n ?? rr.nome ?? rr.name, 60); const grams = num(rr.g ?? rr.grammi ?? rr.grams);
        if (!name || grams == null || grams < 5 || grams > 1500) { if (name) warnings.push(`quantità non valida per ${name}`); continue; }
        const id = resolveFood(name, num(rr.k ?? rr.kcal), num(rr.p), num(rr.c), num(rr.f), grams, custom);
        if (!id) { warnings.push(`non conosco i valori di ${name}`); continue; }
        items.push({ foodId: id, grams: Math.round(grams / 5) * 5 });
      }
      if (!items.length) continue;
      const n = (used.get(slot) ?? 0) + 1; used.set(slot, n);
      const note = str(mm.ric ?? mm.nota ?? mm.note ?? mm.recipe, 400);
      const meal: PlanMeal & { note?: string } = { id: `${wd}-${slot}${n > 1 ? `-${n}` : ''}`, slot, name: str(mm.n ?? mm.nome ?? mm.name, 80) || slot, items };
      if (note) meal.note = note;
      day.push(meal);
    }
    if (day.length) days.set(wd, day);
  });
  return { days, meta, custom: [...custom.values()], warnings };
}

/** Unisce i giorni letti al piano esistente: un piano di 7 giorni lo sostituisce, qualche giorno solo cambia quei giorni. Senza piano, i giorni mancanti ripetono quelli dati. */
export function mergePlan(existing: PlanDay[] | null, parsed: Map<number, PlanDay>): PlanDay[] {
  const have = [...parsed.keys()].sort((a, b) => a - b);
  if (!have.length) return existing ?? [];
  const base: PlanDay[] = existing && existing.length === 7 ? existing.slice() : Array.from({ length: 7 }, (_, i) => (parsed.has(i) ? parsed.get(i)! : parsed.get(have[i % have.length])!.map((m) => ({ ...m, id: `${i}-${m.id.split('-').slice(1).join('-')}` }))));
  parsed.forEach((day, wd) => { base[wd] = day; });
  return base;
}

/** Il piano in poche righe, da mostrare all'AI quando l'utente vuole cambiarlo. */
export function planSummary(plan: PlanDay[] | null, max = 4000): string {
  if (!plan?.length) return '';
  const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const out = plan.map((day, i) => `${WD[i]}: ${day.map((m) => `${m.slot} «${m.name}» (${m.items.map((it) => `${FOOD(it.foodId)?.name ?? it.foodId} ${it.grams} g`).join(', ')}; ${kcalOf(m.items)} kcal)`).join(' | ')}`).join('\n');
  return out.length > max ? out.slice(0, max) + '…' : out;
}

/** Spesa del piano: grammi per alimento per `days` giorni dal giorno `from`, meno cio' che c'e' gia' nel frigo (grammi per alimento). */
export function shoppingList(plan: PlanDay[], from: number, days: number, people: number, have: Map<string, number>): { foodId: string; name: string; grams: number }[] {
  const need = new Map<string, number>();
  for (let k = 0; k < days; k++) for (const m of plan[(from + k) % 7] ?? []) for (const it of m.items) need.set(it.foodId, (need.get(it.foodId) ?? 0) + it.grams * people);
  const out: { foodId: string; name: string; grams: number }[] = [];
  need.forEach((g, id) => { const miss = g - (have.get(id) ?? 0); if (miss >= 20) out.push({ foodId: id, name: FOOD(id)?.name ?? id, grams: Math.round(miss / 10) * 10 }); });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const TALK = /\b(piano alimentare|piano dei pasti|piano dieta|dieta|menu settimanale|menu della settimana|piano nutrizionale|programma alimentare|cosa (?:devo )?mangiare|pasti della settimana|alimentazione)\b/i;
const EDIT = /\b(cambia|cambiami|sostituisci|togli|metti|aggiungi|sistema|modifica|non mi piace|non voglio|niente|rifai|meno|più|piu)\b/i;
/** La conversazione e' sul piano alimentare? (adesso, o nei messaggi dell'utente appena prima, o c'e' gia' un piano e chiede un cambio) */
const OTHER = /\b(turni|turno|bolletta|bollette|fattura|fatture|estratto|agenda|calendario|task|impegn\w*|riunione|appuntamento|viaggio|vacanz\w*|pdf|file|allegat\w*)\b/i;
export function mealPlanTalk(question: string, recentUser: string[], hasPlan: boolean): boolean {
  if (TALK.test(question)) return true;
  if (OTHER.test(question)) return false; /* si parla d'altro (turni, bollette…): non e' il discorso sul piano */
  if (recentUser.slice(-2).some((x) => TALK.test(x))) return true;
  return hasPlan && EDIT.test(question) && /\b(pasto|colazione|pranzo|cena|spuntino|merenda|lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|piano)\b/i.test(question);
}

export type MealPlanContext = { body?: string; target?: number; avoid?: string[]; diet?: string; people?: number; fridge?: string[]; plan?: string };
/** Istruzioni da aggiungere al prompt di Theia quando si parla di piano alimentare. */
export function mealPlanPrompt(c: MealPlanContext): string {
  const known = [c.body ? `dati dell'utente: ${c.body}` : '', c.target ? `fabbisogno indicativo calcolato: ${c.target} kcal` : '', c.diet && c.diet !== 'onnivoro' ? `dieta: ${c.diet}` : '', c.avoid?.length ? `evita: ${c.avoid.join(', ')}` : '', c.people && c.people > 1 ? `spesa per ${c.people} persone` : '', c.fridge?.length ? `nel frigo ha: ${c.fridge.slice(0, 40).join(', ')}` : ''].filter(Boolean).join('; ');
  return `PIANO ALIMENTARE (la conversazione e' su questo): parla con l'utente come un nutrizionista attento ma senza prescrivere terapie. Prima capisci bene la situazione con domande, poi scrivi il piano.
Fase 1 - domande (MASSIMO 4 per messaggio, le piu' importanti, numerate, MAI tutte insieme (le altre le chiedi dopo la risposta), salta quelle di cui hai gia' la risposta): obiettivo (dimagrire, mantenere, mettere massa, stare meglio) e quanto, problemi o condizioni di salute (colesterolo, glicemia, pressione, gastrite, reflusso, intolleranze, gravidanza, farmaci), allergie e intolleranze, cibi che non mangia o non gli piacciono, cibi che ama, dieta (vegetariana, vegana, halal...), quanti pasti al giorno e a che ora, dove mangia (casa, ufficio, mensa), quanto tempo ha per cucinare, budget, per quante persone, attivita' fisica, e se mancano peso, altezza ed eta'.
Fase 2 - quando hai le risposte essenziali (obiettivo, problemi, cosa non mangia, pasti al giorno) NON chiedere altro: scrivi in 1-2 frasi cosa hai capito e poi, a fine risposta, il piano in UN solo blocco su una riga: [[PIANO {"titolo":"...","kcal":numero,"note":"consigli generali brevi","giorni":[{"g":0,"pasti":[{"s":"colazione|spuntino|pranzo|merenda|cena","n":"nome del piatto","ric":"preparazione in una frase","i":[{"n":"ingrediente","g":grammi,"k":kcal per 100 g,"p":proteine per 100 g,"c":carboidrati per 100 g,"f":grassi per 100 g}]}]}]}]]. Giorni 0=lunedi' ... 6=domenica: scrivi tutti e 7 i giorni, varia i piatti, ingredienti comuni e semplici, grammi realistici (cotto o crudo come lo pesa), valori per 100 g veri, mai piu' di 6 ingredienti per pasto. Il JSON valido, senza commenti, senza a-capo dentro i testi. Mai scrivere il piano a parole nel messaggio: il blocco lo imposta l'app direttamente nella sezione Piano alimentare, dove l'utente lo vede.
Fase 3 - se l'utente vuole cambiare qualcosa (un pasto, un giorno, un ingrediente, le calorie, "non mi piace il pesce"): rispondi in breve e scrivi il blocco [[PIANO {...}]] con SOLO i giorni modificati (con il loro "g"); se il cambio riguarda tutta la settimana, scrivi tutti e 7 i giorni.
Non chiedere se e' gia' tutto chiaro; non rifare domande gia' fatte; se dice di avere una patologia seria, di essere minorenne o in gravidanza, resta prudente e consiglia in una frase di sentire anche il medico o un dietista.${known ? `\nCosa gia' si sa: ${known}.` : ''}${c.plan ? `\nPiano attuale dell'utente (per i cambi):\n${c.plan}` : '\nL\'utente non ha ancora un piano.'}`;
}
/** Una riga con i dati del corpo, per il prompt di Theia. */
export function describeBody(b: { sex: string; age: number; weightKg: number; heightCm: number; activity: string; goal: string }): string {
  return [b.sex === 'f' ? 'donna' : 'uomo', b.age + ' anni', b.weightKg + ' kg', b.heightCm + ' cm', 'attività ' + b.activity, 'obiettivo ' + b.goal].join(', ');
}
export { FOODS };
