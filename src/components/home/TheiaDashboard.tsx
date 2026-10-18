import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { askTheiaAbout } from '@/store/theia';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { fromInsight, fromNeed } from '@/lib/dashCandidates';
import { buildBrief, calmSuggestion, interestWeights, rankCandidates, TOPICS, TOPIC_LABEL, type Candidate, type DashPrefs, type Topic } from '@/lib/dashBrief';
import { nextEvent } from '@/lib/homeNext';
import type { useDashboard } from '@/lib/analyticsData';
import type { useNeeds } from '@/components/home/HomeBlocks';
import { dayKey, } from '@/lib/format';
import { useInterests } from '@/store/interests';
import { useLife, taskIsDone } from '@/store/life';
import { useNet } from '@/store/network';
import { holdings, useFin } from '@/store/finance';
import { useApp } from '@/store/app';
import { donationStreak } from '@/lib/network';
import { rankMixed } from '@/lib/relevance';
import { ActionsCard, DayPlanSheet, animateLayout, useDayPlan, type PlanData } from '@/components/home/DayPlan';
import { totalUnread } from '@/store/chat';
import { useFitness } from '@/store/fitness';
import { dailyTarget } from '@/lib/fitness/nutrition';
import { buildSections, type SectionRow, type Tone } from '@/lib/dashSections';
import { translateText } from '@/i18n/core';
import { showUndoToast, toast } from '@/store/toast';

type Dash = ReturnType<typeof useDashboard>;
type Needs = ReturnType<typeof useNeeds>;

const KIND: Record<'fact' | 'reading' | 'suggestion', { label: string; icon: string }> = {
  fact: { label: 'Fatto', icon: 'check' }, reading: { label: 'Possibile lettura', icon: 'search' }, suggestion: { label: 'Suggerimento', icon: 'sparkle' },
};

function useDashPrefs(): DashPrefs {
  const dash = useInterests((s) => s.dash), areas = useInterests((s) => s.areas), selected = useInterests((s) => s.selected), custom = useInterests((s) => s.custom);
  const themes = useNet((s) => s.themeWeights);
  const day = dayKey();
  return useMemo(() => ({
    now: Date.now(), muted: dash?.muted ?? [], snoozed: dash?.snoozed ?? {}, feedback: dash?.feedback ?? {},
    interest: interestWeights({ areas, interests: [...selected.map(String), ...custom.map((c) => c.label)], themes: (themes ?? {}) as Partial<Record<string, number>> }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dash, areas, selected, custom, themes, day]);
}

/** Etichetta di tipo (Fatto / Possibile lettura / Suggerimento) con stile diverso per ciascuno. */
function KindRow({ kind, text }: { kind: 'fact' | 'reading' | 'suggestion'; text: string }) {
  const t = useTheme();
  const c = kind === 'fact' ? t.muted : kind === 'reading' ? t.warn : t.accent;
  return (
    <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: c }} />
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'flex-start' }} gap={5}><Icon name={KIND[kind].icon} size={12} color={c} stroke={2.4} /><Text style={{ color: c, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{KIND[kind].label}</Text></Row>
        <Body small style={{ marginTop: 2 }} {...(kind === 'reading' ? { muted: true } : {})}>{text}</Body>
      </View>
    </View>
  );
}

function InsightItem({ c, dash, onMetric }: { c: Candidate; dash: Dash; onMetric: (id: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const st = useInterests.getState;
  const lvl = c.reliability?.level;
  const lc = lvl === 'alta' ? t.positive : lvl === 'media' ? t.warn : t.muted;
  const follow = () => {
    st().dashFollow(c.topic);
    const f = c.follow;
    if ('metricId' in f) { if (dash.byId[f.metricId]) onMetric(f.metricId); else go('lifehealth'); }
    else if ('ask' in f) askTheiaAbout({ source: 'home' });
    else go(f.page, f.params);
  };
  const snooze = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(5, 0, 0, 0); st().dashSnooze(c.id, d.getTime()); toast('Te lo riproporrò domani'); };
  const remove = () => {
    st().dashIrrelevant(c.id, c.topic, c.sub);
    showUndoToast(`Non vedrai più così spesso: ${TOPIC_LABEL[c.topic]}`, () => { st().dashUnmute(c.id); st().dashUnmute(`sub:${c.topic}:${c.sub ?? ''}`); });
  };
  const sev = c.severity === 'bad' ? t.danger : c.severity === 'warn' ? t.warn : c.severity === 'good' ? t.positive : t.accent;
  if (!expanded) {
    return (
      <Card style={{ padding: 14 }} onPress={() => setExpanded(true)}>
        <Row gap={10}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: sev }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>{TOPIC_LABEL[c.topic]} · {c.period}</Text>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>{c.observed}</Text>
          </View>
          <Icon name="arrow-down" size={16} color={t.muted} />
        </Row>
      </Card>
    );
  }
  return (
    <Card style={{ padding: 16 }}>
      <Row style={{ justifyContent: 'flex-start' }} gap={8}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sev }} />
        <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', flex: 1 }}>{TOPIC_LABEL[c.topic]} · {c.period}</Text>
        {lvl ? <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: lc + '22' }}><Text style={{ color: lc, fontSize: 11, fontWeight: '700' }}>{`Affidabilità ${lvl}`}</Text></View> : null}
      </Row>
      <KindRow kind="fact" text={c.observed} />
      {c.reading ? <KindRow kind="reading" text={c.reading} /> : null}
      {c.suggestion ? <KindRow kind="suggestion" text={c.suggestion} /> : null}
      <Body small muted style={{ marginTop: 10 }}>Perché lo vedi ora: {c.whyNow}</Body>
      {open && (
        <View style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: t.tile }}>
          {c.detail ? <Body small>{c.detail}</Body> : null}
          {c.reliability ? <Body small muted style={{ marginTop: c.detail ? 6 : 0 }}>Affidabilità {c.reliability.level}: {c.reliability.why}.</Body> : <Body small muted>È un dato certo, non una stima.</Body>}
        </View>
      )}
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 14 }}>Le tue opzioni</Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Btn title={c.followLabel} onPress={follow} />
        <Row gap={8}>
          <Btn small ghost style={{ flex: 1 }} title="Rimanda a domani" onPress={snooze} />
          <Btn small ghost style={{ flex: 1 }} title={open ? 'Meno dettagli' : 'Maggiori dettagli'} onPress={() => setOpen(!open)} />
        </Row>
        <Row><Pressable onPress={() => setExpanded(false)} accessibilityRole="button" style={{ paddingVertical: 4 }}><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>Riduci</Text></Pressable></Row>
        <Pressable onPress={remove} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 4 }}><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>Non mi interessa</Text></Pressable>
      </View>
    </Card>
  );
}

/** Foglio "Personalizza": argomenti attivi/ridotti, elementi tolti da rimettere, azzeramento della memoria. */
function PersonalizeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const dash = useInterests((s) => s.dash);
  const muted = dash?.muted ?? [];
  const st = useInterests.getState;
  const toggleTopic = (tp: Topic) => { const k = `topic:${tp}`; if (muted.includes(k)) st().dashUnmute(k); else st().dashIrrelevant(k, tp); };
  const items = muted.filter((m) => !m.startsWith('topic:'));
  const label = (m: string) => (m.startsWith('sub:') ? `${TOPIC_LABEL[m.split(':')[1] as Topic] ?? 'Altro'} · ${m.split(':')[2]}` : m.replace(/^need-/, ''));
  return (
    <Sheet visible={visible} title="Personalizza le priorità" onClose={onClose}>
      <Body small muted style={{ marginBottom: 10 }}>La Dashboard cambia ogni giorno in base ai tuoi interessi e a ciò che è urgente. Scegli di cosa vuoi sentir parlare. Le scadenze imminenti restano sempre visibili.</Body>
      {TOPICS.map((tp) => {
        const off = muted.includes(`topic:${tp}`);
        return (
          <Pressable key={tp} onPress={() => toggleTopic(tp)} accessibilityRole="switch" accessibilityState={{ checked: !off }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <Body style={{ flex: 1 }}>{TOPIC_LABEL[tp]}</Body>
            <Text style={{ color: off ? t.muted : t.accent, fontWeight: '700', fontSize: 13 }}>{off ? 'Nascosto' : 'Mostrato'}</Text>
          </Pressable>
        );
      })}
      {items.length > 0 && (
        <>
          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 16, marginBottom: 4 }}>Cose che hai tolto</Text>
          {items.map((m) => (
            <Row key={m} style={{ paddingVertical: 8 }}>
              <Body small style={{ flex: 1 }}>{label(m)}</Body>
              <Btn small ghost title="Rimetti" onPress={() => st().dashUnmute(m)} />
            </Row>
          ))}
        </>
      )}
      <Btn ghost style={{ marginTop: 16 }} title="Azzera ciò che ho tolto" onPress={() => { st().dashResetMemory(); toast('Memoria azzerata'); }} />
    </Sheet>
  );
}

const TONE_COLOR = (t: ReturnType<typeof useTheme>, tone: Tone) => (tone === 'good' ? t.positive : tone === 'warn' ? t.warn : tone === 'bad' ? t.danger : tone === 'neutral' ? t.accent : t.border);

/** Una riga a colpo d'occhio: pallino di stato, titolo, dato e dettaglio. Si tocca per entrare. */
function SectionLine({ r, last }: { r: SectionRow; last: boolean }) {
  const t = useTheme();
  const c = TONE_COLOR(t, r.tone);
  return (
    <Pressable onPress={() => go(r.page, r.params)} accessibilityRole="button" accessibilityLabel={`${translateText(r.title)}: ${r.headline}${r.detail ? `, ${r.detail}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={19} color={r.tone === 'none' ? t.muted : c} stroke={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{translateText(r.title)}</Text>
        <Text style={{ color: r.tone === 'none' ? t.muted : t.text, fontSize: 17, fontWeight: '800', marginTop: 1 }} numberOfLines={1}>{r.headline}</Text>
        {r.detail ? <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>{r.detail}</Text> : null}
      </View>
      <Icon name="arrow-right" size={16} color={t.muted} />
    </Pressable>
  );
}

export function TheiaDashboard({ dash, needs, name, onPlan, onMetric, moodToday }: { dash: Dash; needs: Needs; name: string; onPlan: () => void; onMetric: (id: string) => void; moodToday?: string | null }) {
  const t = useTheme();
  const prefs = useDashPrefs();
  const me = useApp((s) => s.account.name);
  const [custom, setCustom] = useState(false);
  const [day, setDay] = useState(false);
  const events = useLife((s) => s.events), tasks = useLife((s) => s.tasks);
  const net = useNet();
  const fin = useFin();
  void onPlan;

  const cands = useMemo(() => [
    ...dash.insights.filter((i) => i.severity !== 'good').map((i) => fromInsight(i, dash.byId, dash.corrs)),
    ...needs.map(fromNeed),
  ], [dash.insights, dash.byId, dash.corrs, needs]);
  const top = useMemo(() => rankCandidates(cands, prefs, 2), [cands, prefs]);

  const today = dayKey();
  const next = useMemo(() => nextEvent(events, new Date()), [events]);
  const eventsToday = (events[today] || []).slice().sort((a, b) => a.time.localeCompare(b.time)).map((e) => ({ time: e.time, title: e.title }));
  const open = tasks.filter((x) => !taskIsDone(x));
  const brief = buildBrief({
    name, hour: new Date().getHours(), eventsToday, nextEvent: next ? { time: next.ev.time, title: next.ev.title, daysAhead: next.daysAhead } : null,
    openTasks: open.length, urgentTasks: open.filter((x) => x.urgent).map((x) => x.t), dataDays: dash.dataDays, hasAnyData: dash.list.length > 0, top, moodToday,
  });

  // contenuti che potrebbero interessarti: seminari, servizi, prodotti e post, ordinati dai tuoi interessi (stesso criterio del Marketplace)
  const weights = useNet((s) => s.themeWeights);
  const forYou = useMemo(() => {
    type Pick = { id: string; kind: string; text: string; title: string; sub?: string; icon: string; page: string; params?: Record<string, string> };
    const now = Date.now();
    const items: Pick[] = [
      ...net.seminars.filter((x) => x.host !== me && (x.startsAt ?? now + 1) > now).map((x): Pick => ({ id: `s${x.id}`, kind: 'Seminario', text: `${x.title} ${x.desc ?? ''}`, title: x.title, sub: `di ${x.host}`, icon: 'award', page: 'seminarPage', params: { id: String(x.id) } })),
      ...net.providers.filter((x) => x.name !== me).map((x): Pick => ({ id: `p${x.name}`, kind: 'Servizio', text: `${x.role} ${x.name}`, title: x.role, sub: `con ${x.name}`, icon: 'users', page: 'servicePage', params: { name: x.name } })),
      ...(net.products ?? []).filter((x) => x.shop !== me).map((x): Pick => ({ id: `pr${x.id}`, kind: 'Prodotto', text: `${x.name} ${x.desc}`, title: x.name, sub: `${x.price} LP · negozio di ${x.shop}`, icon: 'coin', page: 'shopPage', params: { name: x.shop } })),
      ...net.posts.filter((x) => x.author !== me).slice(0, 12).map((x): Pick => ({ id: `po${x.id}`, kind: 'Post', text: x.text, title: x.text.length > 70 ? x.text.slice(0, 69) + '…' : x.text, sub: `di ${x.author}`, icon: 'comment', page: 'postPage', params: { key: `standalone:${x.id}` } })),
    ];
    const ranked = rankMixed(items, weights);
    // al massimo uno per tipo, finché ci sono tipi diversi
    const out: Pick[] = []; const kinds = new Set<string>();
    for (const x of ranked) { if (out.length >= 3) break; if (!kinds.has(x.kind)) { out.push(x); kinds.add(x.kind); } }
    for (const x of ranked) { if (out.length >= 3) break; if (!out.includes(x)) out.push(x); }
    return out;
  }, [net.seminars, net.providers, net.products, net.posts, weights, me]);

  // il piano di oggi: impegni, task, benessere (acqua, passi, scale, pause), soldi e messaggi
  const pd = useMemo<PlanData>(() => {
    const sa = dash.byId['steps'], sl = dash.byId['sleep'], mi = dash.byId['mindful'];
    const todayD = new Date(); const t0 = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate()).getTime();
    const bills = fin.invoices.filter((x) => x.state !== 'paid' && x.dueDate).map((x) => ({ name: x.issuer, days: Math.round((new Date(x.dueDate + 'T00:00:00').getTime() - t0) / 86400000) })).filter((b) => b.days <= 5);
    return { hour: todayD.getHours(), events: eventsToday, todayKey: today, steps: sa ? Math.round(sa.latest.v) : null, stepsGoal: 8000, sleepHours: sl ? sl.latest.v : null, mindfulMin: mi ? mi.latest.v : null, unreadMessages: totalUnread(me), bills };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash.byId, fin.invoices, eventsToday.length, today, me]);
  const { plan, complete } = useDayPlan(pd);

  const fitMeals = useFitness((s) => s.meals), fitBody = useFitness((s) => s.body);
  const rows = useMemo(() => {
    const booked = net.seminars.filter((s) => s.host === me).map((s) => ({ title: s.title, count: (net.participants?.[`seminar:${s.id}`] ?? []).length, startsAt: s.startsAt ?? 0 }))
      .concat((net.participants?.[`service:${me}`] ? [{ title: 'Le tue sedute', count: net.participants[`service:${me}`].length, startsAt: Date.now() + 1 }] : []));
    let cc = 0; let last: { author: string; text: string } | undefined;
    for (const p of net.posts.filter((x) => x.author === me)) { const list = net.comments['standalone:' + p.id] ?? []; cc += list.length; if (list.length) last = list[list.length - 1]; }
    const hold = holdings(fin.stocks);
    const value = hold.reduce((s, x) => s + x.shares * x.price, 0), invested = hold.reduce((s, x) => s + x.shares * x.avgCost, 0);
    const dayAbs = hold.reduce((s, x) => s + x.shares * x.changeAbs, 0);
    const built = buildSections({
      next: next ? { title: next.ev.title, time: next.ev.time, daysAhead: next.daysAhead } : null, booked, comments: { count: cc, last },
      invest: { hasHoldings: hold.length > 0, dayPct: value - dayAbs > 0 ? (dayAbs / (value - dayAbs)) * 100 : 0, totalPct: invested ? ((value - invested) / invested) * 100 : 0 },
      nutrition: (() => { const ms = fitMeals.filter((m) => new Date(m.ts).toDateString() === new Date().toDateString()); return { eaten: Math.round(ms.reduce((a, m) => a + m.macros.kcal, 0)), target: fitBody ? dailyTarget(fitBody) : null, meals: ms.length }; })(),
      streak: donationStreak(), scores: dash.scores, tasks: { open: open.length, urgent: open.filter((x) => x.urgent).length }, lifePoints: net.lifePoints, now: Date.now(),
    });
    const rank: Record<string, number> = { bad: 0, warn: 1, good: 2, neutral: 3, none: 4 };
    return built.map((r, k) => ({ r, k })).sort((a, b) => (rank[a.r.tone] - rank[b.r.tone]) || (a.k - b.k)).map((x) => x.r);
  }, [net.seminars, net.participants, net.posts, net.comments, net.lifePoints, fin.stocks, dash.scores, open.length, next, me, fitMeals, fitBody]);

  // quando una sezione cambia stato le righe si riassettano con un'animazione breve
  const rowSig = rows.map((r) => r.id + r.tone).join('|');
  const lastSig = useRef(rowSig);
  useEffect(() => { if (lastSig.current !== rowSig) { animateLayout(); lastSig.current = rowSig; } }, [rowSig]);

  return (
    <>
      <Card style={{ padding: 16 }} onPress={() => setDay(true)}>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="sparkle" size={15} color={t.accent} /><Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}>Il quadro di oggi</Text><Text style={{ color: t.accent, fontSize: 12.5, fontWeight: '700' }}>Apri</Text></Row>
        <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', marginTop: 6 }}>{brief.headline}</Text>
        {brief.dataNote ? <Body small color={t.warn} style={{ marginTop: 6 }}>{brief.dataNote}</Body> : null}
      </Card>

      <ActionsCard plan={plan} onDone={complete} />

      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 6 }}>Le tue sezioni</Text>
      <Card style={{ paddingVertical: 4 }}>
        {rows.map((r, i) => <SectionLine key={r.id} r={r} last={i === rows.length - 1} />)}
      </Card>

      {forYou.length > 0 && (
        <>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 6 }}>Per te</Text>
          <Card style={{ paddingVertical: 4 }}>
            {forYou.map((x, i) => (
              <Pressable key={x.id} onPress={() => go(x.page, x.params)} accessibilityRole="button" accessibilityLabel={`${x.kind}: ${x.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === forYou.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={19} color={t.accent} stroke={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>{x.kind}</Text>
                  <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }} numberOfLines={2}>{x.title}</Text>
                  {x.sub ? <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={1}>{x.sub}</Text> : null}
                </View>
                <Icon name="arrow-right" size={16} color={t.muted} />
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <Row style={{ marginTop: 18, marginBottom: 6 }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>Da guardare</Text>
        <Pressable onPress={() => setCustom(true)} accessibilityRole="button" accessibilityLabel="Personalizza le priorità" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="settings" size={15} color={t.muted} /><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>Personalizza</Text></Pressable>
      </Row>
      {top.length === 0 ? (
        <Card><Body muted>{brief.state === 'pochi_dati' ? 'Non c\'è ancora abbastanza per segnalarti qualcosa con sicurezza.' : 'Niente di particolare: sei in linea con i tuoi obiettivi.'}</Body></Card>
      ) : top.map((c) => <InsightItem key={c.id} c={c} dash={dash} onMetric={onMetric} />)}
      <PersonalizeSheet visible={custom} onClose={() => setCustom(false)} />
      <DayPlanSheet visible={day} onClose={() => setDay(false)} plan={plan} onDone={complete} name={name} />
    </>
  );
}
