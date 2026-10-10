import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Input, Item, Pill, Row, Select, Sheet } from '@/components/ui';
import { fmtDuration, nextDays as whenDays, timeOptions } from '@/lib/when';
import { useTheme } from '@/hooks/use-theme';
import { buildAgenda, buildTasks, dayLabelOf, myConflicts, noteShareOf, type AgendaRange } from '@/lib/chatShare';
import { dayKey, pad2, uid } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { notePreview, noteTitle } from '@/lib/notes';
import { useApp } from '@/store/app';
import type { AgendaMode, ChatMessage } from '@/store/chat';
import { taskIsDone, useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { agendaAllows, optionOf } from '@/lib/dataCatalog';
import { go } from '@/lib/nav';
import { useChoices } from '@/store/sharing';
import { translateText } from '@/i18n/core';

export type SharePayload = Partial<ChatMessage> & { kind: ChatMessage['kind'] };
type Common = { visible: boolean; onClose: () => void; onSend: (m: SharePayload) => void };

const modeInfo: Record<AgendaMode, { label: string; hint: string }> = {
  dettagli: { label: 'Con dettagli', hint: 'Chi riceve vede titolo, giorno e ora di ogni impegno e può aggiungerli al proprio piano.' },
  occupato: { label: 'Solo occupato', hint: 'Chi riceve vede quando sei occupato e quando sei libero, ma non cosa stai facendo: i titoli non vengono inviati.' },
  liberi: { label: 'Solo slot liberi', hint: 'Chi riceve vede soltanto quando sei libero e può proporti un orario. Impegni e titoli restano nascosti: non vengono inviati.' },
};

const bandList = [{ n: 'Mattina', from: '06:00', to: '12:00' }, { n: 'Pomeriggio', from: '12:00', to: '18:00' }, { n: 'Sera', from: '18:00', to: '23:00' }];

export function AgendaSheet({ visible, onClose, onSend }: Common) {
  const t = useTheme();
  const events = useLife((s) => s.events);
  const wh = useApp((s) => s.workHours);
  const [range, setRange] = useState<AgendaRange>('7 giorni');
  const [mode, setMode] = useState<AgendaMode>('liberi');
  // livello massimo scelto in "Cosa condivido": limita cosa si può inviare
  const shareChoices = useChoices();
  const maxOpt = shareChoices.plan_agenda;
  const maxLabel = optionOf('plan_agenda', shareChoices)?.label ?? '';
  const blocked = !agendaAllows(maxOpt, 'liberi');
  const [minSlot, setMinSlot] = useState(30);
  const [weekend, setWeekend] = useState(false);
  // fasce della giornata da mostrare: togli quelle in cui non vuoi essere disturbato
  const [bands, setBands] = useState<string[]>(['Mattina', 'Pomeriggio', 'Sera']);
  const [cust, setCust] = useState(false);
  const [cf, setCf] = useState('09:00');
  const [ct, setCt] = useState('13:00');
  const windows = cust ? [{ from: cf, to: ct }] : bands.length === 3 ? undefined : bandList.filter((b) => bands.includes(b.n)).map((b) => ({ from: b.from, to: b.to }));
  const preview = visible ? buildAgenda(range, mode, { minSlot, weekend, windows: windows ?? (mode === 'dettagli' ? undefined : [{ from: wh.start, to: wh.end }]) }) : null;
  void events;
  const list = mode === 'dettagli'
    ? preview?.items.map((it) => ({ day: it.day, key: it.time, text: `${it.time}  ${it.title}` }))
    : [...(preview?.busy ?? []).map((b) => ({ day: b.day, key: b.from, text: `occupato ${b.from}–${b.to}` })), ...(preview?.free ?? []).map((f) => ({ day: f.day, key: f.from, text: `libero ${f.from}–${f.to}` }))].sort((a, b) => (a.day + a.key).localeCompare(b.day + b.key));
  return (
    <Sheet visible={visible} title="Condividi la tua agenda" onClose={onClose}>
      <Body small muted style={{ marginBottom: 6 }}>Cosa vuoi far vedere?</Body>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 6, flexWrap: 'wrap' }} gap={6}>{(Object.keys(modeInfo) as AgendaMode[]).map((m) => <Pill key={m} icon={m === 'dettagli' ? 'calendar' : m === 'occupato' ? 'eye' : 'clock'} label={modeInfo[m].label} on={mode === m} off={!agendaAllows(maxOpt, m === 'dettagli' ? 'dettagli' : m === 'occupato' ? 'occupato' : 'liberi')} onPress={() => setMode(m)} />)}</Row>
      <Row style={{ marginBottom: 8 }}>
        <Body small muted style={{ flex: 1 }}>{blocked ? 'Condiviso: no. Nelle impostazioni "Cosa condivido" l\'agenda è privata.' : `Condiviso: sì, al massimo "${maxLabel}" (impostazione "Cosa condivido").`}</Body>
        <Btn small ghost title="Cambia" onPress={() => { onClose(); go('sharing'); }} />
      </Row>
      <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginBottom: 10 }}><Body small>{modeInfo[mode].hint}</Body></View>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }} gap={6}>{(['oggi', 'domani', '7 giorni'] as AgendaRange[]).map((r) => <Pill key={r} label={r === 'oggi' ? 'Oggi' : r === 'domani' ? 'Domani' : 'Prossimi 7 giorni'} on={range === r} onPress={() => setRange(r)} />)}</Row>
      <Body small muted style={{ marginBottom: 4 }}>Fasce della giornata da includere{mode === 'dettagli' ? '' : ' (con tutte e tre vale il tuo orario di lavoro)'}</Body>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }} gap={6}>
        {bandList.map((b) => <Pill key={b.n} label={`${b.n} ${b.from}–${b.to}`} on={!cust && bands.includes(b.n)} onPress={() => { setCust(false); setBands(bands.includes(b.n) ? bands.filter((x) => x !== b.n) : [...bands, b.n]); }} />)}
        <Pill label="Orario preciso" on={cust} onPress={() => setCust(!cust)} />
      </Row>
      {cust && (
        <Row style={{ marginBottom: 8 }} gap={8}>
          <Input flex={1} placeholder="Dalle (09:00)" value={cf} onChangeText={setCf} style={{ marginBottom: 0 }} />
          <Input flex={1} placeholder="Alle (13:00)" value={ct} onChangeText={setCt} style={{ marginBottom: 0 }} />
        </Row>
      )}
      {mode !== 'dettagli' && (
        <>
          <Body small muted style={{ marginBottom: 4 }}>Slot liberi di almeno · orario di lavoro {wh.start}–{wh.end}</Body>
          <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={6}>{[30, 60, 90].map((m) => <Pill key={m} label={`${m} min`} on={minSlot === m} onPress={() => setMinSlot(m)} />)}{range === '7 giorni' && <Pill label="Includi weekend" on={weekend} onPress={() => setWeekend(!weekend)} />}</Row>
        </>
      )}
      <Body small bold style={{ marginTop: 4, marginBottom: 2 }}>Anteprima di ciò che verrà inviato</Body>
      {list && list.length ? list.slice(0, 10).map((it, i, arr) => <Item key={i} last={i === arr.length - 1}><Row><Body small bold style={{ width: 84 }}>{dayLabelOf(it.day)}</Body><Body small style={{ flex: 1 }} numberOfLines={1}>{it.text}</Body></Row></Item>) : <Body small muted>{mode === 'dettagli' ? 'Nessun impegno in questo periodo.' : 'Nessuno slot libero in questo periodo.'}</Body>}
      {list && list.length > 10 && <Body small muted>…e altri {list.length - 10}</Body>}
      {!blocked && agendaAllows(maxOpt, mode === 'dettagli' ? 'dettagli' : mode === 'occupato' ? 'occupato' : 'liberi') && preview && (mode === 'dettagli' || !!preview.free?.length) && <Btn style={{ marginTop: 12 }} icon="send" title="Invia" onPress={() => { onSend({ kind: 'agenda', agenda: preview }); onClose(); }} />}
    </Sheet>
  );
}

export function TasksSheet({ visible, onClose, onSend }: Common) {
  const t = useTheme();
  const tasks = useLife((s) => s.tasks);
  const [sel, setSel] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]); // task nuovi scritti qui, non ancora nella tua lista
  const [draft, setDraft] = useState('');
  const open = tasks.filter((x) => !taskIsDone(x));
  const addFresh = () => { const v = draft.trim(); if (!v) return; setFresh([...fresh, v]); setDraft(''); };
  async function fromFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/csv', 'text/markdown'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const txt = Platform.OS === 'web' ? await (await fetch(a.uri)).text() : await new File(a.uri).text();
      const lines = txt.split(/\r?\n/).map((l) => l.replace(/^[\s\-*•\d.)\[\]x]+/i, '').trim()).filter((l) => l.length > 1).slice(0, 40);
      if (!lines.length) { toast('Il file è vuoto'); return; }
      setFresh((f) => [...f, ...lines]);
      toast(`${lines.length} task letti dal file`);
    } catch { toast('Non riesco a leggere il file'); }
  }
  const total = sel.length + fresh.length;
  return (
    <Sheet visible={visible} title="Condividi dei task" onClose={onClose}>
      <Body small muted style={{ marginBottom: 6 }}>Scegli dai tuoi task, scrivine di nuovi o caricane una lista da file di testo (una riga per task).</Body>
      <Row style={{ alignItems: 'flex-start', marginBottom: 8 }} gap={8}>
        <Input flex={1} placeholder="Nuovo task da condividere…" value={draft} onChangeText={setDraft} onSubmitEditing={addFresh} returnKeyType="done" style={{ marginBottom: 0 }} />
        <Btn title="" label="Aggiungi" icon="plus" onPress={addFresh} disabled={!draft.trim()} />
      </Row>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={6}><Pill icon="paperclip" label="Carica da file" onPress={fromFile} /></Row>
      {fresh.map((f, i) => (
        <Item key={'f' + i} last={false}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}><Icon name="plus" size={18} color={t.accent} /><Body style={{ flex: 1 }}>{f}</Body><Pressable onPress={() => setFresh(fresh.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={translateText("Togli")}><Icon name="x" size={16} color={t.muted} /></Pressable></Row>
        </Item>
      ))}
      {open.length === 0 ? <Body small muted>Non hai task aperti.</Body> : open.map((x, i) => (
        <Item key={x.id} last={i === open.length - 1} onPress={() => setSel(sel.includes(x.id) ? sel.filter((y) => y !== x.id) : [...sel, x.id])}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}><Icon name={sel.includes(x.id) ? 'checksquare' : 'square'} size={20} color={sel.includes(x.id) ? t.accent : t.muted} /><Body style={{ flex: 1 }}>{x.t}</Body></Row>
        </Item>
      ))}
      <Btn style={{ marginTop: 12 }} icon="send" title={total ? `Invia ${total} task` : 'Scegli o scrivi almeno un task'} disabled={!total} onPress={() => {
        const l = buildTasks(sel);
        const items = [...(l?.items ?? []), ...fresh.map((f) => ({ t: f, done: false }))];
        onSend({ kind: 'tasks', taskList: { title: items.length === 1 ? items[0].t : `${items.length} task`, items } });
        setSel([]); setFresh([]); onClose();
      }} />
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
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>{nextDays.map((d) => <Pill key={d} label={dayLabelOf(d)} on={o.day === d} onPress={() => upd(o.id, { day: d })} />)}</ScrollView>
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

/* ---------- invito a un evento ---------- */
const EV_DURS = [30, 60, 90, 120, 180];

export function EventSheet({ visible, onClose, onSend }: Common) {
  const days = whenDays(30);
  const [title, setTitle] = useState('');
  const [dayLabel, setDayLabel] = useState(days[1].label);
  const [time, setTime] = useState('19:00');
  const [dur, setDur] = useState(60);
  const [place, setPlace] = useState('');
  const [desc, setDesc] = useState('');
  const day = days.find((d) => d.label === dayLabel) ?? days[1];
  const conf = visible ? myConflicts(day.key, time, dur) : [];
  return (
    <Sheet visible={visible} title="Invito a un evento" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Chi riceve risponde con Partecipo, Forse o Non partecipo: le risposte finiscono nel suo Plan e tu vedi il riepilogo.</Body>
      <Input placeholder="Titolo (es. Cena di compleanno)" value={title} onChangeText={setTitle} />
      <Select title="Giorno" value={dayLabel} options={days.map((d) => d.label)} onChange={setDayLabel} />
      <Select title="Ora" value={time} options={timeOptions(6, 23)} onChange={setTime} />
      <Body small muted style={{ marginBottom: 4 }}>Durata</Body>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }} gap={6}>{EV_DURS.map((d) => <Pill key={d} label={fmtDuration(d)} on={dur === d} onPress={() => setDur(d)} />)}</Row>
      <Input placeholder="Luogo (facoltativo)" value={place} onChangeText={setPlace} />
      <Input placeholder="Descrizione (facoltativa)" value={desc} onChangeText={setDesc} multiline />
      {conf.length > 0 && <Body small color="#ffb84f" style={{ marginBottom: 8 }}>Attenzione: nel tuo piano hai già {conf[0]}</Body>}
      <Btn icon="send" title="Invia invito" onPress={() => {
        if (!title.trim()) { toast('Scrivi il titolo dell’evento'); return; }
        onSend({ kind: 'event', event: { title: title.trim(), day: day.key, time, durationMin: dur, place: place.trim() || undefined, description: desc.trim() || undefined, rsvp: {} } });
        setTitle(''); setPlace(''); setDesc(''); onClose();
      }} />
    </Sheet>
  );
}
