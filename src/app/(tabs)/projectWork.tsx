import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/T';
import { InfoTip } from '@/components/InfoTip';
import { Icon, areaColors } from '@/lib/icons';
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
    const area = areaColors.lifetask ?? t.accent;
    const col = over || ratio > 0.85 ? t.warn : area;
    const path = pathOf(nodes, session.nodeId).slice(1, -1);
    const next = groups.flatMap((g) => g.items).find((n) => n.id !== session.nodeId);
    const pr = progressOf(nodes, rootNode.id);
    const finish = () => {
      const min = W().finish();
      useProjects.getState().toggle(session.nodeId);
      void cancelNotif(NOTIF);
      toast(tl('Fatto in {0} min: bravo!', min));
    };
    const stop = () => { W().cancel(); void cancelNotif(NOTIF); };
    const frac = Math.min(1, Math.max(0, ratio));
    const ang = -Math.PI / 2 + 2 * Math.PI * frac;
    const dot = { x: SIZE / 2 + R * Math.cos(ang), y: SIZE / 2 + R * Math.sin(ang) };
    const Round = ({ icon, label, onPress, big, filled }: { icon: string; label: string; onPress: () => void; big?: boolean; filled?: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
        style={{ width: big ? 78 : 52, height: big ? 78 : 52, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? col : t.card, borderWidth: filled ? 0 : 1, borderColor: t.border }}>
        <Icon name={icon} size={big ? 32 : 22} color={filled ? t.bg : t.text} stroke={2.2} />
      </Pressable>
    );
    return (
      <Page id="projectWork" back title={tl('Sto lavorando')}>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          <Pill label={rootNode.title} on color={area} />
          <Pill label={tl('{0} di {1} task', pr.done, pr.total)} />
          {doneToday ? <Pill label={tl('Oggi: {0} fatte', doneToday)} /> : null}
        </Row>

        <Card accent={area} style={{ marginTop: 12 }}>
          <Text style={{ color: area, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{tl('Adesso').toUpperCase()}</Text>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{session.title}</Text>
          {path.length ? <Body small muted style={{ marginTop: 4 }}>{path.join(' › ')}</Body> : null}
        </Card>

        <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
          <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`${fmtElapsed(el)}. ${over ? tl('Oltre la stima') : tl('Restano {0}', fmtElapsed(left))}`}>
            <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={col} strokeOpacity={0.12} strokeWidth={26} fill="none" />
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.chip} strokeWidth={10} fill="none" />
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={col} strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} opacity={running ? 1 : 0.5} />
              {frac > 0.01 ? <Circle cx={dot.x} cy={dot.y} r={9} fill={col} stroke={t.bg} strokeWidth={3} opacity={running ? 1 : 0.6} /> : null}
            </Svg>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{running ? tl('IN CORSO') : tl('IN PAUSA')}</Text>
            <Text style={{ color: t.text, fontSize: 54, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: 2 }}>{fmtElapsed(el)}</Text>
            <View style={{ backgroundColor: col + '22', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: col, fontSize: 14, fontWeight: '800' }}>{over ? tl('+{0} oltre la stima', fmtElapsed(-left)) : tl('restano {0}', fmtElapsed(left))}</Text>
            </View>
          </View>
        </View>

        <Row style={{ justifyContent: 'center', alignItems: 'center' }} gap={10}>
          <Pill label="−5" onPress={() => W().addMinutes(-5)} />
          <Row gap={4} style={{ alignItems: 'center' }}>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>{tl('stima {0}', fmtMin(session.est))}</Text>
            <InfoTip title={tl('Come stimo il tempo')} body={tl('Il tempo è una stima dal testo della task e da quanto ci hai messo in passato: lo puoi cambiare mentre lavori.')} size={16} />
          </Row>
          <Pill label="+5" onPress={() => W().addMinutes(5)} />
        </Row>

        <Row style={{ justifyContent: 'space-evenly', alignItems: 'center', marginTop: 18 }}>
          <Round icon="rotate" label={tl('Cambia task')} onPress={stop} />
          <Round big filled icon={running ? 'pause' : 'play'} label={running ? tl('Pausa') : tl('Riprendi')} onPress={() => (running ? W().pause() : W().resume())} />
          {next ? <Round icon="forward" label={tl('Salta')} onPress={() => { stop(); begin(next); }} /> : <View style={{ width: 52 }} />}
        </Row>

        <Btn style={{ marginTop: 18 }} icon="check" title={tl('Fatto')} onPress={finish} />

        <Card style={{ marginTop: 14 }}>
          <Row style={{ alignItems: 'flex-start' }} gap={10}>
            <Icon name="sparkle" size={18} color={area} />
            <Body style={{ flex: 1 }}>{tl(nudge(ratio, running))}</Body>
          </Row>
        </Card>

        {next ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Salta a {0}', next.title)} onPress={() => { stop(); begin(next); }}>
            <Card style={{ marginTop: 4 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{tl('Dopo').toUpperCase()}</Text>
                  <Body numberOfLines={2} style={{ marginTop: 2 }}>{next.title}</Body>
                </View>
                <Pill label={`~${fmtMin(estimateMinutes(next.title, history))}`} />
                <Icon name="chevron" size={16} color={t.muted} />
              </Row>
            </Card>
          </Pressable>
        ) : null}
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
