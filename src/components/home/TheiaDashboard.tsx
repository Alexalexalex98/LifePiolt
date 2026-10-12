import { useMemo, useState } from 'react';
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

export function TheiaDashboard({ dash, needs, name, onPlan, onMetric, moodToday }: { dash: Dash; needs: Needs; name: string; onPlan: () => void; onMetric: (id: string) => void; moodToday?: string | null }) {
  const t = useTheme();
  const prefs = useDashPrefs();
  const [custom, setCustom] = useState(false);
  const events = useLife((s) => s.events), tasks = useLife((s) => s.tasks);

  const cands = useMemo(() => [
    ...dash.insights.filter((i) => i.severity !== 'good').map((i) => fromInsight(i, dash.byId, dash.corrs)),
    ...needs.map(fromNeed),
  ], [dash.insights, dash.byId, dash.corrs, needs]);
  const top = useMemo(() => rankCandidates(cands, prefs, 3), [cands, prefs]);

  const today = dayKey();
  const next = useMemo(() => nextEvent(events, new Date()), [events]);
  const eventsToday = (events[today] || []).slice().sort((a, b) => a.time.localeCompare(b.time)).map((e) => ({ time: e.time, title: e.title }));
  const open = tasks.filter((x) => !taskIsDone(x));
  const brief = buildBrief({
    name, hour: new Date().getHours(), eventsToday, nextEvent: next ? { time: next.ev.time, title: next.ev.title, daysAhead: next.daysAhead } : null,
    openTasks: open.length, urgentTasks: open.filter((x) => x.urgent).map((x) => x.t), dataDays: dash.dataDays, hasAnyData: dash.list.length > 0, top, moodToday,
  });

  // andamento: solo con almeno 7 giorni di dati
  const trendIds = ['sleep', 'steps', 'mood'];
  const trends = dash.dataDays >= 7 ? trendIds.map((id) => dash.byId[id]).filter(Boolean).slice(0, 3) : [];
  const upcoming = Object.keys(events).filter((d) => d >= today).sort().flatMap((d) => (events[d] || []).slice().sort((a, b) => a.time.localeCompare(b.time)).map((e) => ({ d, ...e }))).slice(0, 3);
  const dayLabel = (d: string) => (d === today ? 'Oggi' : `${d.slice(8)}/${d.slice(5, 7)}`);

  return (
    <>
      {/* il quadro di oggi */}
      <Card style={{ padding: 18 }}>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="sparkle" size={16} color={t.accent} /><Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Il quadro di oggi</Text></Row>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>{brief.headline}</Text>
        {brief.lines.map((l, i) => <KindRow key={i} kind={l.kind} text={l.text} />)}
        {brief.dataNote ? <Body small color={t.warn} style={{ marginTop: 12 }}>{brief.dataNote}</Body> : null}
        {brief.state === 'tranquillo' ? <Body small muted style={{ marginTop: 10 }}>{calmSuggestion({ nextEvent: next ? { title: next.ev.title, time: next.ev.time, daysAhead: next.daysAhead } : null, eventsToday: eventsToday.length })}</Body> : null}
      </Card>

      {/* cosa merita attenzione */}
      <Row style={{ marginTop: 18, marginBottom: 6 }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>Cosa merita attenzione</Text>
        <Pressable onPress={() => setCustom(true)} accessibilityRole="button" accessibilityLabel="Personalizza le priorità" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="settings" size={15} color={t.muted} /><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>Personalizza</Text></Pressable>
      </Row>
      {top.length === 0 ? (
        <Card><Body muted>{brief.state === 'pochi_dati' ? 'Non c\'è ancora abbastanza per segnalarti qualcosa con sicurezza.' : 'Niente di rilevante da segnalare: sei in linea con i tuoi obiettivi e le tue abitudini.'}</Body></Card>
      ) : top.map((c) => <InsightItem key={c.id} c={c} dash={dash} onMetric={onMetric} />)}

      {/* prossimi impegni e andamento */}
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 6 }}>Prossimi impegni e andamento</Text>
      <Card style={{ padding: 16 }}>
        {upcoming.length === 0 ? <Body muted>Nessun impegno in arrivo.</Body> : upcoming.map((e, i) => (
          <Pressable key={`${e.d}${e.time}${i}`} onPress={() => go('plan')} style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700', width: 78 }}>{dayLabel(e.d)} {e.time}</Text>
            <Body small style={{ flex: 1 }} numberOfLines={1}>{e.title}</Body>
          </Pressable>
        ))}
        <Btn small ghost style={{ marginTop: 8 }} title="Aggiungi un impegno" onPress={onPlan} />
        <View style={{ height: 1, backgroundColor: t.border, marginVertical: 12 }} />
        {trends.length === 0 ? (
          <Body small muted>{dash.list.length ? `Con ${dash.dataDays} ${dash.dataDays === 1 ? 'giorno' : 'giorni'} di dati non mostro andamenti: ne servono almeno 7.` : 'Nessun dato registrato: gli andamenti compariranno qui.'}</Body>
        ) : trends.map((a) => {
          const up = a.slopePctWeek > 1, down = a.slopePctWeek < -1;
          return (
            <Row key={a.def.id} style={{ paddingVertical: 4 }}>
              <Body small style={{ flex: 1 }}>{a.def.label}</Body>
              <Row gap={4}><Icon name={up ? 'trend-up' : down ? 'trend-down' : 'minus'} size={14} color={t.muted} /><Body small muted>{up || down ? `${a.slopePctWeek > 0 ? '+' : ''}${Math.round(a.slopePctWeek)}% a settimana` : 'stabile'}</Body></Row>
            </Row>
          );
        })}
      </Card>
      <PersonalizeSheet visible={custom} onClose={() => setCustom(false)} />
    </>
  );
}
