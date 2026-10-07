import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { PostCard, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, Item, Page, Row } from '@/components/ui';
import { go } from '@/lib/nav';
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
  return (
    <Page id="communityProfile" title={c.name} back>
      <Card>
        <Body small muted style={{ marginBottom: 10 }}>{c.topic} · {c.members.length} membri · {c.openPosting ? 'tutti possono pubblicare' : 'solo il proprietario pubblica'}</Body>
        <Btn small ghost={joined} title={joined ? 'Iscritto ✓ · esci' : 'Iscriviti'} onPress={() => {
          net.patch({ communities: net.communities.map((x) => (x.id === c.id ? { ...x, members: joined ? x.members.filter((m) => m !== me) : [...x.members, me] } : x)) });
          toast(joined ? 'Hai lasciato ' + c.name : 'Iscritto a ' + c.name);
        }} />
        {joined && <Btn small ghost style={{ marginTop: 8 }} title="Pubblica qui" onPress={() => { if (c.owner !== me && !c.openPosting) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} />}
      </Card>
      <Card>
        <Body small muted style={{ marginBottom: 8 }}>Membri</Body>
        {c.members.map((m, i) => <Item key={m} last={i === c.members.length - 1} onPress={() => go('userProfile', { name: m })}><Row style={{ justifyContent: 'flex-start' }} gap={10}><UserAvatar name={m} size={26} /><Body>{m}</Body></Row></Item>)}
      </Card>
      {c.posts.length === 0 ? <Card><Empty text="Ancora nessun post in questa community." /></Card> : c.posts.map((p, pi) => <PostCard key={pi} post={{ author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes }} likeKey={`community:${c.id}:${pi}`} />)}
      <View />
    </Page>
  );
}
