import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/T';

import { LpTag, ModButton, UserAvatar, openPurchaseConfirm, openSheet } from '@/components/network';
import { IdeaHero } from '@/components/feed/SpecialCards';
import { ArtPlaceholder, ArtShapes, RingAvatar } from '@/components/feed/parts';
import { paletteFor } from '@/components/feed/feedColors';
import { chunk } from '@/components/feed/feedLogic';
import { Icon } from '@/lib/icons';
import { Body, Btn, Card, Chev, Empty, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF, hashStr } from '@/lib/format';
import { go } from '@/lib/nav';
import { fmtDateTime } from '@/lib/when';
import { badgesFor, bioFor, followerCountFor, ratingFor, receivedLPFor } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useVisible } from '@/lib/moderation';
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
  const visible = useVisible();
  const blockedUser = useChat((s) => s.blocked.includes(name));
  const ideasCount = net.ideas.filter((i) => i.author === name).length;
  const stats: [string, number, () => void][] = [];
  if (ideasCount > 0) stats.push(['Idee pubblicate', ideasCount, () => openSheet('statDetail', { what: 'ideas', name })]);
  if (isMe) {
    const given = net.ledger.filter((l) => l.desc.startsWith('Contributo a')).length;
    if (given > 0) stats.push(['Contributi dati', given, () => openSheet('statDetail', { what: 'contributions', name })]);
    const nSem = net.enrollments.filter((e) => e.kind === 'seminar').length;
    const nSvc = net.enrollments.filter((e) => e.kind === 'service').length;
    if (nSem > 0) stats.push(['Seminari', nSem, () => openSheet('statDetail', { what: 'seminars', name })]);
    if (nSvc > 0) stats.push(['Servizi prenotati', nSvc, () => openSheet('statDetail', { what: 'bookings', name })]);
  }
  const hostSeminars = net.seminars.filter((x) => x.host === name);
  const provider = net.providers.find((x) => x.name === name);
  const followers = followerCountFor(name, me, demo);
  const r = ratingFor(name);
  const fol = net.following.includes(name);
  const others = net.suggested.filter((n) => n !== name);
  const tab = net.prefs.upTab;
  const authorPosts = net.posts.filter((p) => p.author === name);
  const filtered = tab === 'Post' ? authorPosts : tab === 'Foto' ? authorPosts.filter((p) => p.media === 'photo') : authorPosts.filter((p) => p.media === 'video');

  const win = useWindowDimensions().width;
  const hc = useApp((s) => s.accessibility.highContrast);
  const postCount = authorPosts.length + net.communities.reduce((n, c) => n + c.posts.filter((p) => p.author === name).length, 0);
  const followingCount = isMe ? net.following.length : demo ? 40 + (Math.abs(hashStr(name + 'seguiti')) % 220) : 0;
  const cell = Math.floor((win - 2) / 3);
  const tabs: { key: string; label: string; icon: string }[] = [{ key: 'Post', label: 'Post', icon: 'grid' }, { key: 'Foto', label: 'Foto', icon: 'image' }, { key: 'Video', label: 'Video', icon: 'video' }, { key: 'Idee', label: 'Idee', icon: 'sparkle' }];
  const stat = (n: number | string, label: string, onPress?: () => void) => (
    <Pressable key={label} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${n} ${label}`} style={{ flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{n}</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  const thumb = (p: (typeof authorPosts)[number]) => {
    const key = 'standalone:' + p.id;
    const pal = paletteFor(p.author + p.text, t.mode === 'light' ? 'light' : 'dark', hc);
    return (
      <Pressable key={p.id} onPress={() => go('postPage', { key })} accessibilityRole="button" accessibilityLabel={p.text} style={{ width: cell, height: cell, overflow: 'hidden' }}>
        {p.media && p.uri ? <Image source={{ uri: p.uri }} style={{ width: cell, height: cell }} contentFit="cover" />
          : p.media ? <ArtPlaceholder seed={p.author + p.text} width={cell} height={cell} video={p.media === 'video'} />
          : (
            <LinearGradient colors={[pal.from, pal.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: cell, height: cell, padding: 10, justifyContent: 'center' }}>
              <ArtShapes seed={p.author + p.text} size={cell} />
              <Text numberOfLines={6} style={{ color: pal.text, fontSize: 12, lineHeight: 15, fontWeight: '800' }}>{p.text}</Text>
            </LinearGradient>
          )}
        {p.media === 'video' && p.uri ? <View style={{ position: 'absolute', top: 6, end: 6 }}><Icon name="video" size={16} color="#fff" /></View> : null}
      </Pressable>
    );
  };

  return (
    <Page id="userProfile" back right={!isMe ? <ModButton kind="profile" refId={name} label={`Profilo di ${name}`} author={name} /> : undefined}>
      {!isMe && (blockedUser || !visible('profile', name)) && (
        <Card>
          <Body bold>{blockedUser ? `Hai bloccato ${name}` : 'Hai segnalato o nascosto questo profilo'}</Body>
          <Body small muted style={{ marginTop: 4 }}>{blockedUser ? 'Non vedi i suoi contenuti e non puoi scrivergli. Puoi sbloccarlo qui o da Segnalazioni inviate.' : 'Lo trovi in Segnalazioni inviate, dove puoi annullare la segnalazione.'}</Body>
          <Row style={{ marginTop: 10, justifyContent: 'flex-start' }} gap={8}>
            {blockedUser && <Btn small title={`Sblocca ${name}`} onPress={() => { useChat.getState().block(name, false); toast(`${name} sbloccato`); }} />}
            <Btn small ghost title="Segnalazioni inviate" onPress={() => go('reports')} />
          </Row>
        </Card>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <RingAvatar name={name} size={84} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {stat(postCount, 'Post')}
          {stat(followers, 'Follower')}
          {stat(followingCount, 'Seguiti', isMe ? () => openSheet('following') : undefined)}
        </View>
      </View>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 21, fontWeight: '800', marginTop: 14 }}>{name}</Text>
      <Text style={{ color: t.muted, fontSize: 13.5, marginTop: 1 }}>{isMe ? 'Il tuo profilo' : 'Profilo LifeNetwork'}</Text>
      {bioFor(name, me) ? <Text style={{ color: t.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{bioFor(name, me)}</Text> : null}
      {badgesFor(name, me).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {badgesFor(name, me).map((b) => <View key={b} style={{ backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: t.text, fontSize: 12.5, fontWeight: '600' }}>{b}</Text></View>)}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {isMe ? (
          <>
            <Btn style={{ flex: 1 }} ghost title="Modifica profilo" onPress={() => openSheet('editProfile')} />
            <Btn style={{ flex: 1 }} ghost title="Biglietto" onPress={() => go('businessCard', { name })} />
          </>
        ) : (
          <>
            <Btn style={{ flex: 1 }} ghost={fol} title={fol ? 'Già seguito' : 'Segui'} onPress={() => { const f = net.toggleFollow(name); toast(f ? 'Ora segui ' + name : 'Non segui più ' + name); }} />
            <Btn style={{ flex: 1 }} ghost title="Messaggio" onPress={() => go('conversationPage', { id: useChat.getState().ensureDm(name, me) })} />
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {isMe ? (
          <>
            <Btn small ghost title={`Seguiti (${net.following.length})`} onPress={() => openSheet('following')} />
            <Btn small ghost title="Competenze" onPress={() => go('skillProfile', { name })} />
            {followers >= 30 && (net.clubs[name] ? <Btn small ghost title="LifeClub" onPress={() => openSheet('clubManage')} /> : <Btn small title="Crea LifeClub" onPress={() => openSheet('createClub')} />)}
          </>
        ) : (
          <>
            <Btn small ghost icon="star" title="Vota" onPress={() => openSheet('vote', { name })} />
            <Btn small ghost title="Competenze" onPress={() => go('skillProfile', { name })} />
            <Btn small ghost title="Biglietto" onPress={() => go('businessCard', { name })} />
            {net.clubs[name] && <Btn small ghost title={`LifeClub · ${net.clubs[name].fee} LP`} onPress={() => joinClub(name)} />}
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 18, marginTop: 18, paddingVertical: 6, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <View style={{ flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center' }}><Row gap={3} style={{ justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{formatCHF(receivedLPFor(name))}</Text><LpTag size={14} /></Row><Text style={{ color: t.muted, fontSize: 12.5 }}>LP ricevuti</Text></View>
        <Pressable accessibilityRole="button" style={{ flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center', borderStartWidth: 1, borderStartColor: t.item }} onPress={() => openSheet('rating', { name })}><Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{r.avg ? `${r.avg}/5 (${r.count})` : 'Nessun voto'}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>Voto</Text></Pressable>
      </View>
      {stats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
          {stats.map(([l, v, f]) => <Pressable key={l} onPress={f} accessibilityRole="button" accessibilityLabel={`${l}: ${v}`} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 16 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{v}</Text><Text style={{ color: t.muted, fontSize: 13 }}>{l}</Text></Pressable>)}
        </ScrollView>
      )}

      {(hostSeminars.length > 0 || provider) && (
        <Card style={{ marginTop: 16 }}>
          <Body bold style={{ marginBottom: 8 }}>{isMe ? 'I tuoi seminari e servizi' : 'Seminari e servizi'}</Body>
          {provider && <Item last={!hostSeminars.length} onPress={() => go('servicePage', { name })}><Row><View style={{ flex: 1 }}><Body>{provider.role}</Body><Body small muted>Servizio · {provider.price} LP a sessione</Body></View><Chev /></Row></Item>}
          {hostSeminars.map((sm, i) => <Item key={sm.id} last={i === hostSeminars.length - 1} onPress={() => go('seminarPage', { id: String(sm.id) })}><Row><View style={{ flex: 1 }}><Body>{sm.title}</Body><Body small muted>Seminario · {sm.startsAt ? fmtDateTime(sm.startsAt) : 'data da definire'}</Body></View><Chev /></Row></Item>)}
          {!isMe && <Body small muted style={{ marginTop: 8 }}>Puoi votare {name} solo dopo aver partecipato a un suo seminario o servizio.</Body>}
        </Card>
      )}

      {others.length > 0 && (
        <View style={{ marginTop: 18, marginBottom: 6 }}>
          <Body small muted style={{ marginBottom: 8 }}>{isMe ? 'Altri profili' : 'Potresti conoscere'}</Body>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {others.map((n) => <Pressable key={n} style={{ width: 66, minHeight: 44, alignItems: 'center' }} onPress={() => go('userProfile', { name: n })} accessibilityRole="link" accessibilityLabel={n}><UserAvatar name={n} size={52} /><Body small muted numberOfLines={1} style={{ marginTop: 4 }}>{n.split(' ')[0]}</Body></Pressable>)}
          </ScrollView>
        </View>
      )}

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 14, marginHorizontal: -16, borderBottomWidth: 1, borderBottomColor: t.item }}>
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <Pressable key={x.key} onPress={() => net.setPref('upTab', x.key)} accessibilityRole="tab" accessibilityLabel={x.label} accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: on ? t.text : 'transparent', marginBottom: -1 }}>
              <Icon name={x.icon} size={22} color={on ? t.text : t.muted} stroke={on ? 2.2 : 1.8} />
            </Pressable>
          );
        })}
      </View>
      {tab === 'Idee' ? (
        <View style={{ paddingTop: 16 }}>
          {(() => { const l = net.ideas.filter((i) => i.author === name); return l.length ? l.map((i) => <IdeaHero key={i.id} idea={i} inset={false} />) : <Empty text="Ancora nessuna idea pubblicata." />; })()}
        </View>
      ) : filtered.length ? (
        <View style={{ marginHorizontal: -16, marginTop: 2, gap: 1 }}>
          {chunk(filtered, 3).map((row, ri) => <View key={ri} style={{ flexDirection: 'row', gap: 1 }}>{row.map(thumb)}</View>)}
        </View>
      ) : <Empty text="Ancora nessun contenuto qui." />}
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
