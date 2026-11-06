import { useState } from 'react';
import { Image, View } from 'react-native';

import { ChoreEditor } from '@/components/casa/ChoreEditor';
import { ensureMe, localToday, maybeAskRoomPhoto, memberName, pickPhoto, useToday } from '@/components/casa/shared';
import { TidySheet, startTidy } from '@/components/casa/HomeTidy';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { CATS, categoryOf, choreFrom, choreUid, essentialsFor, everyLabel, praiseOf, roomSummary, suggestFor, type Cat, type Chore } from '@/lib/homeCare';
import { GUIDES, guideMinutes } from '@/lib/homeGuides';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const newChore = (room: string | null, title: string, every: Chore['every']): Chore => choreFrom(choreUid(0, Date.now()), room, { title, every, minutes: 10, effort: 1 });

/** Una stanza: la sua foto, e le pulizie divise in tre (ogni giorno, ogni settimana, ogni tanto). Qui aggiungi, modifichi e segni come fatto. */
export function RoomPage({ roomId, onClose }: { roomId: string | null; onClose: () => void }) {
  const th = useTheme(); const today = useToday();
  const { rooms, chores, log, members, me, tidy, updateRoom, addChores, updateChore, removeChore, doChore } = useCasa();
  const room = rooms.find((r) => r.id === roomId) ?? null; const mine = chores.filter((c) => c.room === roomId);
  const [edit, setEdit] = useState<Chore | null>(null); const [ideas, setIdeas] = useState(false); const [tidyId, setTidyId] = useState<string | null>(null); const [actor, setActor] = useState<string | undefined>(me);
  const sum = roomSummary(roomId, chores, log, today); const who = actor ?? me ?? members[0]?.id ?? ensureMe().id;
  const doneToday = new Set(log.filter((d) => d.day === today).map((d) => d.chore));
  const finish = (c: Chore) => { const pts = doChore(c.id, who, today); if (pts != null) { toast(pts > 0 ? praiseOf(log.length) : 'Segnato'); maybeAskRoomPhoto(roomId); } };
  const addIn = (cat: Cat) => { const def = CATS.find((x) => x.id === cat)!; const c = newChore(roomId, tl('Nuova faccenda'), def.every); addChores([c], localToday()); setEdit(c); };
  const sugg = suggestFor(room, chores); const ess = essentialsFor(room, chores);
  const guides = room ? GUIDES.filter((g) => g.room === room.type) : [];
  const state = (c: Chore): string => (doneToday.has(c.id) ? tl('Fatto oggi') : !c.due ? tl('da pianificare') : c.due <= today ? tl('da fare oggi') : `${tl('prossima')} ${new Date(c.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`);
  return (
    <Sheet visible title={room?.name ?? tl('Tutta la casa')} onClose={onClose}>
      {room ? (
        <>
          {room.photo ? <Image source={{ uri: room.photo }} style={{ width: '100%', height: 170, borderRadius: 14, backgroundColor: th.chip }} resizeMode="cover" accessibilityLabel={`${tl('Foto di')} ${room.name}`} /> : <View style={{ height: 90, borderRadius: 14, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Body small muted>{tl('Aggiungi la foto della stanza in ordine')}</Body></View>}
          <Row style={{ marginTop: 8 }}><Btn small icon="camera" title={room.photo ? 'Cambia foto' : 'Aggiungi foto'} onPress={() => { void pickPhoto().then((uri) => { if (uri) updateRoom(room.id, { photo: uri }); }); }} />{room.photo ? <Btn small ghost danger icon="trash" title="" onPress={() => updateRoom(room.id, { photo: undefined })} /> : null}</Row>
        </>
      ) : null}
      <Text style={{ color: sum.clean ? '#22c55e' : th.text, fontWeight: '800', fontSize: 16, marginTop: 12 }}>{sum.total === 0 ? tl('Nessuna pulizia ancora') : sum.clean ? tl('A posto oggi') : sum.dueToday ? tl('{0} da fare oggi', sum.dueToday) : tl('Niente in scadenza oggi')}</Text>
      {members.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{members.map((m) => <Pill key={m.id} label={m.name} color={m.color} on={who === m.id} onPress={() => setActor(m.id)} />)}</View> : null}

      {mine.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <H>Da dove parto?</H>
          <Body small muted style={{ marginTop: 4 }}>{tl('Non c\'è ancora niente da fare in questa stanza. Parti dalle poche cose essenziali, poi aggiungi quello che vuoi.')}</Body>
          <Row style={{ marginTop: 10 }}>{ess.length ? <Btn icon="check" title={`Le ${ess.length} essenziali`} onPress={() => { addChores(ess.map((it, i) => choreFrom(choreUid(i, Date.now()), roomId, it)), localToday()); toast('Aggiunte: le trovi qui sotto'); }} /> : null}<Btn ghost title="Scegli tu" onPress={() => setIdeas(true)} /></Row>
        </Card>
      ) : null}

      {CATS.map((cat) => {
        const list = mine.filter((c) => c.active && categoryOf(c) === cat.id).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')); const paused = mine.filter((c) => !c.active && categoryOf(c) === cat.id);
        return (
          <View key={cat.id} style={{ marginTop: 16 }}>
            <Row><View style={{ flex: 1 }}><Body bold style={{ fontSize: 16 }}>{`${tl(cat.label)} · ${list.length}`}</Body><Body small muted>{tl(cat.hint)}</Body></View><Btn small ghost icon="plus" title="Aggiungi" onPress={() => addIn(cat.id)} /></Row>
            {list.length === 0 ? <Body small muted style={{ marginTop: 6 }}>{tl('Niente qui.')}</Body> : list.map((c) => {
              const d = doneToday.has(c.id); const late = !d && c.due && c.due <= today;
              return (
                <Row key={c.id} style={{ marginTop: 10, opacity: d ? 0.6 : 1 }}>
                  <View style={{ flex: 1 }}>
                    <Body bold style={{ textDecorationLine: d ? 'line-through' : 'none' }}>{c.title}</Body>
                    <Body small muted style={{ color: late ? '#f59e0b' : undefined }}>{`${tl(everyLabel(c.every))} · ${c.minutes} min${c.assignee ? ` · ${memberName(members, c.assignee)}` : ''} · ${state(c)}`}</Body>
                  </View>
                  {d ? <Pill label="✓" on /> : <Btn small icon="check" title="Fatto" onPress={() => finish(c)} />}
                  <Btn small ghost icon="edit" title="" onPress={() => setEdit(c)} />
                </Row>
              );
            })}
            {paused.length ? <Body small muted style={{ marginTop: 6 }}>{tl('In pausa: {0}', paused.map((c) => c.title).join(', '))}</Body> : null}
          </View>
        );
      })}
      {mine.length && sugg.length ? <View style={{ marginTop: 14, alignSelf: 'flex-start' }}><Btn small ghost icon="sparkle" title="Idee per questa stanza" onPress={() => setIdeas(true)} /></View> : null}

      {guides.length ? (
        <Card style={{ marginTop: 18 }}>
          <H>Riordino guidato</H>
          {guides.map((g) => { const on = tidy.find((t) => t.guide === g.id && !t.finished); return <Row key={g.id} style={{ marginTop: 10 }}><View style={{ flex: 1 }}><Body bold>{g.title}</Body><Body small muted>{`${tl(g.intro)} · ${tl('circa {0} min', guideMinutes(g))}`}</Body></View><Btn small ghost title={on ? 'Continua' : 'Inizia'} onPress={() => setTidyId(startTidy(g.id))} /></Row>; })}
        </Card>
      ) : null}

      <Sheet visible={ideas} title={`Idee: ${room?.name ?? tl('Tutta la casa')}`} onClose={() => setIdeas(false)}>
        {sugg.length === 0 ? <Body muted>{tl('Hai già tutte quelle che consiglio.')}</Body> : <>
          {sugg.map((it, i) => <Row key={i} style={{ marginBottom: 8 }}><View style={{ flex: 1 }}><Body bold>{it.title}</Body><Body small muted>{`${tl(everyLabel(it.every))} · ${it.minutes} min`}</Body></View><Btn small icon="plus" title="Aggiungi" onPress={() => { addChores([choreFrom(choreUid(i, Date.now()), roomId, it)], localToday()); toast('Aggiunta'); }} /></Row>)}
          <Btn ghost title="Aggiungi tutte" onPress={() => { addChores(sugg.map((it, i) => choreFrom(choreUid(i, Date.now()), roomId, it)), localToday()); setIdeas(false); }} />
        </>}
      </Sheet>
      <ChoreEditor chore={edit} onClose={() => setEdit(null)} onSave={(p) => { if (edit) { updateChore(edit.id, p); useCasa.getState().rebalance(localToday()); } }}
        onDelete={() => { if (edit) alertT('Eliminare la faccenda?', edit.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { removeChore(edit.id); setEdit(null); } }]); }} />
      {tidyId ? <TidySheet id={tidyId} onClose={() => setTidyId(null)} /> : null}
    </Sheet>
  );
}
