import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { tidy } from '@/lib/aiPersona';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { analysisAiPrompt, analysisText, dayOf, findings, groupByDay, mealOpinion, parseWater, periodStats, quality, waterGoal } from '@/lib/fitness/mealInsights';
import { withMicro } from '@/lib/fitness/mealMicro';
import { dailyTarget, dailyTargets } from '@/lib/fitness/nutrition';
import { refreshFoodReminders } from '@/lib/foodNotify';
import { useApp } from '@/store/app';
import { useFitness } from '@/store/fitness';
import type { TheiaAction } from './theiaExt';

type Push = (text: string, actions?: TheiaAction[]) => void;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

let awaitingWater = 0;
const WAIT_MS = 45 * 60000;

const ctx = () => {
  const b = useFitness.getState().body;
  return { targetKcal: b ? dailyTarget(b) : undefined, weightKg: b?.weightKg, goal: b?.goal };
};
const say = (label: string, text = label): TheiaAction => ({ kind: 'say', label, text });
const litri = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} ${t('litri')}`;

/** Analisi di come mangi (ultimi 7 giorni) mostrata in chat: dove sei carente e cosa migliorare. */
export function eatingAnalysis(push: Push) {
  const fit = useFitness.getState();
  const s = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), 7);
  const list = findings(s, ctx());
  const text = analysisText(s, list, useApp.getState().account.name?.split(' ')[0]);
  push(t(text), [
    ...(s.days ? [say(t('Chiedi all\'AI di approfondire'), 'approfondisci con l\'AI come mangio')] : []),
    { kind: 'open', label: t('Apri lo storico dei pasti'), page: 'fitnessDiary' },
    ...(s.waterMl === null || list.some((f) => f.id === 'acqua') ? [say(t('Segna l\'acqua di oggi'), 'Quanta acqua ho bevuto oggi?')] : []),
  ]);
}

/** La domanda serale: com'è andata con il cibo oggi e quanta acqua hai bevuto (si risponde scrivendo subito sotto o con i pulsanti). */
export function eveningReview(push: Push) {
  const fit = useFitness.getState();
  const today = groupByDay(withMicro(fit.meals)).find((g) => g.key === dayOf(Date.now()));
  const parts: string[] = [];
  if (today) {
    const x = today.total;
    parts.push(t('Oggi hai registrato {0} pasti: circa {1} kcal, proteine {2} g, carboidrati {3} g, grassi {4} g.', today.meals.length, x.kcal, x.p, x.c, x.f));
    const last = today.meals[today.meals.length - 1];
    if (last) parts.push(t('Sull\'ultimo pasto («{0}»): {1}', last.name, mealOpinion(last, ctx()).text));
  } else parts.push(t('Oggi non hai registrato nessun pasto: se vuoi aggiungerli, apri il diario.'));
  parts.push(t('Sono stime, non un parere medico.'));
  askWaterInto(parts);
  push(parts.join('\n\n'), waterChoices(!today));
}

function askWaterInto(parts: string[]) {
  const ml = (useFitness.getState().water ?? {})[dayOf(Date.now())] ?? 0;
  awaitingWater = Date.now();
  parts.push(ml > 0 ? t('Finora oggi hai segnato {0} di acqua. Quanta ne hai bevuta in più? Scrivilo qui sotto, per esempio «1,5 litri» o «due bicchieri».', litri(ml)) : t('Quanta acqua hai bevuto oggi? Scrivilo qui sotto, per esempio «1,5 litri» o «due bicchieri», oppure scegli.'));
}
function waterChoices(withDiary: boolean): TheiaAction[] {
  return [say('500 ml', 'ho bevuto 500 ml'), say(t('1 litro'), 'ho bevuto 1 litro'), say(t('1,5 litri'), 'ho bevuto 1,5 litri'), say(t('2 litri'), 'ho bevuto 2 litri'), ...(withDiary ? [{ kind: 'open', label: t('Apri il diario'), page: 'fitnessMeal' } as TheiaAction] : [])];
}

function logWater(push: Push, ml: number) {
  const fit = useFitness.getState();
  const total = fit.addWater(ml);
  awaitingWater = 0;
  const goal = waterGoal(fit.body?.weightKg);
  const hour = new Date().getHours();
  const low = total < goal * 0.6 && hour >= 16;
  if (low) {
    push(t('Segnato: oggi {0} di acqua, meno di quanto servirebbe (circa {1}). Vuoi che ti avvisi ogni tot per bere un po\' d\'acqua?', litri(total), litri(goal)), [
      say(t('Sì, ogni 2 ore'), 'promemoria acqua ogni 2 ore'), say(t('Ogni 3 ore'), 'promemoria acqua ogni 3 ore'), { kind: 'dismiss', label: t('No, grazie') },
    ]);
  } else {
    push(total >= goal ? t('Segnato: oggi {0} di acqua, obiettivo raggiunto (circa {1}). Bene!', litri(total), litri(goal)) : t('Segnato: oggi {0} di acqua su circa {1}.', litri(total), litri(goal)), fit.waterRemind?.on ? undefined : [say(t('Avvisami per bere'), 'promemoria acqua ogni 2 ore')]);
  }
}

/** Parere dettagliato dell'AI sulle medie (solo numeri), dopo il consenso. */
export async function deepAnalysis(push: Push) {
  if (!aiServerConfigured) { push(t('L\'AI non è collegata in questa app: ti ho dato l\'analisi che posso fare sul telefono.')); return; }
  const fit = useFitness.getState();
  const s = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), 7);
  if (!s.days) { push(t('Non ho ancora abbastanza pasti per chiedere un parere: registra qualche pasto e riprova.')); return; }
  if (!(await askSend('summary', t('Medie degli ultimi 7 giorni: calorie, macronutrienti, zuccheri, saturi, fibre, sale, acqua e vitamine e minerali stimati.')))) { push(t('Va bene, non invio niente. Resta l\'analisi fatta sul telefono.')); return; }
  const c = ctx();
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(s, tg) : null;
  const prompt = analysisAiPrompt(s, findings(s, c), c, q);
  try {
    logSend('summary', prompt.length, ['testo']);
    push(`${tidy(await aiChatRaw(prompt))}\n\n${t('Parere dell\'AI: può sbagliare, controlla su una fonte affidabile. Non è un consiglio medico.')}`);
  } catch (e) { push(e instanceof AiServerError ? e.message : t('Non sono riuscito a contattare il servizio AI.')); }
}

const AI_DEEP = /\b(approfondisc\w*|pi[uù] dettagli\w*|parere)\b.*\b(ai|intelligenza|mang\w*|alimentazion\w*)\b/;
const EAT = /\b(analizz\w*|analisi|valut\w*|giudic\w*|controll\w*)\b.*\b(mang\w*|alimentazion\w*|dieta|cibo|pasti|nutrizion\w*)\b|\bcome (sto )?mang\w+|\bcome mi alimento\b|\bsono carente\b|\bcarenz\w+\b.*\b(alimentazion\w*|dieta)|\bcosa (devo|dovrei) migliorare\b.*\b(mang\w*|alimentazion\w*|dieta)\b/;
const EVENING = /com e andata oggi con il cibo/;
const HISTORY = /\b(storico|diario|cronologia)\b.*\b(pasti|cibo|alimentazione|mangiato)\b|\bi miei pasti\b|\bcosa ho mangiato\b/;
const WATER_ASK = /\bquanta acqua (ho bevuto|devo bere|bevo)\b|\bsegna(re)? l acqua\b/;
const WATER_LOG = /\b(ho bevuto|bevuto|ho preso|bevo)\b.*\b(acqua|l|litri|ml|bicchier\w*|bottigli\w*)\b|\bacqua\b.*\b(\d|bicchier|litr|ml)\b|^\+?\s*\d+(?:[.,]\d+)?\s*(ml|l|litri?)\b|^ho bevuto\b/;
const WATER_REMIND = /\b(promemoria|avvis\w*|ricord\w*|notific\w*)\b.*\bacqua\b|\bbere\b.*\bogni\b|\bacqua ogni\b/;
const OFF = /\b(disattiv\w*|spegn\w*|togli\w*|non voglio|basta)\b/;
const EVENING_OFF = /\b(domanda|notifica|avviso)\b.*\b(serale|sera|cibo)\b|\b(serale|sera)\b.*\b(notifica|avviso)\b/;

/** Frasi sul cibo e sull'acqua. true = gestita (nessuna AI esterna: è tutto calcolato sul telefono). */
export async function handleFood(text: string, push: Push, open: (page: string, params?: Record<string, string>) => void): Promise<boolean> {
  const n = norm(text);
  if (!n) return false;
  // risposta alla domanda «quanta acqua hai bevuto?»: basta il numero
  if (awaitingWater && Date.now() - awaitingWater < WAIT_MS) {
    const ml = parseWater(text);
    if (ml !== null && ml > 0 && ml <= 5000) { logWater(push, ml); return true; }
  }
  if (EVENING.test(n)) { eveningReview(push); return true; }
  if (HISTORY.test(n)) { push(t('Ecco lo storico giorno per giorno: tocca un pasto per vedere la foto e il mio parere.'), [{ kind: 'open', label: t('Apri lo storico dei pasti'), page: 'fitnessDiary' }]); open('fitnessDiary'); return true; }
  if (WATER_ASK.test(n)) { const parts: string[] = []; askWaterInto(parts); push(parts.join('\n\n'), waterChoices(false)); return true; }
  if (WATER_REMIND.test(n)) {
    const fit = useFitness.getState();
    if (OFF.test(n)) { fit.setWaterRemind({ on: false }); await refreshFoodReminders(); push(t('Fatto: non ti avviso più per bere.')); return true; }
    const m = n.match(/ogni (\d+|un ora|una ora|due|tre|quattro) ?(?:ore|ora|h)?/);
    const w: Record<string, number> = { 'un ora': 1, 'una ora': 1, due: 2, tre: 3, quattro: 4 };
    const hours = m ? (w[m[1]] ?? Number(m[1])) : 2;
    const every = Math.min(6, Math.max(1, hours || 2)) * 60;
    fit.setWaterRemind({ on: true, everyMin: every });
    await refreshFoodReminders();
    push(t('Va bene: ti avviso ogni {0} ore tra le {1} e le {2}. Se non ricevi le notifiche, controlla il permesso in Impostazioni. Puoi cambiarlo o spegnerlo dallo storico dei pasti.', Math.round(every / 60), fit.waterRemind.from, fit.waterRemind.to), [{ kind: 'open', label: t('Apri lo storico dei pasti'), page: 'fitnessDiary' }]);
    return true;
  }
  if (EVENING_OFF.test(n) && OFF.test(n)) { useFitness.getState().setEveningCheck({ on: false }); await refreshFoodReminders(); push(t('Fatto: non ti scrivo più la sera per chiederti del cibo. Puoi riattivarla dallo storico dei pasti.')); return true; }
  if (WATER_LOG.test(n)) {
    const ml = parseWater(text);
    if (ml !== null && ml > 0 && ml <= 5000) { logWater(push, ml); return true; }
  }
  if (AI_DEEP.test(n) && /\b(mang\w*|alimentazion\w*)\b/.test(n)) { await deepAnalysis(push); return true; }
  if (EAT.test(n)) { eatingAnalysis(push); return true; }
  return false;
}
