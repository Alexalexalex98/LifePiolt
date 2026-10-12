import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/T';

import { Body, Btn, Card, Pill, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { clampTotal, focusAt, focusPlan, MAX_TOTAL, MIN_TOTAL, planMinutes, planSummary } from '@/lib/focusPlan';
import { cancel, scheduleAt } from '@/lib/notify';
import { go, goBack } from '@/lib/nav';
import { elapsedMs, fmtElapsed, isRunning, pauseTimer, startTimer } from '@/lib/taskTimer';
import { taskIsDone, useLife } from '@/store/life';
import { toast } from '@/store/toast';

const PRESETS = [25, 50, 90, 125, 180];
const NOTIF = 'lp-focus-next';
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

/** Concentrazione su un task: scegli solo il tempo totale di lavoro; pause da 5 minuti ogni 25 e da 15 dopo 125 minuti di lavoro, in automatico. */
export default function Focus() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const task = useLife((s) => s.tasks.find((x) => x.id === id));
  const patchTask = useLife((s) => s.patchTask);
  const toggleTask = useLife((s) => s.toggleTask);
  const [total, setTotal] = useState(task?.focusMin ?? 25);
  const [now, setNow] = useState(Date.now());
  const running = isRunning(task?.timer);
  const started = !!task?.timer;
  const minutes = clampTotal(started ? task?.focusMin ?? total : total);
  const plan = useMemo(() => focusPlan(minutes), [minutes]);
  const pos = focusAt(plan, elapsedMs(task?.timer, now));
  useEffect(() => { if (!running) return; const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, [running]);

  // avviso quando cambia il segmento (lavoro <-> pausa) e a fine sessione
  const [lastIdx, setLastIdx] = useState(-1);
  useEffect(() => {
    if (!started || !running) { setLastIdx(-1); return; }
    if (lastIdx !== -1 && (pos.index !== lastIdx || pos.done)) {
      toast(pos.done ? 'Sessione completata' : pos.kind === 'break' ? (pos.long ? 'Pausa lunga di 15 minuti' : 'Pausa di 5 minuti') : 'Si riparte: nuovo blocco di lavoro');
    }
    setLastIdx(pos.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.index, pos.done, started, running]);

  // notifica locale alla fine del segmento in corso (utile con lo schermo spento)
  useEffect(() => {
    if (!task) return;
    if (running && !pos.done) {
      const label = pos.kind === 'work' ? (pos.index === plan.length - 1 ? 'Sessione completata' : 'Pausa: stacca un momento') : 'Si riparte con il lavoro';
      void scheduleAt(NOTIF, new Date(Date.now() + pos.remainingMs), label, task.t);
    } else void cancel(NOTIF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pos.index, task?.id]);

  if (!task) return <Page id="focus" back title="Concentrazione"><Body muted>Questo task non esiste più.</Body><Btn style={{ marginTop: 12 }} title="Torna ai task" onPress={() => go('lifetask')} /></Page>;

  const start = () => { patchTask(task.id, { focusMin: minutes, timer: startTimer(task.timer, Date.now()) }); setNow(Date.now()); };
  const pause = () => patchTask(task.id, { timer: pauseTimer(task.timer, Date.now()) });
  const reset = () => { patchTask(task.id, { timer: undefined }); void cancel(NOTIF); };
  const finish = () => { patchTask(task.id, { timer: undefined }); const n = toggleTask(task.id, true); void cancel(NOTIF); toast(n ?? `Completato: ${fmtMin(pos.workMinDone)} di lavoro`); goBack(); };

  const isBreak = started && pos.kind === 'break' && !pos.done;
  const ring = pos.done ? t.positive : isBreak ? t.positive : t.warn;
  const bigText = !started ? `${minutes}:00` : pos.done ? '00:00' : fmtElapsed(pos.remainingMs);
  const sub = !started ? 'pronto' : pos.done ? 'finito' : running ? (isBreak ? (pos.long ? 'pausa lunga' : 'pausa') : `lavoro · blocco ${pos.workBlock} di ${pos.workBlocks}`) : 'in pausa';
  const workedPct = started ? Math.min(100, Math.round((pos.workMinDone / minutes) * 100)) : 0;

  return (
    <Page id="focus" back title="Concentrazione">
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Ora</Text>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 4 }}>{task.t}</Text>
        </View>
        {taskIsDone(task) ? <Pill label="Completato" /> : null}
      </Row>

      <View style={{ alignItems: 'center', marginVertical: 28 }}>
        <View style={{ width: 230, height: 230, borderRadius: 115, borderWidth: 5, borderColor: ring, alignItems: 'center', justifyContent: 'center', opacity: running || !started ? 1 : 0.7 }}>
          <Text style={{ color: t.text, fontSize: 50, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${bigText}, ${sub}`}>{bigText}</Text>
          <Text style={{ color: t.muted, fontSize: 14, marginTop: 4 }}>{sub}</Text>
        </View>
      </View>

      {!started ? (
        <>
          <Body small muted style={{ textAlign: 'center', marginBottom: 8 }}>Quanto vuoi lavorare in tutto? Le pause le metto io.</Body>
          <Row style={{ justifyContent: 'center', marginBottom: 10 }} gap={14}>
            <Btn small ghost title="− 5" disabled={total <= MIN_TOTAL} onPress={() => setTotal(clampTotal(total - 5))} />
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', minWidth: 90, textAlign: 'center' }}>{fmtMin(minutes)}</Text>
            <Btn small ghost title="+ 5" disabled={total >= MAX_TOTAL} onPress={() => setTotal(clampTotal(total + 5))} />
          </Row>
          <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }} gap={6}>{PRESETS.map((m) => <Pill key={m} label={fmtMin(m)} on={minutes === m} onPress={() => setTotal(m)} />)}</Row>
          <Card><Body small>{planSummary(plan)}</Body><Body small muted style={{ marginTop: 4 }}>Durata complessiva con le pause: {fmtMin(planMinutes(plan))}. Pausa da 5 minuti ogni 25 di lavoro, da 15 dopo 125 minuti di lavoro.</Body></Card>
          <Btn style={{ marginTop: 14 }} title="Inizia" onPress={start} />
        </>
      ) : (
        <>
          <Row style={{ justifyContent: 'center' }} gap={10}>
            {pos.done ? <Btn title="Segna il task come completato" onPress={finish} /> : <Btn title={running ? 'Pausa' : 'Riprendi'} onPress={running ? pause : start} />}
            <Btn ghost title="Reimposta" onPress={reset} />
          </Row>
          <Body small muted style={{ textAlign: 'center', marginTop: 16 }}>{fmtMin(pos.workMinDone)} di lavoro su {fmtMin(minutes)} ({workedPct}%) · {planSummary(plan)}</Body>
          {!pos.done && <Btn small ghost style={{ marginTop: 14 }} title="Ho già finito: segna completato" onPress={finish} />}
        </>
      )}
      <Body small muted style={{ textAlign: 'center', marginTop: 22 }}>I dati restano solo su questo dispositivo.</Body>
    </Page>
  );
}
