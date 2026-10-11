import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Club } from '@/lib/club';
import { previewOf, clubChatId, useChat } from '@/store/chat';

/** Ultimi messaggi del canale del club (sola lettura), per la scheda Chat della pagina pubblica. */
export function ClubChatPreview({ club }: { club: Club }) {
  const t = useTheme();
  const msgs = useChat((s) => s.messages[clubChatId(club.id)]);
  const last = (msgs ?? []).filter((m) => m.kind !== 'system' && !m.deletedForAll).slice(-3);
  if (!last.length) return <Body small muted style={{ marginTop: 10 }}>Ancora nessun messaggio.</Body>;
  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {last.map((m) => (
        <View key={m.id} style={{ backgroundColor: t.chip, borderRadius: 12, padding: 10 }}>
          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700' }}>{m.from === club.owner ? `${m.from} · creatore` : m.from}</Text>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, marginTop: 2 }}>{previewOf(m)}</Text>
        </View>
      ))}
    </View>
  );
}
