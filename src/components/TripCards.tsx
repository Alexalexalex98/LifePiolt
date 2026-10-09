import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import type { Itinerary, Ranked, Reason, Slot } from '@/lib/tripPlanner';

/** Testo di un motivo: modello italiano tradotto, importi ('$123') formattati nella valuta dell'app. */
export const reasonText = (r: Reason) => tl(r.t, ...r.a.map((x) => (x.startsWith('$') ? formatMoney(Number(x.slice(1))) : x)));

const GRADS: Record<string, [string, string]> = {
  city: ['#3a2a5c', '#10131c'], summer: ['#1f5a4a', '#0e1a18'], winter: ['#2a4a7a', '#0e1520'],
};
const SLOT_LABEL: Record<Slot, string> = { morning: 'Mattina', afternoon: 'Pomeriggio', evening: 'Sera' };
export const levelLabel = (l: string) => (l === 'comfort' ? 'Comfort' : l === 'budget' ? 'Risparmio' : 'Centrale');

/** Card di un viaggio consigliato: segnaposto con gradiente, motivi, costo stimato contro budget. */
export function TripCard({ r, type, cost, budget, onPress }: { r: Ranked; type: 'city' | 'summer' | 'winter'; cost: number; budget: number; onPress: () => void }) {
  const t = useTheme();
  const fits = cost <= budget;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.name} style={{ marginBottom: 12 }}>
      <LinearGradient colors={GRADS[type]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, borderWidth: 1, borderColor: t.inputBorder, padding: 16, minHeight: 150 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#f4f6f8', fontSize: 20, fontWeight: '700' }}>{r.name}</Text>
            <Text style={{ color: '#c8d0dc', fontSize: 12, marginTop: 2 }}>{levelLabel(r.level)}</Text>
          </View>
          <Icon name="chevron" size={16} color="#c8d0dc" stroke={2} />
        </Row>
        <View style={{ marginTop: 10, gap: 3 }}>
          {r.reasons.slice(0, 4).map((x, i) => <Text key={i} style={{ color: '#e6eaf0', fontSize: 13 }}>{'• ' + reasonText(x)}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#f4f6f8', fontSize: 16, fontWeight: '700' }}>{formatMoney(cost)}</Text>
          <View style={{ backgroundColor: (fits ? t.positive : t.warn) + '33', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: fits ? t.positive : t.warn, fontSize: 12, fontWeight: '700' }}>{fits ? tl('Nel budget di {0}', formatMoney(budget)) : tl('Oltre il budget di {0}', formatMoney(budget))}</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Itinerario giorno per giorno + riepilogo costi. */
export function ItineraryView({ it, hotelName, flightText, startLabel }: { it: Itinerary; hotelName?: string; flightText?: string; startLabel?: (dayIdx: number) => string }) {
  const t = useTheme();
  return (
    <>
      {it.notes.map((n, i) => <Body key={i} small muted style={{ marginBottom: 4 }}>{reasonText(n)}</Body>)}
      <Body small muted style={{ marginTop: 10, marginBottom: 4 }}>Alloggio</Body>
      <Item><Row><Body>{hotelName ?? levelLabel(it.level)}</Body><Body bold>{formatMoney(it.lodging.perNight)}/notte</Body></Row></Item>
      {flightText ? <Item><Body small muted>{flightText}</Body></Item> : null}
      {it.days.map((d, i) => (
        <Item key={d.n}>
          <Body bold>{startLabel ? tl('Giorno {0} · {1}', d.n, startLabel(i)) : tl('Giorno {0}', d.n)}</Body>
          {d.items.map((x, j) => (
            <Row key={j} style={{ marginTop: 6 }} gap={8}>
              <View style={{ width: 74 }}><Text style={{ color: t.muted, fontSize: 12 }}>{SLOT_LABEL[x.slot]}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 14 }}>{x.title}</Text></View>
              <Text style={{ color: x.cost ? t.text : t.positive, fontSize: 13, fontWeight: '600' }}>{x.cost ? formatMoney(x.cost) : tl('Gratis')}</Text>
            </Row>
          ))}
        </Item>
      ))}
      <Item style={{ marginTop: 8 }}><Row><Body muted>Trasporto (a/r)</Body><Body bold>{formatMoney(it.flight)}</Body></Row></Item>
      <Item><Row><Body muted>{tl('Soggiorno ({0} notti)', it.nights)}</Body><Body bold>{formatMoney(it.lodging.total)}</Body></Row></Item>
      <Item><Row><Body muted>Pasti e spostamenti locali</Body><Body bold>{formatMoney(it.food)}</Body></Row></Item>
      <Item><Row><Body muted>Attività</Body><Body bold>{formatMoney(it.activities)}</Body></Row></Item>
      <Item last><Row><Body bold>Totale stimato</Body><Body bold color={it.fits ? t.positive : t.warn}>{formatMoney(it.total)}</Body></Row></Item>
      <Body small muted style={{ marginTop: 8 }}>{it.fits ? tl('Dentro il budget di {0}.', formatMoney(it.budget)) : tl('Oltre il budget di {0}.', formatMoney(it.budget))} Prezzi indicativi, verifica prima di prenotare.</Body>
    </>
  );
}
