import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { heroPaletteFor } from '@/components/feed/feedColors';
import { FeedPost } from '@/components/feed/FeedPost';
import { ArtShapes, FEED_RADIUS, SoftPill } from '@/components/feed/parts';
import { ModButton, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, Page } from '@/components/ui';
import { describeCommunity } from '@/data/marketSeed';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { fmtDate } from '@/lib/when';
import { useApp } from '@/store/app';
import { useVisible } from '@/lib/moderation';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function CommunityProfile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const c = net.communities.find((x) => String(x.id) === id);
  const visible = useVisible();
  if (c && !visible('community', c.id, c.owner === 'system' ? undefined : c.owner)) return <Page id="communityProfile" title="Community" back><Card><Empty text="Hai nascosto o segnalato questa community, oppure il proprietario è bloccato." /><Btn small ghost style={{ marginTop: 10 }} title="Segnalazioni inviate" onPress={() => go('reports')} /></Card></Page>;
  if (!c) return <Page id="communityProfile" title="Community" back><Card><Empty text="Community non trovata." /></Card></Page>;
  const joined = c.members.includes(me);
  const d = describeCommunity(c);
  const canPost = c.owner === me || c.openPosting;
  const g = heroPaletteFor(c.name);
  const toggle = () => {
    net.patch({ communities: net.communities.map((x) => (x.id === c.id ? { ...x, members: joined ? x.members.filter((m) => m !== me) : [...x.members, me] } : x)) });
    toast(joined ? tl('Hai lasciato {0}', c.name) : tl('Iscritto a {0}', c.name));
  };
  return (
    <Page id="communityProfile" back right={c.owner !== me ? <ModButton kind="community" refId={c.id} label={c.name} author={c.owner === 'system' ? undefined : c.owner} /> : undefined}>
      <View style={{ borderRadius: FEED_RADIUS, overflow: 'hidden', marginTop: 6 }}>
        <LinearGradient colors={[g.from, g.to]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={{ padding: 22, minHeight: 210, justifyContent: 'space-between' }}>
          <ArtShapes seed={c.name} size={400} />
          <SoftPill label={`${tl('Argomento')}: ${c.topic}`} icon="compass" color="#ffffff" bg="rgba(255,255,255,0.2)" />
          <View style={{ marginTop: 50, gap: 6 }}>
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 31, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 }}>{c.name}</Text>
            <Text style={{ color: g.sub, fontSize: 13.5 }}>{c.owner === 'system' ? 'Gestita da LifePilot' : `Creata da ${c.owner}`}{c.ts ? ` · dal ${fmtDate(c.ts)}` : ''}</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <View style={{ flexDirection: 'row' }}>{c.members.slice(0, 5).map((m, i) => <View key={m} style={{ marginStart: i ? -10 : 0, borderRadius: 18, borderWidth: 2, borderColor: t.bg }}><UserAvatar name={m} size={30} /></View>)}</View>
        <Text style={{ color: t.muted, fontSize: 14, flex: 1 }}>{c.members.length} {c.members.length === 1 ? 'membro' : 'membri'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Btn style={{ flex: 1 }} ghost={joined} title={joined ? 'Iscritto · esci dalla community' : 'Iscriviti'} onPress={toggle} />
      </View>
      {joined && <Btn ghost style={{ marginTop: 10 }} icon="plus" title="Pubblica qui" onPress={() => { if (!canPost) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} />}

      <Card style={{ marginTop: 18 }}>
        <H>Di cosa parla</H>
        <Text style={{ color: t.text, fontSize: 15, lineHeight: 23 }}>{d.desc}</Text>
        <Body bold style={{ marginTop: 16, marginBottom: 4 }}>Regole di pubblicazione</Body>
        <Body small muted>{d.rules}</Body>
        {joined && !canPost && <Body small muted style={{ marginTop: 8 }}>Sei iscritto: puoi leggere, mettere mi piace e commentare, ma non pubblicare.</Body>}
      </Card>

      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 6, marginBottom: 10 }}>{tl('Membri ({0})', c.members.length)}</Text>
      {c.members.length === 0 ? <Body small muted>Ancora nessun membro: iscriviti per essere il primo.</Body> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
          {c.members.map((m) => <Pressable key={m} onPress={() => go('userProfile', { name: m })} accessibilityRole="link" accessibilityLabel={m} style={{ width: 66, minHeight: 44, alignItems: 'center' }}><UserAvatar name={m} size={52} /><Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5, marginTop: 4 }}>{m.split(' ')[0]}</Text></Pressable>)}
        </ScrollView>
      )}

      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 12 }}>Post della community</Text>
      {c.posts.length === 0 ? <Card><Empty text="Ancora nessun post in questa community." /></Card> : (
        <View style={{ marginHorizontal: -16 }}>
          {c.posts.map((p, pi) => <FeedPost key={pi} post={{ author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes, ts: p.ts, uri: p.uri }} likeKey={`community:${c.id}:${pi}`} />)}
        </View>
      )}
    </Page>
  );
}
