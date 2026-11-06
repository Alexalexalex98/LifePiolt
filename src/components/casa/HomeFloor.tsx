import { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, ScrollView, View } from 'react-native';

import { ROOM_COLORS, pickPhoto } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { readFloorplan } from '@/lib/homeAi';
import { ROOM_DEFAULT, ROOM_TYPES, areaOf, boundsOf, clampSide, estimateRooms, overlapsOther, placeRooms, snapMove, snapResize, swapDims, totalArea, type Room, type RoomType } from '@/lib/homeCare';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const rid = (n: number) => `r${Date.now().toString(36)}${n}`;
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Crea le stanze dai metri quadrati e dal numero di stanze. Niente faccende: quelle si scelgono poi, stanza per stanza, in Pulizie. */
export function QuickStart({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const { addRooms, rooms: have, set } = useCasa();
  const [m2, setM2] = useState(''); const [cnt, setCnt] = useState({ camera: 1, bagno: 1, cameretta: 0, studio: 0, balcone: 0 }); const [extras, setExtras] = useState<RoomType[]>(['cucina', 'soggiorno', 'ingresso']);
  const bump = (k: keyof typeof cnt, d: number) => setCnt({ ...cnt, [k]: Math.max(0, Math.min(6, cnt[k] + d)) });
  const toggle = (t: RoomType) => setExtras(extras.includes(t) ? extras.filter((x) => x !== t) : [...extras, t]);
  const go = () => {
    const types: RoomType[] = [...extras, ...(Object.entries(cnt) as [RoomType, number][]).flatMap(([t, n]) => Array.from({ length: n }, () => t))];
    if (!types.length) { toast('Scegli almeno una stanza'); return; }
    const area = num(m2); if (!(area >= 15 && area <= 1000)) { toast('Scrivi quanti metri quadrati è la casa, per esempio 70'); return; }
    const list = estimateRooms(area, types).map((r, i) => ({ ...r, id: rid(i) }));
    set({ rooms: placeRooms([...have, ...list]) }); void addRooms; toast(tl('{0} stanze create. Ora sistemale come sono in casa tua.', list.length)); onClose(); onDone?.();
  };
  return (
    <Sheet visible={open} title="Crea la tua casa" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Basta una stima. Poi trascini e ridimensioni le stanze finché la planimetria somiglia alla tua casa.')}</Body>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('QUANTI METRI QUADRATI È LA CASA?').toUpperCase()}</Body>
      <Row><Input flex={1} placeholder="Per esempio 70" keyboardType="numeric" value={m2} onChangeText={setM2} /><Text style={{ fontSize: 20, fontWeight: '800' }}>m²</Text></Row>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('STANZE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{(['cucina', 'soggiorno', 'ingresso', 'corridoio', 'lavanderia', 'cantina', 'garage'] as RoomType[]).map((t) => <Pill key={t} label={ROOM_TYPES.find((x) => x.id === t)!.label} on={extras.includes(t)} onPress={() => toggle(t)} />)}</View>
      {(Object.keys(cnt) as (keyof typeof cnt)[]).map((k) => <Row key={k} style={{ marginBottom: 4 }}><Body style={{ flex: 1 }}>{ROOM_TYPES.find((x) => x.id === k)!.label}</Body><Btn small ghost title="−" onPress={() => bump(k, -1)} /><Text style={{ width: 24, textAlign: 'center', fontWeight: '800' }}>{cnt[k]}</Text><Btn small ghost title="+" onPress={() => bump(k, 1)} /></Row>)}
      {have.length ? <Body small muted style={{ marginTop: 6 }}>{tl('Hai già {0} stanze: queste si aggiungono.', have.length)}</Body> : null}
      <View style={{ height: 8 }} /><Btn icon="check" title="Crea le stanze" onPress={go} />
    </Sheet>
  );
}

type Live = { x: number; y: number; w: number; l: number };
/** Una stanza sul disegno: tocca per sceglierla, tieni premuto e trascina per spostarla, usa l'angolo per cambiare le misure. */
function RoomBox({ room, rooms, ppm, color, selected, bad, onSelect, onCommit }: { room: Room; rooms: Room[]; ppm: number; color: string; selected: boolean; bad: boolean; onSelect: () => void; onCommit: (p: Partial<Room>) => void }) {
  const th = useTheme(); const [live, setLive] = useState<Live | null>(null); const [lifted, setLifted] = useState(false);
  const cur = useRef({ room, rooms, ppm, onCommit }); useEffect(() => { cur.current = { room, rooms, ppm, onCommit }; });
  const armed = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const down = useRef({ x: 0, y: 0, moved: false }); const origin = useRef({ x: 0, y: 0, w: 0, l: 0 });
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  const finish = (commit: Partial<Room> | null) => { armed.current = false; setLifted(false); setLive(null); if (commit) cur.current.onCommit(commit); };
  const move = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => armed.current,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const r = cur.current.room; origin.current = { x: r.x ?? 0, y: r.y ?? 0, w: r.w, l: r.l }; },
    onPanResponderMove: (_e, g) => { const c = cur.current; const p = snapMove(c.rooms, c.room.id, origin.current.x + g.dx / c.ppm, origin.current.y + g.dy / c.ppm); setLive({ ...p, w: c.room.w, l: c.room.l }); },
    onPanResponderRelease: (_e, g) => { const c = cur.current; const p = snapMove(c.rooms, c.room.id, origin.current.x + g.dx / c.ppm, origin.current.y + g.dy / c.ppm); finish(p); },
    onPanResponderTerminate: () => finish(null),
  })).current;
  const size = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const r = cur.current.room; origin.current = { x: r.x ?? 0, y: r.y ?? 0, w: r.w, l: r.l }; },
    onPanResponderMove: (_e, g) => { const c = cur.current; const s = snapResize(c.rooms, c.room.id, origin.current.w + g.dx / c.ppm, origin.current.l + g.dy / c.ppm); setLive({ x: origin.current.x, y: origin.current.y, ...{ w: s.w, l: s.l } }); },
    onPanResponderRelease: (_e, g) => { const c = cur.current; finish(snapResize(c.rooms, c.room.id, origin.current.w + g.dx / c.ppm, origin.current.l + g.dy / c.ppm)); },
    onPanResponderTerminate: () => finish(null),
  })).current;
  const L = live ?? { x: room.x ?? 0, y: room.y ?? 0, w: room.w, l: room.l };
  return (
    <View
      {...move.panHandlers}
      onTouchStart={(e) => { down.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, moved: false }; clear(); timer.current = setTimeout(() => { armed.current = true; setLifted(true); }, 350); }}
      onTouchMove={(e) => { if (!armed.current && (Math.abs(e.nativeEvent.pageX - down.current.x) > 10 || Math.abs(e.nativeEvent.pageY - down.current.y) > 10)) { down.current.moved = true; clear(); } }}
      onTouchEnd={() => { const was = armed.current || live != null; clear(); if (!was && !down.current.moved) onSelect(); armed.current = false; setLifted(false); }}
      accessibilityRole="button" accessibilityLabel={`${room.name}, ${fmt(room.w)} per ${fmt(room.l)} metri`}
      style={{ position: 'absolute', left: L.x * ppm, top: L.y * ppm, width: L.w * ppm, height: L.l * ppm, borderRadius: 6, borderWidth: selected ? 3 : 2, borderColor: bad ? '#ef4444' : color, backgroundColor: lifted ? `${color}55` : `${color}28`, padding: 4, opacity: lifted ? 0.85 : 1, overflow: 'hidden' }}
    >
      <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 12 }}>{room.name}</Text>
      <Text numberOfLines={1} style={{ color: th.muted, fontSize: 11 }}>{`${fmt(L.w)}×${fmt(L.l)} m`}</Text>
      {selected ? <View {...size.panHandlers} hitSlop={12} style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, backgroundColor: color, borderTopLeftRadius: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>↘</Text></View> : null}
    </View>
  );
}

/** La planimetria della tua casa: stanze che trascini, allunghi, accorci e ingrandisci finché somiglia a casa tua. */
export function HomeFloor() {
  const th = useTheme(); const { rooms, floorplan, set, addRooms, updateRoom, removeRoom } = useCasa();
  const [sel, setSel] = useState<string | null>(null); const [ppm, setPpm] = useState(30); const [step, setStep] = useState(0.1); const [photoOn, setPhotoOn] = useState(true);
  const [edit, setEdit] = useState<Room | null>(null); const [quick, setQuick] = useState(false); const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Omit<Room, 'id'>[] | null>(null); const [pick, setPick] = useState<boolean[]>([]);
  useEffect(() => { if (rooms.some((r) => r.x == null || r.y == null)) set({ rooms: placeRooms(rooms) }); }, [rooms, set]);
  const b = boundsOf(rooms); const cw = Math.round(b.w * ppm + 40); const ch = Math.round(b.h * ppm + 40);
  const room = rooms.find((r) => r.id === sel) ?? null;
  const upd = (p: Partial<Room>) => { if (room) updateRoom(room.id, p); };
  const nudge = (dx: number, dy: number) => { if (room) upd({ x: Math.max(0, Math.round(((room.x ?? 0) + dx) * 10) / 10), y: Math.max(0, Math.round(((room.y ?? 0) + dy) * 10) / 10) }); };
  const readPlan = async () => { if (!floorplan) return; setBusy(true); const r = await readFloorplan(floorplan); setBusy(false); if (!r.ok) { toast(r.message); return; } setFound(r.data); setPick(r.data.map(() => true)); };
  const add = () => { const d = ROOM_DEFAULT.altro; const r: Room = { id: rid(0), name: tl('Nuova stanza'), type: 'altro', w: d[0], l: d[1] }; set({ rooms: placeRooms([...rooms, r]) }); setSel(r.id); setEdit(r); };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>La tua casa</H><Btn small ghost icon="plus" title="Stanza" onPress={add} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{rooms.length ? tl('{0} stanze · circa {1} m². Tocca una stanza per sceglierla, tieni premuto e trascina per spostarla, usa l\'angolo ↘ per cambiare le misure.', rooms.length, fmt(totalArea(rooms))) : tl('Ancora nessuna stanza.')}</Body>
        {rooms.length ? (
          <>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={{ marginTop: 10 }}>
              <View style={{ width: cw, height: ch, borderRadius: 12, backgroundColor: th.chip, overflow: 'hidden' }}>
                {floorplan && photoOn ? <Image source={{ uri: floorplan }} style={{ position: 'absolute', left: 0, top: 0, width: cw, height: ch, opacity: 0.35 }} resizeMode="contain" accessibilityLabel={tl('Planimetria caricata')} /> : null}
                {rooms.map((r, i) => <RoomBox key={r.id} room={r} rooms={rooms} ppm={ppm} color={ROOM_COLORS[i % ROOM_COLORS.length]!} selected={r.id === sel} bad={overlapsOther(rooms, r.id)} onSelect={() => setSel(r.id === sel ? null : r.id)} onCommit={(p) => updateRoom(r.id, p)} />)}
              </View>
            </ScrollView>
            <Row style={{ marginTop: 8 }}><Body small muted style={{ flex: 1 }}>{tl('Ingrandisci o rimpicciolisci il disegno')}</Body><Btn small ghost title="−" onPress={() => setPpm(Math.max(14, ppm - 4))} /><Btn small ghost title="+" onPress={() => setPpm(Math.min(64, ppm + 4))} /></Row>
            {floorplan ? <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Pill label={photoOn ? tl('Foto sotto il disegno: sì') : tl('Foto sotto il disegno: no')} on={photoOn} onPress={() => setPhotoOn(!photoOn)} /></View> : null}
          </>
        ) : <View style={{ marginTop: 10 }}><Btn icon="plus" title="Crea la mia casa" onPress={() => setQuick(true)} /></View>}
      </Card>

      {room ? (
        <Card accent={ROOM_COLORS[rooms.findIndex((r) => r.id === room.id) % ROOM_COLORS.length]}>
          <Row><View style={{ flex: 1 }}><H>{room.name}</H><Body small muted>{`${fmt(room.w)} × ${fmt(room.l)} m · ${fmt(areaOf(room))} m²`}</Body></View><Btn small ghost icon="edit" title="Nome e tipo" onPress={() => setEdit(room)} /></Row>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Pill label={tl('Passo fine 10 cm')} on={step === 0.1} onPress={() => setStep(0.1)} /><Pill label={tl('Passo 50 cm')} on={step === 0.5} onPress={() => setStep(0.5)} /></View>
          <Stepper label={tl('Larghezza')} value={room.w} step={step} onChange={(v) => upd({ w: v })} />
          <Stepper label={tl('Lunghezza')} value={room.l} step={step} onChange={(v) => upd({ l: v })} />
          <Body small bold muted style={{ marginTop: 12, marginBottom: 6 }}>{tl('SPOSTA').toUpperCase()}</Body>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Btn small ghost title="←" onPress={() => nudge(-step, 0)} /><Btn small ghost title="↑" onPress={() => nudge(0, -step)} /><Btn small ghost title="↓" onPress={() => nudge(0, step)} /><Btn small ghost title="→" onPress={() => nudge(step, 0)} /><Btn small ghost icon="repeat" title="Ruota" onPress={() => upd(swapDims(room))} /></View>
          {overlapsOther(rooms, room.id) ? <Body small style={{ color: '#ef4444', marginTop: 8 }}>{tl('Questa stanza si sovrappone a un\'altra: spostala o accorciala.')}</Body> : null}
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small ghost danger icon="trash" title="Elimina la stanza" onPress={() => alertT('Eliminare la stanza?', `${room.name}: le sue pulizie si eliminano.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { removeRoom(room.id); setSel(null); } }])} /></View>
        </Card>
      ) : null}

      <Card>
        <H>Planimetria o mappa del robot</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Carica la foto della planimetria o lo screenshot della mappa del robot: la vedi sotto il disegno e la ricalchi con le stanze. Se vuoi, Theia prova a leggerla.')}</Body>
        {floorplan ? <Image source={{ uri: floorplan }} style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10, backgroundColor: th.chip }} resizeMode="contain" accessibilityLabel={tl('Planimetria')} /> : null}
        <Row style={{ marginTop: 10 }}><Btn small icon="camera" title={floorplan ? 'Cambia foto' : 'Aggiungi foto'} onPress={() => { void pickPhoto().then((uri) => { if (uri) set({ floorplan: uri }); }); }} />{floorplan ? <Btn small icon="sparkle" disabled={busy} title={busy ? 'Leggo…' : 'Fai leggere a Theia'} onPress={() => { void readPlan(); }} /> : null}{floorplan ? <Btn small ghost danger icon="trash" title="" onPress={() => set({ floorplan: undefined })} /> : null}</Row>
        <Body small muted style={{ marginTop: 6 }}>{tl('Le misure lette dall\'AI sono stime e possono sbagliare: controllale e correggile.')}</Body>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Btn small ghost title="Aggiungi stanze con la stima" onPress={() => setQuick(true)} /></View>
      </Card>

      <QuickStart open={quick} onClose={() => setQuick(false)} />
      <Sheet visible={!!found} title="Stanze trovate da Theia" onClose={() => setFound(null)}>
        {(found ?? []).map((r, i) => <Row key={i} style={{ marginBottom: 6 }}><Pill label={pick[i] ? '✓' : '○'} on={pick[i]} onPress={() => setPick(pick.map((x, j) => (j === i ? !x : x)))} /><Body style={{ flex: 1 }}>{`${r.name} · ${fmt(r.w)}×${fmt(r.l)} m`}</Body></Row>)}
        <Body small muted style={{ marginVertical: 8 }}>{tl('Le aggiungo alla tua casa: poi puoi correggere nomi e misure.')}</Body>
        <Btn icon="check" title="Aggiungi le stanze scelte" onPress={() => { const sel2 = (found ?? []).filter((_, i) => pick[i]).map((r, i) => ({ ...r, id: rid(i) })); set({ rooms: placeRooms([...rooms, ...sel2]) }); void addRooms; toast(tl('{0} stanze aggiunte', sel2.length)); setFound(null); }} />
      </Sheet>
      <RoomEditor room={edit} onClose={() => setEdit(null)} onSave={(p) => { if (edit) updateRoom(edit.id, p); }} />
    </View>
  );
}

function RoomEditor({ room, onClose, onSave }: { room: Room | null; onClose: () => void; onSave: (p: Partial<Room>) => void }) {
  const [name, setName] = useState(''); const [ww, setWw] = useState(''); const [ll, setLl] = useState(''); const [type, setType] = useState<RoomType>('altro'); const [seen, setSeen] = useState<string | null>(null);
  if (room && seen !== room.id) { setSeen(room.id); setName(room.name); setWw(String(room.w)); setLl(String(room.l)); setType(room.type); }
  const save = () => { const a = num(ww); const b = num(ll); if (!(a >= 0.8 && a <= 30 && b >= 0.8 && b <= 30)) { toast('Le misure vanno da 1 a 30 metri'); return; } onSave({ name: name.trim() || room!.name, type, w: Math.round(a * 10) / 10, l: Math.round(b * 10) / 10 }); setSeen(null); onClose(); };
  return (
    <Sheet visible={!!room} title="Stanza" onClose={() => { setSeen(null); onClose(); }}>
      <Input placeholder="Nome" value={name} onChangeText={setName} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('TIPO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{ROOM_TYPES.map((t) => <Pill key={t.id} label={t.label} on={type === t.id} onPress={() => setType(t.id)} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('MISURE ESATTE').toUpperCase()}</Body>
      <Row><Input flex={1} placeholder="Larghezza (m)" keyboardType="numeric" value={ww} onChangeText={setWw} /><Input flex={1} placeholder="Lunghezza (m)" keyboardType="numeric" value={ll} onChangeText={setLl} /></Row>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Anche a passi: un passo è circa 70 cm.')}</Body>
      <Btn icon="check" title="Salva" onPress={save} />
    </Sheet>
  );
}

function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  const th = useTheme();
  return <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>{label}</Body><Btn small ghost title="−" onPress={() => onChange(clampSide(value - step))} /><Text style={{ minWidth: 64, textAlign: 'center', fontWeight: '800', color: th.text }}>{`${fmt(value)} m`}</Text><Btn small ghost title="+" onPress={() => onChange(clampSide(value + step))} /></Row>;
}
