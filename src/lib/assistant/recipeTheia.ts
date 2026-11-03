import { t } from '@/i18n/core';
import { recipeStatus } from '@/lib/fitness/cooking';
import { FOOD, macrosFor, sumMacros } from '@/lib/fitness/nutrition';
import { CATALOG, CATALOG_BY_ID } from '@/lib/recipes/catalog';
import { DIETS, DIFF_LABEL, dietsOf, estimateTotalSec, filterRecipes, fmtMin, itemName, nutritionPer, ovenLeadMin, planBackwards, prettyAmount, scaleGrams, stepSeconds, totalMin, type Diet, type FullRecipe } from '@/lib/recipes/book';
import { parseRecipeIntent, type RIntent } from '@/lib/recipes/intent';
import { remindPlan } from '@/lib/recipes/plan';
import { secLeft, startTimer, stopTimer } from '@/lib/recipes/timers';
import { useFitness } from '@/store/fitness';
import { usePantry } from '@/store/pantry';
import { useRecipes } from '@/store/recipes';
import type { TheiaAction, TheiaExt } from './theiaExt';

type Card = NonNullable<TheiaExt['card']>;
export type RPush = (text: string, o?: { actions?: TheiaAction[]; cards?: Card[]; chips?: string[] }) => void;

const SIX_H = 6 * 3600 * 1000;
let lastId: string | undefined;
let chatCook = false;
let lastSearch: { intent: Extract<RIntent, { k: 'search' }>; shown: number } | null = null;

const card = (r: FullRecipe): Card => ({ icon: 'meal', title: r.name, sub: `${fmtMin(totalMin(r))} · ${t(DIFF_LABEL[r.diff]!)} · ${nutritionPer(r).kcal} kcal ${t('a porzione')}`, page: 'recipes', params: { id: r.id } });
const cookCard = (r: FullRecipe): Card => ({ icon: 'timer', title: `${t('Cucina con me')}: ${r.name}`, sub: t('Apri i passaggi con timer e forno'), page: 'recipes', params: { id: r.id, cook: '1' } });
const cooking = () => { const c = useRecipes.getState().cooking; return c && chatCook && Date.now() - c.startedAt < SIX_H ? c : null; };
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const list = (r: FullRecipe, servings: number) => r.items.map((i) => { const nm = itemName(i); return `• ${nm}${i.note ? ` (${i.note})` : ''}: ${i.grams ? prettyAmount(nm, scaleGrams(i.grams, r.servings, servings)) : t('q.b.')}`; }).join('\n');

function dietFilters(): Diet[] { return useRecipes.getState().myDiets; }

function showRecipe(r: FullRecipe, push: RPush, servings = r.servings) {
  lastId = r.id;
  const n = nutritionPer(r); const dd = dietsOf(r); const my = dietFilters().filter((d) => !dd.diets.includes(d));
  const tags = dd.diets.filter((d) => ['vegetariana', 'vegana', 'senza glutine', 'senza lattosio'].includes(d)).join(', ');
  const text = [
    `${r.name} · ${fmtMin(totalMin(r))} (${t('preparazione')} ${r.prep}, ${t('cottura')} ${r.cook}) · ${t(DIFF_LABEL[r.diff]!)} · ${servings} ${t('porzioni')}`,
    `${t('Per porzione')}: ${n.kcal} kcal · ${n.p} g ${t('proteine')} · ${n.c} g ${t('carbo')} · ${n.f} g ${t('grassi')}${tags ? ` · ${tags}` : ''}`,
    dd.contains.length ? `${t('Contiene')}: ${dd.contains.join(', ')}` : '',
    my.length ? t('Attenzione: non rispetta «{0}».', my.join(', ')) : '',
    `${t('Ingredienti')}:\n${list(r, servings)}`,
    r.steps.some((s) => s.oven) ? t('Serve il forno: ti avviso io quando accenderlo.') : '',
  ].filter(Boolean).join('\n\n');
  push(text, { cards: [card(r)], actions: [{ kind: 'recipe', label: t('Cuciniamo insieme'), op: 'cook', id: r.id, servings }, { kind: 'recipe', label: t('Metti i mancanti nella spesa'), op: 'shop', id: r.id, servings }, { kind: 'recipe', label: useRecipes.getState().favs.includes(r.id) ? t('Togli dai preferiti') : t('Tra i preferiti'), op: 'fav', id: r.id }], chips: [t('Cuciniamo insieme'), t('Altre ricette')] });
}

function runSearch(it: Extract<RIntent, { k: 'search' }>, push: RPush, offset = 0) {
  lastSearch = { intent: it, shown: offset };
  const mine = dietFilters();
  const diets = [...new Set([...it.diets, ...mine])];
  let ids: Set<string> | null = null;
  if (it.fridge) {
    const items = usePantry.getState().items;
    if (!items.length) { push(t('Il tuo frigo è vuoto: aggiungi quello che hai (anche con una foto) e ti dico cosa puoi cucinare. Intanto ti propongo qualche ricetta facile.'), { actions: [{ kind: 'open', label: t('Apri Frigo e spesa'), page: 'fitnessFridge' }] }); it = { ...it, fridge: false, maxMin: it.maxMin ?? 30 }; }
    else ids = new Set(CATALOG.filter((r) => recipeStatus({ id: r.id, name: r.name, method: '', items: r.items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId, grams: i.grams })) }, items, 1).ok).map((r) => r.id));
  }
  const favs = it.fav ? useRecipes.getState().favs : null;
  const all = filterRecipes(CATALOG, { q: it.q, cat: it.cat, maxMin: it.maxMin, diff: it.diff ?? null, diets, region: it.region ?? null, favs, ids }).sort((a, b) => Number(!!a.basic) - Number(!!b.basic));
  const page = all.slice(offset, offset + it.n);
  const bits = [it.cat ? t(it.cat) : '', it.q, it.maxMin ? t('in {0} minuti', it.maxMin) : '', ...diets, it.region ?? '', it.fridge ? t('con quello che hai in frigo') : ''].filter(Boolean).join(', ');
  if (!all.length) { push(t('Con questi criteri non ho trovato ricette{0}. Prova a togliere un filtro: ho oltre {1} ricette.', bits ? ` (${bits})` : '', CATALOG.length), { actions: [{ kind: 'open', label: t('Apri tutte le ricette'), page: 'recipes' }] }); return; }
  if (!page.length) { push(t('Sono finite: ti ho già mostrato tutte e {0}.', all.length)); return; }
  const more = offset + page.length < all.length;
  push(`${t('Ho trovato {0} ricette', all.length)}${bits ? ` (${bits})` : ''}. ${offset ? t('Ecco le prossime:') : t('Ecco le più adatte, toccane una per aprirla:')}`, { cards: page.map(card), actions: [{ kind: 'open', label: t('Apri il libro di ricette'), page: 'recipes' }], chips: more ? [t('Altre ricette'), t('Solo veloci')] : [] });
  lastSearch.shown = offset + page.length;
  if (page.length === 1) lastId = page[0]!.id;
}

/* ---------------- cucina guidata in chat ---------------- */
function stepText(r: FullRecipe, i: number, servings: number): string {
  const s = r.steps[i]!; const left = r.steps.slice(i).reduce((a, x) => a + stepSeconds(x), 0);
  const parts = [`${t('Passaggio {0} di {1}', i + 1, r.steps.length)} · ${t('mancano circa {0} minuti', Math.max(1, Math.round(left / 60)))}`, s.text];
  if (s.oven) parts.push(`${t('Forno')}: ${s.oven.temp}° ${t(s.oven.mode)}. ${t('Se è freddo, preriscaldalo.')}`);
  if (s.timer) parts.push(`${t('Timer')}: ${fmtMin(Math.round(s.timer.sec / 60))}`);
  if (!s.oven) { let acc = 0; for (let k = i; k < r.steps.length; k++) { const x = r.steps[k]!; if (x.oven && k > i) { if (acc <= ovenLeadMin(x.oven) * 60 + 90) parts.push(t('Accendi il forno adesso a {0}° ({1}): serve il tempo di scaldarsi.', x.oven.temp, t(x.oven.mode))); break; } acc += stepSeconds(x); } }
  void servings; return parts.join('\n\n');
}
function sayStep(r: FullRecipe, push: RPush) {
  const c = useRecipes.getState().cooking!; const i = Math.min(c.step, r.steps.length - 1); const s = r.steps[i]!; const last = i === r.steps.length - 1;
  const actions: TheiaAction[] = [];
  if (s.timer) actions.push({ kind: 'recipe', label: t('Avvia il timer: {0}', fmtMin(Math.round(s.timer.sec / 60))), op: 'timer', id: r.id, sec: s.timer.sec, timerLabel: s.timer.label });
  if (last) actions.push({ kind: 'recipe', label: t('Segna una porzione nel diario'), op: 'done', id: r.id });
  push(stepText(r, i, c.servings) + (last && r.tip ? `\n\n${t('Consiglio')}: ${r.tip}` : '') + (last ? `\n\n${t('Ultimo passaggio! Buon appetito.')}` : ''), { actions, cards: i === 0 ? [cookCard(r)] : undefined, chips: last ? [t('Esci')] : [t('Avanti'), t('Indietro'), t('Ripeti'), t('Ingredienti'), t('Esci')] });
}
function startCook(r: FullRecipe, servings: number, push: RPush) {
  lastId = r.id; chatCook = true;
  useRecipes.getState().startCooking({ recipeId: r.id, servings, step: 0, startedAt: Date.now(), checked: [] });
  const total = Math.round(estimateTotalSec(r) / 60);
  push(`${t('Perfetto, cuciniamo «{0}» per {1} porzioni. Ci vogliono circa {2} minuti.', r.name, servings, total)}\n\n${t('Ingredienti')}:\n${list(r, servings)}\n\n${t('Appena sei pronto scrivi «avanti»: ti guido un passaggio alla volta e ti avvio i timer.')}`, { chips: [t('Avanti'), t('Esci')] });
}
function stepCmd(op: Extract<RIntent, { k: 'step' }>['op'], push: RPush) {
  const c = useRecipes.getState().cooking!; const r = CATALOG_BY_ID.get(c.recipeId); if (!r) { chatCook = false; return; }
  const st = useRecipes.getState();
  if (op === 'stop') { chatCook = false; st.stopCooking(); push(t('Va bene, abbiamo finito. I timer che hai avviato restano attivi finché non li ferma.'), {}); return; }
  if (op === 'next') { if (c.step >= r.steps.length - 1) { push(t('Hai finito tutti i passaggi! Vuoi segnare il piatto nel diario?'), { actions: [{ kind: 'recipe', label: t('Segna una porzione nel diario'), op: 'done', id: r.id }], chips: [t('Esci')] }); return; } st.patchCooking({ step: c.step + 1 }); sayStep(r, push); return; }
  if (op === 'prev') { st.patchCooking({ step: Math.max(0, c.step - 1) }); sayStep(r, push); return; }
  if (op === 'repeat' || op === 'where') { sayStep(r, push); return; }
  if (op === 'ingredients') { push(`${t('Ingredienti')} (${c.servings} ${t('porzioni')}):\n${list(r, c.servings)}`, { chips: [t('Avanti'), t('Indietro')] }); return; }
  if (op === 'timer') { const s = r.steps[c.step]!; if (!s.timer) { push(t('In questo passaggio non serve un timer. Se ti serve dimmi «timer di 5 minuti».')); return; } startTimer(s.timer.label, s.timer.sec, r.id); push(t('Timer avviato: {0} per «{1}». Ti avviso io, anche a schermo spento.', fmtMin(Math.round(s.timer.sec / 60)), s.timer.label), { chips: [t('Avanti')] }); }
}

function shopFor(r: FullRecipe, servings: number, push: RPush) {
  const st = recipeStatus({ id: r.id, name: r.name, method: '', items: r.items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId, grams: i.grams })) }, usePantry.getState().items, servings / r.servings);
  if (!st.missing.length) { push(t('Per «{0}» hai già tutto in frigo.', r.name), { actions: [{ kind: 'recipe', label: t('Cuciniamo insieme'), op: 'cook', id: r.id, servings }] }); return; }
  st.missing.forEach((m) => usePantry.getState().addShop(m.name, m.missing, 'g'));
  push(`${t('Ho messo nella lista della spesa {0} ingredienti per «{1}»:', st.missing.length, r.name)}\n${st.missing.map((m) => `• ${m.name}: ${prettyAmount(m.name, m.missing)}`).join('\n')}`, { actions: [{ kind: 'open', label: t('Apri la lista della spesa'), page: 'fitnessFridge' }] });
}
function logCooked(r: FullRecipe, push: RPush) {
  const its = r.items.filter((x) => FOOD(x.foodId)).map((x) => ({ foodId: x.foodId, name: FOOD(x.foodId)!.name, grams: Math.round(scaleGrams(x.grams, r.servings, 1)) }));
  const m = sumMacros(its.map((x) => macrosFor(FOOD(x.foodId)!, x.grams)));
  useFitness.getState().addMeal({ ts: Date.now(), name: r.name, grams: its.reduce((a, x) => a + x.grams, 0), macros: m, items: its });
  useRecipes.getState().markCooked(r.id);
  if (useRecipes.getState().cooking?.recipeId === r.id) { useRecipes.getState().stopCooking(); chatCook = false; }
  push(t('Buon appetito! Ho segnato una porzione di «{0}» nel diario: circa {1} kcal.', r.name, Math.round(m.kcal)), { actions: [{ kind: 'open', label: t('Apri il diario dei pasti'), page: 'fitnessDiary' }] });
}

/** Frasi sulle ricette. true = gestita (tutto sul telefono, nessuna AI esterna). */
export function handleRecipes(text: string, push: RPush, open: (page: string, params?: Record<string, string>) => void): boolean {
  const c = cooking();
  const it = parseRecipeIntent(text, { cooking: !!c, last: lastId });
  if (!it) return false;
  const rid = (id?: string) => (id ? CATALOG_BY_ID.get(id) : undefined);
  switch (it.k) {
    case 'search': runSearch(it, push); return true;
    case 'more': if (lastSearch) runSearch(lastSearch.intent, push, lastSearch.shown); else push(t('Dimmi che ricette cerchi, ad esempio «ricette veloci con le zucchine».')); return true;
    case 'show': { const r = rid(it.id); if (r) showRecipe(r, push, it.servings ?? r.servings); return !!r; }
    case 'pick': push(t('Quale intendi? Toccane una per aprirla.'), { cards: it.ids.map(rid).filter((x): x is FullRecipe => !!x).map(card) }); return true;
    case 'cook': { const r = rid(it.id); if (!r) return false; startCook(r, it.servings ?? r.servings, push); return true; }
    case 'step': if (!c) return false; stepCmd(it.op, push); return true;
    case 'timer': { startTimer(it.label || t('Timer'), it.sec, c?.recipeId); push(t('Timer avviato: {0}{1}. Ti avviso io, anche a schermo spento.', fmtMin(Math.max(1, Math.round(it.sec / 60))), it.label ? ` (${it.label})` : '')); return true; }
    case 'timers': { const ts = useRecipes.getState().timers.filter((x) => !x.fired); push(ts.length ? ts.map((x) => `• ${x.label}: ${Math.floor(secLeft(x) / 60)} min ${secLeft(x) % 60} s`).join('\n') : t('Non hai timer attivi.')); return true; }
    case 'timerstop': { const ts = useRecipes.getState().timers; ts.forEach((x) => stopTimer(x.id)); push(ts.length ? t('Fatto: ho fermato {0} timer.', ts.length) : t('Non avevi timer attivi.')); return true; }
    case 'plan': {
      const r = rid(it.id); if (!r) { push(t('Per quale ricetta? Dimmi ad esempio «voglio mangiare la carbonara alle 20:30».')); return true; }
      const d = new Date(); d.setHours(it.h, it.m, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      const pb = planBackwards(r, d.getTime()); lastId = r.id; const oi = r.steps.findIndex((s) => s.oven);
      push(`${t('Per mangiare «{0}» alle {1} devi iniziare alle {2}.', r.name, hhmm(d.getTime()), hhmm(pb.start))}${oi >= 0 ? `\n${t('Accendi il forno alle {0}.', hhmm(pb.at[oi]! - ovenLeadMin(r.steps[oi]!.oven!) * 60000))}` : ''}`, { cards: [card(r)], actions: [{ kind: 'recipe', label: t('Ricordamelo'), op: 'remind', id: r.id, at: d.getTime() }] }); return true;
    }
    case 'shop': { const r = rid(it.id); if (!r) return false; shopFor(r, r.servings, push); return true; }
    case 'fav': {
      if (it.list || !it.id) { const f = useRecipes.getState().favs.map(rid).filter((x): x is FullRecipe => !!x); push(f.length ? t('Le tue ricette preferite:') : t('Non hai ancora ricette preferite: aprine una e tocca il cuore, oppure dimmi «metti la carbonara tra i preferiti».'), { cards: f.slice(0, 8).map(card) }); return true; }
      const r = rid(it.id)!; useRecipes.getState().toggleFav(r.id); lastId = r.id; push(useRecipes.getState().favs.includes(r.id) ? t('Fatto: «{0}» è tra i preferiti.', r.name) : t('Fatto: ho tolto «{0}» dai preferiti.', r.name), { cards: [card(r)] }); return true;
    }
    case 'cooked': { const r = rid(it.id); if (!r) return false; logCooked(r, push); return true; }
    case 'diet': {
      const cur = useRecipes.getState().myDiets; const next = it.off ? cur.filter((d) => !it.diets.includes(d)) : [...new Set([...cur, ...it.diets])];
      useRecipes.getState().setDiets(next.filter((d) => DIETS.includes(d)));
      push(it.off ? t('Fatto: ho tolto il filtro. Ora cerco ricette senza restrizioni.') : t('Fatto: da ora ti propongo solo ricette «{0}» e ti segnalo quelle che non le rispettano. Le diete sono stimate dai nomi degli ingredienti: con un\'allergia controlla sempre le etichette.', it.diets.join(', '))); return true;
    }
    case 'open': push(t('Apro «{0}».', t(it.label))); open(it.page); return true;
  }
}

/** Il tocco su un pulsante di un messaggio di Theia che riguarda le ricette. */
export function runRecipeAction(a: Extract<TheiaAction, { kind: 'recipe' }>, push: RPush) {
  const r = CATALOG_BY_ID.get(a.id); if (!r) return;
  switch (a.op) {
    case 'cook': startCook(r, a.servings ?? r.servings, push); return;
    case 'show': showRecipe(r, push, a.servings ?? r.servings); return;
    case 'shop': shopFor(r, a.servings ?? r.servings, push); return;
    case 'fav': useRecipes.getState().toggleFav(r.id); push(useRecipes.getState().favs.includes(r.id) ? t('Fatto: «{0}» è tra i preferiti.', r.name) : t('Fatto: ho tolto «{0}» dai preferiti.', r.name)); return;
    case 'timer': startTimer(a.timerLabel || t('Timer'), a.sec ?? 60, r.id); push(t('Timer avviato: {0}. Ti avviso io, anche a schermo spento.', fmtMin(Math.max(1, Math.round((a.sec ?? 60) / 60)))), { chips: cooking() ? [t('Avanti')] : [] }); return;
    case 'remind': void remindPlan(r, a.at ?? Date.now()).then((ok) => push(ok ? t('Fatto: ti avviso io quando è ora di iniziare.') : t('Non posso mandarti la notifica: controlla i permessi nelle impostazioni.'))); return;
    case 'done': logCooked(r, push); return;
  }
}
