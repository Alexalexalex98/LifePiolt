import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Btn, Card, Empty, H, Input, Item, Link, Pill, Row, Select, Sheet, Toggle, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, minutesToTime, monthNames, pad2, timeToMinutes } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { decomposeTextToSteps } from '@/lib/taskDecompose';
import { useApp } from '@/store/app';
import { useLife, taskIsDone, type Task } from '@/store/life';
import { showUndoToast, toast } from '@/store/toast';

/* ---------- riga task (Plan e LifeTask) ---------- */
export function TaskRow({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const t = useTheme();
  const { toggleTask, delTask, restoreTask } = useLife();
  const remove = () => {
    const idx = useLife.getState().tasks.findIndex((x) => x.id === task.id);
    const removed = delTask(task.id);
    if (removed) showUndoToast('Task eliminato', () => restoreTask(removed, idx));
  };
  if (task.subtasks?.length) {
    const dc = task.subtasks.filter((s) => s.done).length;
    const totalH = task.subtasks.reduce((s, x) => s + x.h, 0);
    return (
      <Item onPress={() => onOpen(task.id)}>
        <Row>
          <Body style={{ flex: 1, textDecorationLine: dc === task.subtasks.length ? 'line-through' : 'none', opacity: dc === task.subtasks.length ? 0.45 : 1 }}>{task.t}</Body>
          <Row gap={8}>
            <Body small muted>{dc}/{task.subtasks.length} · {totalH}h</Body>
            <XBtn onPress={remove} />
          </Row>
        </Row>
      </Item>
    );
  }
  return (
    <Item>
      <Row>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} onPress={() => { const n = toggleTask(task.id, !task.done); if (n) toast(n); }} accessibilityRole="checkbox" accessibilityState={{ checked: !!task.done }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: task.done ? t.positive : t.muted, backgroundColor: task.done ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {task.done && <Icon name="check" size={14} color={t.bg} stroke={3} />}
          </View>
          <Body style={{ flex: 1, textDecorationLine: task.done ? 'line-through' : 'none', opacity: task.done ? 0.45 : 1 }}>
            {task.t}
            {task.recurring && task.recurring !== 'none' ? <Text style={{ color: t.muted, fontSize: 12 }}>{'  · '}{task.recurring === 'daily' ? 'ogni giorno' : 'ogni settimana'}</Text> : null}
          </Body>
        </Pressable>
        <Btn small ghost title="" icon="x" onPress={remove} />
      </Row>
    </Item>
  );
}

/* ---------- nuovo task con scomposizione AI ---------- */
type Draft = { t: string; subtasks: { t: string; h: number; done: boolean; type: 'lavoro' | 'piacere' }[] };

export function SmartTaskSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const addTask = useLife((s) => s.addTask);
  const [text, setText] = useState('');
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly'>('none');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newStep, setNewStep] = useState('');
  const recLabels = { none: 'Non si ripete', daily: 'Si ripete ogni giorno', weekly: 'Si ripete ogni settimana' } as const;

  const close = () => { setDraft(null); setText(''); setNewStep(''); setRecurring('none'); onClose(); };
  const total = draft ? draft.subtasks.reduce((s, x) => s + x.h, 0) : 0;
  const upd = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));

  return (
    <Sheet visible={visible} title={draft ? 'Scomposizione' : 'Nuovo task'} onClose={close}>
      {!draft ? (
        <>
          <Input placeholder="Es. Creare il business plan per Life" value={text} onChangeText={setText} />
          <Select value={recLabels[recurring]} options={Object.values(recLabels)} onChange={(v) => setRecurring((Object.keys(recLabels) as (keyof typeof recLabels)[]).find((k) => recLabels[k] === v) ?? 'none')} />
          <Btn title="Scomponi con AI" onPress={() => { const x = text.trim(); if (!x) return; setDraft({ t: x, subtasks: decomposeTextToSteps(x).map((s) => ({ ...s, done: false, type: 'lavoro' as const })) }); }} />
          <Btn small ghost style={{ marginTop: 8 }} title="Aggiungi come task singolo" onPress={() => { const x = text.trim(); if (!x) return; addTask({ t: x, done: false, recurring }); toast(recurring === 'none' ? 'Task aggiunto' : 'Task ricorrente aggiunto'); close(); }} />
        </>
      ) : (
        <>
          <Body small muted>"{draft.t}" scomposto in {draft.subtasks.length} passaggi più piccoli. Se un passaggio è ancora troppo grande, tocca "Scomponi ulteriormente".</Body>
          {draft.subtasks.map((s, i) => (
            <Item key={i}>
              <Row><Body style={{ flex: 1 }}>{s.t}</Body><XBtn onPress={() => upd((d) => ({ ...d, subtasks: d.subtasks.filter((_, j) => j !== i) }))} /></Row>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <Input keyboardType="decimal-pad" defaultValue={String(s.h)} style={{ width: 64, padding: 7, marginBottom: 0 }} onChangeText={(v) => upd((d) => ({ ...d, subtasks: d.subtasks.map((x, j) => (j === i ? { ...x, h: parseFloat(v.replace(',', '.')) || 0 } : x)) }))} />
                <Body small muted>h</Body>
                <Pill label="Lavoro" on={s.type === 'lavoro'} onPress={() => upd((d) => ({ ...d, subtasks: d.subtasks.map((x, j) => (j === i ? { ...x, type: 'lavoro' } : x)) }))} />
                <Pill label="Piacere" on={s.type === 'piacere'} onPress={() => upd((d) => ({ ...d, subtasks: d.subtasks.map((x, j) => (j === i ? { ...x, type: 'piacere' } : x)) }))} />
                <Pill label="Scomponi ulteriormente" onPress={() => { upd((d) => { const subs = d.subtasks.slice(); const o = subs[i]; subs.splice(i, 1, ...decomposeTextToSteps(o.t).map((x) => ({ ...x, done: false, type: o.type }))); return { ...d, subtasks: subs }; }); toast('Passaggio scomposto in parti più piccole'); }} />
              </View>
            </Item>
          ))}
          <Row style={{ marginTop: 10 }}>
            <Input flex={1} placeholder="Nuovo passaggio…" value={newStep} onChangeText={setNewStep} style={{ marginBottom: 0 }} />
            <Btn small ghost title="+" onPress={() => { const x = newStep.trim(); if (!x) return; upd((d) => ({ ...d, subtasks: [...d.subtasks, { t: x, h: 1, done: false, type: 'lavoro' }] })); setNewStep(''); }} />
          </Row>
          <Item style={{ marginTop: 10 }}><Row><Body muted>Tempo totale stimato</Body><Body bold>{total}h</Body></Row></Item>
          <Btn style={{ marginTop: 12 }} title="Aggiungi al Task list" onPress={() => { addTask({ t: draft.t, subtasks: draft.subtasks }); toast('Task scomposto e aggiunto'); close(); }} />
        </>
      )}
    </Sheet>
  );
}

/* ---------- dettaglio task scomposto ---------- */
export function TaskBreakdownSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const t = useTheme();
  const task = useLife((s) => s.tasks.find((x) => x.id === taskId));
  const { toggleSubtask, expandSubtask, scheduleBreakdown } = useLife();
  const wh = useApp((s) => s.workHours);
  const subs = task?.subtasks ?? [];
  const totalH = subs.reduce((s, x) => s + x.h, 0);
  const doneH = subs.filter((s) => s.done).reduce((s, x) => s + x.h, 0);
  return (
    <Sheet visible={!!task} title={task?.t ?? ''} onClose={onClose}>
      {task && (
        <>
          <Body small muted>Tempo totale stimato: <Text style={{ fontWeight: '700' }}>{totalH}h</Text> · completato: {doneH}h</Body>
          {subs.map((s, i) => (
            <Item key={i}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => toggleSubtask(task.id, i, !s.done)}>
                <Icon name={s.done ? 'checksquare' : 'square'} size={20} color={s.done ? t.positive : t.muted} />
                <Body style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none', opacity: s.done ? 0.45 : 1 }}>{s.t}</Body>
              </Pressable>
              <Row style={{ marginTop: 4 }}>
                <Body small muted>{s.h}h · {s.type === 'piacere' ? 'Piacere' : 'Lavoro'}</Body>
                {!s.done && <Link onPress={() => { expandSubtask(task.id, i, decomposeTextToSteps(s.t)); toast('Passaggio scomposto in parti più piccole'); }}>scomponi ulteriormente</Link>}
              </Row>
            </Item>
          ))}
          <Btn style={{ marginTop: 14 }} title="Pianifica nel calendario" onPress={() => {
            const r = scheduleBreakdown(task.id, wh.start, wh.end);
            toast(`${r.scheduled} passaggi pianificati oggi${r.skipped ? `, ${r.skipped} non entrano nell'orario di lavoro odierno` : ''}`);
            onClose();
          }} />
        </>
      )}
    </Sheet>
  );
}

/* ---------- orari di lavoro ---------- */
export function WorkHoursSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { workHours, set } = useApp();
  const [start, setStart] = useState(workHours.start);
  const [end, setEnd] = useState(workHours.end);
  return (
    <Sheet visible={visible} title="Orari di lavoro" onClose={onClose}>
      <Row><Input flex={1} placeholder="Inizio (es. 09:00)" value={start} onChangeText={setStart} /><Input flex={1} placeholder="Fine (es. 18:00)" value={end} onChangeText={setEnd} /></Row>
      <Btn title="Salva" onPress={() => {
        const ok = (v: string) => /^\d{1,2}:\d{2}$/.test(v.trim());
        if (!ok(start) || !ok(end)) { toast('Usa il formato HH:MM'); return; }
        set({ workHours: { start: start.trim(), end: end.trim() } });
        toast('Orari di lavoro aggiornati');
        onClose();
      }} />
    </Sheet>
  );
}

/* ---------- pianifica la giornata ---------- */
const presets = ['Meeting', 'Allenamento', 'Focus profondo', 'Pausa', 'Pranzo', 'Chiamata', 'Studio', 'Commissioni'];

export function PlanDaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const wh = useApp((s) => s.workHours);
  const addEvents = useLife((s) => s.addEvents);
  const [mode, setMode] = useState<'manual' | 'text'>('manual');
  const [draft, setDraft] = useState<{ time: string; label: string }[]>([]);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [text, setText] = useState('');

  const nextTime = () => {
    if (!draft.length) return wh.start;
    const p = draft[draft.length - 1].time.split(':').map(Number);
    return `${pad2((p[0] + 1) % 24)}:${pad2(p[1] || 0)}`;
  };
  const close = () => { setDraft([]); setLabel(''); setText(''); setMode('manual'); onClose(); };

  function organize() {
    const parts = text.split(/,|\be\b|\bpoi\b|\bquindi\b|\n/i).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) { toast('Scrivi prima qualcosa'); return; }
    const sh = parseInt(wh.start.split(':')[0]) || 9, eh = parseInt(wh.end.split(':')[0]) || 18;
    const step = Math.max(1, eh - sh) / parts.length;
    setDraft(parts.map((l, i) => {
      const hf = sh + step * i;
      let h = Math.floor(hf), m = Math.round(((hf - h) * 60) / 15) * 15;
      if (m === 60) { m = 0; h += 1; }
      return { time: `${pad2(h)}:${pad2(m)}`, label: l.charAt(0).toUpperCase() + l.slice(1) };
    }));
    setMode('manual');
    toast('Giornata organizzata: controlla e modifica se serve');
  }

  return (
    <Sheet visible={visible} title="Pianifica la giornata" onClose={close}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Pill label="Aggiungi attività" on={mode === 'manual'} onPress={() => setMode('manual')} />
        <Pill label="Raccontamelo" on={mode === 'text'} onPress={() => setMode('text')} />
      </View>
      {mode === 'manual' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{presets.map((p) => <Pill key={p} label={p} onPress={() => setLabel(p)} />)}</View>
          <Row><Input flex={1} placeholder="Attività" value={label} onChangeText={setLabel} /><Input placeholder="09:00" style={{ width: 84 }} value={time} onChangeText={setTime} /></Row>
          <Btn small ghost title="+ Aggiungi" onPress={() => { if (!label.trim()) { toast("Scrivi o scegli un'attività"); return; } setDraft([...draft, { time: time.trim() || nextTime(), label: label.trim() }]); setLabel(''); setTime(''); }} />
        </>
      ) : (
        <>
          <Body small muted style={{ marginBottom: 8 }}>Scrivi (o detta con il microfono della tastiera) tutti gli impegni di oggi, separati da virgola o "e": LifePilot li mette in orario per te.</Body>
          <Input multiline numberOfLines={4} placeholder="Es. palestra, chiamata con il team, pranzo con Marco, finire la presentazione…" value={text} onChangeText={setText} />
          <Btn small title="Organizza la giornata" onPress={organize} />
        </>
      )}
      {draft.length > 0 && (
        <>
          <Body small muted style={{ marginTop: 16, marginBottom: 6 }}>Bozza di oggi</Body>
          {draft.slice().sort((a, b) => a.time.localeCompare(b.time)).map((it, i) => (
            <Item key={i}><Row><Body>{it.time} · {it.label}</Body><XBtn onPress={() => setDraft(draft.filter((x) => x !== it))} /></Row></Item>
          ))}
          <Btn style={{ marginTop: 14 }} title="Applica piano" onPress={() => { addEvents(dayKey(), draft.map((d) => ({ time: d.time, title: d.label }))); toast('Piano applicato al calendario di oggi'); close(); }} />
        </>
      )}
    </Sheet>
  );
}

/* ---------- calendario ---------- */
export function MonthCalendar({ selectMode, onPick }: { selectMode: boolean; onPick: (key: string) => void }) {
  const t = useTheme();
  const events = useLife((s) => s.events);
  const vac = useLife((s) => s.vacRange);
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // lunedì = 0
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayKey = dayKey();
  void selectMode;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 11 }}>{d}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (d == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 48 }} />;
          const key = `${y}-${pad2(m + 1)}-${pad2(d)}`;
          const isToday = key === todayKey;
          const inVac = !!vac && key >= vac.start && key <= (vac.end ?? vac.start);
          return (
            <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
              <Pressable onPress={() => onPick(key)} style={{ height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: inVac ? '#3a2a1a' : t.cardAlt, borderWidth: isToday ? 1 : 0, borderColor: '#565f6e' }}>
                <Text style={{ color: inVac ? '#ffc78a' : t.text, fontSize: 12, fontWeight: inVac ? '700' : '400' }}>{d}</Text>
                {events[key]?.length ? <Text style={{ color: t.muted, fontSize: 9, marginTop: -2 }}>•</Text> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const monthTitle = () => {
  const d = new Date();
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

export function DaySheet({ day, onClose }: { day: string | null; onClose: () => void }) {
  const t = useTheme();
  const events = useLife((s) => (day ? s.events[day] : undefined)) ?? [];
  const { addEvent, delEvent, restoreEvent, toggleReminder } = useLife();
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [weekly, setWeekly] = useState(false);
  if (!day) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const d = new Date(day + 'T00:00:00');
  const titleStr = day === dayKey() ? `Oggi · ${d.getDate()} ${monthNames[d.getMonth()].toLowerCase()}` : `${d.getDate()} ${monthNames[d.getMonth()].toLowerCase()}`;
  const sorted = events.map((e, idx) => ({ e, idx })).sort((a, b) => a.e.time.localeCompare(b.e.time));
  const endOfMonth = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return (
    <Sheet visible title={titleStr} onClose={onClose}>
      {sorted.length === 0 && <Empty text="Nessun impegno pianificato." />}
      {sorted.map(({ e, idx }) => (
        <Item key={idx}>
          <Row>
            <Body style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{e.time}</Text> · {e.title}</Body>
            <Row gap={12}>
              <Pressable onPress={() => { const on = toggleReminder(day, idx); toast(on ? 'Promemoria impostato' : 'Promemoria rimosso'); }} accessibilityLabel="Promemoria">
                <Icon name="bell" size={18} color={e.reminder ? '#ffb84f' : t.text} fill={e.reminder ? '#ffb84f' : 'none'} />
              </Pressable>
              <Link danger onPress={() => { const rem = delEvent(day, idx); if (rem) showUndoToast('Impegno rimosso', () => restoreEvent(day, idx, rem)); }}>rimuovi</Link>
            </Row>
          </Row>
        </Item>
      ))}
      <Row style={{ marginTop: 14 }}>
        <Input placeholder="09:00" style={{ width: 84 }} value={time} onChangeText={setTime} />
        <Input flex={1} placeholder="Nuovo impegno…" value={title} onChangeText={setTitle} />
      </Row>
      <Toggle label="Ogni settimana (per questo mese)" value={weekly} onChange={setWeekly} />
      <Btn title="Aggiungi al calendario" onPress={() => {
        const ti = title.trim(); if (!ti) return;
        const n = addEvent(day, { time: time.trim() || '--:--', title: ti, reminder: false }, weekly ? endOfMonth : undefined);
        setTitle('');
        toast(n > 1 ? `Impegno aggiunto a ${n} date (ogni settimana)` : 'Impegno aggiunto');
      }} />
    </Sheet>
  );
}

export { H, Card, Empty, timeToMinutes, minutesToTime, taskIsDone };
