import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { IdeaCard, LpTag, PostCard, UserAvatar, openPurchaseConfirm, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, Page, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { badgesFor, bioFor, followerCountFor, ratingFor, receivedLPFor } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function UserProfile() {
  const t = useTheme();
  const { name: param } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const net = useNet();
  const name = param || me;
  const isMe = name === me;
  const ideasCount = net.ideas.filter((i) => i.author === name).length;
  const stats: [string, number, () => void][] = [];
  if (ideasCount > 0) stats.push(['Idee pubblicate', ideasCount, () => openSheet('statDetail', { what: 'ideas', name })]);
  if (isMe) {
    const given = net.ledger.filter((l) => l.desc.startsWith('Contributo a')).length;
    if (given > 0) stats.push(['Contributi dati', given, () => openSheet('statDetail', { what: 'contributions', name })]);
    if (net.bookings.length > 0) stats.push(['Servizi prenotati', net.bookings.length, () => openSheet('statDetail', { what: 'bookings', name })]);
  }
  const followers = followerCountFor(name, me, demo);
  const r = ratingFor(name);
  const fol = net.following.includes(name);
  const others = net.suggested.filter((n) => n !== name);
  const tab = net.prefs.upTab;
  const authorPosts = net.posts.filter((p) => p.author === name);
  const filtered = tab === 'Post' ? authorPosts : tab === 'Foto' ? authorPosts.filter((p) => p.media === 'photo') : authorPosts.filter((p) => p.media === 'video');

  return (
    <Page id="userProfile" back>
      <Card style={{ alignItems: 'center' }}>
        <UserAvatar name={name} size={84} />
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{name}</Text>
        <Body small muted>{isMe ? 'Il tuo profilo' : 'Profilo LifeNetwork'}</Body>
        <Body small style={{ marginTop: 6, textAlign: 'center' }}>{bioFor(name, me)}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {badgesFor(name, me).map((b) => <View key={b} style={{ backgroundColor: '#241a3a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: '#c9b6ff', fontSize: 12 }}>{b}</Text></View>)}
        </View>
        {stats.length > 0 && (
          <Row style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: t.item, paddingTop: 12, alignSelf: 'stretch' }}>
            {stats.map(([l, v, f]) => <Pressable key={l} style={{ flex: 1, alignItems: 'center' }} onPress={f}><Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{v}</Text><Body small muted>{l}</Body></Pressable>)}
          </Row>
        )}
        <Row style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: t.item, paddingTop: 14, alignSelf: 'stretch' }} gap={0}>
          <View style={{ flex: 1, alignItems: 'center' }}><Body bold>{followers}</Body><Body small muted>Follower</Body></View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: t.item }}><Row gap={2}><Body bold>{formatCHF(receivedLPFor(name))}</Body><LpTag size={13} /></Row><Body small muted>LP ricevuti</Body></View>
          <Pressable style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: t.item }} onPress={() => openSheet('rating', { name })}><Body bold>{r.avg ? `★ ${r.avg} (${r.count})` : 'Nessun voto'}</Body><Body small muted>Voto</Body></Pressable>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {isMe ? (
            <>
              <Btn small ghost title="Modifica profilo" onPress={() => openSheet('editProfile')} />
              <Btn small ghost title={`Seguiti (${net.following.length})`} onPress={() => openSheet('following')} />
              <Btn small ghost title="Biglietto" onPress={() => go('businessCard', { name })} />
              {followers >= 30 && (net.clubs[name] ? <Btn small ghost title="LifeClub" onPress={() => openSheet('clubManage')} /> : <Btn small title="Crea LifeClub" onPress={() => openSheet('createClub')} />)}
            </>
          ) : (
            <>
              <Btn small ghost={fol} title={fol ? 'Già seguito' : 'Segui'} onPress={() => { const f = net.toggleFollow(name); toast(f ? 'Ora segui ' + name : 'Non segui più ' + name); }} />
              <Btn small ghost title="Messaggio" onPress={() => go('conversationPage', { id: useChat.getState().ensureDm(name, me) })} />
              <Btn small ghost title="Vota" onPress={() => openSheet('vote', { name })} />
              <Btn small ghost title="Biglietto" onPress={() => go('businessCard', { name })} />
              {net.clubs[name] && <Btn small ghost title={`LifeClub · ${net.clubs[name].fee} LP`} onPress={() => joinClub(name)} />}
            </>
          )}
        </View>
      </Card>

      {others.length > 0 && (
        <View style={{ marginVertical: 14 }}>
          <Body small muted style={{ marginBottom: 8 }}>{isMe ? 'Altri profili' : 'Potresti conoscere'}</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {others.map((n) => <Pressable key={n} style={{ width: 62, alignItems: 'center' }} onPress={() => go('userProfile', { name: n })}><UserAvatar name={n} size={48} /><Body small muted numberOfLines={1} style={{ marginTop: 4 }}>{n.split(' ')[0]}</Body></Pressable>)}
          </ScrollView>
        </View>
      )}

      <Seg options={['Post', 'Foto', 'Video', 'Idee']} value={tab} onChange={(v) => net.setPref('upTab', v)} />
      {tab === 'Idee' ? (
        (() => { const l = net.ideas.filter((i) => i.author === name); return l.length ? l.map((i) => <IdeaCard key={i.id} idea={i} />) : <Card><Empty text="Ancora nessuna idea pubblicata." /></Card>; })()
      ) : filtered.length ? filtered.map((p) => <PostCard key={p.id} post={p} likeKey={'standalone:' + p.id} />) : <Card><Empty text="Ancora nessun contenuto qui." /></Card>}
    </Page>
  );
}

function joinClub(name: string) {
  const club = useNet.getState().clubs[name];
  if (!club) return;
  openPurchaseConfirm('LifeClub di ' + name, [['Titolare', name], ['Quota mensile', club.fee + ' LP'], ['Contenuto', club.desc || 'Contenuti esclusivi del club']], () => {
    const st = useNet.getState();
    const me = useApp.getState().account.name;
    if (!st.spend(club.fee, 'Quota LifeClub di ' + name, name)) { toast('LifePoints insufficienti'); return; }
    useNet.setState((s) => ({
      clubs: { ...s.clubs, [name]: { ...club, members: club.members.includes(me) ? club.members : [...club.members, me] } },
      communities: s.communities.map((c) => (c.id === club.communityId && !c.members.includes(me) ? { ...c, members: [...c.members, me] } : c)),
    }));
    toast('Iscritto al LifeClub di ' + name);
  }, 'userProfile');
}
