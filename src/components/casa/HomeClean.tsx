import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { HomePlan } from '@/components/casa/HomePlan';
import { RoomPage } from '@/components/casa/RoomPage';
import { ROOM_COLORS, useToday } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { roomSummary } from '@/lib/homeCare';
import { Icon } from '@/lib/icons';
import { useCasa } from '@/store/casa';

type Open = { id: string | null } | null;

/** Pulizie: una scheda per stanza, con la sua foto. Si entra nella stanza per vedere cosa c'è da fare (in tre gruppi), aggiungere, modificare e segnare come fatto. */
export function HomeClean({ onFloor }: { onFloor: () => void }) {
  const th = useTheme(); const today = useToday(); const { rooms, chores, log } = useCasa(); const [open, setOpen] = useState<Open>(null); const [cal, setCal] = useState(false);
  const dueAll = chores.filter((c) => c.active && c.due && c.due <= today).length; const house = roomSummary(null, chores, log, today);
  const card = (id: string | null, name: string, photo: string | undefined, color: string) => {
    const s = roomSummary(id, chores, log, today);
    return (
      <Pressable key={id ?? 'casa'} onPress={() => setOpen({ id })} accessibilityRole="button" accessibilityLabel={`${name}. ${s.total ? (s.clean ? tl('A posto oggi') : tl('{0} da fare oggi', s.dueToday)) : tl('Nessuna pulizia')}`} style={{ flexBasis: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 2, borderColor: s.clean ? '#22c55e' : color, overflow: 'hidden', backgroundColor: th.card }}>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: 96 }} resizeMode="cover" /> : <View style={{ height: 96, backgroundColor: `${color}30`, alignItems: 'center', justifyContent: 'center' }}><Icon name="home" size={30} color={color} /></View>}
        <View style={{ padding: 10 }}>
          <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 15 }}>{name}</Text>
          <Text style={{ color: s.clean ? '#22c55e' : s.dueToday ? '#f59e0b' : th.muted, fontSize: 12, marginTop: 2, fontWeight: '700' }}>{s.total === 0 ? tl('Nessuna pulizia') : s.clean ? tl('A posto oggi') : s.dueToday ? tl('{0} da fare oggi', s.dueToday) : tl('{0} pulizie', s.total)}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row><H>Pulizie</H><Btn small ghost icon="calendar" title="Calendario" onPress={() => setCal(true)} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{rooms.length ? (dueAll ? tl('Oggi ci sono {0} cose da fare in tutta la casa. Entra in una stanza per vederle.', dueAll) : tl('Oggi non c\'è niente in scadenza.')) : tl('Prima disegna la casa: poi scegli le pulizie stanza per stanza.')}</Body>
      </Card>
      {rooms.length === 0 ? <Card><Empty text="Ancora nessuna stanza." /><View style={{ marginTop: 8 }}><Btn icon="plus" title="Disegna la mia casa" onPress={onFloor} /></View></Card> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {rooms.map((r, i) => card(r.id, r.name, r.photo, ROOM_COLORS[i % ROOM_COLORS.length]!))}
          {card(null, tl('Tutta la casa'), undefined, th.accent)}
        </View>
      )}
      {house.total === 0 && rooms.length > 0 ? <Body small muted>{tl('Tocca una stanza e parti dalle poche cose essenziali.')}</Body> : null}
      {open ? <RoomPage roomId={open.id} onClose={() => setOpen(null)} /> : null}
      <Sheet visible={cal} title="Calendario delle pulizie" onClose={() => setCal(false)}><HomePlan /></Sheet>
    </View>
  );
}
