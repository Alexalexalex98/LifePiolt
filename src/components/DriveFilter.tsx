import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { useInk, useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { driveFolderColors } from '@/store/life';

const META: Record<string, { icon: string; color: string }> = {
  Tutte: { icon: 'grid', color: '#8e98a8' }, Tutti: { icon: 'grid', color: '#8e98a8' },
  Cibo: { icon: 'meal', color: '#7be0b0' }, Frigo: { icon: 'archive', color: '#6ec9dd' }, Scontrini: { icon: 'euro', color: '#e0c97b' },
  Chat: { icon: 'comment', color: '#7bb8e0' }, 'Caricate da Theia': { icon: 'sparkle', color: '#b96bff' }, Allenamento: { icon: 'lifefitness', color: '#ff9d6e' },
  Task: { icon: 'tasks', color: '#6bd0c0' }, 'Finanza personale': { icon: 'euro', color: '#7be0b0' }, Bollette: { icon: 'euro', color: '#e0b97b' }, Fisco: { icon: 'file', color: '#c9b6ff' }, Corpo: { icon: 'heart', color: '#ff9d9d' }, Viaggi: { icon: 'lifetravel', color: '#8fb3ff' }, Casa: { icon: 'home', color: '#e0a07b' }, 'Caricate da te': { icon: 'image', color: '#a8b4ff' },
  Documenti: { icon: 'file', color: driveFolderColors.Documenti }, Video: { icon: 'video', color: driveFolderColors.Video }, Ricevute: { icon: 'euro', color: driveFolderColors.Ricevute },
  'Bollette e fatture': { icon: 'euro', color: driveFolderColors['Bollette e fatture'] ?? '#e0b97b' }, Salute: { icon: 'heart', color: driveFolderColors.Salute }, Lavoro: { icon: 'briefcase', color: driveFolderColors.Lavoro },
  Progetti: { icon: 'projects', color: driveFolderColors.Progetti }, 'Chat con Theia': { icon: 'sparkle', color: '#b96bff' }, 'Creazioni di Theia': { icon: 'sparkle', color: '#d98bff' }, Altro: { icon: 'file', color: '#8e98a8' },
};

/** I filtri di LifeDrive: una riga di «chip» compatte (icona, nome, quanti), una sola riga che scorre, con il titolo di cosa stai filtrando. */
export function DriveFilter({ items, value, onChange, label }: { items: { id: string; count: number }[]; value: string; onChange: (id: string) => void; label?: string }) {
  const t = useTheme();
  const ink = useInk();
  return (
    <View style={{ marginBottom: 6 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6, marginStart: 2 }}>{tl(label)}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingBottom: 4 }}>
        {items.map((it) => {
          const m = META[it.id] ?? { icon: 'file', color: '#8e98a8' };
          const on = value === it.id;
          return (
            <Pressable key={it.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${tl(it.id)}, ${it.count}`} onPress={() => onChange(it.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingStart: 8, paddingEnd: 12, borderRadius: 999, backgroundColor: on ? m.color + '2e' : t.item, borderWidth: 1, borderColor: on ? m.color : t.sheetBorder }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: m.color + (on ? '55' : '2a'), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={13} color={ink(m.color)} stroke={2.2} />
              </View>
              <Text numberOfLines={1} style={{ color: on ? t.text : t.muted, fontWeight: '700', fontSize: 13 }}>{tl(it.id)}</Text>
              <Text style={{ color: on ? ink(m.color) : t.muted, fontWeight: '800', fontSize: 12 }}>{it.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
