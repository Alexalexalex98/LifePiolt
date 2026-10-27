import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { go, goBack } from '@/lib/nav';
import { cancel as cancelNotif, scheduleAt } from '@/lib/notify';
import { childrenOf, isLeaf, pathOf, progressOf, subtreeIds, type PNode } from '@/lib/projectTree';
import { elapsedMs, fmtElapsed, isRunning } from '@/lib/taskTimer';
import { estimateMinutes, fmtMin, nudge } from '@/lib/workEstimate';
import { useProjectWork } from '@/store/projectWork';
import { useProjects } from '@/store/projects';
import { toast } from '@/store/toast';

const NOTIF = 'lp-project-work';
const SIZE = 244;
const R = 108;
const C = 2 * Math.PI * R;

/** «Inizia a lavorare»: scegli da quale task cominciare, la stimo e parte il cronometro. Una cosa alla volta, pensato per chi fa fatica a partire (ADHD). */
export default function ProjectWork() {
  const t = useTheme();
  const { root } = useLocalSearchParams<{ root?: string }>();
  const nodes = useProjects((s) => s.nodes);
  const session = useProjectWork((s) => s.session);
  const history = useProjectWork((s) => s.history);
  const doneToday = useProjectWork((s) => s.doneByDay[dayKey()] ?? 0);
  const W = useProjectWork.getState;
  const rootId = session?.rootId ?? root ?? null;
  const rootNode = nodes.find((n) => n.id === rootId);
  const [now, setNow] = useState(Date.now());
  const running = isRunning(session?.timer);
  useEffect(() => { if (!running) return; const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, [running]);

  /* le task aperte del progetto, in ordine, raggruppate per sotto-progetto */
  const groups = useMemo(() => {
    if (!rootNode) return [] as { title: string; items: PNode[] }[];
    const ids = new Set(subtreeIds(nodes, rootNode.id));
    const leaves = nodes.filter((n) => ids.has(n.id) && n.id !== rootNode.id && isLeaf(nodes, n.id) && !n.done);
    const subs = childrenOf(nodes, rootNode.id);
    const out: { title: string; items: PNode[] }[] = [];
    for (const s of subs) {
      const sub = new Set(subtreeIds(nodes, s.id));
      const items = leaves.filter((l) => sub.has(l.id));
      if (items.length) out.push({ title: s.title, items });
    }
    const direct = leaves.filter((l) => l.parent === rootNode.id);
    if (direct.length) out.unshift({ title: rootNode.title, items: direct });
    return out;
  }, [nodes, rootNode]);
  const first = groups[0]?.items[0];

  /* avviso quando scade il tempo stimato (anche a schermo spento) */
  useEffect(() => {
    if (!session) { void cancelNotif(NOTIF); return; }
    if (running) {
      const left = session.est * 60000 - elapsedMs(session.timer, Date.now());
      if (left > 0) void scheduleAt(NOTIF, new Date(Date.now() + left), tl('Tempo stimato finito'), `${session.title}: ${tl('hai ancora energia? Aggiungi 5 minuti o segna fatto.')}`);
    } else void cancelNotif(NOTIF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, session?.nodeId, session?.est]);

  const begin = (n: PNode) => {
    if (!rootNode) return;
    W().start({ rootId: rootNode.id, nodeId: n.id, title: n.title, est: estimateMinutes(n.title, history) });
    setNow(Date.now());
  };

  if (!rootNode) {
    return <Page id="projectWork" back title={tl('Inizia a lavorare')}><Empty text={tl('Scegli un progetto da Progetti e tocca «Inizia a lavorare».')} /><Btn style={{ marginTop: 12 }} title={tl('Apri Progetti')} onPress={() => go('projects')} /></Page>;
  }

  /* ---- lavoro in corso ---- */
  if (session) {
    const el = elapsedMs(session.timer, now);
    const estMs = session.est * 60000;
    const ratio = el / Math.max(1, estMs);
    const left = estMs - el;
    const over = left < 0;
    const col = over ? t.warn : ratio > 0.85 ? t.warn : t.accent;
    const path = pathOf(nodes, session.nodeId).slice(1, -1);
    const next = groups.flatMap((g) => g.items).find((n) => n.id !== session.nodeId);
    const finish = () => {
      const min = W().finish();
      useProjects.getState().toggle(session.nodeId);
      void cancelNotif(NOTIF);
      toast(tl('Fatto in {0} min: bravo!', min));
    };
    const stop = () => { W().cancel(); void cancelNotif(NOTIF); };
    return (
      <Page id="projectWork" back title={tl('Sto lavorando')}>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{path.length ? path.join(' › ') : rootNode.title}</Text>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', marginTop: 6 }}>{session.title}</Text>

        <View style={{ alignItems: 'center', marginVertical: 22 }}>
          <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${fmtElapsed(el)}. ${over ? tl('Oltre la stima') : tl('Restano {0}', fmtElapsed(left))}`}>
            <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.chip} strokeWidth={14} fill="none" />
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={col} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={C * Math.min(1, Math.max(0, ratio))} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} opacity={running ? 1 : 0.55} />
            </Svg>
            <Text style={{ color: t.text, fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{fmtElapsed(el)}</Text>
            <Text style={{ color: over ? t.warn : t.muted, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{over ? tl('+{0} oltre la stima', fmtElapsed(-left)) : tl('restano {0}', fmtElapsed(left))}</Text>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{tl('stima {0}', fmtMin(session.est))}</Text>
          </View>
        </View>

        <Card>
          <Body style={{ textAlign: 'center' }}>{tl(nudge(ratio, running))}</Body>
        </Card>

        <Btn style={{ marginTop: 14 }} icon="check" title={tl('Fatto')} onPress={finish} />
        <Row style={{ marginTop: 10 }} gap={8}>
          <View style={{ flex: 1 }}><Btn ghost title={running ? tl('Pausa') : tl('Riprendi')} onPress={() => (running ? W().pause() : W().resume())} /></View>
          <View style={{ flex: 1 }}><Btn ghost title={tl('+5 min')} onPress={() => W().addMinutes(5)} /></View>
          <View style={{ flex: 1 }}><Btn ghost title={tl('−5 min')} onPress={() => W().addMinutes(-5)} /></View>
        </Row>
        <Row style={{ marginTop: 10 }} gap={8}>
          <View style={{ flex: 1 }}><Btn small ghost title={tl('Cambia task')} onPress={stop} /></View>
          {next ? <View style={{ flex: 1 }}><Btn small ghost title={tl('Salta')} onPress={() => { stop(); begin(next); }} /></View> : null}
        </Row>
        <Body small muted style={{ textAlign: 'center', marginTop: 16 }}>{doneToday ? tl('Oggi hai finito {0} task con «Inizia a lavorare». Continua così.', doneToday) : tl('Una cosa alla volta: quando finisci la prima, ti propongo la prossima.')}</Body>
        {next ? <Body small muted style={{ textAlign: 'center', marginTop: 4 }}>{tl('Dopo: {0} (~{1})', next.title, fmtMin(estimateMinutes(next.title, history)))}</Body> : null}
      </Page>
    );
  }

  /* ---- scelta della task da cui iniziare ---- */
  const pr = progressOf(nodes, rootNode.id);
  return (
    <Page id="projectWork" back title={tl('Inizia a lavorare')}>
      <H>{rootNode.title}</H>
      <Body small muted style={{ marginTop: 2 }}>{tl('{0} task fatte su {1}', pr.done, pr.total)}</Body>
      {!first ? (
        <Card><Empty text={tl('Non ci sono task aperte: il progetto è completo.')} /><Btn style={{ marginTop: 10 }} title={tl('Torna ai progetti')} onPress={() => goBack()} /></Card>
      ) : (
        <>
          <Card accent={t.accent}>
            <Body small muted>{tl('Ti consiglio di partire da')}</Body>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{first.title}</Text>
            <Body small muted style={{ marginTop: 4 }}>{tl('Stimo circa {0}. Parte subito il cronometro.', fmtMin(estimateMinutes(first.title, history)))}</Body>
            <Btn style={{ marginTop: 10 }} icon="play" title={tl('Inizia da questa')} onPress={() => begin(first)} />
          </Card>
          <Body bold style={{ marginTop: 16, marginBottom: 6 }}>{tl('Oppure scegli tu da dove iniziare')}</Body>
          {groups.map((g) => (
            <Card key={g.title}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>{g.title}</Text>
              {g.items.map((n, i) => (
                <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.title}, ${fmtMin(estimateMinutes(n.title, history))}`} onPress={() => begin(n)} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                  <Row><Body style={{ flex: 1 }}>{n.title}</Body><Pill label={`~${fmtMin(estimateMinutes(n.title, history))}`} /></Row>
                </Pressable>
              ))}
            </Card>
          ))}
        </>
      )}
      <Body small muted style={{ marginTop: 10 }}>{tl('Il tempo è una stima dal testo della task e da quanto ci hai messo in passato: lo puoi cambiare mentre lavori.')}</Body>
    </Page>
  );
}
