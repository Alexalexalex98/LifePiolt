import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { ensureMe, localToday, pickPhoto } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { CATALOG, ROOM_DEFAULT, ROOM_TYPES, areaOf, choreFrom, choreUid, estimateRooms, layoutRooms, totalArea, type Room, type RoomType } from '@/lib/homeCare';
import { readFloorplan } from '@/lib/homeAi';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const rid = (n: number) => `r${Date.now().toString(36)}${n}`;
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const COLORS = ['#0F766E', '#2563EB', '#7C3AED', '#B45309', '#DB2777', '#16A34A', '#0891B2', '#9333EA'];

/** Crea la casa in un minuto: quante stanze e i metri quadrati (anche stimati). Poi si perfeziona. Genera anche le faccende e il piano. */
export function QuickStart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addRooms, addChores, rooms: have } = useCasa();
  const [m2, setM2] = useState('70'); const [cnt, setCnt] = useState({ camera: 1, bagno: 1, cameretta: 0, studio: 0, balcone: 0 }); const [extras, setExtras] = useState<RoomType[]>(['cucina', 'soggiorno', 'ingresso']);
  const bump = (k: keyof typeof cnt, d: number) => setCnt({ ...cnt, [k]: Math.max(0, Math.min(6, cnt[k] + d)) });
  const go = () => {
    const types: RoomType[] = [...extras, ...(Object.entries(cnt) as [RoomType, number][]).flatMap(([t, n]) => Array.from({ length: n }, () => t))];
    if (!types.length) { toast('Scegli almeno una stanza'); return; }
    const list = estimateRooms(Math.max(15, num(m2) || 60), types).map((r, i) => ({ ...r, id: rid(i) }));
    addRooms(list);
    const today = localToday(); let n = 0;
    const chores = [...list.flatMap((r) => CATALOG[r.type].map((it) => choreFrom(choreUid(n++, Date.now()), r.id, it))), ...CATALOG.casa.map((it) => choreFrom(choreUid(n++, Date.now()), null, it))];
    addChores(chores, today); ensureMe(); toast(tl('Casa creata: {0} stanze e {1} faccende, già distribuite nei giorni', list.length, chores.length)); onClose();
  };
  const toggle = (t: RoomType) => setExtras(extras.includes(t) ? extras.filter((x) => x !== t) : [...extras, t]);
  return (
    <Sheet visible={open} title="Crea la tua casa" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Basta una stima: poi cambi le misure e le stanze quando vuoi. Il piano si fa da solo.')}</Body>
      <Input placeholder="Metri quadrati della casa (anche a occhio)" keyboardType="numeric" value={m2} onChangeText={setM2} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('STANZE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{(['cucina', 'soggiorno', 'ingresso', 'corridoio', 'lavanderia', 'cantina', 'garage'] as RoomType[]).map((t) => <Pill key={t} label={ROOM_TYPES.find((x) => x.id === t)!.label} on={extras.includes(t)} onPress={() => toggle(t)} />)}</View>
      {(Object.keys(cnt) as (keyof typeof cnt)[]).map((k) => <Row key={k} style={{ marginBottom: 4 }}><Body style={{ flex: 1 }}>{ROOM_TYPES.find((x) => x.id === k)!.label}</Body><Btn small ghost title="−" onPress={() => bump(k, -1)} /><Text style={{ width: 24, textAlign: 'center', fontWeight: '800' }}>{cnt[k]}</Text><Btn small ghost title="+" onPress={() => bump(k, 1)} /></Row>)}
      {have.length ? <Body small muted style={{ marginTop: 6 }}>{tl('Hai già {0} stanze: queste si aggiungono.', have.length)}</Body> : null}
      <View style={{ height: 8 }} /><Btn icon="check" title="Crea casa e piano" onPress={go} />
    </Sheet>
  );
}

/** Stanze e planimetria: il disegno si fa da solo dalle misure (stimate); si può caricare la foto della planimetria o lo screenshot della mappa del robot e farla leggere a Theia. */
export function HomeRooms() {
  const th = useTheme(); const { rooms, floorplan, set, addRooms, updateRoom, removeRoom } = useCasa();
  const [w, setW] = useState(300); const [edit, setEdit] = useState<Room | null>(null); const [quick, setQuick] = useState(false); const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Omit<Room, 'id'>[] | null>(null); const [pick, setPick] = useState<boolean[]>([]);
  const L = layoutRooms(rooms, w);
  const photo = async () => { const uri = await pickPhoto(); if (uri) set({ floorplan: uri }); };
  const read = async () => {
    if (!floorplan) return; setBusy(true); const r = await readFloorplan(floorplan); setBusy(false);
    if (!r.ok) { toast(r.message); return; } setFound(r.data); setPick(r.data.map(() => true));
  };
  const add = () => { const d = ROOM_DEFAULT.altro; const r: Room = { id: rid(0), name: tl('Nuova stanza'), type: 'altro', w: d[0], l: d[1] }; addRooms([r]); setEdit(r); };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>La tua casa</H><Btn small ghost icon="plus" title="Stanza" onPress={add} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{rooms.length ? tl('{0} stanze · circa {1} m². Tocca una stanza per cambiare nome e misure.', rooms.length, totalArea(rooms)) : tl('Ancora nessuna stanza.')}</Body>
        <View onLayout={(e) => setW(Math.max(200, Math.floor(e.nativeEvent.layout.width)))} style={{ marginTop: 10, height: L.height || 40 }}>
          {L.rects.map(({ room, x, y, w: rw, h }, i) => (
            <Pressable key={room.id} onPress={() => setEdit(room)} accessibilityRole="button" accessibilityLabel={`${room.name}, ${areaOf(room)} metri quadrati`} style={{ position: 'absolute', left: x, top: y, width: rw, height: h, borderRadius: 8, borderWidth: 2, borderColor: COLORS[i % COLORS.length], backgroundColor: th.chip, padding: 6, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 12 }}>{room.name}</Text>
              <Text numberOfLines={1} style={{ color: th.muted, fontSize: 11 }}>{`${room.w}×${room.l} m`}</Text>
            </Pressable>
          ))}
        </View>
        {rooms.length === 0 ? <><Empty text="Crea la casa in un minuto o aggiungi le stanze a mano." /><View style={{ marginTop: 8 }}><Btn icon="plus" title="Crea la mia casa" onPress={() => setQuick(true)} /></View></> : <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small ghost title="Aggiungi stanze con la stima" onPress={() => setQuick(true)} /></View>}
      </Card>

      <Card>
        <H>Planimetria o mappa del robot</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Carica la foto della planimetria o lo screenshot della mappa del robot aspirapolvere: ti serve da guida per sistemare le misure. Se vuoi, Theia prova a leggerla.')}</Body>
        {floorplan ? <Image source={{ uri: floorplan }} style={{ width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: th.chip }} resizeMode="contain" accessibilityLabel={tl('Planimetria')} /> : null}
        <Row style={{ marginTop: 10 }}><Btn small icon="camera" title={floorplan ? 'Cambia foto' : 'Aggiungi foto'} onPress={() => { void photo(); }} />{floorplan ? <Btn small icon="sparkle" disabled={busy} title={busy ? 'Leggo…' : 'Fai leggere a Theia'} onPress={() => { void read(); }} /> : null}{floorplan ? <Btn small ghost danger icon="trash" title="" onPress={() => set({ floorplan: undefined })} /> : null}</Row>
        <Body small muted style={{ marginTop: 6 }}>{tl('Le misure lette dall\'AI sono stime e possono sbagliare: controllale e correggile.')}</Body>
      </Card>

      <QuickStart open={quick} onClose={() => setQuick(false)} />
      <Sheet visible={!!found} title="Stanze trovate da Theia" onClose={() => setFound(null)}>
        {(found ?? []).map((r, i) => <Row key={i} style={{ marginBottom: 6 }}><Pill label={pick[i] ? '✓' : '○'} on={pick[i]} onPress={() => setPick(pick.map((x, j) => (j === i ? !x : x)))} /><Body style={{ flex: 1 }}>{`${r.name} · ${r.w}×${r.l} m`}</Body></Row>)}
        <Body small muted style={{ marginVertical: 8 }}>{tl('Le aggiungo alla tua casa: poi puoi correggere nomi e misure.')}</Body>
        <Btn icon="check" title="Aggiungi le stanze scelte" onPress={() => { const sel = (found ?? []).filter((_, i) => pick[i]).map((r, i) => ({ ...r, id: rid(i) })); addRooms(sel); toast(tl('{0} stanze aggiunte', sel.length)); setFound(null); }} />
      </Sheet>
      <RoomEditor room={edit} onClose={() => setEdit(null)} onSave={(p) => { if (edit) updateRoom(edit.id, p); }} onDelete={() => { if (edit) alertT('Eliminare la stanza?', `${edit.name}: le sue faccende si eliminano.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { removeRoom(edit.id); setEdit(null); } }]); }} />
    </View>
  );
}

function RoomEditor({ room, onClose, onSave, onDelete }: { room: Room | null; onClose: () => void; onSave: (p: Partial<Room>) => void; onDelete: () => void }) {
  const [name, setName] = useState(''); const [ww, setWw] = useState(''); const [ll, setLl] = useState(''); const [type, setType] = useState<RoomType>('altro'); const [seen, setSeen] = useState<string | null>(null);
  if (room && seen !== room.id) { setSeen(room.id); setName(room.name); setWw(String(room.w)); setLl(String(room.l)); setType(room.type); }
  const save = () => { const a = num(ww); const b = num(ll); if (!(a >= 0.8 && a <= 30 && b >= 0.8 && b <= 30)) { toast('Le misure vanno da 1 a 30 metri'); return; } onSave({ name: name.trim() || room!.name, type, w: Math.round(a * 10) / 10, l: Math.round(b * 10) / 10 }); setSeen(null); onClose(); };
  return (
    <Sheet visible={!!room} title="Stanza" onClose={() => { setSeen(null); onClose(); }}>
      <Input placeholder="Nome" value={name} onChangeText={setName} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('TIPO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{ROOM_TYPES.map((t) => <Pill key={t.id} label={t.label} on={type === t.id} onPress={() => setType(t.id)} />)}</View>
      <Row><Input flex={1} placeholder="Larghezza (m)" keyboardType="numeric" value={ww} onChangeText={setWw} /><Input flex={1} placeholder="Lunghezza (m)" keyboardType="numeric" value={ll} onChangeText={setLl} /></Row>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Anche a passi: un passo è circa 70 cm.')}</Body>
      <Row><Btn icon="check" title="Salva" onPress={save} /><Btn ghost danger title="Elimina" onPress={onDelete} /></Row>
    </Sheet>
  );
}
