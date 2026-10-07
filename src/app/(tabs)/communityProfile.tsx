import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { PostCard, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, IL, Item, Page, Row } from '@/components/ui';
import { describeCommunity } from '@/data/marketSeed';
import { go } from '@/lib/nav';
import { fmtDate } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function CommunityProfile() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const c = net.communities.find((x) => String(x.id) === id);
  if (!c) return <Page id="communityProfile" title="Community" back><Card><Empty text="Community non trovata." /></Card></Page>;
  const joined = c.members.includes(me);
  const d = describeCommunity(c);
  const canPost = c.owner === me || c.openPosting;
  return (
    <Page id="communityProfile" title={c.name} back>
      <Card>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <IL icon="compass" small>Argomento: {c.topic}</IL>
          <IL icon="users" small>{c.members.length} {c.members.length === 1 ? 'membro' : 'membri'}</IL>
          <IL icon="profile" small muted>{c.owner === 'system' ? 'Gestita da LifePilot' : `Creata da ${c.owner}`}{c.ts ? ` · dal ${fmtDate(c.ts)}` : ''}</IL>
        </View>
        <Btn small ghost={joined} title={joined ? 'Iscritto · esci dalla community' : 'Iscriviti'} onPress={() => {
          net.patch({ communities: net.communities.map((x) => (x.id === c.id ? { ...x, members: joined ? x.members.filter((m) => m !== me) : [...x.members, me] } : x)) });
          toast(joined ? 'Hai lasciato ' + c.name : 'Iscritto a ' + c.name);
        }} />
        {joined && <Btn small ghost style={{ marginTop: 8 }} title="Pubblica qui" onPress={() => { if (!canPost) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} />}
      </Card>
      <Card>
        <H>Di cosa parla</H>
        <Body small>{d.desc}</Body>
        <Body bold style={{ marginTop: 14, marginBottom: 4 }}>Regole di pubblicazione</Body>
        <Body small>{d.rules}</Body>
        {joined && !canPost && <Body small muted style={{ marginTop: 8 }}>Sei iscritto: puoi leggere, mettere mi piace e commentare, ma non pubblicare.</Body>}
      </Card>
      <Card>
        <H>Membri ({c.members.length})</H>
        {c.members.length === 0 ? <Body small muted>Ancora nessun membro: iscriviti per essere il primo.</Body> : c.members.map((m, i) => <Item key={m} last={i === c.members.length - 1} onPress={() => go('userProfile', { name: m })}><Row style={{ justifyContent: 'flex-start' }} gap={10}><UserAvatar name={m} size={26} /><Body>{m}</Body></Row></Item>)}
      </Card>
      <Body small muted style={{ marginBottom: 8 }}>Post della community</Body>
      {c.posts.length === 0 ? <Card><Empty text="Ancora nessun post in questa community." /></Card> : c.posts.map((p, pi) => <PostCard key={pi} post={{ author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes, ts: p.ts, uri: p.uri }} likeKey={`community:${c.id}:${pi}`} />)}
    </Page>
  );
}
