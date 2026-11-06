import { useState } from 'react';
import { View } from 'react-native';

import { localToday, memberName } from '@/components/casa/shared';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { INTERVALS, choreFrom, choreUid, everyLabel, roomName, suggestFor, type Chore, type Every, type Unit } from '@/lib/homeCare';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const UNITS: { id: Unit; label: string }[] = [{ id: 'day', label: 'giorni' }, { id: 'week', label: 'settimane' }, { id: 'month', label: 'mesi' }, { id: 'year', label: 'anni' }];
const same = (a: Every, b: Every) => a.n === b.n && a.unit === b.unit;

/** Le faccende di casa e ogni quanto si ripetono. Aggiungi quelle consigliate per ogni stanza o scrivi le tue. */
export function HomeChores() {
  const { chores, rooms, members, updateChore, removeChore, addChores } = useCasa();
  const [edit, setEdit] = useState<Chore | null>(null); const [sug, setSug] = useState<{ room: string | null; name: string } | null>(null);
  const groups = [...rooms.map((r) => ({ id: r.id as string | null, name: r.name })), { id: null as string | null, name: 'Tutta la casa' }];
  const newChore = () => { const c = choreFrom(choreUid(0, Date.now()), null, { title: tl('Nuova faccenda'), every: { n: 1, unit: 'week' }, minutes: 10, effort: 1 }); addChores([c], localToday()); setEdit(c); };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>Le faccende</H><Btn small icon="plus" title="Nuova" onPress={newChore} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{tl('Per ognuna scegli ogni quanto si ripete: il piano dei giorni e dell\'anno si aggiorna da solo.')}</Body>
      </Card>
      {groups.map((g) => {
        const list = chores.filter((c) => c.room === g.id); const room = g.id ? rooms.find((r) => r.id === g.id) ?? null : null;
        if (!list.length && g.id) return <Card key={g.id}><Row><H>{g.name}</H><Btn small ghost title="Idee" onPress={() => setSug({ room: g.id, name: g.name })} /></Row><Body small muted>{tl('Nessuna faccenda.')}</Body></Card>;
        if (!list.length) return null;
        return (
          <Card key={g.id ?? 'casa'}>
            <Row><H>{g.name}</H>{suggestFor(room, chores).length ? <Btn small ghost title="Idee" onPress={() => setSug({ room: g.id, name: g.name })} /> : null}</Row>
            {list.map((c) => (
              <Row key={c.id} style={{ marginTop: 10, opacity: c.active ? 1 : 0.5 }}>
                <View style={{ flex: 1 }}><Body bold onPress={() => setEdit(c)}>{c.title}</Body><Body small muted>{`${tl(everyLabel(c.every))} · ${c.minutes} min${c.assignee ? ` · ${memberName(members, c.assignee)}` : ''}`}</Body></View>
                <Btn small ghost title="Modifica" onPress={() => setEdit(c)} />
              </Row>
            ))}
          </Card>
        );
      })}
      {chores.length === 0 && rooms.length === 0 ? <Card><Empty text="Crea prima la tua casa nella scheda Casa: le faccende arrivano da sole." /></Card> : null}

      <Sheet visible={!!sug} title={`Idee per: ${sug?.name ?? ''}`} onClose={() => setSug(null)}>
        {sug ? (() => { const room = rooms.find((r) => r.id === sug.room) ?? null; const items = suggestFor(room, chores);
          return items.length === 0 ? <Empty text="Hai già tutte quelle che consiglio." /> : <>
            {items.map((it, i) => <Row key={i} style={{ marginBottom: 8 }}><View style={{ flex: 1 }}><Body bold>{it.title}</Body><Body small muted>{`${tl(everyLabel(it.every))} · ${it.minutes} min`}</Body></View><Btn small icon="plus" title="Aggiungi" onPress={() => { addChores([choreFrom(choreUid(i, Date.now()), sug.room, it)], localToday()); toast('Aggiunta al piano'); }} /></Row>)}
            <Btn ghost title="Aggiungi tutte" onPress={() => { addChores(items.map((it, i) => choreFrom(choreUid(i, Date.now()), sug.room, it)), localToday()); toast(tl('{0} faccende aggiunte', items.length)); setSug(null); }} />
          </>; })() : null}
      </Sheet>
      <ChoreEditor chore={edit} onClose={() => setEdit(null)} onSave={(p) => { if (edit) { updateChore(edit.id, p); useCasa.getState().rebalance(localToday()); } }}
        onDelete={() => { if (edit) alertT('Eliminare la faccenda?', edit.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { removeChore(edit.id); setEdit(null); } }]); }} />
    </View>
  );
}

function ChoreEditor({ chore, onClose, onSave, onDelete }: { chore: Chore | null; onClose: () => void; onSave: (p: Partial<Chore>) => void; onDelete: () => void }) {
  const { rooms, members } = useCasa();
  const [seen, setSeen] = useState<string | null>(null); const [title, setTitle] = useState(''); const [room, setRoom] = useState<string | null>(null); const [every, setEvery] = useState<Every>({ n: 1, unit: 'week' }); const [mins, setMins] = useState('10'); const [effort, setEffort] = useState<1 | 2 | 3>(1); const [who, setWho] = useState<string | null>(null); const [active, setActive] = useState(true); const [custom, setCustom] = useState(false); const [nn, setNn] = useState('1');
  if (chore && seen !== chore.id) { setSeen(chore.id); setTitle(chore.title); setRoom(chore.room); setEvery(chore.every); setMins(String(chore.minutes)); setEffort(chore.effort); setWho(chore.assignee); setActive(chore.active); setCustom(!INTERVALS.some((i) => same(i.every, chore.every))); setNn(String(chore.every.n)); }
  const save = () => { const m = parseInt(mins, 10); if (!(m >= 1 && m <= 480)) { toast('I minuti vanno da 1 a 480'); return; } const e = custom ? { n: Math.max(1, Math.min(99, parseInt(nn, 10) || 1)), unit: every.unit } : every; onSave({ title: title.trim() || chore!.title, room, every: e, minutes: m, effort, assignee: who, active, due: same(e, chore!.every) ? chore!.due : null }); setSeen(null); onClose(); };
  return (
    <Sheet visible={!!chore} title="Faccenda" onClose={() => { setSeen(null); onClose(); }}>
      <Input placeholder="Cosa fare" value={title} onChangeText={setTitle} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('DOVE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{[{ id: null as string | null, name: 'Tutta la casa' }, ...rooms.map((r) => ({ id: r.id as string | null, name: r.name }))].map((r) => <Pill key={r.id ?? 'casa'} label={r.name} on={room === r.id} onPress={() => setRoom(r.id)} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('OGNI QUANTO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{INTERVALS.map((i) => <Pill key={i.label} label={i.label} on={!custom && same(every, i.every)} onPress={() => { setCustom(false); setEvery(i.every); }} />)}<Pill label={tl('Altro…')} on={custom} onPress={() => setCustom(true)} /></View>
      {custom ? <Row style={{ marginBottom: 8 }}><Input flex={1} placeholder="Ogni quanti" keyboardType="numeric" value={nn} onChangeText={setNn} /><View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 2 }}>{UNITS.map((u) => <Pill key={u.id} label={u.label} on={every.unit === u.id} onPress={() => setEvery({ ...every, unit: u.id })} />)}</View></Row> : null}
      <Row><Input flex={1} placeholder="Minuti" keyboardType="numeric" value={mins} onChangeText={setMins} /></Row>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('FATICA').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>{([[1, 'Leggera'], [2, 'Media'], [3, 'Impegnativa']] as const).map(([n, l]) => <Pill key={n} label={tl(l)} on={effort === n} onPress={() => setEffort(n)} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('CHI').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><Pill label={tl('Chiunque')} on={who === null} onPress={() => setWho(null)} />{members.length > 1 ? <Pill label={tl('A turno')} on={who === 'rotate'} onPress={() => setWho('rotate')} /> : null}{members.map((m) => <Pill key={m.id} label={m.name} color={m.color} on={who === m.id} onPress={() => setWho(m.id)} />)}</View>
      <Pill label={active ? tl('Attiva') : tl('In pausa')} on={active} onPress={() => setActive(!active)} />
      <View style={{ height: 10 }} /><Row><Btn icon="check" title="Salva" onPress={save} /><Btn ghost danger title="Elimina" onPress={onDelete} /></Row>
      <Body small muted style={{ marginTop: 6 }}>{chore ? `${roomName(rooms, room)}` : ''}</Body>
    </Sheet>
  );
}
