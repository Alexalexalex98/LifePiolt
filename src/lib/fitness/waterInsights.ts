/**
 * Acqua bevuta in un periodo: a che punto sei rispetto all'obiettivo e cosa può succedere se ne bevi troppo poca o troppa (modulo PURO).
 * Conta solo l'acqua che hai segnato. Valori generali per un adulto in salute: non sono un parere medico.
 */
export type WaterLevel = 'poca' | 'quasi' | 'ok' | 'molta' | 'troppa';
export type WaterPeriod = {
  period: number;
  /** giorni del periodo in cui hai segnato acqua, e quelli senza niente segnato */
  loggedDays: number; unloggedDays: number;
  totalMl: number;
  /** media al giorno sui giorni con acqua segnata (null se nessuno) */
  avgMl: number | null;
  goal: number;
  /** media / obiettivo (0-…) */
  pct: number;
  daysAtGoal: number;
  /** giorni sotto il 70% dell'obiettivo / sopra 4,5 litri */
  lowDays: number; highDays: number;
  level: WaterLevel | null;
};

export const dayKey = (ts: number): string => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DAY = 86400000;

export function waterLevel(avg: number, goal: number): WaterLevel {
  if (avg > Math.max(4000, goal * 2)) return 'troppa';
  if (avg > goal * 1.5) return 'molta';
  if (avg >= goal * 0.9) return 'ok';
  if (avg >= goal * 0.7) return 'quasi';
  return 'poca';
}

/** Gli ultimi `period` giorni. Oggi conta solo dopo le 20 (prima è incompleto e abbasserebbe la media). */
export function waterPeriod(water: Record<string, number>, now: number, period: number, goal: number): WaterPeriod {
  const late = new Date(now).getHours() >= 20;
  const keys: string[] = [];
  for (let i = late ? 0 : 1; i <= (late ? period - 1 : period); i += 1) keys.push(dayKey(now - i * DAY));
  const vals = keys.map((k) => water[k] ?? 0);
  const logged = vals.filter((v) => v > 0);
  const total = logged.reduce((a, b) => a + b, 0);
  const avg = logged.length ? Math.round(total / logged.length) : null;
  return {
    period, loggedDays: logged.length, unloggedDays: keys.length - logged.length, totalMl: total, avgMl: avg, goal,
    pct: avg === null ? 0 : avg / goal,
    daysAtGoal: logged.filter((v) => v >= goal * 0.9).length,
    lowDays: logged.filter((v) => v < goal * 0.7).length,
    highDays: logged.filter((v) => v > 4500).length,
    level: avg === null ? null : waterLevel(avg, goal),
  };
}

const L = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/** Cosa può succedere se se ne beve poca. */
export const WHAT_IF_LOW: string[] = [
  'mal di testa, stanchezza e calo della concentrazione',
  'bocca secca, sete, urine scure e meno frequenti',
  'stitichezza e crampi muscolari, soprattutto con l\'attività fisica',
  'con caldo, sport o febbre il rischio sale in fretta; negli anziani e nei bambini ancora di più',
];
export const WHAT_IF_LOW_WARN = 'Se hai capogiri, confusione, battito molto veloce o non urini da molte ore, non aspettare: parlane con un medico.';

/** Cosa può succedere se se ne beve troppa. */
export const WHAT_IF_HIGH: string[] = [
  'oltre 4-5 litri al giorno, o molti litri in poche ore, il sodio nel sangue si diluisce (iponatriemia): nausea, mal di testa, gonfiore, confusione',
  'nei casi gravi crampi, svenimento o convulsioni: è raro, ma è un\'urgenza medica',
  'i reni smaltiscono circa 0,8-1 litro all\'ora: meglio distribuire che bere tanto tutto insieme',
  'se bevi molto e hai sempre sete, o urini moltissimo, fallo controllare dal medico',
];
export const WHAT_IF_HIGH_WARN = 'Chi ha problemi a reni o cuore, o prende diuretici, deve seguire le indicazioni del medico sulla quantità.';
export const WATER_NOTE = 'Conta solo l\'acqua che hai segnato: anche cibo, tè e caffè contribuiscono. È un riferimento generale per un adulto in salute, non un parere medico.';

export type WaterVerdict = { level: 'ok' | 'attenzione' | 'carenza'; title: string; detail: string; /** consiglio breve */ advice: string; /** consiglio con cosa può succedere */ tip: string };

/** Il giudizio in parole: a che punto sei e cosa fare. Null se nessun giorno ha acqua segnata. */
export function waterVerdict(p: WaterPeriod): WaterVerdict | null {
  if (p.avgMl === null || p.level === null) return null;
  const media = `In media ${L(p.avgMl)} al giorno su circa ${L(p.goal)}, ${p.daysAtGoal} giorni su ${p.loggedDays} con l'obiettivo raggiunto.`;
  switch (p.level) {
    case 'poca':
      return { level: 'carenza', title: 'Poca acqua', detail: media, advice: 'Tieni una bottiglia a portata di mano e bevi un bicchiere a ogni pasto e a metà mattina e pomeriggio.', tip: `Tieni una bottiglia a portata di mano e bevi un bicchiere a ogni pasto e a metà mattina e pomeriggio. Se ne bevi poca può succedere: ${WHAT_IF_LOW.slice(0, 3).join('; ')}. ${WHAT_IF_LOW_WARN}` };
    case 'quasi':
      return { level: 'attenzione', title: 'Un po\' poca acqua', detail: media, advice: 'Sei vicino: un bicchiere in più a pranzo e uno nel pomeriggio ti portano all\'obiettivo.', tip: 'Sei vicino: un bicchiere in più a pranzo e uno nel pomeriggio ti portano all\'obiettivo.' };
    case 'ok':
      return { level: 'ok', title: 'Acqua nella norma', detail: media, advice: '', tip: '' };
    case 'molta':
      return { level: 'ok', title: 'Molta acqua', detail: media, advice: 'È sopra il riferimento: va bene se fa caldo o ti alleni tanto. Distribuiscila nella giornata.', tip: 'È sopra il riferimento: va bene se fa caldo o ti alleni tanto. Distribuiscila nella giornata senza berne molti litri tutti insieme.' };
    default:
      return { level: 'attenzione', title: 'Troppa acqua', detail: media, advice: 'Distribuisci l\'acqua nella giornata e non berne molti litri tutti insieme.', tip: `Bere molto più del necessario può diluire il sodio nel sangue: ${WHAT_IF_HIGH.slice(0, 3).join('; ')}. ${WHAT_IF_HIGH_WARN}` };
  }
}
