import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { openSheet, useNetSheet } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';

type Tile = { key: string; icon: string; title: string; sub: string; colors: [string, string]; run: () => void; wide?: boolean };

/** «Crea»: da qui si pubblica qualsiasi contenuto dell'app. Foto, video e frasi vanno in un post, il recap ha la sua schermata. */
export function CreateHubView() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const hasBusiness = useIdentity((x) => x.businesses).some((b) => b.owner === me);
  const { width } = useWindowDimensions();
  const close = () => useNetSheet.getState().close();
  const page = (p: string, params?: Record<string, string>) => () => { close(); go(p, params); };
  const tiles: Tile[] = [
    { key: 'post', icon: 'image', title: 'Post', sub: 'Foto, video o una frase', colors: ['#7b5cff', '#c13fd6'], run: () => openSheet('newPost'), wide: true },
    { key: 'recap', icon: 'sparkle', title: 'Recap', sub: 'Un momento per 24 ore', colors: ['#ff7a59', '#ff2d87'], run: page('storyCreate') },
    { key: 'idea', icon: 'poll', title: 'Idea', sub: 'Raccogli sostegno', colors: ['#16c79a', '#1f7ae0'], run: () => openSheet('newIdea') },
    { key: 'seminar', icon: 'calendar', title: 'Seminario', sub: 'Un evento con date', colors: ['#f5a623', '#e8543a'], run: () => openSheet('newSeminar') },
    { key: 'service', icon: 'briefcase', title: 'Servizio o attività', sub: 'Offri il tuo lavoro', colors: ['#4facfe', '#5b6cff'], run: page('businessCreate') },
    { key: 'job', icon: 'contact', title: 'Offerta di lavoro', sub: 'Cerca persone', colors: ['#38d9a9', '#12a37a'], run: page('jobEdit') },
    { key: 'shop', icon: 'orders', title: 'Prodotto', sub: hasBusiness ? 'Nel tuo negozio' : 'Prima crea un’attività', colors: ['#b197fc', '#7048e8'], run: hasBusiness ? page('shopPage', { name: me }) : page('businessCreate') },
    { key: 'community', icon: 'users', title: 'Community', sub: 'Un gruppo tematico', colors: ['#ff6b8b', '#d6336c'], run: () => openSheet('newCommunity') },
  ];
  const w = (width - 32 - 12) / 2;
  return (
    <View>
      <Text style={{ color: t.muted, fontSize: 13.5, marginBottom: 14 }}>{tl('Cosa vuoi pubblicare?')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((x) => (
          <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={`${tl(x.title)}. ${tl(x.sub)}`} onPress={x.run} style={({ pressed }) => ({ width: x.wide ? width - 32 : w, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <LinearGradient colors={x.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 14, minHeight: x.wide ? 92 : 118, justifyContent: 'space-between', flexDirection: x.wide ? 'row' : 'column', alignItems: x.wide ? 'center' : 'flex-start', gap: 10 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon as never} size={22} color="#fff" /></View>
              <View style={{ flex: x.wide ? 1 : undefined }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{tl(x.title)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 2 }}>{tl(x.sub)}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
