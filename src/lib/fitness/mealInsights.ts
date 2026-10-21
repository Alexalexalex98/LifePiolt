/**
 * Storico dei pasti e giudizio su come si mangia (modulo PURO): raggruppa i pasti per giorno, calcola le medie
 * e le confronta con valori di riferimento generali. Vede solo calorie, macronutrienti, zuccheri, grassi saturi,
 * fibre, sale e acqua: vitamine e minerali non vengono registrati, quindi non vengono giudicati.
 * Non è un consiglio medico o nutrizionale.
 */
import { MICRO_INFO, NUTRITION_LEGAL, microRows, scaleMicro, sumMicro, type Micro } from './micro.ts';
import type { Macros } from './nutrition.ts';

export type DayMeal = { id: string; ts: number; name: string; grams: number; macros: Macros; photo?: string; /** vitamine e minerali stimati */ micro?: Micro; /** calorie che vengono da cibo spazzatura (fritti, dolci, bibite, fast food) */ junkKcal?: number };
export type DayGroup = { key: string; ts: number; meals: DayMeal[]; total: Macros; micro: Micro; junkKcal: number };

const r1 = (n: number) => Math.round(n * 10) / 10;
const pad = (n: number) => String(n).padStart(2, '0');
/** Chiave del giorno in ora locale (AAAA-MM-GG). */
export const dayOf = (ts: number): string => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const KEYS = ['kcal', 'p', 'c', 'f', 'sat', 'sug', 'fib', 'salt'] as const;
export const sumTotals = (list: Macros[]): Macros => {
  const o: Macros = { kcal: 0, p: 0, c: 0, f: 0, sat: 0, sug: 0, fib: 0, salt: 0 };
  for (const m of list) for (const k of KEYS) o[k] = (o[k] ?? 0) + (m[k] ?? 0);
  for (const k of KEYS) o[k] = k === 'kcal' ? Math.round(o[k] ?? 0) : r1(o[k] ?? 0);
  return o;
};

/** Pasti raggruppati per giorno, dal più recente; dentro ogni giorno dal mattino alla sera. */
export function groupByDay(meals: DayMeal[]): DayGroup[] {
  const by = new Map<string, DayMeal[]>();
  for (const m of meals) { const k = dayOf(m.ts); by.set(k, [...(by.get(k) ?? []), m]); }
  return [...by.entries()]
    .map(([key, list]) => { const sorted = [...list].sort((a, b) => a.ts - b.ts); return { key, ts: sorted[0].ts, meals: sorted, total: sumTotals(sorted.map((m) => m.macros)), micro: sumMicro(sorted.map((m) => m.micro)), junkKcal: sorted.reduce((x, m) => x + (m.junkKcal ?? 0), 0) }; })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Momento della giornata di un pasto, dall'ora. */
export function slotOf(ts: number): 'colazione' | 'pranzo' | 'merenda' | 'cena' | 'notte' {
  const h = new Date(ts).getHours();
  return h < 10 ? 'colazione' : h < 15 ? 'pranzo' : h < 18 ? 'merenda' : h < 23 ? 'cena' : 'notte';
}

export type Level = 'ok' | 'attenzione' | 'carenza';
export type Finding = { id: string; level: Level; title: string; detail: string; tip: string };
export type Stats = { days: number; asked: number; avg: Macros; mealsPerDay: number; waterMl: number | null; waterDays: number; /** media al giorno di vitamine e minerali (stima) */ micro?: Micro; /** quota media di calorie da cibo spazzatura (0-1) */ junkShare?: number };
export type Ctx = { targetKcal?: number; weightKg?: number; goal?: 'dimagrire' | 'mantenere' | 'massa' };

/**
 * Medie al giorno sugli ultimi `period` giorni. Si contano solo i giorni con almeno un pasto; il giorno corrente
 * si conta solo dopo le 20 (prima è incompleto e abbasserebbe le medie).
 */
export function periodStats(meals: DayMeal[], water: Record<string, number>, now: number, period = 7): Stats {
  const groups = groupByDay(meals);
  const since = now - period * 86400000;
  const today = dayOf(now);
  const late = new Date(now).getHours() >= 20;
  const used = groups.filter((g) => g.ts >= since - 86400000 && g.ts <= now && (g.key !== today || late) && g.key >= dayOf(since));
  const n = used.length;
  const avg = n ? { kcal: 0, p: 0, c: 0, f: 0, sat: 0, sug: 0, fib: 0, salt: 0 } : sumTotals([]);
  if (n) {
    const t = sumTotals(used.map((g) => g.total));
    for (const k of KEYS) avg[k] = k === 'kcal' ? Math.round((t[k] ?? 0) / n) : r1((t[k] ?? 0) / n);
  }
  const wDays = Object.entries(water).filter(([k, v]) => k >= dayOf(since) && v > 0 && (k !== today || late));
  return {
    days: n, asked: period, avg,
    mealsPerDay: n ? r1(used.reduce((s, g) => s + g.meals.length, 0) / n) : 0,
    waterMl: wDays.length ? Math.round(wDays.reduce((s, [, v]) => s + v, 0) / wDays.length) : null,
    waterDays: wDays.length,
    micro: n ? scaleMicro(sumMicro(used.map((g) => g.micro)), 1 / n) : undefined,
    junkShare: n ? Math.min(1, used.reduce((x, g) => x + g.junkKcal, 0) / Math.max(1, used.reduce((x, g) => x + g.total.kcal, 0))) : undefined,
  };
}

/** Acqua di riferimento al giorno (ml): circa 30 ml per kg, tra 1,5 e 2,5 litri; senza il peso 2 litri. */
export const waterGoal = (weightKg?: number): number => (weightKg && weightKg > 30 ? Math.round(Math.min(2500, Math.max(1500, weightKg * 30)) / 50) * 50 : 2000);

/** I punti su cui lavorare (e quelli già in ordine), dal più importante. Valori di riferimento generali per un adulto. */
export function findings(s: Stats, ctx: Ctx = {}): Finding[] {
  const out: Finding[] = [];
  if (!s.days) return out;
  const a = s.avg;
  const kcal = a.kcal || 1;
  const T = ctx.targetKcal;
  if (T) {
    if (a.kcal < T * 0.8) out.push({ id: 'kcal-sotto', level: 'attenzione', title: 'Mangi meno del tuo fabbisogno', detail: `In media ${a.kcal} kcal al giorno contro circa ${T} stimate per te.`, tip: 'Se non è voluto, aggiungi uno spuntino con proteine e carboidrati complessi (yogurt e frutta, pane integrale e legumi). Se stai registrando solo alcuni pasti, completa il diario.' });
    else if (a.kcal > T * 1.15) out.push({ id: 'kcal-sopra', level: 'attenzione', title: 'Mangi più del tuo fabbisogno', detail: `In media ${a.kcal} kcal al giorno contro circa ${T} stimate per te.`, tip: 'Riduci le porzioni dei pasti più ricchi o i fuori pasto, senza saltare i pasti principali.' });
    else out.push({ id: 'kcal-ok', level: 'ok', title: 'Calorie in linea', detail: `In media ${a.kcal} kcal al giorno, vicino alle ${T} stimate per te.`, tip: '' });
  }
  const protGoal = ctx.weightKg ? Math.round(ctx.weightKg * (ctx.goal === 'massa' ? 1.6 : 0.9)) : 55;
  if (a.p < protGoal * 0.8) out.push({ id: 'proteine', level: 'carenza', title: 'Proteine basse', detail: `Circa ${a.p} g al giorno, ne servirebbero intorno a ${protGoal} g.`, tip: 'Metti una fonte di proteine a ogni pasto: uova, legumi, pesce, pollo, yogurt greco, formaggi magri o tofu.' });
  else out.push({ id: 'proteine-ok', level: 'ok', title: 'Proteine sufficienti', detail: `Circa ${a.p} g al giorno.`, tip: '' });
  const fib = a.fib ?? 0;
  if (fib < 18) out.push({ id: 'fibre', level: 'carenza', title: 'Poche fibre', detail: `Circa ${fib} g al giorno, l'obiettivo generale è 25-30 g.`, tip: 'Più verdure e frutta intera, legumi, cereali integrali e frutta secca: le fibre aiutano sazietà, intestino e glicemia.' });
  else out.push({ id: 'fibre-ok', level: 'ok', title: 'Fibre buone', detail: `Circa ${fib} g al giorno.`, tip: '' });
  const sugPct = ((a.sug ?? 0) * 4 * 100) / kcal;
  if (sugPct > 15) out.push({ id: 'zuccheri', level: 'attenzione', title: 'Zuccheri alti', detail: `Circa ${a.sug} g al giorno (${Math.round(sugPct)}% delle calorie). Qui contano anche quelli di frutta e latte.`, tip: 'Riduci bibite, dolci e colazioni zuccherate; scegli frutta intera al posto dei succhi.' });
  const satPct = ((a.sat ?? 0) * 9 * 100) / kcal;
  if (satPct > 10) out.push({ id: 'saturi', level: 'attenzione', title: 'Grassi saturi alti', detail: `Circa ${a.sat} g al giorno (${Math.round(satPct)}% delle calorie, meglio sotto il 10%).`, tip: 'Meno fritti, salumi, formaggi grassi e dolci con burro; più olio d\'oliva, pesce e frutta secca.' });
  if ((a.salt ?? 0) > 5) out.push({ id: 'sale', level: 'attenzione', title: 'Sale alto', detail: `Circa ${a.salt} g al giorno, il riferimento è sotto 5 g.`, tip: 'Attenzione a salumi, formaggi, pane, snack e piatti pronti; insaporisci con erbe e spezie.' });
  const fatPct = (a.f * 9 * 100) / kcal;
  if (fatPct > 38) out.push({ id: 'grassi', level: 'attenzione', title: 'Molti grassi in totale', detail: `Circa il ${Math.round(fatPct)}% delle calorie dai grassi (di solito 20-35%).`, tip: 'Controlla condimenti e fritture, e scegli cotture al forno o alla piastra.' });
  if (s.mealsPerDay < 2.5 && s.days >= 2) out.push({ id: 'pasti', level: 'attenzione', title: 'Pochi pasti registrati', detail: `In media ${s.mealsPerDay} pasti al giorno nel diario.`, tip: 'Se salti i pasti, prova tre pasti regolari e uno spuntino; se invece non li registri, il giudizio è meno preciso.' });
  const wg = waterGoal(ctx.weightKg);
  if (s.waterMl !== null) {
    if (s.waterMl < wg * 0.7) out.push({ id: 'acqua', level: 'carenza', title: 'Poca acqua', detail: `In media ${(s.waterMl / 1000).toFixed(1).replace('.', ',')} litri al giorno, ne servirebbero circa ${(wg / 1000).toFixed(1).replace('.', ',')}.`, tip: 'Tieni una bottiglia a portata di mano e bevi un bicchiere a ogni pasto e a metà mattina e pomeriggio.' });
    else out.push({ id: 'acqua-ok', level: 'ok', title: 'Acqua nella norma', detail: `In media ${(s.waterMl / 1000).toFixed(1).replace('.', ',')} litri al giorno.`, tip: '' });
  }
  if (s.micro) {
    const rows = microRows(s.micro);
    const low = rows.filter((r) => r.pct < 60).sort((x, y) => x.pct - y.pct);
    if (low.length) {
      const worst = low.slice(0, 4);
      out.push({
        id: 'micro', level: worst[0].pct < 40 ? 'carenza' : 'attenzione', title: 'Vitamine e minerali che potrebbero mancare (stima)',
        detail: worst.map((r) => `${r.label} ${r.pct}% del riferimento`).join(', ') + '.',
        tip: `Per questi punti: ${worst.slice(0, 3).map((r) => `${r.label.toLowerCase()} (${r.sources})`).join('; ')}. Sono stime per categoria di alimento: non sono un dato medico.`,
      });
    } else out.push({ id: 'micro-ok', level: 'ok', title: 'Vitamine e minerali nella norma (stima)', detail: 'Le stime sono in linea con i riferimenti giornalieri.', tip: '' });
  }
  const order = { carenza: 0, attenzione: 1, ok: 2 } as const;
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

/** Testo per la chat: com'è andata, dove mancano cose e cosa migliorare. */
export function analysisText(s: Stats, list: Finding[], name?: string): string {
  if (!s.days) return 'Non ho ancora abbastanza pasti nel diario per dirti qualcosa di utile. Registra qualche pasto (anche solo con una foto) e riprovo.';
  const who = name ? `${name}, ` : '';
  const bad = list.filter((f) => f.level !== 'ok');
  const good = list.filter((f) => f.level === 'ok');
  const head = `${who}ho guardato gli ultimi ${s.asked} giorni (${s.days} con pasti registrati): in media ${s.avg.kcal} kcal, proteine ${s.avg.p} g, carboidrati ${s.avg.c} g, grassi ${s.avg.f} g.`;
  const lack = bad.filter((f) => f.level === 'carenza');
  const care = bad.filter((f) => f.level === 'attenzione');
  const parts: string[] = [head];
  if (lack.length) parts.push(`Dove sei carente:\n${lack.map((f) => `• ${f.title}: ${f.detail}`).join('\n')}`);
  if (care.length) parts.push(`Da tenere d'occhio:\n${care.map((f) => `• ${f.title}: ${f.detail}`).join('\n')}`);
  if (good.length) parts.push(`Va bene: ${good.map((f) => f.title.toLowerCase()).join(', ')}.`);
  if (bad.length) parts.push(`Cosa migliorare, in ordine:\n${bad.slice(0, 4).map((f, i) => `${i + 1}. ${f.tip}`).join('\n')}`);
  else parts.push('Non vedo punti critici: continua così.');
  parts.push(`Ricorda: ${NUTRITION_LEGAL}`);
  return parts.join('\n\n');
}

/** Il parere su un singolo pasto, calcolato sui suoi valori (non serve internet). `slotKcal` = quota di calorie tipica del pasto. */
export function mealOpinion(m: Pick<DayMeal, 'ts' | 'macros' | 'grams'>, ctx: Ctx = {}): { verdict: Level; text: string } {
  const x = m.macros;
  const kcal = Math.max(1, x.kcal);
  const T = ctx.targetKcal ?? 2000;
  const share = { colazione: 0.22, pranzo: 0.35, merenda: 0.1, cena: 0.3, notte: 0.08 }[slotOf(m.ts)];
  const lines: string[] = [];
  let bad = 0, lack = 0;
  const pPct = (x.p * 4 * 100) / kcal, sPct = ((x.sug ?? 0) * 4 * 100) / kcal, satPct = ((x.sat ?? 0) * 9 * 100) / kcal;
  if (x.kcal > T * share * 1.5) { lines.push(`È un pasto molto energetico (${x.kcal} kcal, più di una porzione tipica di ${slotOf(m.ts)}).`); bad++; }
  else if (x.kcal < T * share * 0.4 && slotOf(m.ts) !== 'merenda') { lines.push(`È un pasto leggero (${x.kcal} kcal): potrebbe non bastare fino al prossimo.`); lack++; }
  else lines.push(`Le calorie (${x.kcal} kcal) sono adatte a un pasto di ${slotOf(m.ts)}.`);
  if (pPct < 12 && x.kcal > 250) { lines.push('Poche proteine: aggiungi uova, legumi, pesce, carne magra o yogurt.'); lack++; }
  else if (pPct >= 20) lines.push('Buon contenuto di proteine.');
  if ((x.fib ?? 0) < 3 && x.kcal > 300) { lines.push('Poche fibre: manca una verdura o un cereale integrale.'); lack++; }
  else if ((x.fib ?? 0) >= 6) lines.push('Ricco di fibre, bene per la sazietà.');
  if (sPct > 25 && (x.sug ?? 0) > 15) { lines.push(`Molti zuccheri (${x.sug} g): meglio non abituarsi.`); bad++; }
  if (satPct > 14 && (x.sat ?? 0) > 8) { lines.push(`Grassi saturi alti (${x.sat} g).`); bad++; }
  if ((x.salt ?? 0) > 2.5) { lines.push(`Molto sale (${x.salt} g): per oggi compensa con piatti poco salati.`); bad++; }
  return { verdict: bad >= 2 ? 'attenzione' : lack >= 1 || bad === 1 ? 'attenzione' : 'ok', text: lines.join(' ') };
}

/** Quanta acqua si legge in una frase («ho bevuto 1,5 litri», «500 ml», «due bicchieri», «una bottiglia»), in ml; null se non c'è. */
export function parseWater(raw: string): number | null {
  const t = raw.toLowerCase().replace(/,/g, '.');
  const words: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, mezzo: 0.5, mezza: 0.5 };
  const num = (s: string) => (words[s] ?? Number(s));
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litri|litro)\b/);
  if (m) return Math.round(Number(m[1]) * 1000);
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:ml|millilitri|cl)\b/);
  if (m) return Math.round(/cl/.test(m[0]) ? Number(m[1]) * 10 : Number(m[1]));
  m = t.match(/\b(un|uno|una|due|tre|quattro|cinque|sei|mezzo|mezza|\d+(?:\.\d+)?)\s*(?:bicchier\w*)\b/);
  if (m && Number.isFinite(num(m[1]))) return Math.round(num(m[1]) * 200);
  m = t.match(/\b(un|uno|una|due|tre|mezza|mezzo|\d+(?:\.\d+)?)\s*(?:bottigli\w*|borracc\w*)\b/);
  if (m && Number.isFinite(num(m[1]))) return Math.round(num(m[1]) * 500);
  if (/\b(un|1)\s*litro\b|\bmezzo litro\b/.test(t)) return /mezzo/.test(t) ? 500 : 1000;
  const bare = t.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (bare) { const v = Number(bare[1]); return v <= 10 ? Math.round(v * 1000) : v <= 5000 ? Math.round(v) : null; }
  return null;
}

/** Orari dei promemoria dell'acqua: ogni `everyMin` minuti tra `from` e `to` (HH:MM), al massimo 8. */
export function waterTimes(everyMin: number, from = '09:00', to = '21:00'): string[] {
  const mm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? +m[1] * 60 + +m[2] : null; };
  const a = mm(from) ?? 540, b = mm(to) ?? 1260;
  const step = Math.max(60, Math.round(everyMin / 15) * 15);
  const out: string[] = [];
  for (let t = a; t <= b && out.length < 8; t += step) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  return out;
}

/** Stato di un valore rispetto al limite: ok fino al limite, «warn» (arancione) fino al 15% oltre, «over» (rosso) oltre. */
export type LimitState = 'ok' | 'warn' | 'over';
export const limitState = (value: number, limit: number | undefined): LimitState => {
  if (!limit || limit <= 0) return 'ok';
  const r = value / limit;
  return r <= 1 ? 'ok' : r <= 1.15 ? 'warn' : 'over';
};

/** Valori di riferimento giornalieri (come `dailyTargets`): grammi di proteine, carboidrati e grassi, limiti e minimi. */
export type Targets = { kcal: number; protein: number; carbs: number; fat: number; fibre: number; sugarMax: number; satMax: number; saltMax: number };

/** Statistiche di un solo giorno (stesso formato delle medie), per il resoconto giornaliero e il suo punteggio. */
export function dayStats(g: DayGroup | undefined, waterMl: number | undefined): Stats {
  return { days: g ? 1 : 0, asked: 1, avg: g?.total ?? sumTotals([]), mealsPerDay: g?.meals.length ?? 0, waterMl: waterMl && waterMl > 0 ? waterMl : null, waterDays: waterMl && waterMl > 0 ? 1 : 0, micro: g?.micro, junkShare: g ? Math.min(1, g.junkKcal / Math.max(1, g.total.kcal)) : undefined };
}

export type QualityPart = { id: string; label: string; score: number; max: number; note: string };
export type Quality = { score: number; label: string; level: Level; parts: QualityPart[] };

/**
 * Punteggio complessivo (0-100) della qualità dell'alimentazione, dalle medie rispetto ai valori di riferimento:
 * calorie 25, proteine 15, fibre 15, zuccheri 15, grassi saturi 15, sale 10, acqua 5. Solo ciò che registri: vitamine e minerali non contano.
 */
export function quality(s: Stats, tg: Targets): Quality | null {
  if (!s.days) return null;
  const a = s.avg;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const lowSide = (v: number, goal: number) => clamp(v / goal); // più è vicino all'obiettivo meglio è
  const highSide = (v: number, lim: number) => (v <= lim ? 1 : clamp(1 - (v / lim - 1) / 0.6)); // sopra il limite scende, a +60% vale 0
  const kc = a.kcal <= tg.kcal * 1.1 ? lowSide(a.kcal, tg.kcal * 0.9) : clamp(1 - (a.kcal / tg.kcal - 1.1) / 0.4);
  const parts: QualityPart[] = [
    { id: 'kcal', label: 'Calorie', max: 25, score: kc * 25, note: `${a.kcal} su ${tg.kcal} kcal` },
    { id: 'proteine', label: 'Proteine', max: 15, score: lowSide(a.p, tg.protein * 0.9) * 15, note: `${a.p} su ${tg.protein} g` },
    { id: 'fibre', label: 'Fibre', max: 15, score: lowSide(a.fib ?? 0, tg.fibre) * 15, note: `${a.fib ?? 0} su ${tg.fibre} g` },
    { id: 'zuccheri', label: 'Zuccheri', max: 15, score: highSide(a.sug ?? 0, tg.sugarMax) * 15, note: `${a.sug ?? 0} g, massimo ${tg.sugarMax}` },
    { id: 'saturi', label: 'Grassi saturi', max: 15, score: highSide(a.sat ?? 0, tg.satMax) * 15, note: `${a.sat ?? 0} g, massimo ${tg.satMax}` },
    { id: 'sale', label: 'Sale', max: 10, score: highSide(a.salt ?? 0, tg.saltMax) * 10, note: `${a.salt ?? 0} g, massimo ${tg.saltMax}` },
  ];
  if (s.waterMl !== null) parts.push({ id: 'acqua', label: 'Acqua', max: 5, score: lowSide(s.waterMl, 2000) * 5, note: `${(s.waterMl / 1000).toFixed(1).replace('.', ',')} L` });
  if (s.micro) { const rows = microRows(s.micro); const mean = rows.reduce((x, r) => x + Math.min(1, r.pct / 100), 0) / rows.length; parts.push({ id: 'micro', label: 'Vitamine e minerali (stima)', max: 20, score: mean * 20, note: `${Math.round(mean * 100)}% dei riferimenti` }); }
  if (s.junkShare !== undefined) parts.push({ id: 'junk', label: 'Cibo spazzatura', max: 15, score: clamp(1 - s.junkShare / 0.4) * 15, note: `${Math.round(s.junkShare * 100)}% delle calorie` });
  const max = parts.reduce((x, p) => x + p.max, 0);
  let score = Math.round((parts.reduce((x, p) => x + p.score, 0) / max) * 100);
  /* il cibo spazzatura mette un tetto: con metà delle calorie da fritti, dolci e fast food non si può avere un punteggio alto */
  const js = s.junkShare ?? 0;
  if (js >= 0.7) score = Math.min(score, 35); else if (js >= 0.5) score = Math.min(score, 50); else if (js >= 0.35) score = Math.min(score, 65);
  const label = score >= 80 ? 'Ottima' : score >= 65 ? 'Buona' : score >= 50 ? 'Discreta' : 'Da migliorare';
  return { score, label, level: score >= 65 ? 'ok' : score >= 50 ? 'attenzione' : 'carenza', parts: parts.map((p) => ({ ...p, score: Math.round(p.score * 10) / 10 })) };
}

const GUIDE = 'Rispondi in italiano, con tono da persona che conosce bene l\'utente, senza consigli medici: sono indicazioni generali. Formato: una frase iniziale con il giudizio; poi un elenco con «• » di al massimo 4 punti (cosa va bene, cosa manca o è troppo, un\'idea concreta per migliorare); usa il **grassetto** solo per 1-3 parole chiave. Niente titoli, niente emoji. Al massimo 130 parole. Chiudi sempre con una frase breve: sono stime, non un parere medico, e per dubbi o sintomi ci si rivolge al medico o a un dietista. Non parlare di diagnosi, terapie o integratori e non promettere risultati. Se i dati sono pochi o stimati, dillo.';

/** Testo da mandare all'AI per un parere dettagliato su un pasto (nessuna foto, nessun dato personale oltre a obiettivo e fabbisogno). */
export function mealAiPrompt(m: { ts: number; name: string; macros: Macros }, items: { name: string; grams: number }[], ctx: Ctx = {}): string {
  const x = m.macros;
  const d = new Date(m.ts);
  return `Dai un parere dettagliato su questo pasto (${slotOf(m.ts)}, ore ${pad(d.getHours())}:${pad(d.getMinutes())}).\nPiatto: ${m.name}\nIngredienti: ${items.map((i) => `${i.name} ${i.grams} g`).join('; ') || 'non indicati'}\nValori stimati: ${x.kcal} kcal, proteine ${x.p} g, carboidrati ${x.c} g, grassi ${x.f} g, grassi saturi ${x.sat ?? '?'} g, zuccheri ${x.sug ?? '?'} g, fibre ${x.fib ?? '?'} g, sale ${x.salt ?? '?'} g.\n${ctx.targetKcal ? `Fabbisogno giornaliero stimato: ${ctx.targetKcal} kcal. ` : ''}${ctx.goal ? `Obiettivo: ${ctx.goal}. ` : ''}\n${GUIDE}`;
}

/** Testo per un parere più dettagliato sulle medie dell'alimentazione (solo numeri). */
export function analysisAiPrompt(s: Stats, list: Finding[], ctx: Ctx = {}, q?: { score: number; label: string } | null): string {
  const a = s.avg;
  return `Dai un parere dettagliato sull'alimentazione di una persona, dalle medie degli ultimi ${s.asked} giorni (${s.days} con pasti registrati).\nMedie al giorno: ${a.kcal} kcal, proteine ${a.p} g, carboidrati ${a.c} g, grassi ${a.f} g, grassi saturi ${a.sat ?? '?'} g, zuccheri ${a.sug ?? '?'} g, fibre ${a.fib ?? '?'} g, sale ${a.salt ?? '?'} g, acqua ${s.waterMl === null ? 'non registrata' : `${s.waterMl} ml`}, pasti al giorno ${s.mealsPerDay}.\n${ctx.targetKcal ? `Fabbisogno stimato: ${ctx.targetKcal} kcal. ` : ''}${q ? `Punteggio calcolato dall'app: ${q.score}/100 (${q.label}). ` : ''}\nPunti già rilevati dall'app: ${list.filter((f) => f.level !== 'ok').map((f) => f.title).join('; ') || 'nessuno'}.\n${s.micro ? `Vitamine e minerali (stime per categoria di alimento, % del riferimento giornaliero): ${microRows(s.micro).map((r) => `${r.label} ${r.pct}%`).join(', ')}.` : ''}\n${GUIDE}`;
}

/* ---------- titoli dei pasti ---------- */
const CUT = /\s(?:con|condit\w*|impanat\w*|ripien\w*|fresc\w*|intera|interi|cott\w*|lesse?|lessi|grigliat\w*|alla piastra|al forno|fritt\w*|di cottura|e|o)(?:\s|$)|[,(;:]|\s-\s/i;
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Il nome «di base» di un alimento: «Cotoletta di maiale alla viennese impanata e fitta» diventa «Cotoletta di maiale alla viennese». */
export function coreName(name: string): string {
  let c = String(name ?? '').split(CUT)[0].trim();
  c = c.replace(/\s+(impanat\w*|fresc\w*|intera|interi)$/i, '');
  return capFirst(c.split(/\s+/).slice(0, 6).join(' '));
}
/** Titolo corto e chiaro di un pasto dai suoi ingredienti: «Cotoletta di maiale e patate lesse, +1». Al massimo `max` caratteri. */
export function mealTitle(names: string[], max = 52): string {
  const cores = [...new Set(names.map(coreName).filter(Boolean))];
  if (!cores.length) return 'Pasto';
  let t = cores.length === 1 ? cores[0] : `${cores[0]} e ${cores[1].charAt(0).toLowerCase()}${cores[1].slice(1)}`;
  const more = cores.length - 2;
  if (more > 0) t += ` +${more}`;
  if (t.length > max) t = `${t.slice(0, max - 1).trimEnd()}…`;
  return t;
}
/** Il titolo da mostrare per un pasto salvato: dagli ingredienti se ci sono, altrimenti dal nome (anche vecchio e lungo). */
export function displayName(m: { name: string; items?: { name: string }[] }): string {
  return m.items?.length ? mealTitle(m.items.map((i) => i.name)) : mealTitle([m.name]);
}
