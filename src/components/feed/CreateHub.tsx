import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { openSheet, useNetSheet } from '@/components/network';
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
  return (
    <View style={{ gap: 10 }}>
      {/* azione principale */}
      <Pressable accessibilityRole="button" accessibilityLabel={`${tl(main.title)}. ${tl(main.sub)}`} onPress={main.run} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: t.accent, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}><Icon name={main.icon as never} size={22} color={t.onText} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.onText, fontSize: 17, fontWeight: '800' }}>{tl(main.title)}</Text>
          <Text style={{ color: t.onText, opacity: 0.8, fontSize: 13, marginTop: 2 }}>{tl(main.sub)}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={t.onText} />
      </Pressable>
      {/* tutto il resto, in elenco ordinato */}
      <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.item, overflow: 'hidden' }}>
        {tiles.map((x, i) => (
          <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={`${tl(x.title)}. ${tl(x.sub)}`} onPress={x.run} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: t.item, backgroundColor: pressed ? t.chip : 'transparent' })}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon as never} size={19} color={t.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{tl(x.title)}</Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{tl(x.sub)}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={t.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
