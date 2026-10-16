import { snapBackdrop } from '@/lib/storyBackdrop';
import { SharePostSheet } from '@/components/feed/SharePostSheet';
import { holdCarousel, releaseCarousel } from '@/lib/feedSwipe';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, TextInput, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar, openMedia, openSheet } from '@/components/network';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { fmtAgo, fmtDay } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl, translateText } from '@/i18n/core';
import { captionNeedsMore, isDoubleTap, pageIndex, postLayout } from './feedLogic.ts';
import { LinearGradient } from 'expo-linear-gradient';
import { ArtPlaceholder, IconBtn, NATIVE, RingAvatar, TextCard } from './parts';

export type FeedPostData = { author: string; text: string; media?: 'photo' | 'video' | null; tag?: string; likes: number; ts?: number; uri?: string; poster?: string; uris?: string[]; editedAt?: number; hideLikes?: boolean; commentsOff?: boolean };

export const LIKE = '#ff4d6d';

/** Cuore che compare e svanisce al doppio tocco (con "Riduci animazioni": solo una breve comparsa, senza movimento). */
export function useHeartBurst() {
  const reduce = useReduceMotion();
  const heart = useRef(new Animated.Value(0)).current;
  const flash = () => {
    heart.stopAnimation();
    if (reduce) { heart.setValue(1); Animated.timing(heart, { toValue: 0, duration: 500, delay: 350, useNativeDriver: NATIVE }).start(); return; }
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, friction: 5, tension: 180, useNativeDriver: NATIVE }),
      Animated.timing(heart, { toValue: 0, duration: 380, delay: 260, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
    ]).start();
  };
  return { heart, flash };
}

/** Segnaposto che pulsa dolcemente mentre foto e video si caricano (sfondo del colore dell'app, niente riquadro nero). */
function MediaSkeleton({ width, height }: { width: number; height: number }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: NATIVE }), Animated.timing(a, { toValue: 0.45, duration: 800, useNativeDriver: NATIVE })]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, width, height, backgroundColor: t.item, opacity: a }} />;
}

/** Foto del feed: segnaposto che pulsa, poi la foto compare con una dissolvenza. */
function FeedImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const [ready, setReady] = useState(false);
  return (
    <View style={{ width, height, backgroundColor: 'transparent' }}>
      {ready ? null : <MediaSkeleton width={width} height={height} />}
      <Image source={{ uri }} style={{ width, height }} contentFit="cover" transition={380} recyclingKey={uri} cachePolicy="memory-disk" onLoad={() => setReady(true)} />
    </View>
  );
}

/** Video nel feed: parte da solo, muto e in loop; un tocco lo apre a schermo intero. */
function FeedVideo({ uri, width, height, poster }: { uri: string; width: number; height: number; poster?: string }) {
  const p = useVideoPlayer(uri, (pl) => { pl.loop = true; pl.muted = true; pl.play(); });
  const [shown, setShown] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const onFirst = () => { setShown(true); Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: NATIVE }).start(); };
  return (
    <View pointerEvents="none" style={{ width, height }}>
      {shown ? null : poster ? <Image source={{ uri: poster }} pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, width, height }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : <MediaSkeleton width={width} height={height} />}
      <Animated.View style={{ width, height, opacity: fade }}><VideoView player={p} style={{ width, height }} nativeControls={false} contentFit="cover" onFirstFrameRender={onFirst} /></Animated.View>
      <View style={{ position: 'absolute', top: 12, start: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}><Icon name="video" size={14} color="#fff" /></View>
    </View>
  );
}

/** Media del post: carosello con puntini se ci sono più immagini; doppio tocco = mi piace; un tocco = schermo intero. */
export function MediaArea({ post, w, onDouble, onSingle, heart }: { post: FeedPostData; w: number; onDouble: () => void; onSingle: () => void; heart: Animated.Value }) {
  const images = post.uris?.length ? post.uris : post.uri ? [post.uri] : [];
  const [page, setPage] = useState(0);
  const lastTap = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const tap = () => {
    const now = Date.now();
    if (isDoubleTap(lastTap.current, now)) {
      lastTap.current = 0;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      onDouble();
      return;
    }
    lastTap.current = now;
    timer.current = setTimeout(() => { timer.current = null; lastTap.current = 0; onSingle(); }, 270);
  };
  const isPhoto = post.media === 'photo' && images.length > 0;
  const h = isPhoto ? Math.round(w * 1.25) : w;
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(pageIndex(e.nativeEvent.contentOffset.x, w, images.length)), [w, images.length]);
  let body;
  if (isPhoto) {
    const slide = (u: string, i: number) => (
      <Pressable key={i} onPress={tap} accessibilityRole="imagebutton" accessibilityLabel={translateText(images.length > 1 ? 'Foto del post, tocca due volte per mettere mi piace' : 'Foto del post, tocca due volte per mettere mi piace')}>
        <FeedImage uri={u} width={w} height={h} />
      </Pressable>
    );
    body = images.length > 1 ? (
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} onTouchStart={holdCarousel} onTouchEnd={releaseCarousel} onTouchCancel={releaseCarousel} onScrollEndDrag={releaseCarousel} bounces={false} overScrollMode="never" scrollEventThrottle={16} style={{ width: w, height: h }} nestedScrollEnabled>
        {images.map(slide)}
      </ScrollView>
    ) : slide(images[0], 0);
  } else if (post.media === 'video' && images.length > 0) {
    body = (
      <Pressable onPress={tap} accessibilityRole="imagebutton" accessibilityLabel={translateText('Video del post, tocca due volte per mettere mi piace')}>
        <FeedVideo uri={images[0]} width={w} height={Math.round(w * 1.25)} poster={post.poster} />
      </Pressable>
    );
  } else if (post.media) {
    body = (
      <Pressable onPress={tap} accessibilityRole="imagebutton" accessibilityLabel={translateText(post.media === 'video' ? 'Video del post, tocca due volte per mettere mi piace' : 'Foto del post, tocca due volte per mettere mi piace')}>
        <ArtPlaceholder seed={post.author + post.text} width={w} height={h} video={post.media === 'video'} />
      </Pressable>
    );
  } else {
    body = (
      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={translateText('Apri il post, tocca due volte per mettere mi piace')}>
        <TextCard seed={post.author + post.text} text={post.text} tag={post.tag} width={w} />
      </Pressable>
    );
  }
  return (
    <View>
      {body}
      {images.length > 1 && (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, end: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{page + 1}/{images.length}</Text></View>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, direction: 'ltr' }}>
            {images.map((_, i) => <View key={i} style={{ width: i === page ? 7 : 6, height: i === page ? 7 : 6, borderRadius: 4, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.55)' }} />)}
          </View>
        </>
      )}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.15, 1] }) }] }}>
        <Icon name="heart" size={96} color="#fff" fill={LIKE} stroke={1.2} />
      </Animated.View>
    </View>
  );
}

/** Post del feed, a tutta larghezza (stile "vago" Instagram, senza storie). */
export const FeedPost = memo(function FeedPost({ post, likeKey }: { post: FeedPostData; likeKey: string }) {
  const t = useTheme();
  const win = useWindowDimensions().width;
  const [w, setW] = useState(win);
  const me = useApp((s) => s.account.name);
  const liked = useNet((s) => s.likedPosts.includes(likeKey));
  const saved = useNet((s) => (s.savedPosts ?? []).includes(likeKey));
  const comments = useNet((s) => s.comments[likeKey]);
  const donated = useNet((s) => s.dailyPoint.lastGiven === weekdayShortDate());
  const muted = useNet((s) => s.mutedAuthors.includes(post.author) || (!!post.tag && s.mutedTopics.includes(post.tag)));
  const role = useNet((s) => s.providers.find((p) => p.name === post.author)?.role);
  const visible = useVisible();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [draft, setDraft] = useState('');
  const { heart, flash } = useHeartBurst();
  if (muted || !visible('post', likeKey, post.author)) return null;

  const commentCount = (comments || []).length;
  const sendDraft = () => { const x = draft.trim(); if (!x) return; useNet.getState().addComment(likeKey, me, x); setDraft(''); };
  const first = (comments || [])[(comments || []).length - 1];
  const hasMedia = !!post.media;
  const layout = postLayout(post, post.uris?.length ?? 1);
  const more = hasMedia && captionNeedsMore(post.text);
  const sub = [post.tag ?? role, fmtAgo(post.ts), post.editedAt ? translateText('modificato') : ''].filter(Boolean).join(' · ');

  const like = () => useNet.getState().likePost(likeKey);
  const doubleLike = () => { flash(); if (!useNet.getState().likedPosts.includes(likeKey)) like(); };
  const single = () => { if (post.media && post.author !== me && (post.uri || post.uris?.length)) void snapBackdrop().then(() => go('swipeDeck', { start: likeKey, solo: '1' })); else if (post.media) openMedia({ media: post.media, seed: post.author + post.text, uri: post.uri }); else go('postPage', { key: likeKey }); };
  const onLayout = (e: LayoutChangeEvent) => { const x = Math.round(e.nativeEvent.layout.width); if (x && x !== w) setW(x); };

  return (
    <View onLayout={onLayout} style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 10 }}>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minHeight: 48 }} onPress={() => go('userProfile', { name: post.author })} accessibilityRole="link" accessibilityLabel={tl('Profilo di {0}', post.author)}>
          <RingAvatar name={post.author} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{post.author}</Text>
            {sub ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{sub}</Text> : null}
          </View>
        </Pressable>
        <Pressable onPress={() => openSheet('postMenu', { author: post.author, tag: post.tag, ref: likeKey, label: post.text })} hitSlop={6} accessibilityRole="button" accessibilityLabel={translateText('Altre azioni sul post')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="more-h" size={22} color={t.text} stroke={2.2} />
        </Pressable>
      </View>

      <SharePostSheet visible={sharing} onClose={() => setSharing(false)} author={post.author} text={post.text} media={post.media} uri={post.uri ?? post.uris?.[0]} likeKey={likeKey} />
      {layout === 'story' ? <Text style={{ color: t.text, fontSize: 18, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2, paddingHorizontal: 14, paddingBottom: 12 }}>{post.text}</Text> : null}
      {layout === 'story' ? (
        <View style={{ marginHorizontal: 12, borderRadius: 20, overflow: 'hidden' }}><MediaArea post={post} w={w - 24} onDouble={doubleLike} onSingle={single} heart={heart} /></View>
      ) : layout === 'overlay' ? (
        <View>
          <MediaArea post={post} w={w} onDouble={doubleLike} onSingle={single} heart={heart} />
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
            <Text numberOfLines={3} style={{ color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>{post.text}</Text>
          </LinearGradient>
        </View>
      ) : <MediaArea post={post} w={w} onDouble={doubleLike} onSingle={single} heart={heart} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, marginTop: 4 }}>
        <IconBtn icon="heart" size={27} color={liked ? LIKE : t.text} fill={liked ? LIKE : 'none'} label={liked ? 'Togli il mi piace' : 'Mi piace'} onPress={like} pop={liked} selected={liked} />
        {post.commentsOff ? null : <IconBtn icon="comment" label="Apri il post e i commenti" onPress={() => go('postPage', { key: likeKey })} />}
        <IconBtn icon="send" label="Condividi nell’app" onPress={() => setSharing(true)} />
        {!donated && post.author !== me && <IconBtn icon="coin" size={26} color={t.accent} label="Dona il LifePoint di oggi" onPress={() => openSheet('donate', { author: post.author, key: likeKey })} />}
        <View style={{ flex: 1 }} />
        <IconBtn icon="bookmark" color={t.text} fill={saved ? t.text : 'none'} label={saved ? 'Rimuovi dai salvati' : 'Salva'} selected={saved} onPress={() => { const on = useNet.getState().toggleSavePost(likeKey); toast(on ? 'Post salvato' : 'Rimosso dai salvati'); }} />
      </View>

      <View style={{ paddingHorizontal: 14, gap: 5 }}>
        {post.hideLikes && post.author !== me ? null : <Text style={{ color: t.text, fontSize: 14.5, fontWeight: '800' }}>{tl(post.likes === 1 ? 'Piace a {0} persona' : 'Piace a {0} persone', post.likes)}{post.hideLikes ? ` · ${translateText('nascosto agli altri')}` : ''}</Text>}
        {hasMedia && layout === 'classic' && (
          <View>
            <Text numberOfLines={open || !more ? undefined : 2} style={{ color: t.text, fontSize: 14.5, lineHeight: 21 }}>
              <Text style={{ fontWeight: '800' }} onPress={() => go('userProfile', { name: post.author })}>{post.author} </Text>{post.text}
            </Text>
            {more && !open && <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Mostra tutta la didascalia')} style={{ paddingVertical: 4 }}><Text style={{ color: t.muted, fontSize: 14 }}>altro</Text></Pressable>}
          </View>
        )}
        {post.commentsOff ? <Text style={{ color: t.muted, fontSize: 13.5 }}>{translateText('I commenti sono disattivati')}</Text> : (<>
        {commentCount > 0 ? (
          <Pressable onPress={() => go('postPage', { key: likeKey })} accessibilityRole="link" style={{ paddingVertical: 3 }}>
            <Text style={{ color: t.muted, fontSize: 14 }}>{commentCount === 1 ? tl('Vedi il commento') : tl('Vedi tutti i {0} commenti', commentCount)}</Text>
          </Pressable>
        ) : null}
        {first ? <Text numberOfLines={1} style={{ color: t.text, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>{first.author} </Text>{first.text}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
          <UserAvatar name={me} size={24} />
          <TextInput value={draft} onChangeText={setDraft} placeholder={translateText('Aggiungi un commento…')} placeholderTextColor={t.muted} accessibilityLabel={translateText('Scrivi un commento…')} returnKeyType="send" blurOnSubmit onSubmitEditing={sendDraft} style={{ flex: 1, color: t.text, fontSize: 14, paddingVertical: 8 }} />
          {draft.trim() ? <Pressable onPress={sendDraft} accessibilityRole="button" accessibilityLabel={translateText('Pubblica il commento')} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }}>{translateText('Pubblica')}</Text></Pressable> : null}
        </View>
        </>)}
        {post.ts ? <Text style={{ color: t.muted, fontSize: 11.5, letterSpacing: 0.3, textTransform: 'uppercase' }}>{fmtDay(post.ts)}</Text> : null}
      </View>
    </View>
  );
});
