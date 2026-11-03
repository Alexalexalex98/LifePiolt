import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CookMode } from '@/components/recipes/CookMode';
import { Dots, RecipeCard } from '@/components/recipes/RecipeCard';
import { Text } from '@/components/T';
import { Body, Btn, Input, Page, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { cookable, recipeStatus } from '@/lib/fitness/cooking';
import { Icon } from '@/lib/icons';
import { remindPlan } from '@/lib/recipes/plan';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { CATALOG, WRITTEN_COUNT } from '@/lib/recipes/catalog';
import { CAT_COLOR, DIETS, DIFF_LABEL, RCATS, balanceScore, dietsOf, estimateTotalSec, filterRecipes, fmtClock, fmtMin, itemName, nutritionPer, ovenLeadMin, planBackwards, prettyAmount, regionsOf, scaleGrams, totalMin, type Diet, type FullRecipe, type RCat } from '@/lib/recipes/book';
import { secLeft, stopTimer, useKitchenTimers } from '@/lib/recipes/timers';
import { usePantry } from '@/store/pantry';
import { useRecipes } from '@/store/recipes';
import { toast } from '@/store/toast';

const MAX_RAIL = 12;
export default function Recipes() {
  const th = useTheme();
  const favs = useRecipes((s) => s.favs); const cooking = useRecipes((s) => s.cooking); const myDiets = useRecipes((s) => s.myDiets);
  const items = usePantry((s) => s.items);
  const params = useLocalSearchParams<{ id?: string; cook?: string }>();
  const [open, setOpen] = useState<string | null>(typeof params.id === 'string' ? params.id : null);
  useEffect(() => { if (typeof params.id === 'string' && params.id) setOpen(params.id); }, [params.id]);
  const [q, setQ] = useState(''); const [cat, setCat] = useState<RCat | null>(null);
  const [quick, setQuick] = useState<'favs' | 'fridge' | 'fast' | null>(null);
  const [diets, setDiets] = useState<Diet[]>([]); const [diff, setDiff] = useState<1 | 2 | 3 | null>(null); const [region, setRegion] = useState<string | null>(null);
  const [fOpen, setFOpen] = useState(false);
  const { timers, now } = useKitchenTimers();
  const regions = useMemo(() => regionsOf(CATALOG), []);
  const fridge = useMemo(() => { const c = cookable(CATALOG.map((r) => ({ id: r.id, name: r.name, method: '', items: r.items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId, grams: i.grams })) })), items, 1, 0); return new Set(c.now.map((x) => x.r.id)); }, [items]);
  const filtering = !!(q.trim() || cat || quick || diets.length || diff || region);
  const list = useMemo(() => filterRecipes(CATALOG, { q, cat, maxMin: quick === 'fast' ? 20 : undefined, diets: [...new Set([...diets, ...(quick ? [] : [])])], diff, region, favs: quick === 'favs' ? favs : null, ids: quick === 'fridge' ? fridge : null }), [q, cat, quick, diets, diff, region, favs, fridge]);
  const recipe = open ? CATALOG.find((r) => r.id === open) : null;
  const toggleDiet = (d: Diet) => setDiets((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  if (recipe) return <Detail key={recipe.id + (params.cook ?? '')} r={recipe} onBack={() => setOpen(null)} autoCook={params.cook === '1'} />;

  const chip = (on: boolean) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? th.accent : th.border, backgroundColor: on ? th.accent + '26' : th.card } as const);
  const rail = (title: string, sub: string | undefined, rs: FullRecipe[], more?: () => void) => rs.length ? (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><View><Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>{sub ? <Text style={{ color: th.muted, fontSize: 12 }}>{sub}</Text> : null}</View>{more ? <Pressable onPress={more} hitSlop={8}><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('Vedi tutte')}</Text></Pressable> : null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{rs.slice(0, MAX_RAIL).map((r) => <RecipeCard key={r.id} r={r} width={196} onPress={() => setOpen(r.id)} fav={favs.includes(r.id)} onFav={() => useRecipes.getState().toggleFav(r.id)} />)}</ScrollView>
    </View>
  ) : null;

  const cur = cooking ? CATALOG.find((r) => r.id === cooking.recipeId) : null;
  return (
    <Page id="recipes" title={tl('Ricette')} back>
      {timers.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10 }}>
          {timers.map((tm) => { const s = secLeft(tm, now); const done = s <= 0; return <View key={tm.id} style={{ backgroundColor: done ? th.danger : th.card, borderRadius: 16, borderWidth: 1, borderColor: done ? th.danger : th.border, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140 }}><Text numberOfLines={1} style={{ color: done ? '#fff' : th.muted, fontSize: 11, fontWeight: '700' }}>{tm.label}</Text><Text style={{ color: done ? '#fff' : th.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{done ? tl('Pronto!') : fmtClock(s)}</Text><Pressable onPress={() => stopTimer(tm.id)} hitSlop={8}><Text style={{ color: done ? '#fff' : th.accent, fontWeight: '800', fontSize: 12 }}>{done ? tl('Ok') : tl('Ferma')}</Text></Pressable></View>; })}
        </ScrollView>
      ) : null}
      {cur ? (
        <Pressable onPress={() => setOpen(cur.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: th.accent + '22', borderColor: th.accent, borderWidth: 1, borderRadius: 18, padding: 14 }}>
          <Icon name="timer" size={22} color={th.accent} /><View style={{ flex: 1 }}><Text style={{ color: th.text, fontWeight: '800' }}>{tl('Stai cucinando')}</Text><Text numberOfLines={1} style={{ color: th.muted, fontSize: 13 }}>{`${cur.name} · ${tl('passaggio {0} di {1}', cooking!.step + 1, cur.steps.length)}`}</Text></View><Text style={{ color: th.accent, fontWeight: '800' }}>{tl('Riprendi')}</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.input, borderWidth: 1, borderColor: th.border, borderRadius: 16, paddingHorizontal: 14 }}>
        <Icon name="search" size={18} color={th.muted} />
        <Input value={q} onChangeText={setQ} placeholder={tl('Cerca una ricetta o un ingrediente')} style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginBottom: 0 }} />
        <Pressable onPress={() => setFOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Filtri')} style={{ padding: 4 }}><Icon name="settings" size={19} color={diets.length || diff || region ? th.accent : th.muted} /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([[null, 'Tutte'], ['fridge', 'Con quello che ho'], ['fast', 'In 20 minuti'], ['favs', 'Preferite']] as const).map(([k, l]) => <Pressable key={l} onPress={() => setQuick(k)} accessibilityRole="button" style={chip(quick === k)}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(l)}</Text></Pressable>)}
        {DIETS.slice(0, 4).map((d) => <Pressable key={d} onPress={() => toggleDiet(d)} accessibilityRole="button" style={chip(diets.includes(d))}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(d.charAt(0).toUpperCase() + d.slice(1))}</Text></Pressable>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {RCATS.map((c) => { const n = CATALOG.filter((r) => r.cat === c).length; if (!n) return null; const on = cat === c; return (
          <Pressable key={c} onPress={() => setCat(on ? null : c)} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <LinearGradient colors={[CAT_COLOR[c] + (on ? 'ff' : 'aa'), CAT_COLOR[c] + (on ? 'cc' : '44')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, minWidth: 104, borderWidth: on ? 2 : 0, borderColor: '#fff' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{tl(c)}</Text><Text style={{ color: '#ffffffd0', fontSize: 12 }}>{tl('{0} ricette', n)}</Text>
            </LinearGradient>
          </Pressable>
        ); })}
      </ScrollView>

      {filtering ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: th.muted, fontSize: 13 }}>{tl('{0} ricette', list.length)}{myDiets.length ? '' : ''}</Text>
          {list.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{list.slice(0, 60).map((r) => <View key={r.id} style={{ width: '47.5%' }}><RecipeCard r={r} onPress={() => setOpen(r.id)} fav={favs.includes(r.id)} onFav={() => useRecipes.getState().toggleFav(r.id)} /></View>)}</View> : <Body muted>{tl('Nessuna ricetta con questi filtri. Prova a toglierne qualcuno.')}</Body>}
          {list.length > 60 ? <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Mostro le prime 60: restringi la ricerca per vedere le altre.')}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 22 }}>
          {rail(tl('Si può fare adesso'), tl('Con quello che hai in frigo'), CATALOG.filter((r) => fridge.has(r.id)), () => setQuick('fridge'))}
          {rail(tl('Preferite'), undefined, CATALOG.filter((r) => favs.includes(r.id)), () => setQuick('favs'))}
          {rail(tl('Pronte in 20 minuti'), undefined, CATALOG.filter((r) => totalMin(r) <= 20 && !r.basic), () => setQuick('fast'))}
          {rail(tl('Classici italiani'), tl('{0} ricette scritte passo passo', WRITTEN_COUNT), CATALOG.filter((r) => !r.basic && r.region), () => setCat(null))}
          {RCATS.map((c) => rail(tl(c), undefined, CATALOG.filter((r) => r.cat === c), () => setCat(c)))}
        </View>
      )}

      <Sheet visible={fOpen} title={tl('Filtri')} onClose={() => setFOpen(false)}>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}><Text style={{ color: th.muted, fontWeight: '800', fontSize: 12 }}>{tl('Difficoltà').toUpperCase()}</Text><View style={{ flexDirection: 'row', gap: 8 }}>{([1, 2, 3] as const).map((d) => <Pressable key={d} onPress={() => setDiff(diff === d ? null : d)} style={chip(diff === d)}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(DIFF_LABEL[d]!)}</Text></Pressable>)}</View></View>
          <View style={{ gap: 8 }}><Text style={{ color: th.muted, fontWeight: '800', fontSize: 12 }}>{tl('Dieta e intolleranze').toUpperCase()}</Text><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{DIETS.map((d) => <Pressable key={d} onPress={() => toggleDiet(d)} style={chip(diets.includes(d))}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(d.charAt(0).toUpperCase() + d.slice(1))}</Text></Pressable>)}</View></View>
          {regions.length ? <View style={{ gap: 8 }}><Text style={{ color: th.muted, fontWeight: '800', fontSize: 12 }}>{tl('Regione').toUpperCase()}</Text><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{regions.map((g) => <Pressable key={g} onPress={() => setRegion(region === g ? null : g)} style={chip(region === g)}><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{g}</Text></Pressable>)}</View></View> : null}
          <Body small muted>{tl('Le diete sono stimate dai nomi degli ingredienti: controlla sempre le etichette se hai un\'allergia.')}</Body>
          <View style={{ flexDirection: 'row', gap: 10 }}><Btn ghost style={{ flex: 1 }} title={tl('Azzera')} onPress={() => { setDiets([]); setDiff(null); setRegion(null); }} /><Btn style={{ flex: 1 }} title={tl('Fatto')} onPress={() => setFOpen(false)} /></View>
        </View>
      </Sheet>
    </Page>
  );
}

/* ------------------------------ scheda ricetta ------------------------------ */
function Detail({ r, onBack, autoCook }: { r: FullRecipe; onBack: () => void; autoCook?: boolean }) {
  const th = useTheme(); const c = CAT_COLOR[r.cat];
  const fav = useRecipes((s) => s.favs.includes(r.id)); const note = useRecipes((s) => s.notes[r.id] ?? ''); const done = useRecipes((s) => s.cooked[r.id]); const myDiets = useRecipes((s) => s.myDiets);
  const cooking = useRecipes((s) => s.cooking);
  const items = usePantry((s) => s.items); const addShop = usePantry((s) => s.addShop);
  const [servings, setServings] = useState(cooking?.recipeId === r.id ? cooking.servings : r.servings);
  const [play, setPlay] = useState(!!autoCook && cooking?.recipeId === r.id);
  const [plan, setPlan] = useState(false); const [eat, setEat] = useState(() => { const d = new Date(Date.now() + (estimateTotalSec(r) + 15 * 60) * 1000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0); return d.getTime(); });
  const nut = nutritionPer(r); const bal = balanceScore(r); const dd = dietsOf(r);
  const st = useMemo(() => recipeStatus({ id: r.id, name: r.name, method: '', items: r.items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId, grams: i.grams })) }, items, servings / r.servings), [r, items, servings]);
  const missingIds = new Set(st.missing.map((m) => m.foodId));
  const conflicts = myDiets.filter((d) => !dd.diets.includes(d));
  const start = () => { useRecipes.getState().startCooking(cooking?.recipeId === r.id ? { ...cooking, servings } : { recipeId: r.id, servings, step: 0, startedAt: Date.now(), checked: [] }); setPlay(true); };
  const toList = () => { st.missing.forEach((m) => addShop(m.name, m.missing, 'g')); toast(st.missing.length ? tl('Aggiunti {0} ingredienti alla lista della spesa', st.missing.length) : tl('Hai già tutto')); };
  const pb = planBackwards(r, eat); const ovenStep = r.steps.findIndex((s) => s.oven);
  const remind = async () => { const ok = await remindPlan(r, eat); toast(ok ? tl('Ti avviso io') : tl('Non posso mandarti la notifica: controlla i permessi.')); setPlan(false); };
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <Page id="recipes" title={tl('Ricetta')} back onBack={onBack}>
      <LinearGradient colors={[c + 'dd', c + '22']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{`${tl(r.cat)}${r.region ? ` · ${r.region}` : ''}`}</Text>
          <Pressable onPress={() => useRecipes.getState().toggleFav(r.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={fav ? tl('Togli dai preferiti') : tl('Aggiungi ai preferiti')}><Icon name="heart" size={24} color="#fff" fill={fav ? '#fff' : 'none'} /></Pressable>
        </View>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.4 }}>{r.name}</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="clock" size={15} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>{fmtMin(totalMin(r))}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dots n={r.diff} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>{tl(DIFF_LABEL[r.diff]!)}</Text></View>
          {done ? <Text style={{ color: '#fff', fontWeight: '700' }}>{tl('Fatta {0} volte', done.n)}</Text> : null}
        </View>
        <Text style={{ color: '#ffffffd0', fontSize: 12 }}>{`${tl('Preparazione')} ${r.prep} min · ${tl('cottura')} ${r.cook} min`}</Text>
      </LinearGradient>
      {r.basic ? <Body small muted>{tl('Per questa ricetta i passaggi sono essenziali: tempi e dosi sono indicativi.')}</Body> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn style={{ flex: 2 }} icon="timer" title={cooking?.recipeId === r.id ? tl('Riprendi a cucinare') : tl('Inizia a cucinare')} onPress={start} />
        <Btn style={{ flex: 1 }} ghost icon="clock" title={tl('A che ora?')} onPress={() => setPlan(true)} />
      </View>

      <View style={{ backgroundColor: th.card, borderRadius: 20, borderWidth: 1, borderColor: th.border, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{tl('Porzioni')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={() => setServings(Math.max(1, servings - 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Meno porzioni')} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={16} color={th.text} stroke={2.4} /></Pressable>
            <Text style={{ color: th.text, fontSize: 20, fontWeight: '800', minWidth: 24, textAlign: 'center' }}>{servings}</Text>
            <Pressable onPress={() => setServings(Math.min(24, servings + 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Più porzioni')} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={th.text} stroke={2.4} /></Pressable>
          </View>
        </View>
        {r.items.map((it, k) => { const nm = itemName(it); const miss = it.foodId ? missingIds.has(it.foodId) : false; return (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: th.border, paddingTop: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !it.foodId ? th.border : miss ? '#e8955f' : '#3fbf8a' }} />
            <Text style={{ flex: 1, color: th.text, fontSize: 15 }}>{nm}{it.note ? <Text style={{ color: th.muted }}>{` · ${it.note}`}</Text> : null}</Text>
            <Text style={{ color: th.muted, fontSize: 14 }}>{it.grams ? prettyAmount(nm, scaleGrams(it.grams, r.servings, servings)) : tl('q.b.')}</Text>
          </View>
        ); })}
        <Text style={{ color: th.muted, fontSize: 12 }}>{items.length ? tl('Verde: ce l\'hai in frigo. Arancione: manca.') : tl('Aggiungi il frigo per vedere cosa ti manca.')}</Text>
        {st.missing.length ? <Btn small ghost icon="orders" title={tl('Metti i mancanti nella spesa ({0})', st.missing.length)} onPress={toList} /> : null}
      </View>

      <View style={{ backgroundColor: th.card, borderRadius: 20, borderWidth: 1, borderColor: th.border, padding: 14, gap: 10 }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{tl('Per porzione')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[[nut.kcal, 'kcal'], [nut.p, tl('proteine')], [nut.c, tl('carbo')], [nut.f, tl('grassi')]].map(([v, l]) => <View key={String(l)} style={{ alignItems: 'center' }}><Text style={{ color: th.text, fontSize: 20, fontWeight: '800' }}>{v}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{l}</Text></View>)}
        </View>
        {bal != null ? <View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: th.text, fontSize: 13, fontWeight: '700' }}>{tl('Equilibrio nutrizionale (stima)')}</Text><Text style={{ color: th.muted, fontSize: 13 }}>{`${bal}/100`}</Text></View><View style={{ height: 6, backgroundColor: th.border, borderRadius: 3, marginTop: 5 }}><View style={{ width: `${bal}%`, height: 6, borderRadius: 3, backgroundColor: bal >= 65 ? '#3fbf8a' : bal >= 45 ? '#e0c97b' : '#e8955f' }} /></View></View> : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{dd.diets.filter((d) => ['vegetariana', 'vegana', 'senza glutine', 'senza lattosio'].includes(d)).map((d) => <View key={d} style={{ backgroundColor: '#3fbf8a22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#3fbf8a', fontSize: 12, fontWeight: '700' }}>{tl(d.charAt(0).toUpperCase() + d.slice(1))}</Text></View>)}</View>
        {dd.contains.length ? <Text style={{ color: th.muted, fontSize: 12 }}>{`${tl('Contiene')}: ${dd.contains.join(', ')}`}</Text> : null}
        {conflicts.length ? <View style={{ backgroundColor: '#e0615f22', borderColor: '#e0615f', borderWidth: 1, borderRadius: 12, padding: 10 }}><Text style={{ color: th.text, fontSize: 13 }}>{tl('Attenzione: non rispetta «{0}».', conflicts.join(', '))}</Text></View> : null}
        <Text style={{ color: th.muted, fontSize: 11 }}>{tl('Valori indicativi, calcolati dagli ingredienti. Non sono un consiglio medico.')}</Text>
      </View>

      <View style={{ backgroundColor: th.card, borderRadius: 20, borderWidth: 1, borderColor: th.border, padding: 14, gap: 12 }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{tl('Preparazione')}</Text>
        {r.tools.length ? <Text style={{ color: th.muted, fontSize: 13 }}>{`${tl('Ti servono')}: ${r.tools.join(', ')}`}</Text> : null}
        {r.steps.map((s, k) => (
          <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c + '33', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>{k + 1}</Text></View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: th.text, fontSize: 15, lineHeight: 22 }}>{s.text}</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {s.oven ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#e8955f22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Icon name="alert" size={12} color="#e8955f" /><Text style={{ color: '#e8955f', fontSize: 12, fontWeight: '800' }}>{`${tl('Forno')} ${s.oven.temp}° ${tl(s.oven.mode)}`}</Text></View> : null}
                {s.timer ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: th.accent + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Icon name="timer" size={12} color={th.accent} /><Text style={{ color: th.accent, fontSize: 12, fontWeight: '800' }}>{fmtMin(Math.round(s.timer.sec / 60))}</Text></View> : null}
              </View>
            </View>
          </View>
        ))}
        {r.tip ? <View style={{ backgroundColor: th.accent + '14', borderRadius: 14, padding: 12 }}><Text style={{ color: th.text, fontSize: 14, lineHeight: 20 }}>{`${tl('Consiglio')}: ${r.tip}`}</Text></View> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{tl('Le tue note')}</Text>
        <Input value={note} onChangeText={(v) => useRecipes.getState().setNote(r.id, v)} multiline placeholder={tl('Cosa cambieresti? Quanto sale hai messo?')} style={{ minHeight: 70 }} />
      </View>

      {play ? <CookMode r={r} onClose={() => setPlay(false)} /> : null}
      <Sheet visible={plan} title={tl('A che ora vuoi mangiare?')} onClose={() => setPlan(false)}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
            <Pressable onPress={() => setEat(eat - 15 * 60000)} hitSlop={10} accessibilityRole="button" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} color={th.text} stroke={2.4} /></Pressable>
            <Text style={{ color: th.text, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{hhmm(eat)}</Text>
            <Pressable onPress={() => setEat(eat + 15 * 60000)} hitSlop={10} accessibilityRole="button" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={th.text} stroke={2.4} /></Pressable>
          </View>
          <Text style={{ color: th.text, fontSize: 16, textAlign: 'center' }}>{tl('Devi iniziare alle {0}', hhmm(pb.start))}</Text>
          {pb.start < Date.now() ? <Text style={{ color: th.danger, textAlign: 'center', fontSize: 13 }}>{tl('È già tardi per quest\'ora: scegli un orario più avanti.')}</Text> : null}
          {ovenStep >= 0 ? <Text style={{ color: th.muted, textAlign: 'center', fontSize: 13 }}>{tl('Accendi il forno alle {0}', hhmm(pb.at[ovenStep]! - ovenLeadMin(r.steps[ovenStep]!.oven!) * 60000))}</Text> : null}
          <Btn title={tl('Ricordamelo')} disabled={pb.start < Date.now()} onPress={() => void remind()} />
        </View>
      </Sheet>
    </Page>
  );
}
