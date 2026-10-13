import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { suggestCommands, type CommandSuggestion } from '@/lib/assistantCommands';
import { Icon } from '@/lib/icons';

/** Mentre scrivi: i comandi che Theia capisce, filtrati da quello che digiti. Un tocco li mette nel campo. */
export function CommandSuggest({ typed, onPick }: { typed: string; onPick: (c: CommandSuggestion) => void }) {
  const t = useTheme();
  const list = suggestCommands(typed, 5);
  if (!list.length) return null;
  return (
    <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, marginBottom: 8, overflow: 'hidden' }}>
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>{typed.trim() ? 'Puoi chiedermi' : 'Prova a scrivere'}</Text>
      {list.map((c, i) => (
        <Pressable key={c.id} onPress={() => onPick(c)} accessibilityRole="button" accessibilityLabel={translateText(c.label)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border, backgroundColor: pressed ? t.chip : 'transparent' })}>
          <Icon name={c.icon} size={18} color={t.accent} stroke={2} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{translateText(c.label)}</Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 12 }}>{c.area}</Text>
        </Pressable>
      ))}
    </View>
  );
}
