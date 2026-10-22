import { useMenus } from '@/store/menus';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { ModButton, UserAvatar, openSheet } from '@/components/network';
import { paletteFor } from '@/components/feed/feedColors';
import { chunk } from '@/components/feed/feedLogic';
import { IdeaHero } from '@/components/feed/SpecialCards';
import { ArtPlaceholder, ArtShapes, RingAvatar } from '@/components/feed/parts';
import { IdBadge, LifePointsRow, StatsBar } from '@/components/profile/ProfileParts';
import { VideoPoster } from '@/components/stories/VideoPoster';
import { Body, Btn, Card, Chev, Empty, Page, Row } from '@/components/ui';
import { activeStories, fixedMoments } from '@/lib/stories';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { hashStr } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { badgesFor, bioFor, followerCountFor } from '@/lib/network';
import { identityStatusOf } from '@/lib/profile/actions';
import { DEFAULT_LOOK, safeLink, visibleSections, type SectionId } from '@/lib/profile/look';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useIdentity } from '@/store/identity';
import { useVisible } from '@/lib/moderation';
import { useNet } from '@/store/network';
import { repostsOf } from '@/lib/threads';
import { toast } from '@/store/toast';

export default function UserProfile() {
  const t = useTheme();
  const { name: param, follow: fromFollow } = useLocalSearchParams<{ name?: string; follow?: string }>();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const net = useNet();
  const idRec = useIdentity((s) => s.identity);
  const storedLook = useIdentity((s) => s.look);
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
  const hasBusiness = useIdentity((x) => x.businesses).some((b) => b.owner === name);
  const shopCount = (net.products ?? []).filter((x) => x.shop === name).length;
  const menuData = useMenus((x) => x.byOwner[name]);
  const menuCount = menuData ? menuData.items.length + menuData.files.length : 0;
  const given = isMe ? net.ledger.filter((l) => l.desc.startsWith('Contributo a')).length : 0;
  // contributi per ultimo, dopo ciò che si offre; servizi/seminari solo se offerti
  const pills: { key: string; label: string; icon: string; n: number }[] = [
    { key: 'post', label: 'Post', icon: 'image', n: postCount },
    ...(menuCount > 0 || (isMe && hasBusiness) ? [{ key: 'menu', label: 'Menù', icon: 'file', n: menuCount }] : []),
    { key: 'idee', label: 'Idee', icon: 'sparkle', n: ideasCount },
    ...(shopCount > 0 || (isMe && hasBusiness) ? [{ key: 'store', label: 'Store', icon: 'briefcase', n: shopCount }] : []),
    ...(sellCount > 0 ? [{ key: 'servizi', label: 'Servizi', icon: 'briefcase', n: sellCount }] : []),
    ...(isMe ? [{ key: 'contributi', label: 'Contributi', icon: 'heart', n: given }] : []),
    { key: 'altro', label: 'Altro', icon: 'more-h', n: -1 },
  ];
  const look = isMe ? storedLook ?? DEFAULT_LOOK : DEFAULT_LOOK;
  const accent = look.accent ?? t.accent;
  const hc = useApp((s) => s.accessibility.highContrast);
  const visibleTabs = ['Post', 'Repost', 'Foto', 'Video', 'Idee'].filter((k) => !look.hiddenTabs.includes(k));
  const tab0 = visibleTabs.includes(net.prefs.upTab) ? net.prefs.upTab : visibleTabs[0] ?? 'Post';
  const authorPosts = [
    ...net.posts.filter((p) => p.author === name).map((p) => ({ key: 'standalone:' + p.id, id: 's' + p.id, author: p.author, text: p.text, media: p.media, uri: p.uri })),
    ...net.communities.flatMap((c) => c.posts.map((p, pi) => ({ key: `community:${c.id}:${pi}`, id: `c${c.id}:${pi}`, author: p.author, text: p.text, media: p.media ?? null, uri: p.uri })).filter((p) => p.author === name)),
  ];
  const reps = repostsOf(net.reposts ?? [], name, net.posts, net.communities);
  /* chi non ha pubblicato niente ma ha ripubblicato: si vedono subito i repost */
  const tab = tab0 === 'Post' && authorPosts.length === 0 && reps.length > 0 && visibleTabs.includes('Repost') ? 'Repost' : tab0;
  const filtered = tab === 'Foto' ? authorPosts.filter((p) => p.media === 'photo') : tab === 'Video' ? authorPosts.filter((p) => p.media === 'video') : authorPosts;
  const cell = Math.floor((win - 2) / 3);
  const tabs: { key: string; label: string; icon: string }[] = [{ key: 'Post', label: 'Post', icon: 'grid' }, { key: 'Repost', label: 'Repost', icon: 'repeat' }, { key: 'Foto', label: 'Foto', icon: 'image' }, { key: 'Video', label: 'Video', icon: 'video' }, { key: 'Idee', label: 'Idee', icon: 'sparkle' }].filter((x) => !look.hiddenTabs.includes(x.key));
  const thumb = (p: (typeof authorPosts)[number], onOpen?: () => void, reposted?: boolean) => {
    const pal = paletteFor(p.author + p.text, t.mode === 'light' ? 'light' : 'dark', hc);
    return (
      <Pressable key={p.id} onPress={onOpen ?? (() => go('postPage', { key: p.key }))} accessibilityRole="button" accessibilityLabel={p.text} style={{ width: cell, height: cell, overflow: 'hidden' }}>
        {p.media && p.uri ? <Image source={{ uri: p.uri }} style={{ width: cell, height: cell }} contentFit="cover" />
          : p.media ? <ArtPlaceholder seed={p.author + p.text} width={cell} height={cell} video={p.media === 'video'} />
          : (
            <LinearGradient colors={[pal.from, pal.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: cell, height: cell, padding: 10, justifyContent: 'center' }}>
              <ArtShapes seed={p.author + p.text} size={cell} />
              <Text numberOfLines={6} style={{ color: pal.text, fontSize: 12, lineHeight: 15, fontWeight: '800' }}>{p.text}</Text>
            </LinearGradient>
          )}
        {p.media === 'video' && p.uri ? <View style={{ position: 'absolute', top: 6, end: 6 }}><Icon name="video" size={16} color="#fff" /></View> : null}
        {reposted ? <View style={{ position: 'absolute', bottom: 6, start: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}><Icon name="repeat" size={12} color="#fff" /><Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '700', maxWidth: cell - 40 }}>{p.author}</Text></View> : null}
      </Pressable>
    );
  };
  const role = bioFor(name, me);
  const shownPills = pills.filter((p) => !look.hiddenPills.includes(p.key));
  const link = isMe ? safeLink(look.link) : null;

  const sections: Record<SectionId, React.ReactNode> = {
    badges: badgesFor(name, me).length > 0 ? (
      <ScrollView key="badges" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 16, flexGrow: 0 }}>
        {badgesFor(name, me).map((b) => <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}><Icon name="award" size={14} color={accent} /><Text style={{ color: t.text, fontSize: 12.5, fontWeight: '700' }}>{b}</Text></View>)}
      </ScrollView>
    ) : null,
    stats: (
      <View key="stats" style={{ marginTop: 16 }}>
        <StatsBar name={name} followers={followers} following={followingCount} onFollowing={isMe ? () => openSheet('following') : undefined} />
      </View>
    ),
    lifepoints: <View key="lifepoints" style={{ marginTop: 14 }}><LifePointsRow name={name} isMe={isMe} /></View>,
    pills: shownPills.length ? (
      <ScrollView key="pills" horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18, flexGrow: 0, marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {shownPills.map((p) => (
          <Pressable key={p.key} onPress={() => (p.key === 'altro' ? go('profileMore', { name }) : p.key === 'menu' ? go('menuPage', { name }) : p.key === 'store' ? go('shopPage', { name }) : go('profileContent', { name, kind: p.key }))} accessibilityRole="button" accessibilityLabel={p.n < 0 ? p.label : `${p.label}: ${p.n}`}
            style={({ pressed }) => ({ width: 104, borderRadius: 22, padding: 12, gap: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.item, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={18} color={accent} /></View>
            <View>
              <Text style={{ color: t.text, fontSize: p.n >= 0 ? 24 : 17, fontWeight: '900', letterSpacing: -0.5, minHeight: 28 }}>{p.n >= 0 ? p.n : '···'}</Text>
              <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5, fontWeight: '600' }}>{p.label}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    ) : null,
    others: others.length > 0 ? (
      <View key="others" style={{ marginTop: 20, marginBottom: 4 }}>
        <Body small muted style={{ marginBottom: 8 }}>{isMe ? 'Altri profili' : 'Potresti conoscere'}</Body>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {others.map((n) => <Pressable key={n} style={{ width: 66, minHeight: 44, alignItems: 'center' }} onPress={() => go('userProfile', { name: n })} accessibilityRole="link" accessibilityLabel={n}><UserAvatar name={n} size={52} /><Body small muted numberOfLines={1} style={{ marginTop: 4 }}>{n.split(' ')[0]}</Body></Pressable>)}
        </ScrollView>
      </View>
    ) : null,
    grid: tabs.length === 0 ? null : (
      <View key="grid">
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 18, marginHorizontal: -16, borderBottomWidth: 1, borderBottomColor: t.item }}>
          {tabs.map((x) => {
            const on = tab === x.key;
            return (
              <Pressable key={x.key} onPress={() => net.setPref('upTab', x.key)} accessibilityRole="tab" accessibilityLabel={x.label} accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: on ? accent : 'transparent', marginBottom: -1 }}>
                <Icon name={x.icon} size={22} color={on ? accent : t.muted} stroke={on ? 2.2 : 1.8} />
              </Pressable>
            );
          })}
        </View>
        {tab === 'Idee' ? (
          <View style={{ paddingTop: 16 }}>
            {(() => { const l = net.ideas.filter((i) => i.author === name); return l.length ? l.map((i) => <IdeaHero key={i.id} idea={i} inset={false} />) : <Empty text="Ancora nessuna idea pubblicata." />; })()}
          </View>
        ) : tab === 'Repost' ? (
          reps.length ? (
            <View style={{ marginHorizontal: -16, marginTop: 2, gap: 1 }}>
              {chunk(reps.map((x, i) => ({ i, p: { key: x.r.key, id: `r${i}${x.r.key}`, author: x.post.author, text: x.r.note ?? x.post.text, media: x.post.media ?? null, uri: x.post.uri ?? x.post.uris?.[0] } })), 3).map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 1 }}>{row.map((c) => thumb(c.p, () => go('repostFeed', { name, start: String(c.i) }), true))}</View>
              ))}
            </View>
          ) : <Empty text={isMe ? 'Non hai ancora ripubblicato niente. Tocca l\'icona di ripubblica sotto un post.' : 'Ancora nessun repost.'} />
        ) : filtered.length ? (
          <View style={{ marginHorizontal: -16, marginTop: 2, gap: 1 }}>
            {chunk(filtered, 3).map((row, ri) => <View key={ri} style={{ flexDirection: 'row', gap: 1 }}>{row.map((p) => thumb(p))}</View>)}
          </View>
        ) : <Empty text="Ancora nessun contenuto qui." />}
      </View>
    ),
  };
  const fixedList = fixedMoments(activeStories(net.stories, Date.now()).filter((x) => x.author === name));
  const nameSize = look.nameSize === 'S' ? 20 : look.nameSize === 'L' ? 27 : 23;
  const headline = isMe ? (look.headline || net.bio || 'Il tuo profilo') : role;

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

      {/* copertina e avatar al centro, nome, ruolo e luogo */}
      <View style={{ marginTop: 8 }}>
        <View style={{ height: 156, borderRadius: 28, overflow: 'hidden', backgroundColor: t.card }}>
          <LinearGradient colors={look.banner && isMe ? [look.banner.c1, look.banner.c2] : [accent, accent + '33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
          {look.banner && isMe && look.banner.uri ? <Image source={{ uri: look.banner.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : null}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} pointerEvents="none" style={{ position: 'absolute', bottom: 0, start: 0, end: 0, height: 80 }} />
        </View>
        <View style={{ alignItems: 'center', marginTop: -56 }}>
          <LinearGradient colors={[accent, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><UserAvatar name={name} size={94} link={false} /></View>
          </LinearGradient>
        </View>
        <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Text accessibilityRole="header" numberOfLines={1} style={{ color: t.text, fontSize: nameSize + 4, fontWeight: '900', letterSpacing: -0.5, flexShrink: 1 }}>{name}</Text>
            {(!isMe || look.showVerified) && <IdBadge status={status} preview={isMe && !!idRec.preview} />}
          </Row>
          <Text style={{ color: t.muted, fontSize: 14.5, textAlign: 'center', paddingHorizontal: 16 }} numberOfLines={2}>{headline}</Text>
        </View>
      </View>
      {isMe && (look.place || link) ? (
        <Row gap={8} style={{ justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {look.place ? <Row gap={5} style={{ backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Icon name="location" size={14} color={t.muted} /><Body small muted>{look.place}</Body></Row> : null}
          {link ? <Pressable onPress={() => Linking.openURL(link).catch(() => toast('Non riesco ad aprire il link'))} accessibilityRole="link" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Icon name="link" size={14} color={accent} /><Text numberOfLines={1} style={{ color: accent, fontSize: 13, fontWeight: '700', maxWidth: 200 }}>{link.replace(/^https?:\/\//, '')}</Text></Pressable> : null}
        </Row>
      ) : null}
      {isMe && look.headline && net.bio ? <Text style={{ color: t.text, fontSize: 14.5, lineHeight: 21, marginTop: 10, textAlign: 'center' }}>{net.bio}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {isMe ? (
          <View style={{ flex: 1, gap: 10 }}>
            <Btn icon="edit" title="Modifica profilo" onPress={() => go('editProfile')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn style={{ flex: 1 }} ghost icon="briefcase" title="Biglietto" onPress={() => go('cardEditor')} />
              <Btn style={{ flex: 1 }} ghost icon="chart" title="Statistiche" onPress={() => go('creatorStats')} />
            </View>
          </View>
        ) : (
          <>
            <Btn style={{ flex: 1 }} ghost={fol} title={fol ? 'Già seguito' : fromFollow ? 'Segui anche tu' : 'Segui'} onPress={() => { const f = net.toggleFollow(name); toast(f ? 'Ora segui ' + name : 'Non segui più ' + name); }} />
            <Btn style={{ flex: 1 }} ghost title="Messaggio" onPress={() => go('conversationPage', { id: useChat.getState().ensureDm(name, me) })} />
            <Btn ghost icon="award" title="Vota" onPress={() => openSheet('vote', { name })} />
          </>
        )}
      </View>

      {isMe && hasBusiness && menuCount === 0 ? (
        <Card style={{ marginTop: 14 }} onPress={() => go('menuPage', { name })}>
          <Row>
            <Icon name="file" size={20} color={t.accent} />
            <View style={{ flex: 1 }}><Body bold>Carica il tuo menù</Body><Body small muted>Foto, screenshot o PDF: chi ti trova vede subito cosa offri e quanto costa.</Body></View>
            <Chev />
          </Row>
        </Card>
      ) : null}

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

      {(fixedList.length > 0 || isMe) && !(blockedUser || (!isMe && !visible('profile', name))) ? (
        <View style={{ marginTop: 22 }}>
          <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 }}>{tl('IN EVIDENZA')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingEnd: 8 }}>
            {isMe ? (
              <Pressable onPress={() => go('storyCreate')} accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento fisso')} style={{ width: 72, alignItems: 'center', gap: 6 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.muted, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={26} color={t.muted} /></View>
                <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{tl('Nuovo')}</Text>
              </Pressable>
            ) : null}
            {fixedList.map((m) => (
              <Pressable key={m.id} onPress={() => go('storyView', { author: name, fixed: '1', at: m.id })} accessibilityRole="button" accessibilityLabel={m.text ? `${tl('Momento fisso')}: ${m.text}` : tl('Momento fisso')} style={{ width: 72, alignItems: 'center', gap: 6 }}>
                <LinearGradient colors={[accent, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 66, height: 66, borderRadius: 33, overflow: 'hidden', borderWidth: 2.5, borderColor: t.bg, backgroundColor: t.card }}>
                    {m.kind === 'photo' ? <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      : m.kind === 'video' ? <VideoPoster uri={m.uri} poster={m.poster} width={66} height={66} />
                      : <LinearGradient colors={m.bg ?? ['#6c8cff', '#3b2a7a']} style={{ flex: 1 }} />}
                  </View>
                </LinearGradient>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{m.text ? m.text.slice(0, 10) : tl('Fisso')}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {visibleSections(look).map((id) => sections[id])}
    </Page>
  );
}
