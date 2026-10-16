import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, Share, TextInput, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { dmId, useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

type Target = { id: string; name: string; group: boolean };

/** Condividi dentro l'app: anteprima del post, persone e gruppi a griglia (un tocco per sceglierli), invio con un pulsante; più link e altre app. */
export function SharePostSheet({ visible, onClose, author, text, media, uri, likeKey }: { visible: boolean; onClose: () => void; author: string; text: string; media?: 'photo' | 'video' | null; uri?: string; likeKey?: string }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const targets = useMemo<Target[]>(() => {
    const out: Target[] = [];
    const seen = new Set<string>();
    Object.values(chats).forEach((c) => { const id = c.type === 'dm' ? dmId(c.name) : c.id; if (!seen.has(id) && c.name !== me) { seen.add(id); out.push({ id, name: c.name, group: c.type !== 'dm' }); } });
    peoplePool(me).forEach((n) => { const id = dmId(n); if (!seen.has(id) && n !== me) { seen.add(id); out.push({ id, name: n, group: false }); } });
    return out;
  }, [chats, me]);
  const shown = targets.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const caption = `${translateText('Post di')} ${author}: ${text}`;
  const done = () => { setSel([]); setQ(''); onClose(); };

  const send = () => {
    const chat = useChat.getState();
    sel.forEach((id) => {
      if (id.startsWith('dm:')) chat.ensureDm(id.slice(3), me);
      chat.send(id, me, media && uri ? { kind: media === 'video' ? 'video' : 'image', text: caption, media: { uri, mime: media === 'video' ? 'video/mp4' : 'image/jpeg' } } : { kind: 'text', text: caption });
    });
    if (likeKey) useNet.getState().bumpReach(likeKey, 'share');
    toast(`${translateText('Condiviso con')} ${sel.length} ${sel.length === 1 ? translateText('chat') : translateText('chat')}`);
    done();
  };
  const link = likeKey ? `lifepilot://post?key=${encodeURIComponent(likeKey)}` : 'lifepilot://';
  const copy = async () => { try { await Clipboard.setStringAsync(link); toast('Link copiato'); } catch { toast('Non riesco a copiare il link'); } done(); };
  const other = async () => { try { await Share.share({ message: `${caption} ${link}` }); if (likeKey) useNet.getState().bumpReach(likeKey, 'share'); } catch { /* annullato */ } done(); };
  const action = (icon: string, label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={translateText(label)} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 7, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon as never} size={23} color={t.text} /></View>
      <Text numberOfLines={2} style={{ color: t.text, fontSize: 11.5, fontWeight: '700', textAlign: 'center' }}>{translateText(label)}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} title={translateText('Condividi')} onClose={done}>
      {/* anteprima */}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: t.chip, borderRadius: 18, padding: 10 }}>
        <View style={{ width: 62, height: 62, borderRadius: 12, overflow: 'hidden', backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}>
          {media && uri && media === 'photo' ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name={media === 'video' ? 'video' : 'note'} size={24} color={t.muted} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontWeight: '800', fontSize: 14.5 }}>{author}</Text>
          <Text numberOfLines={2} style={{ color: t.muted, fontSize: 13, lineHeight: 18, marginTop: 1 }}>{text}</Text>
        </View>
      </View>

      {/* ricerca */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: t.input, marginTop: 14 }}>
        <Icon name="search" size={17} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={translateText('Cerca una persona o un gruppo')} placeholderTextColor={t.muted} accessibilityLabel={translateText('Cerca')} style={{ flex: 1, color: t.text, fontSize: 15 }} />
      </View>

      {/* persone e gruppi */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 14 }}>
        {shown.slice(0, q.trim() ? 24 : 12).map((x) => {
          const on = sel.includes(x.id);
          return (
            <Pressable key={x.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={x.name} onPress={() => toggle(x.id)} style={{ width: '25%', alignItems: 'center', gap: 6 }}>
              <View>
                <View style={{ borderRadius: 34, borderWidth: 2.5, borderColor: on ? t.accent : 'transparent', padding: 2 }}>
                  {x.group ? <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={24} color={t.text} /></View> : <UserAvatar name={x.name} size={56} link={false} />}
                </View>
                {on ? <View style={{ position: 'absolute', end: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.bg }}><Icon name="check" size={13} color={t.onText} stroke={3.5} /></View> : null}
              </View>
              <Text numberOfLines={1} style={{ color: on ? t.text : t.muted, fontSize: 12, fontWeight: on ? '800' : '500', maxWidth: 76, textAlign: 'center' }}>{x.group ? x.name : x.name.split(' ')[0]}</Text>
            </Pressable>
          );
        })}
        {shown.length === 0 ? <Text style={{ color: t.muted, width: '100%', textAlign: 'center', paddingVertical: 16 }}>{translateText('Nessun risultato')}</Text> : null}
      </View>

      {/* invia */}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !sel.length }} accessibilityLabel={sel.length ? `${translateText('Invia a')} ${sel.length}` : translateText('Scegli almeno una chat')} disabled={!sel.length} onPress={send} style={({ pressed }) => ({ marginTop: 18, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: sel.length ? t.accent : t.chip, opacity: pressed ? 0.9 : 1 })}>
        <Icon name="send" size={19} color={sel.length ? t.onText : t.muted} />
        <Text style={{ color: sel.length ? t.onText : t.muted, fontSize: 16.5, fontWeight: '800' }}>{sel.length ? `${translateText('Invia a')} ${sel.length}` : translateText('Scegli almeno una chat')}</Text>
      </Pressable>

      {/* altre strade */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 6 }}>
        {action('link', 'Copia il link', () => void copy())}
        {action('share', 'Altre app', () => void other())}
      </View>
    </Sheet>
  );
}
