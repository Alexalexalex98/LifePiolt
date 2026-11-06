import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { localToday, useToday } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { addDays, everyLabel, roomName, yearPlan } from '@/lib/homeCare';
import { useCasa } from '@/store/casa';
import { toast } from '@/store/toast';

const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

/** Il piano: i prossimi giorni e l'anno. Si distribuisce da solo, ma lo puoi ricalcolare. */
export function HomePlan() {
  const th = useTheme(); const today = useToday(); const { chores, rooms, settings } = useCasa(); const [open, setOpen] = useState<string | null>(null);
  const year = useMemo(() => yearPlan(chores, today), [chores, today]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); const items = chores.filter((c) => c.active && c.due === d); return { d, items, minutes: items.reduce((n, c) => n + c.minutes, 0) }; }), [chores, today]);
  if (!chores.length) return <Card><H>Il piano</H><Empty text="Crea la tua casa e il piano compare qui, giorno per giorno e per tutto l'anno." /></Card>;
  const max = Math.max(settings.budget, ...week.map((w) => w.minutes), 1);
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <H>Prossimi 7 giorni</H>
        {week.map((w, i) => (
          <View key={w.d} style={{ marginTop: 10 }}>
            <Row><Body bold style={{ flex: 1, textTransform: 'capitalize' }}>{i === 0 ? tl('Oggi') : dayLabel(w.d)}</Body><Body small muted>{w.minutes ? `${w.minutes} min` : tl('libero')}</Body></Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: th.chip, marginTop: 4 }}><View style={{ width: `${Math.round((w.minutes / max) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: th.accent }} /></View>
            {w.items.slice(0, 4).map((c) => <Body key={c.id} small muted style={{ marginTop: 2 }}>{`• ${c.title} (${roomName(rooms, c.room)})`}</Body>)}
            {w.items.length > 4 ? <Body small muted>{tl('e altre {0}', w.items.length - 4)}</Body> : null}
          </View>
        ))}
      </Card>
      <Card>
        <H>L'anno</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Cosa c\'è da fare ogni mese e quanto tempo serve.')}</Body>
        {year.map((m) => (
          <View key={m.month} style={{ marginTop: 10 }}>
            <Row><View style={{ flex: 1 }}><Body bold style={{ textTransform: 'capitalize' }}>{monthLabel(m.month)}</Body><Body small muted>{tl('{0} faccende · circa {1} ore', m.count, Math.round((m.minutes / 60) * 10) / 10)}</Body></View><Pill label={open === m.month ? tl('Chiudi') : tl('Apri')} onPress={() => setOpen(open === m.month ? null : m.month)} /></Row>
            {open === m.month ? m.items.filter((i) => i.chore.every.unit !== 'day' || i.chore.every.n > 1).slice(0, 60).map((i, k) => <Text key={k} style={{ color: th.muted, fontSize: 13, marginTop: 3 }}>{`${dayLabel(i.day)} · ${i.chore.title} · ${tl(everyLabel(i.chore.every))}`}</Text>) : null}
          </View>
        ))}
      </Card>
      <Btn ghost icon="repeat" title="Ricalcola e distribuisci il piano" onPress={() => alertT('Ricalcolare il piano?', 'Le date delle faccende si ridistribuiscono per non avere giorni troppo pieni. Quello che hai già fatto resta segnato.', [{ text: 'Annulla', style: 'cancel' }, { text: 'Ricalcola', onPress: () => { useCasa.getState().rebalance(localToday(), true); toast('Piano ricalcolato'); } }])} />
    </View>
  );
}
