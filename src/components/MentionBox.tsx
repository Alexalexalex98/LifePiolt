import { useMemo } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { activeMention, applyMention, splitMentions, suggestNames } from '@/lib/mentions';
import { go } from '@/lib/nav';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

/** Chi si può menzionare: le persone che segui, quelle con cui hai una chat e quelle che conosci nell'app. */
export function useMentionNames(): string[] {
  const me = useApp((s) => s.account.name);
  const following = useNet((s) => s.following);
  const chats = useChat((s) => s.chats);
  return useMemo(() => {
    const names: string[] = [...following];
    Object.values(chats).forEach((c) => { if (c.type === 'dm') names.push(c.name); });
    peoplePool(me).forEach((n) => names.push(n));
    return [...new Set(names.filter((n) => n && n !== me))];
  }, [following, chats, me]);
}

/** Suggerimenti quando scrivi «@»: una riga di persone sopra il campo. Si usa accanto a qualunque campo di testo. */
export function MentionSuggest({ text, onPick }: { text: string; onPick: (next: string) => void }) {
  const t = useTheme();
  const names = useMentionNames();
  const a = activeMention(text);
  const list = a ? suggestNames(a.query, names, 8) : [];
  if (!a || !list.length) return null;
  return (
    <View accessibilityLabel="Suggerimenti persone" style={{ marginVertical: 6 }}>
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {list.map((n) => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`@${n}`} onPress={() => onPick(applyMention(text, n))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingStart: 6, paddingEnd: 14, borderRadius: 999, backgroundColor: pressed ? t.item : t.chip, borderWidth: 1, borderColor: t.border })}>
            <UserAvatar name={n} size={26} link={false} />
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Testo con le menzioni evidenziate: un tocco su «@Nome» apre il suo profilo. */
export function MentionText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const names = useMentionNames();
  const me = useApp((s) => s.account.name);
  const segs = useMemo(() => splitMentions(text, [...names, me]), [text, names, me]);
  return (
    <Text style={style}>
      {segs.map((s, i) => s.mention
        ? <Text key={i} onPress={() => go('userProfile', { name: s.mention! })} accessibilityRole="link" style={{ color: t.accent, fontWeight: '700' }}>{s.text}</Text>
        : s.text)}
    </Text>
  );
}
