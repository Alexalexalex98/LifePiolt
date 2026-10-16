import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar, openSheet, useNetSheet } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';

type Tile = { key: string; icon: string; title: string; sub: string; run: () => void };

/** «Crea»: da qui si pubblica qualsiasi contenuto dell'app. Sobrio: un solo colore (quello dell'app), icone nitide, testo chiaro. */
export function CreateHubView() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const hasBusiness = useIdentity((x) => x.businesses).some((b) => b.owner === me);
  const close = () => useNetSheet.getState().close();
  const page = (p: string, params?: Record<string, string>) => () => { close(); go(p, params); };
  const main: Tile = { key: 'post', icon: 'image', title: 'Post', sub: 'Foto, video o una frase', run: () => openSheet('newPost') };
  const tiles: Tile[] = [
    { key: 'recap', icon: 'sparkle', title: 'Recap', sub: 'Un momento per 24 ore', run: page('storyCreate') },
    { key: 'idea', icon: 'poll', title: 'Idea', sub: 'Raccogli sostegno', run: () => openSheet('newIdea') },
    { key: 'seminar', icon: 'calendar', title: 'Seminario', sub: 'Un evento con date', run: () => openSheet('newSeminar') },
    { key: 'service', icon: 'briefcase', title: 'Servizio o attività', sub: 'Offri il tuo lavoro', run: page('businessCreate') },
    { key: 'job', icon: 'contact', title: 'Offerta di lavoro', sub: 'Cerca persone', run: page('jobEdit') },
    { key: 'shop', icon: 'orders', title: 'Prodotto', sub: hasBusiness ? 'Nel tuo negozio' : 'Prima crea un’attività', run: hasBusiness ? page('shopPage', { name: me }) : page('businessCreate') },
    { key: 'community', icon: 'users', title: 'Community', sub: 'Un gruppo tematico', run: () => openSheet('newCommunity') },
  ];
  /* spunti per iniziare: tre al giorno, a rotazione (toccandone uno il post parte già scritto) */
  const PROMPTS = ['Racconta una cosa che hai imparato questa settimana', 'Una foto di oggi che ti ha fatto sorridere', 'Cosa consigli a chi sta iniziando?', 'Una domanda per chi mi segue: voi cosa fareste?', 'Il mio obiettivo di questa settimana è…', 'Un posto che consiglio e perché'];
  const day = Math.floor(Date.now() / 86400000);
  const prompts = [0, 1, 2].map((i) => PROMPTS[(day + i * 2) % PROMPTS.length]);
  return (
    <View style={{ gap: 16 }}>
      {/* azione principale: scrivi subito o scegli cosa allegare */}
      <View style={{ borderRadius: 24, backgroundColor: t.accent, padding: 16, gap: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${tl(main.title)}. ${tl(main.sub)}`} onPress={main.run} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <UserAvatar name={me} size={42} link={false} />
          <View style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text style={{ color: t.onText, opacity: 0.85, fontSize: 15 }}>{tl('Cosa vuoi condividere?')}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['image', 'Foto'], ['video', 'Video'], ['edit', 'Frase']] as const).map(([ic, label]) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={tl(label)} onPress={main.run} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 20, backgroundColor: pressed ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)' })}>
              <Icon name={ic as never} size={17} color={t.onText} />
              <Text style={{ color: t.onText, fontWeight: '800', fontSize: 13.5 }}>{tl(label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* spunti di Theia */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="sparkle" size={14} color={t.accent} />
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}>{tl('SPUNTI PER OGGI')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {prompts.map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={tl(x)} onPress={() => openSheet('newPost', { prefill: tl(x) })} style={({ pressed }) => ({ width: 220, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.item, opacity: pressed ? 0.85 : 1 })}>
              <Text numberOfLines={3} style={{ color: t.text, fontSize: 14.5, lineHeight: 20, fontWeight: '600' }}>{tl(x)}</Text>
              <Text style={{ color: t.accent, fontSize: 12.5, fontWeight: '800', marginTop: 8 }}>{tl('Scrivi')}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* il resto che puoi creare */}
      <View>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>{tl('CREA ANCHE')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {tiles.map((x) => (
            <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={`${tl(x.title)}. ${tl(x.sub)}`} onPress={x.run} style={({ pressed }) => ({ width: '48.5%', minHeight: 124, borderRadius: 22, padding: 14, justifyContent: 'space-between', backgroundColor: t.card, borderWidth: 1, borderColor: t.item, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent + '22', borderWidth: 1, borderColor: t.accent + '44', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon as never} size={21} color={t.accent} /></View>
              <View>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 15.5, fontWeight: '800' }}>{tl(x.title)}</Text>
                <Text numberOfLines={2} style={{ color: t.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{tl(x.sub)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
