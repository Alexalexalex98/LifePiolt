import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { enter, whenLabel } from '@/lib/callActions';
import { canEnter, minutesTo, phase } from '@/lib/groupCall';
import { Icon } from '@/lib/icons';
import { useNow } from '@/lib/enroll';
import type { ChatMessage } from '@/store/chat';
import { inLabel } from './CallCard';

/** Le call a cui hai detto di sì restano fissate in alto: finché non è l'ora il conto alla rovescia, poi il pulsante per entrare. */
export function PinnedCalls({ calls, me, onJump }: { calls: ChatMessage[]; me: string; onJump: (mid: string) => void }) {
  const t = useTheme();
  const now = useNow(15000);
  if (!calls.length) return null;
  return (
    <View style={{ backgroundColor: t.card, borderBottomWidth: 1, borderBottomColor: t.border }}>
      {calls.slice(0, 2).map((m) => {
        const call = m.call!;
        const open = phase(call, now) === 'open';
        return (
          <Pressable key={m.id} onPress={() => onJump(m.id)} accessibilityRole="button" accessibilityLabel={`${call.title}, ${whenLabel(call.startsAt)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (open ? t.positive : t.accent) + '2a', alignItems: 'center', justifyContent: 'center' }}><Icon name={call.video ? 'video' : 'phone'} size={16} color={open ? t.positive : t.accent} stroke={2} /></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{call.title}</Text>
              <Text numberOfLines={1} style={{ color: open ? t.positive : t.muted, fontSize: 12, fontWeight: open ? '700' : '500' }}>{open ? tl('La stanza è aperta') : `${whenLabel(call.startsAt)} · ${inLabel(minutesTo(call, now))}`}</Text>
            </View>
            {open && canEnter(call, me, now) ? (
              <Pressable onPress={() => enter(m.chatId, m.id, me)} accessibilityRole="button" accessibilityLabel={tl('Entra')} style={{ paddingHorizontal: 14, minHeight: 36, borderRadius: 18, backgroundColor: t.positive, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{tl('Entra')}</Text>
              </Pressable>
            ) : <Icon name="pin" size={14} color={t.muted} />}
          </Pressable>
        );
      })}
    </View>
  );
}
