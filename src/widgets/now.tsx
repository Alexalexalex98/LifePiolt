import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget } from 'expo-widgets';

import type { LockData } from '@/lib/lockScreen';

/**
 * Widget e Live Activity di LifePilot per il blocco schermo e la schermata Home di iPhone. Le funzioni con 'widget' girano dentro il widget:
 * devono bastare a se stesse (niente funzioni fuori da qui) e usano solo i dati che arrivano nelle props.
 */
const ICON: Record<string, never> = { turni: 'briefcase.fill' as never, impegni: 'calendar' as never, task: 'checkmark.circle' as never, allenamento: 'figure.run' as never, acqua: 'drop.fill' as never };

export const NowWidget = createWidget<LockData>('LifePilotNow', (props, env) => {
  'widget';
  const items = props.items ?? [];
  const first = items[0];
  const fam = env.widgetFamily;
  if (!first) {
    return fam === 'accessoryInline'
      ? <Text>LifePilot: niente di urgente</Text>
      : <VStack modifiers={[padding({ all: 8 }), containerBackground('#0b0f17', 'widget')]}><Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#ffffff')]}>Niente di urgente</Text><Text modifiers={[font({ size: 12 }), foregroundStyle('#8e98a8')]}>Turni e impegni compaiono qui</Text></VStack>;
  }
  if (fam === 'accessoryInline') return <Text>{`${first.title}${first.sub ? ` · ${first.sub}` : ''}`}</Text>;
  if (fam === 'accessoryCircular') return <VStack><Image systemName={ICON[first.kind] ?? ('circle' as never)} size={20} /><Text modifiers={[font({ size: 11, weight: 'bold' })]}>{first.sub?.replace(/^.*?(\d{1,2}:\d{2}).*$/, '$1') ?? ''}</Text></VStack>;
  if (fam === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(first.url)]}>
        <HStack spacing={4}><Image systemName={ICON[first.kind] ?? ('circle' as never)} size={12} /><Text modifiers={[font({ size: 13, weight: 'bold' })]}>{first.title}</Text></HStack>
        {first.sub ? <Text modifiers={[font({ size: 12 })]}>{first.sub}</Text> : null}
        {items[1] ? <Text modifiers={[font({ size: 11 })]}>{`${items[1].title}${items[1].sub ? ` · ${items[1].sub}` : ''}`}</Text> : null}
      </VStack>
    );
  }
  const rows = items.slice(0, fam === 'systemSmall' ? 2 : 4);
  return (
    <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 10 }), containerBackground('#0b0f17', 'widget'), widgetURL(first.url)]}>
      {rows.map((it, i) => (
        <HStack key={i} spacing={8}>
          <Image systemName={ICON[it.kind] ?? ('circle' as never)} size={16} color={it.color} />
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: i === 0 ? 15 : 13, weight: 'semibold' }), foregroundStyle('#ffffff')]}>{it.title}</Text>
            {it.sub ? <Text modifiers={[font({ size: 12 }), foregroundStyle('#8e98a8')]}>{it.sub}</Text> : null}
          </VStack>
          <Spacer />
        </HStack>
      ))}
    </VStack>
  );
}, { updatedAt: 0, items: [] });

export type ShiftActivity = { name: string; startTs: number; endTs: number; color: string };
/** Sul blocco schermo mentre un turno è in corso: nome, conto alla rovescia fino alla fine e l'orario. */
export const ShiftLive = createLiveActivity<ShiftActivity>('LifePilotShift', (props) => {
  'widget';
  const start = new Date(props.startTs), end = new Date(props.endTs);
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    banner: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 12 })]}>
        <HStack spacing={6}><Image systemName={'briefcase.fill' as never} size={14} color={props.color} /><Text modifiers={[font({ size: 15, weight: 'bold' })]}>{props.name}</Text></HStack>
        <Text modifiers={[font({ size: 28, weight: 'bold', design: 'rounded' })]} timerInterval={{ lower: start, upper: end }} countsDown>{''}</Text>
        <Text modifiers={[font({ size: 12 })]}>{`${hm(start)} - ${hm(end)}`}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName={'briefcase.fill' as never} size={14} color={props.color} />,
    compactTrailing: <Text modifiers={[font({ size: 13, weight: 'bold' })]} timerInterval={{ lower: start, upper: end }} countsDown>{''}</Text>,
    minimal: <Image systemName={'briefcase.fill' as never} size={14} color={props.color} />,
    expandedCenter: <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.name}</Text>,
    expandedBottom: <Text modifiers={[font({ size: 22, weight: 'bold', design: 'rounded' })]} timerInterval={{ lower: start, upper: end }} countsDown>{''}</Text>,
  };
});
