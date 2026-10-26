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
  Task: { icon: 'tasks', color: '#6bd0c0' }, 'Caricate da te': { icon: 'image', color: '#a8b4ff' },
  Documenti: { icon: 'file', color: driveFolderColors.Documenti }, Video: { icon: 'video', color: driveFolderColors.Video }, Ricevute: { icon: 'euro', color: driveFolderColors.Ricevute },
  'Bollette e fatture': { icon: 'euro', color: driveFolderColors['Bollette e fatture'] ?? '#e0b97b' }, Salute: { icon: 'heart', color: driveFolderColors.Salute }, Lavoro: { icon: 'briefcase', color: driveFolderColors.Lavoro },
  Progetti: { icon: 'projects', color: driveFolderColors.Progetti }, 'Chat con Theia': { icon: 'sparkle', color: '#b96bff' }, 'Creazioni di Theia': { icon: 'sparkle', color: '#d98bff' }, Altro: { icon: 'file', color: '#8e98a8' },
};

/** Il menu di LifeDrive: una scheda colorata per ogni categoria (con quante ce ne sono); la prima, «Tutte», le mostra insieme. */
export function DriveFilter({ items, value, onChange }: { items: { id: string; count: number }[]; value: string; onChange: (id: string) => void }) {
  const t = useTheme();
  const ink = useInk();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12, paddingHorizontal: 2 }}>
      {items.map((it) => {
        const m = META[it.id] ?? { icon: 'file', color: '#8e98a8' };
        const on = value === it.id;
        return (
          <Pressable key={it.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${tl(it.id)}, ${it.count}`} onPress={() => onChange(it.id)}
            style={{ minWidth: 92, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 20, backgroundColor: on ? m.color + '2e' : t.item, borderWidth: 1.5, borderColor: on ? m.color : t.sheetBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: m.color + (on ? '55' : '2a'), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={18} color={ink(m.color)} stroke={2.1} />
              </View>
              <Text style={{ color: on ? ink(m.color) : t.text, fontWeight: '900', fontSize: 18 }}>{it.count}</Text>
            </View>
            <Text numberOfLines={1} style={{ color: on ? t.text : t.muted, fontWeight: '800', fontSize: 12.5, marginTop: 8 }}>{tl(it.id)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
