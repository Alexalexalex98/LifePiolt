import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { ModButton, UserAvatar, openSheet } from '@/components/network';
import { paletteFor } from '@/components/feed/feedColors';
import { chunk } from '@/components/feed/feedLogic';
import { IdeaHero } from '@/components/feed/SpecialCards';
import { ArtPlaceholder, ArtShapes, RingAvatar } from '@/components/feed/parts';
import { IdBadge, LifePointsRow, StatsBar } from '@/components/profile/ProfileParts';
import { Body, Btn, Card, Chev, Empty, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { hashStr } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { badgesFor, bioFor, followerCountFor } from '@/lib/network';
import { identityStatusOf } from '@/lib/profile/actions';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useIdentity } from '@/store/identity';
import { useVisible } from '@/lib/moderation';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function UserProfile() {
  const t = useTheme();
  const { name: param, follow: fromFollow } = useLocalSearchParams<{ name?: string; follow?: string }>();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const net = useNet();
  const idRec = useIdentity((s) => s.identity);
  const name = param || me;
  const isMe = name === me;
  const visible = useVisible();
  const blockedUser = useChat((s) => s.blocked.includes(name));
  const win = useWindowDimensions().width;

  const status = identityStatusOf(name, me);
  const followers = followerCountFor(name, me, demo);
  const followingCount = isMe ? net.following.length : demo ? 40 + (Math.abs(hashStr(name + 'seguiti')) % 220) : 0;
  const fol = net.following.includes(name);
  const others = net.suggested.filter((n) => n !== name);

  const postCount = net.posts.filter((p) => p.author === name).length + net.communities.reduce((a, c) => a + c.posts.filter((p) => p.author === name).length, 0);
  const ideasCount = net.ideas.filter((i) => i.author === name).length;
  const sellCount = net.seminars.filter((x) => x.host === name).length + (net.providers.some((x) => x.name === name) ? 1 : 0);
  const given = isMe ? net.ledger.filter((l) => l.desc.startsWith('Contributo a')).length : 0;
  // contributi per ultimo, dopo ciò che si offre; servizi/seminari solo se offerti
  const pills: { key: string; label: string; icon: string; n: number }[] = [
    { key: 'post', label: 'Post', icon: 'image', n: postCount },
    { key: 'idee', label: 'Idee', icon: 'sparkle', n: ideasCount },
    ...(sellCount > 0 ? [{ key: 'servizi', label: 'Servizi', icon: 'briefcase', n: sellCount }] : []),
    ...(isMe ? [{ key: 'contributi', label: 'Contributi', icon: 'heart', n: given }] : []),
    { key: 'altro', label: 'Altro', icon: 'more-h', n: -1 },
  ];
  const hc = useApp((s) => s.accessibility.highContrast);
  const tab = net.prefs.upTab;
  const authorPosts = [
    ...net.posts.filter((p) => p.author === name).map((p) => ({ key: 'standalone:' + p.id, id: 's' + p.id, author: p.author, text: p.text, media: p.media, uri: p.uri })),
    ...net.communities.flatMap((c) => c.posts.map((p, pi) => ({ key: `community:${c.id}:${pi}`, id: `c${c.id}:${pi}`, author: p.author, text: p.text, media: p.media ?? null, uri: p.uri })).filter((p) => p.author === name)),
  ];
  const filtered = tab === 'Foto' ? authorPosts.filter((p) => p.media === 'photo') : tab === 'Video' ? authorPosts.filter((p) => p.media === 'video') : authorPosts;
  const cell = Math.floor((win - 2) / 3);
  const tabs: { key: string; label: string; icon: string }[] = [{ key: 'Post', label: 'Post', icon: 'grid' }, { key: 'Foto', label: 'Foto', icon: 'image' }, { key: 'Video', label: 'Video', icon: 'video' }, { key: 'Idee', label: 'Idee', icon: 'sparkle' }];
  const thumb = (p: (typeof authorPosts)[number]) => {
    const pal = paletteFor(p.author + p.text, t.mode === 'light' ? 'light' : 'dark', hc);
    return (
      <Pressable key={p.id} onPress={() => go('postPage', { key: p.key })} accessibilityRole="button" accessibilityLabel={p.text} style={{ width: cell, height: cell, overflow: 'hidden' }}>
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
  const role = bioFor(name, me);

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

      {/* intestazione: avatar, nome, identità, ruolo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <RingAvatar name={name} size={72} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 }}>{name}</Text>
          <IdBadge status={status} preview={isMe && !!idRec.preview} />
          <Text style={{ color: t.muted, fontSize: 13.5 }} numberOfLines={2}>{isMe ? (net.bio || 'Il tuo profilo') : role}</Text>
        </View>
      </View>
      {badgesFor(name, me).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {badgesFor(name, me).map((b) => <View key={b} style={{ backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: t.text, fontSize: 12.5, fontWeight: '600' }}>{b}</Text></View>)}
        </View>
      )}

      {/* barra alta: Follower · Seguiti · Voto complessivo */}
      <View style={{ marginTop: 16 }}>
        <StatsBar name={name} followers={followers} following={followingCount} onFollowing={isMe ? () => openSheet('following') : undefined} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {isMe ? (
          <>
            <Btn style={{ flex: 1 }} ghost title="Modifica profilo" onPress={() => openSheet('editProfile')} />
            <Btn style={{ flex: 1 }} ghost icon="briefcase" title="Biglietto" onPress={() => go('cardEditor')} />
          </>
        ) : (
          <>
            <Btn style={{ flex: 1 }} ghost={fol} title={fol ? 'Già seguito' : fromFollow ? 'Segui anche tu' : 'Segui'} onPress={() => { const f = net.toggleFollow(name); toast(f ? 'Ora segui ' + name : 'Non segui più ' + name); }} />
            <Btn style={{ flex: 1 }} ghost title="Messaggio" onPress={() => go('conversationPage', { id: useChat.getState().ensureDm(name, me) })} />
            <Btn ghost icon="award" title="Vota" onPress={() => openSheet('vote', { name })} />
          </>
        )}
      </View>

      {isMe && (status === 'none' || status === 'rejected' || status === 'pending') && (
        <Card style={{ marginTop: 14 }} onPress={() => go('identityVerify')}>
          <Row>
            <Icon name="lock" size={20} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Body bold>{status === 'pending' ? 'Verifica in corso' : status === 'rejected' ? 'Verifica respinta: riprova' : 'Verifica la tua identità'}</Body>
              <Body small muted>{status === 'pending' ? 'Stiamo controllando il documento. Intanto puoi pubblicare post.' : status === 'rejected' ? (idRec.reason ?? 'Il documento non è stato accettato.') : 'Serve per pubblicare, vendere, offrire servizi e votare su LifeNetwork. Il resto dell’app funziona senza.'}</Body>
            </View>
            <Chev />
          </Row>
        </Card>
      )}

      <View style={{ marginTop: 14 }}><LifePointsRow name={name} /></View>

      {/* pillole di contenuto: si aprono in un elenco dedicato */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 16 }}>
        {pills.map((p) => (
          <Pressable key={p.key} onPress={() => (p.key === 'altro' ? go('profileMore', { name }) : go('profileContent', { name, kind: p.key }))} accessibilityRole="button" accessibilityLabel={p.n < 0 ? p.label : `${p.label}: ${p.n}`} style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 16 }}>
            <Icon name={p.icon} size={16} color={t.muted} />
            {p.n >= 0 && <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{p.n}</Text>}
            <Text style={{ color: t.muted, fontSize: 13.5 }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 18, marginHorizontal: -16, borderBottomWidth: 1, borderBottomColor: t.item }}>
        {tabs.map((x) => {
          const on = tab === x.key || (x.key === 'Post' && !['Foto', 'Video', 'Idee'].includes(tab));
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
      {others.length > 0 && (
        <View style={{ marginTop: 22, marginBottom: 6 }}>
          <Body small muted style={{ marginBottom: 8 }}>{isMe ? 'Altri profili' : 'Potresti conoscere'}</Body>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {others.map((n) => <Pressable key={n} style={{ width: 66, minHeight: 44, alignItems: 'center' }} onPress={() => go('userProfile', { name: n })} accessibilityRole="link" accessibilityLabel={n}><UserAvatar name={n} size={52} /><Body small muted numberOfLines={1} style={{ marginTop: 4 }}>{n.split(' ')[0]}</Body></Pressable>)}
          </ScrollView>
        </View>
      )}
    </Page>
  );
}
