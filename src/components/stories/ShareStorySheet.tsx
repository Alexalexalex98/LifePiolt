import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { StoryFx } from '@/components/stories/StoryFx';
import { VideoPoster } from '@/components/stories/VideoPoster';
import { UserAvatar } from '@/components/network';
import { Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { peoplePool } from '@/lib/network';
import { makeStory, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { dmId, useChat } from '@/store/chat';
import { newId, useNet } from '@/store/network';
import { toast } from '@/store/toast';

const LINK = (s: Story) => `lifepilot://recap?u=${encodeURIComponent(s.author)}&id=${encodeURIComponent(s.id)}`;

/** Condividi un momento del recap: anteprima, persone a cui mandarlo con un tocco, e le altre strade (tuo recap, link, altre app). */
export function ShareStorySheet({ visible, onClose, story }: { visible: boolean; onClose: () => void; story: Story }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const [sel, setSel] = useState<string[]>([]);
  // chat recenti per prime, poi le altre persone
  const people = useMemo(() => {
    const names: string[] = [];
    Object.values(chats).forEach((c) => { if (c.type === 'dm' && c.name !== me && !names.includes(c.name)) names.push(c.name); });
    peoplePool(me).forEach((n) => { if (n !== me && !names.includes(n)) names.push(n); });
    return names.slice(0, 16);
  }, [chats, me]);
  const toggle = (n: string) => setSel((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]));
  const done = () => { setSel([]); onClose(); };

  const sendTo = () => {
    const chat = useChat.getState();
    sel.forEach((n) => {
      const id = chat.ensureDm(n, me);
      chat.send(id, me, { kind: 'text', text: `${tl('Recap di {0}', story.author)}${story.text ? `: ${story.text}` : ''}`, storyReply: { author: story.author, kind: story.kind, mine: false, ...(story.uri ? { uri: story.uri } : {}), ...(story.kind === 'text' ? { text: story.text, bg: story.bg } : {}) } });
    });
    toast(tl('Inviato a {0}', sel.length === 1 ? sel[0] : `${sel.length} ${tl('persone')}`));
    done();
  };
  const toMyRecap = () => {
    const made = makeStory({ id: String(newId()), author: me, now: Date.now(), kind: story.kind, uri: story.uri, text: story.text, bg: story.bg, filter: story.filter, adj: story.adj, fit: story.fit, textPos: story.textPos, textColor: story.textColor, textSize: story.textSize, textStyle: story.textStyle });
    if (!made) { toast('Non posso aggiungerlo al tuo recap'); return; }
    useNet.getState().patch({ stories: [...(useNet.getState().stories ?? []), { ...made, ...(story.poster ? { poster: story.poster } : {}) }] });
    toast('Aggiunto al tuo recap');
    done();
  };
  const copy = async () => { try { await Clipboard.setStringAsync(LINK(story)); toast('Link copiato'); } catch { toast('Non riesco a copiare il link'); } done(); };
  const other = async () => { try { await Share.share({ message: `${tl('Recap di {0}', story.author)}${story.text ? `: ${story.text}` : ''} ${LINK(story)}` }); } catch { /* annullato */ } done(); };

  const tile = (icon: string, label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 7, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: t.chip }}><Icon name={icon as never} size={24} color={t.text} /></View>
      <Text numberOfLines={2} style={{ color: t.text, fontSize: 11.5, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} title={tl('Condividi il recap')} onClose={done}>
      {/* anteprima del momento */}
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: t.chip, borderRadius: 20, padding: 12 }}>
        <View style={{ width: 72, height: 112, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111' }}>
          {story.kind === 'text' ? <LinearGradient colors={story.bg ?? ['#6c8cff', '#3b2a7a']} style={{ flex: 1, padding: 6, justifyContent: 'center' }}><Text numberOfLines={5} style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>{story.text}</Text></LinearGradient>
            : story.kind === 'photo' ? <Image source={{ uri: story.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <VideoPoster uri={story.uri} poster={story.poster} width={72} height={112} />}
          {story.kind !== 'text' ? <StoryFx s={story} /> : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><UserAvatar name={story.author} size={26} link={false} /><Text numberOfLines={1} style={{ color: t.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{story.author === me ? tl('Il tuo recap') : story.author}</Text></View>
          {story.text ? <Text numberOfLines={3} style={{ color: t.muted, fontSize: 13.5, lineHeight: 19 }}>{story.text}</Text> : <Text style={{ color: t.muted, fontSize: 13.5 }}>{tl(story.kind === 'video' ? 'Video' : 'Foto')}</Text>}
        </View>
      </View>

      {/* persone */}
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 18, marginBottom: 10 }}>{tl('INVIA A')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
        {people.map((n) => {
          const on = sel.includes(n);
          return (
            <Pressable key={n} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={n} onPress={() => toggle(n)} style={{ width: 66, alignItems: 'center', gap: 6 }}>
              <View>
                <View style={{ borderRadius: 32, borderWidth: 2.5, borderColor: on ? t.accent : 'transparent', padding: 2 }}><UserAvatar name={n} size={54} link={false} /></View>
                {on ? <View style={{ position: 'absolute', end: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.bg }}><Icon name="check" size={13} color="#fff" stroke={3.5} /></View> : null}
              </View>
              <Text numberOfLines={1} style={{ color: on ? t.text : t.muted, fontSize: 12, fontWeight: on ? '800' : '500' }}>{n.split(' ')[0]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !sel.length }} accessibilityLabel={sel.length ? tl('Invia a {0}', sel.length) : tl('Scegli una persona')} disabled={!sel.length} onPress={sendTo} style={({ pressed }) => ({ marginTop: 14, opacity: sel.length ? 1 : 0.45, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: t.accent }}>
          <Icon name="send" size={20} color={t.onText} />
          <Text style={{ color: t.onText, fontSize: 16, fontWeight: '800' }}>{sel.length ? tl('Invia a {0}', sel.length) : tl('Scegli una persona')}</Text>
        </View>
      </Pressable>

      {/* altre strade */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 22, marginBottom: 6 }}>
        {tile('plus', tl('Aggiungi al tuo recap'), toMyRecap)}
        {tile('link', tl('Copia il link'), () => void copy())}
        {tile('share', tl('Altre app'), () => void other())}
      </View>
    </Sheet>
  );
}
