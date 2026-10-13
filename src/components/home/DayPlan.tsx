import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { buildPlan, KIND_LABEL, KIND_ORDER, planSummary, topActions, type PlanItem } from '@/lib/dashPlan';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useInterests } from '@/store/interests';
import { useLife } from '@/store/life';
import { showUndoToast } from '@/store/toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch { /* facoltativo */ } }
/** Le voci si spostano con un'animazione breve quando cambia l'ordine o ne esce una. */
export const animateLayout = () => { try { LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)); } catch { /* facoltativo */ } };

export type PlanData = { hour: number; events: { time: string; title: string }[]; steps?: number | null; stepsGoal?: number; sleepHours?: number | null; mindfulMin?: number | null; unreadMessages?: number; bills?: { name: string; days: number }[]; todayKey: string };

/** Il piano di oggi, sempre aggiornato: task aperti + benessere + impegni + soldi, con le voci già fatte tolte. */
export function useDayPlan(d: PlanData): { plan: PlanItem[]; complete: (x: PlanItem) => void } {
  const tasks = useLife((s) => s.tasks);
  const doneState = useInterests((s) => s.dayDone);
  const done = doneState?.day === d.todayKey ? doneState.ids : [];
  const plan = useMemo(() => buildPlan({ ...d, tasks: tasks.map((t) => ({ id: t.id, t: t.t, urgent: t.urgent, due: t.due, done: !!(t.subtasks?.length ? t.subtasks.every((x) => x.done) : t.done) })), done }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, done.join('|'), d.hour, d.steps, d.sleepHours, d.mindfulMin, d.unreadMessages, d.todayKey, d.events.length, (d.bills ?? []).length]);
  const complete = (x: PlanItem) => {
    animateLayout();
    if (x.taskId) { useLife.getState().toggleTask(x.taskId, true); showUndoToast('Task completato', () => { animateLayout(); useLife.getState().toggleTask(x.taskId!, false); }); }
    else if (x.id.startsWith('well:')) { const id = x.id.slice(5); useInterests.getState().markDayDone(d.todayKey, id); showUndoToast('Fatto', () => { animateLayout(); useInterests.getState().markDayDone(d.todayKey, id, false); }); }
  };
  return { plan, complete };
}

const kindColor = (t: ReturnType<typeof useTheme>, k: PlanItem['kind']) => (k === 'task' ? t.accent : k === 'benessere' ? t.positive : k === 'soldi' ? t.warn : k === 'persone' ? t.accent : t.muted);

export function PlanRow({ x, onDone, last }: { x: PlanItem; onDone: (x: PlanItem) => void; last: boolean }) {
  const t = useTheme();
  const c = kindColor(t, x.kind);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border }}>
      {x.checkable ? (
        <Pressable onPress={() => onDone(x)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Segna fatto: ${x.text}`} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c, alignItems: 'center', justifyContent: 'center' }} />
      ) : <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.kind === 'evento' ? 'calendar' : x.kind === 'soldi' ? 'coin' : 'comment'} size={14} color={c} /></View>}
      <Pressable style={{ flex: 1 }} onPress={() => x.page && go(x.page)} accessibilityRole="button">
        <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }} numberOfLines={2}>{x.text}</Text>
        {x.why ? <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={1}>{x.why}</Text> : null}
      </Pressable>
      <Text style={{ color: c, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{KIND_LABEL[x.kind] === 'Da fare' ? 'Task' : KIND_LABEL[x.kind]}</Text>
    </View>
  );
}

/** «Da fare adesso»: le 3 azioni più importanti, separate; se ne completi una, entra la successiva. */
export function ActionsCard({ plan, onDone }: { plan: PlanItem[]; onDone: (x: PlanItem) => void }) {
  const t = useTheme();
  const top = topActions(plan, 3);
  const next = useRef<string>('');
  const sig = top.map((x) => x.id).join('|');
  useEffect(() => { if (next.current && next.current !== sig) animateLayout(); next.current = sig; }, [sig]);
  return (
    <>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 6 }}>Da fare adesso</Text>
      <Card style={{ paddingVertical: 4 }}>
        {top.length === 0 ? <Body muted style={{ paddingVertical: 10 }}>Tutto fatto per ora. Goditi la pausa.</Body> : top.map((x, i) => <PlanRow key={x.id} x={x} onDone={onDone} last={i === top.length - 1} />)}
      </Card>
    </>
  );
}

/** Il quadro di oggi per esteso: impegni, task, benessere, soldi e persone, tutto in un posto. */
export function DayPlanSheet({ visible, onClose, plan, onDone, name }: { visible: boolean; onClose: () => void; plan: PlanItem[]; onDone: (x: PlanItem) => void; name: string }) {
  const t = useTheme();
  const [, force] = useState(0);
  return (
    <Sheet visible={visible} title="Il quadro di oggi" onClose={onClose}>
      <Body muted>{name ? `${name}, ` : ''}ecco come potrebbe andare oggi: {planSummary(plan).toLowerCase()}. Spunta quello che fai: le altre voci si riordinano da sole.</Body>
      {KIND_ORDER.map((k) => {
        const list = plan.filter((x) => x.kind === k);
        if (!list.length) return null;
        return (
          <View key={k} style={{ marginTop: 14 }}>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>{KIND_LABEL[k]}</Text>
            {list.map((x, i) => <PlanRow key={x.id} x={x} onDone={(y) => { onDone(y); force((n) => n + 1); }} last={i === list.length - 1} />)}
          </View>
        );
      })}
      <Row style={{ marginTop: 16 }} gap={8}>
        <Btn small ghost style={{ flex: 1 }} title="Apri il Piano" onPress={() => { onClose(); go('plan'); }} />
        <Btn small ghost style={{ flex: 1 }} title="Tutti i task" onPress={() => { onClose(); go('lifetask'); }} />
      </Row>
    </Sheet>
  );
}
