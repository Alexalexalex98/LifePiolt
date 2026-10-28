import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { tidy } from '@/lib/aiPersona';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { analysisAiPrompt, analysisText, dayOf, findings, groupByDay, mealOpinion, parseWater, periodStats, quality, waterGoal } from '@/lib/fitness/mealInsights';
import { withMicro } from '@/lib/fitness/mealMicro';
import { microRows } from '@/lib/fitness/micro';
import { dailyTarget, dailyTargets } from '@/lib/fitness/nutrition';
import { refreshFoodReminders } from '@/lib/foodNotify';
import { useApp } from '@/store/app';
import { useFitness } from '@/store/fitness';
import { usePantry } from '@/store/pantry';
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

/** Il recap di come mangi (7 giorni), calcolato sul telefono: serve alla scheda dello storico e alla chat. */
export function recapText(): string {
  const fit = useFitness.getState();
  const s = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), 7);
  return analysisText(s, findings(s, ctx()), useApp.getState().account.name?.split(' ')[0]);
}

/**
 * «Analisi di Theia»: calcolata sul telefono, su tutto e su tutti i nutrienti degli ultimi 7 giorni (media al giorno rispetto al tuo obiettivo o limite),
 * con vitamine e minerali stimati e il giorno per giorno. Niente AI esterna.
 */
export function fullAnalysisText(): string {
  const fit = useFitness.getState();
  const meals = withMicro(fit.meals);
  const s = periodStats(meals, fit.water ?? {}, Date.now(), 7);
  const head = recapText();
  if (!s.days) return head;
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const a = s.avg;
  const num = (n: number | undefined) => String(Math.round((n ?? 0) * 10) / 10).replace('.', ',');
  const pct = (v: number, goal: number) => `${Math.round((v / Math.max(1, goal)) * 100)}%`;
  const low = (label: string, v: number | undefined, goal: number, unit: string, why: string) => {
    const r = (v ?? 0) / Math.max(1, goal);
    return `• ${label}: ${num(v)} ${unit} su ${num(goal)} (${pct(v ?? 0, goal)}) · ${r >= 0.9 ? t('in linea') : r >= 0.6 ? t('un po\' sotto') : t('sotto')}. ${why}`;
  };
  const high = (label: string, v: number | undefined, max: number, unit: string, why: string) => {
    const r = (v ?? 0) / Math.max(1, max);
    return `• ${label}: ${num(v)} ${unit}, massimo ${num(max)} (${pct(v ?? 0, max)}) · ${r <= 1 ? t('nei limiti') : r <= 1.3 ? t('un po\' sopra') : t('troppo alto')}. ${why}`;
  };
  const out: string[] = [head];
  const macros: string[] = [`${t('Energia e macronutrienti (media al giorno)')}`];
  macros.push(tg ? low(t('Calorie'), a.kcal, tg.kcal, 'kcal', t('Il fabbisogno dipende da età, peso e attività.')) : `• ${t('Calorie')}: ${num(a.kcal)} kcal.`);
  macros.push(tg ? low(t('Proteine'), a.p, tg.protein, 'g', t('Servono a muscoli, pelle e difese.')) : `• ${t('Proteine')}: ${num(a.p)} g.`);
  macros.push(tg ? low(t('Carboidrati'), a.c, tg.carbs, 'g', t('Sono la principale fonte di energia per cervello e muscoli.')) : `• ${t('Carboidrati')}: ${num(a.c)} g.`);
  macros.push(tg ? low(t('Grassi totali'), a.f, tg.fat, 'g', t('Contano il tipo e la qualità, non solo la quantità.')) : `• ${t('Grassi totali')}: ${num(a.f)} g.`);
  if (tg) {
    macros.push(high(t('Zuccheri'), a.sug, tg.sugarMax, 'g', t('Qui sono contati tutti gli zuccheri, anche quelli naturali di frutta e latte. Quelli aggiunti (bibite, dolci, succhi) vanno limitati.')));
    macros.push(high(t('Grassi saturi'), a.sat, tg.satMax, 'g', t('Sono i grassi di burro, formaggi grassi, salumi e carni grasse: in eccesso fanno salire il colesterolo «cattivo».')));
    macros.push(low(t('Fibre'), a.fib, tg.fibre, 'g', t('Sono nella frutta intera, verdura, legumi e cereali integrali: aiutano sazietà e intestino.')));
    macros.push(high(t('Sale'), a.salt, tg.saltMax, 'g', t('Tieni presente salumi, formaggi, pane e piatti pronti.')));
  } else {
    macros.push(`• ${t('Zuccheri')}: ${num(a.sug)} g · ${t('Grassi saturi')}: ${num(a.sat)} g · ${t('Fibre')}: ${num(a.fib)} g · ${t('Sale')}: ${num(a.salt)} g.`);
    macros.push(t('Inserisci peso, altezza ed età in LifeFitness per confrontarli con il tuo obiettivo.'));
  }
  const goalW = waterGoal(fit.body?.weightKg);
  macros.push(s.waterMl !== null ? low(t('Acqua'), s.waterMl / 1000, goalW / 1000, 'L', t('Conta anche l\'acqua che arriva da frutta, verdura e minestre.')) : `• ${t('Acqua')}: ${t('non hai segnato quanta ne bevi.')}`);
  out.push(macros.join('\n'));
  if (s.micro) {
    const rows = microRows(s.micro);
    const mic = [t('Vitamine e minerali (stima, media al giorno rispetto al riferimento)')];
    for (const r of rows) mic.push(`• ${r.label}: ${num(r.value)} ${r.unit} su ${num(r.ref)} (${r.pct}%) · ${r.level === 'ok' ? t('in linea') : r.level === 'basso' ? t('basso') : t('molto basso')}${r.level === 'ok' ? '' : `. ${t('Dove trovarla')}: ${r.sources}.`}`);
    mic.push(t('Sono stime, non un dato medico: vitamine e minerali sono calcolati per categoria di alimento.'));
    out.push(mic.join('\n'));
  }
  const days = groupByDay(meals).filter((g) => g.ts >= Date.now() - 7 * 86400000).slice(0, 7);
  if (days.length) {
    const rows = [t('Giorno per giorno')];
    for (const g of days) rows.push(`• ${new Date(g.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'numeric' })}: ${g.total.kcal} kcal · P ${num(g.total.p)} g · C ${num(g.total.c)} g · G ${num(g.total.f)} g · ${t('zuccheri')} ${num(g.total.sug)} g · ${t('fibre')} ${num(g.total.fib)} g · ${t('sale')} ${num(g.total.salt)} g (${g.meals.length} ${t('pasti')})`);
    out.push(rows.join('\n'));
  }
  return out.join('\n\n');
}

/** Parere dettagliato dell'AI sulle medie (solo numeri), dopo il consenso. `ok` = è arrivato davvero il parere dell'AI. */
export async function deepAnalysisText(): Promise<{ ok: boolean; text: string }> {
  if (!aiServerConfigured) return { ok: false, text: t('L\'AI non è collegata in questa app: resta l\'analisi fatta sul telefono.') };
  const fit = useFitness.getState();
  const s = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), 7);
  if (!s.days) return { ok: false, text: t('Non ho ancora abbastanza pasti per chiedere un parere: registra qualche pasto e riprova.') };
  if (!(await askSend('summary', t('Medie degli ultimi 7 giorni: calorie, macronutrienti, zuccheri, saturi, fibre, sale, acqua e vitamine e minerali stimati.')))) return { ok: false, text: t('Va bene, non invio niente. Resta l\'analisi fatta sul telefono.') };
  const c = ctx();
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(s, tg) : null;
  const prompt = `${analysisAiPrompt(s, findings(s, c), c, q)}\n\nIMPORTANTE: sii BREVE. Una frase di giudizio e al massimo 3 punti molto corti (circa 60 parole in tutto). L'analisi dettagliata su ogni nutriente la scrive già l'app.`;
  try {
    logSend('summary', prompt.length, ['testo']);
    return { ok: true, text: `${tidy(await aiChatRaw(prompt))}\n\n${t('Parere dell\'AI: può sbagliare, controlla su una fonte affidabile. Non è un consiglio medico.')}` };
  } catch (e) { return { ok: false, text: e instanceof AiServerError ? e.message : t('Non sono riuscito a contattare il servizio AI.') }; }
}

/** Come sopra, ma il risultato va in chat. */
export async function deepAnalysis(push: Push) { push((await deepAnalysisText()).text); }

const AI_DEEP = /\b(approfondisc\w*|pi[uù] dettagli\w*|parere)\b.*\b(ai|intelligenza|mang\w*|alimentazion\w*)\b/;
const EAT = /\b(analizz\w*|analisi|valut\w*|giudic\w*|controll\w*)\b.*\b(mang\w*|alimentazion\w*|dieta|cibo|pasti|nutrizion\w*)\b|\bcome (sto )?mang\w+|\bcome mi alimento\b|\bsono carente\b|\bcarenz\w+\b.*\b(alimentazion\w*|dieta)|\bcosa (devo|dovrei) migliorare\b.*\b(mang\w*|alimentazion\w*|dieta)\b/;
const EVENING = /com e andata oggi con il cibo/;
const HISTORY = /\b(storico|diario|cronologia)\b.*\b(pasti|cibo|alimentazione|mangiato)\b|\bi miei pasti\b|\bcosa ho mangiato\b/;
const WATER_ASK = /\bquanta acqua (ho bevuto|devo bere|bevo)\b|\bsegna(re)? l acqua\b/;
const WATER_LOG = /\b(ho bevuto|bevuto|ho preso|bevo)\b.*\b(acqua|l|litri|ml|bicchier\w*|bottigli\w*)\b|\bacqua\b.*\b(\d|bicchier|litr|ml)\b|^\+?\s*\d+(?:[.,]\d+)?\s*(ml|l|litri?)\b|^ho bevuto\b/;
const WATER_REMIND = /\b(promemoria|avvis\w*|ricord\w*|notific\w*)\b.*\bacqua\b|\bbere\b.*\bogni\b|\bacqua ogni\b/;
const OFF = /\b(disattiv\w*|spegn\w*|togli\w*|non voglio|basta)\b/;
const EVENING_OFF = /\b(domanda|notifica|avviso)\b.*\b(serale|sera|cibo)\b|\b(serale|sera)\b.*\b(notifica|avviso)\b/;

const SHOP_LIST = /\b(lista della spesa|lista spesa|cosa devo comprare|cosa (?:mi )?(?:manca|serve) (?:da )?comprare|cosa compro|prepar\w* la spesa|fammi la spesa)\b/;
const EMPTY_FRIDGE = /\b(svuota|svuotare|butta|buttare|elimina|eliminare|cancella|cancellare|togli|toglimi)\b.*\b(frigo|dispensa|scorte)\b/;
const CONFIRM_EMPTY = /^s[iì]\b.*\bsvuota\b.*\bfrigo\b.*\bdavvero\b/;
const RESTORE_FRIDGE = /\b(rimetti|ripristina|rimettere|riporta)\b.*\b(frigo|cose|tutto|scorte)\b/;
let lastCleared: import('@/lib/fitness/pantry').PantryItem[] | null = null;

/** La lista della spesa dal piano alimentare, meno ciò che c'è già in frigo. */
function shoppingFromPlan(push: Push) {
  const pantry = usePantry.getState();
  if (!pantry.plan) { push(t('Non hai ancora un piano alimentare: dimmi cosa vuoi mangiare e come ti senti e lo creiamo insieme, poi ti preparo la lista di ciò che devi comprare.'), [{ kind: 'say', label: t('Creiamo il piano'), text: 'vorrei un piano alimentare' }, { kind: 'dismiss', label: t('Più tardi') }]); return; }
  const list = pantry.shopForPlan(7);
  if (!list.length) { push(t('Hai già in frigo tutto quello che serve per i prossimi 7 giorni del piano: non devi comprare niente.'), [{ kind: 'open', label: t('Apri Frigo e spesa'), page: 'fitnessFridge' }]); return; }
  const g = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10} kg` : `${n} g`);
  push(`${t('Per i prossimi 7 giorni del piano ti serve questo (ho già tolto quello che hai in frigo):')}\n\n${list.slice(0, 40).map((x) => `• ${x.name} · ${g(x.grams)}`).join('\n')}\n\n${t('L\'ho messa nella tua lista della spesa: la spunti mentre compri.')}`, [{ kind: 'open', label: t('Apri la lista della spesa'), page: 'fitnessFridge' }, { kind: 'dismiss', label: t('Ok') }]);
}

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
  if (SHOP_LIST.test(n)) { shoppingFromPlan(push); return true; }
  if (CONFIRM_EMPTY.test(n)) { const before = usePantry.getState().clearItems(); push(before.length ? t('Fatto: ho svuotato il frigo ({0} voci). Se ti sei sbagliato puoi rimetterle.', before.length) : t('Il frigo era già vuoto.'), before.length ? [{ kind: 'say', label: t('Rimetti tutto'), text: 'rimetti le cose nel frigo' }, { kind: 'dismiss', label: t('Ok') }] : undefined); if (before.length) lastCleared = before; return true; }
  if (RESTORE_FRIDGE.test(n) && lastCleared) { usePantry.getState().restoreItems(lastCleared); push(t('Fatto: ho rimesso le {0} voci nel frigo.', lastCleared.length)); lastCleared = null; return true; }
  if (EMPTY_FRIDGE.test(n)) { push(t('Vuoi davvero svuotare tutto il frigo? Tolgo tutte le scorte che hai segnato; la lista della spesa non cambia.'), [{ kind: 'say', label: t('Sì, svuota il frigo'), text: 'sì svuota il frigo davvero' }, { kind: 'dismiss', label: t('No, lascia') }]); return true; }
  if (AI_DEEP.test(n) && /\b(mang\w*|alimentazion\w*)\b/.test(n)) { await deepAnalysis(push); return true; }
  if (EAT.test(n)) { eatingAnalysis(push); return true; }
  return false;
}
