import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Body, Btn, Input, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { buildAgenda, buildTasks, dayLabelOf, myConflicts, noteShareOf, type AgendaRange } from '@/lib/chatShare';
import { dayKey, pad2, uid } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { notePreview, noteTitle } from '@/lib/notes';
import type { ChatMessage } from '@/store/chat';
import { taskIsDone, useLife } from '@/store/life';
import { toast } from '@/store/toast';

export type SharePayload = Partial<ChatMessage> & { kind: ChatMessage['kind'] };
type Common = { visible: boolean; onClose: () => void; onSend: (m: SharePayload) => void };

export function AgendaSheet({ visible, onClose, onSend }: Common) {
  const events = useLife((s) => s.events);
  const [range, setRange] = useState<AgendaRange>('oggi');
  const preview = visible ? buildAgenda(range) : null;
  void events;
  return (
    <Sheet visible={visible} title="Condividi i tuoi impegni" onClose={onClose}>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={6}>{(['oggi', 'domani', '7 giorni'] as AgendaRange[]).map((r) => <Pill key={r} label={r === 'oggi' ? 'Oggi' : r === 'domani' ? 'Domani' : 'Prossimi 7 giorni'} on={range === r} onPress={() => setRange(r)} />)}</Row>
      {preview ? (
        <>
          {preview.items.slice(0, 12).map((it, i) => <Item key={i} last={i === Math.min(preview.items.length, 12) - 1}><Row><Body small bold style={{ width: 88 }}>{dayLabelOf(it.day)} {it.time}</Body><Body small style={{ flex: 1 }} numberOfLines={1}>{it.title}</Body></Row></Item>)}
          <Body small muted style={{ marginTop: 8 }}>Chi riceve vede solo titolo, giorno e ora, e può aggiungerli al proprio piano. Non condividi note né dettagli privati.</Body>
          <Btn style={{ marginTop: 10 }} icon="send" title="Invia" onPress={() => { onSend({ kind: 'agenda', agenda: preview }); onClose(); }} />
        </>
      ) : <Body small muted>Nessun impegno in questo periodo.</Body>}
    </Sheet>
  );
}

export function TasksSheet({ visible, onClose, onSend }: Common) {
  const t = useTheme();
  const tasks = useLife((s) => s.tasks);
  const [sel, setSel] = useState<string[]>([]);
  const open = tasks.filter((x) => !taskIsDone(x));
  return (
    <Sheet visible={visible} title="Condividi dei task" onClose={onClose}>
      {open.length === 0 ? <Body small muted>Non hai task aperti.</Body> : open.map((x, i) => (
        <Item key={x.id} last={i === open.length - 1} onPress={() => setSel(sel.includes(x.id) ? sel.filter((y) => y !== x.id) : [...sel, x.id])}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}><Icon name={sel.includes(x.id) ? 'checksquare' : 'square'} size={20} color={sel.includes(x.id) ? t.accent : t.muted} /><Body style={{ flex: 1 }}>{x.t}</Body></Row>
        </Item>
      ))}
      <Btn style={{ marginTop: 12 }} icon="send" title={sel.length ? `Invia ${sel.length} ${sel.length === 1 ? 'task' : 'task'}` : 'Scegli almeno un task'} disabled={!sel.length} onPress={() => { const l = buildTasks(sel); if (l) onSend({ kind: 'tasks', taskList: l }); setSel([]); onClose(); }} />
    </Sheet>
  );
}

export function NoteSheet({ visible, onClose, onSend }: Common) {
  const notes = useLife((s) => s.notes);
  return (
    <Sheet visible={visible} title="Condividi una nota" onClose={onClose}>
      {notes.length === 0 ? <Body small muted>Non hai ancora note.</Body> : notes.map((n, i) => (
        <Item key={n.id} last={i === notes.length - 1} onPress={() => { const s = noteShareOf(n.id); if (s) onSend({ kind: 'note', noteShare: s }); onClose(); }}>
          <Body bold numberOfLines={1}>{noteTitle(n.text)}</Body><Body small muted numberOfLines={2}>{notePreview(n.text)}</Body>
        </Item>
      ))}
    </Sheet>
  );
}

export function DriveSheet({ visible, onClose, onSend }: Common) {
  const drive = useLife((s) => s.drive);
  return (
    <Sheet visible={visible} title="Invia da LifeDrive" onClose={onClose}>
      {drive.length === 0 ? <Body small muted>LifeDrive è vuoto: carica un file da LifeDrive o allegalo dal telefono.</Body> : drive.map((f, i) => (
        <Item key={f.id} last={i === drive.length - 1} onPress={() => { onSend({ kind: 'file', media: { uri: f.uri ?? '', name: f.n, size: undefined }, text: undefined }); onClose(); toast('Documento inviato'); }}>
          <Row><Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}><Icon name="file" size={20} color="#e5484d" /><View style={{ flex: 1 }}><Body numberOfLines={1}>{f.n}</Body><Body small muted>{f.folder} · {f.s}</Body></View></Row></Row>
        </Item>
      ))}
    </Sheet>
  );
}

/* ---------- proposta di orari ---------- */
const DURS = [15, 30, 45, 60, 90];
const nextDays = Array.from({ length: 10 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return dayKey(d); });
const timeStr = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
type Opt = { id: string; day: string; min: number };

export function SlotsSheet({ visible, onClose, onSend }: Common) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [dur, setDur] = useState(30);
  const [opts, setOpts] = useState<Opt[]>([{ id: uid(), day: nextDays[1], min: 10 * 60 }, { id: uid(), day: nextDays[1], min: 15 * 60 }]);
  const upd = (id: string, p: Partial<Opt>) => setOpts((o) => o.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const step = (id: string, d: number) => setOpts((o) => o.map((x) => (x.id === id ? { ...x, min: Math.min(22 * 60, Math.max(6 * 60, x.min + d)) } : x)));
  return (
    <Sheet visible={visible} title="Proponi degli orari" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Scegli 2–5 orari: chi riceve vota quelli che gli vanno bene e tu confermi il migliore. Vedi subito se un orario si scontra con un tuo impegno.</Body>
      <Input placeholder="Per cosa? (es. Call su AURA)" value={title} onChangeText={setTitle} />
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }} gap={6}>{DURS.map((d) => <Pill key={d} label={`${d} min`} on={dur === d} onPress={() => setDur(d)} />)}</Row>
      {opts.map((o) => {
        const conf = myConflicts(o.day, timeStr(o.min), dur);
        return (
          <View key={o.id} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 10, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{nextDays.map((d) => <Pill key={d} label={dayLabelOf(d)} on={o.day === d} onPress={() => upd(o.id, { day: d })} />)}</ScrollView>
            <Row style={{ marginTop: 8 }}>
              <Row gap={10}>
                <Pressable onPress={() => step(o.id, -30)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={16} color={t.text} /></Pressable>
                <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', minWidth: 62, textAlign: 'center' }}>{timeStr(o.min)}</Text>
                <Pressable onPress={() => step(o.id, 30)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={t.text} /></Pressable>
              </Row>
              {opts.length > 2 && <Pressable onPress={() => setOpts((x) => x.filter((y) => y.id !== o.id))} hitSlop={8}><Icon name="trash" size={18} color={t.danger} /></Pressable>}
            </Row>
            {conf.length > 0 && <Body small color={t.warn} style={{ marginTop: 6 }}>Attenzione: hai già {conf[0]}</Body>}
          </View>
        );
      })}
      {opts.length < 5 && <Btn small ghost icon="plus" title="Aggiungi orario" onPress={() => setOpts((o) => [...o, { id: uid(), day: o[o.length - 1]?.day ?? nextDays[1], min: Math.min(22 * 60, (o[o.length - 1]?.min ?? 9 * 60) + 60) }])} />}
      <Btn style={{ marginTop: 10 }} icon="send" title="Invia proposta" onPress={() => {
        if (!title.trim()) { toast('Scrivi per cosa è l’incontro'); return; }
        onSend({ kind: 'slots', slots: { title: title.trim(), durationMin: dur, options: opts.map((o) => ({ id: o.id, day: o.day, time: timeStr(o.min), votes: [] })) } });
        setTitle(''); onClose();
      }} />
    </Sheet>
  );
}
