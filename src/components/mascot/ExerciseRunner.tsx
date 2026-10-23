import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { ladderSorted, stepDone, visibleSteps, type Answer, type Exercise, type Step } from '@/lib/mindExercises';
import type { Expression } from '@/lib/mascot';

const FACE: Record<Step['kind'], Expression> = { ladder: 'curious', text: 'understood', scale: 'curious', multi: 'curious', choice: 'curious', check: 'curious', breath: 'relaxed', info: 'happy' };

function Ladder({ rows, onChange }: { rows: string[]; onChange: (r: string[]) => void }) {
  const [text, setText] = useState('');
  const [suds, setSuds] = useState(40);
  const sorted = ladderSorted(rows);
  return (
    <View style={{ gap: 8 }}>
      {sorted.map((x, k) => (
        <Row key={`${x.text}${k}`} gap={8}><Body style={{ flex: 1 }}>{x.text}</Body><Body bold>{x.suds}</Body><Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => onChange(rows.filter((r) => r !== `${x.suds}|${x.text}`))} /></Row>
      ))}
      {rows.length < 10 ? (
        <>
          <Input value={text} onChangeText={setText} placeholder={tl('Una situazione (ad esempio: prendere il treno da solo)')} />
          <Body small muted>{tl('Disagio da 0 a 100')}: {suds}</Body>
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => <Pill key={n} label={String(n)} on={suds === n} onPress={() => setSuds(n)} />)}</Row>
          <Btn small ghost icon="plus" title="Aggiungi alla scala" disabled={!text.trim()} onPress={() => { onChange([...rows, `${suds}|${text.trim()}`]); setText(''); }} />
        </>
      ) : null}
    </View>
  );
}

function Breath({ s, onDone }: { s: NonNullable<Step['breath']>; onDone: () => void }) {
  const [total, setTotal] = useState(s.totalS[0]!);
  const [left, setLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    if (left == null) return;
    if (left <= 0) { onDone(); return; }
    const h = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(h);
  }, [left]);
  useEffect(() => {
    if (left == null) return;
    const el = total - left; const cyc = s.inS + s.outS; const m = el % cyc;
    setPhase(m < s.inS ? 'in' : 'out');
  }, [left]);
  if (left == null) return (
    <View style={{ gap: 8 }}>
      <Body small muted>Quanto vuoi restare?</Body>
      <Row gap={8} style={{ justifyContent: 'flex-start' }}>{s.totalS.map((n) => <Pill key={n} label={`${n / 60} min`} on={total === n} onPress={() => setTotal(n)} />)}</Row>
      <Btn title="Cominciamo" onPress={() => setLeft(total)} />
    </View>
  );
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <H>{tl(phase === 'in' ? 'Inspira piano…' : 'Espira lentamente…')}</H>
      <Body small muted>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</Body>
      <Btn small ghost title="Mi fermo qui" onPress={onDone} />
    </View>
  );
}

/** Un'attività da fare insieme alla creatura: un passo alla volta, tutto facoltativo, nessun giusto o sbagliato. Alla fine scegli tu se salvarla nel diario. */
export function ExerciseRunner({ ex, onClose, onSave }: { ex: Exercise | null; onClose: () => void; onSave: (answers: Record<string, Answer>) => void }) {
  const th = useTheme();
  const [a, setA] = useState<Record<string, Answer>>({});
  const [i, setI] = useState(0);
  useEffect(() => { setA({}); setI(0); }, [ex?.id]);
  if (!ex) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const steps = visibleSteps(ex, a);
  const done = i >= steps.length;
  const s = steps[i];
  const set = (v: Answer) => s && setA({ ...a, [s.id]: v });
  const cur = s ? a[s.id] : undefined;
  const toggle = (o: string) => { const l = Array.isArray(cur) ? cur : []; set(l.includes(o) ? l.filter((x) => x !== o) : [...l, o]); };
  return (
    <Sheet visible title={tl(ex.title)} onClose={onClose}>
      <View style={{ gap: 10 }}>
        <View style={{ alignItems: 'center' }}><Mascot size={96} color={th.accent} expression={done ? 'happy' : s ? FACE[s.kind] : 'neutral'} motion={s?.kind === 'breath' ? undefined : undefined} /></View>
        {!done && s ? (
          <>
            <Body small muted>{`${i + 1} / ${steps.length}${s.optional ? ` · ${tl('se ti va')}` : ''}`}</Body>
            {s.kind === 'info' ? <Body>{tl(s.prompt)}</Body> : <H>{tl(s.prompt)}</H>}
            {s.kind === 'text' ? <Input value={typeof cur === 'string' ? cur : ''} onChangeText={set} placeholder={tl('Scrivi qui (resta sul tuo telefono)')} maxLines={6} /> : null}
            {s.kind === 'scale' ? <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{Array.from({ length: (s.max! - s.min!) / ((s.max! - s.min!) > 10 ? 10 : 1) + 1 }, (_, k) => s.min! + k * ((s.max! - s.min!) > 10 ? 10 : 1)).map((n) => <Pill key={n} label={String(n)} on={cur === n} onPress={() => set(n)} />)}</Row> : null}
            {s.kind === 'multi' ? <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{s.options!.map((o) => <Pill key={o} label={tl(o)} on={Array.isArray(cur) && cur.includes(o)} onPress={() => toggle(o)} />)}</Row> : null}
            {s.kind === 'choice' ? <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{s.options!.map((o) => <Pill key={o} label={tl(o)} on={cur === o} onPress={() => set(o)} />)}</Row> : null}
            {s.kind === 'ladder' ? <Ladder rows={Array.isArray(cur) ? cur : []} onChange={(r) => set(r)} /> : null}
            {s.kind === 'breath' ? <Breath s={s.breath!} onDone={() => setI(i + 1)} /> : null}
            {s.kind !== 'breath' ? (
              <Row gap={8}>
                {i > 0 ? <Btn small ghost style={{ flex: 1 }} title="Indietro" onPress={() => setI(i - 1)} /> : null}
                {s.optional ? <Btn small ghost style={{ flex: 1 }} title="Salta" onPress={() => setI(i + 1)} /> : null}
                <Btn small style={{ flex: 1 }} disabled={!stepDone(s, cur)} title="Avanti" onPress={() => setI(i + 1)} />
              </Row>
            ) : null}
          </>
        ) : (
          <>
            <Body>{tl(ex.closing)}</Body>
            <Body small muted>Se ti va, puoi tenerlo nel diario che condividi solo con te stesso: resta sul telefono e lo cancelli quando vuoi.</Body>
            <Row gap={8}>
              <Btn style={{ flex: 1 }} title="Tienilo nel diario" onPress={() => { onSave(a); onClose(); }} />
              <Btn ghost style={{ flex: 1 }} title="Non salvare" onPress={onClose} />
            </Row>
          </>
        )}
        <Btn small ghost title="Esci quando vuoi" onPress={onClose} />
      </View>
    </Sheet>
  );
}
