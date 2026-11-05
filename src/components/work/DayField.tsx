import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CalendarPanel } from '@/components/CalendarViews';
import { Text } from '@/components/T';
import { Btn, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';

const label = (d: string) => { const x = new Date(d + 'T12:00:00'); return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); };

/** Un giorno si sceglie toccandolo nel Plan (calendario con i tuoi impegni), non scrivendolo a mano. */
export function DayField({ value, onChange, placeholder = 'Scegli il giorno', flex }: { value: string; onChange: (d: string) => void; placeholder?: string; flex?: number }) {
  const th = useTheme(); const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={tl('Scegli il giorno dal Plan')} style={{ flex, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: th.input, borderWidth: 1, borderColor: th.border, marginBottom: 12 }}>
        <Icon name="calendar" size={18} color={th.accent} />
        <Text numberOfLines={1} style={{ flex: 1, color: value ? th.text : th.muted, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' }}>{value ? label(value) : tl(placeholder)}</Text>
      </Pressable>
      <Sheet visible={open} title="Scegli il giorno dal tuo Plan" onClose={() => setOpen(false)}>
        <View>
          <CalendarPanel selectMode={false} onPickDay={(k) => { onChange(k); setOpen(false); }} onOpenBand={() => undefined} />
          <Btn style={{ marginTop: 10 }} ghost title="Chiudi" onPress={() => setOpen(false)} />
        </View>
      </Sheet>
    </>
  );
}
