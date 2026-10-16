import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SharePostSheet } from '@/components/feed/SharePostSheet';
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '@/components/T';

import { LIKE, MediaArea, useHeartBurst } from '@/components/feed/FeedPost';
import { IconBtn, RingAvatar } from '@/components/feed/parts';
import { ModButton, UserAvatar, openMedia, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, Page } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { postByKey } from '@/lib/network';
import { fmtDateTime, fmtAgo } from '@/lib/when';
import { useApp } from '@/store/app';
import { useVisible } from '@/lib/moderation';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { QaVote } from '@/components/profile/QaVote';
import { qaPairs, qaRef } from '@/lib/profile/qa';
import { t as tl, translateText } from '@/i18n/core';

export default function PostPage() {
  const t = useTheme();
  const win = useWindowDimensions().width;
  // da una notifica: `commentId` (indice del commento da mostrare), `focus` ('comment' | 'like'), `actor` (chi ha messo mi piace), `at` (rinnova l'apertura)
  const { key, commentId, focus, actor, at: openedAt } = useLocalSearchParams<{ key?: string; commentId?: string; focus?: string; actor?: string; at?: string }>();
  const me = useApp((a) => a.account.name);
  const net = useNet();
  const [text, setText] = useState('');
  const input = useRef<{ focus?: () => void } | null>(null);
  const { heart, flash } = useHeartBurst();
  const visible = useVisible();
  // scorre fino al commento indicato dalla notifica e lo evidenzia per un attimo
  const reduce = useReduceMotion();
  const scroller = useRef<ScrollView>(null);
  const commentsTop = useRef(0);
  const rowY = useRef<Record<number, number>>({});
  const rowRefs = useRef<Record<number, unknown>>({});
  const pendingFocus = useRef<number | null>(null);
  const glow = useRef(new Animated.Value(0)).current;
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const focusComment = (i: number) => {
    const y = rowY.current[i];
    if (y === undefined) return;
    pendingFocus.current = null;
    const to = (yy: number) => scroller.current?.scrollTo({ y: Math.max(0, yy - 90), animated: !reduce });
    // posizione reale dentro lo ScrollView (il contenuto sopra, come le immagini, puo' cambiare altezza dopo il primo layout)
    const node = rowRefs.current[i] as unknown as { measureLayout?: (rel: unknown, ok: (x: number, y: number) => void, err: () => void) => void } | null;
    const inner = (scroller.current as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.();
    if (node?.measureLayout && inner) node.measureLayout(inner, (_x, yy) => to(yy), () => to(commentsTop.current + y));
    else to(commentsTop.current + y);
    setFlashIdx(i);
    glow.setValue(1);
    if (reduce) setTimeout(() => setFlashIdx(null), 2200);
    else Animated.timing(glow, { toValue: 0, duration: 2200, useNativeDriver: false }).start(() => setFlashIdx(null));
  };
  useEffect(() => {
    const n = commentId !== undefined && /^\d+$/.test(commentId) ? Number(commentId) : null;
    pendingFocus.current = n;
    if (n === null) return;
    const h = setTimeout(() => { if (pendingFocus.current !== n) return; if (rowY.current[n] !== undefined) focusComment(n); else setTimeout(() => { if (pendingFocus.current === n) { pendingFocus.current = null; toast('Questo commento non è più disponibile'); } }, 600); }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, commentId, openedAt]);
  const [sharing, setSharing] = useState(false);
  const post = key ? postByKey(key) : null;
  if (key && post && !visible('post', key, post.author)) return <Page id="postPage" title="Post" back><Card><Empty text="Hai nascosto o segnalato questo post, oppure l’autore è bloccato. Lo trovi in Segnalazioni inviate." /><Btn small ghost style={{ marginTop: 10 }} title="Segnalazioni inviate" onPress={() => go('reports')} /></Card></Page>;
  if (!key || !post) return <Page id="postPage" title="Post" back><Card><Empty text="Post non trovato: potrebbe essere stato rimosso." /></Card></Page>;
  const liked = net.likedPosts.includes(key);
  const saved = (net.savedPosts ?? []).includes(key);
  const allComments = net.comments[key] || [];
  const comments = allComments.map((c, i) => ({ ...c, i })).filter((c) => visible('comment', `${key}#${c.i}`, c.author));
  const donated = net.dailyPoint.lastGiven === weekdayShortDate();
  const hasMedia = !!post.media;
  const send = () => {
    if (!text.trim()) { toast('Scrivi qualcosa prima di commentare'); return; }
    net.addComment(key, me, text.trim());
    setText('');
  };
  const doubleLike = () => { flash(); if (!useNet.getState().likedPosts.includes(key)) net.likePost(key); };
  const reply = (author: string) => { setText((v) => (v.startsWith('@' + author) ? v : `@${author} ${v}`)); setTimeout(() => input.current?.focus?.(), 50); };
  const canSend = text.trim().length > 0;
  /* con una sola foto o un solo video, il contenuto resta fisso dietro e i commenti scorrono sopra */
  const layered = hasMedia && !!post.uri;
  const spacerH = Math.round(Math.min(win * 1.1, 520));

  return (
    <Page id="postPage" scroll={false} back>
      <SharePostSheet visible={sharing} onClose={() => setSharing(false)} author={post.author} text={post.text} media={post.media} uri={post.uri} likeKey={key} />
      <View style={{ flex: 1, marginHorizontal: -16 }}>
      {layered ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0 }}><MediaArea post={post} w={win} heart={heart} onDouble={() => {}} onSingle={() => {}} /></View> : null}
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: layered ? 0 : 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {layered ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={translateText(post.media === 'video' ? 'Apri il video a schermo intero' : 'Apri la foto a schermo intero')} onPress={() => openMedia({ media: post.media!, seed: post.author + post.text, uri: post.uri })} onLongPress={doubleLike} style={{ height: spacerH }} /> : null}
        <View style={layered ? { backgroundColor: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, minHeight: 700 } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 10 }}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minHeight: 48 }} onPress={() => go('userProfile', { name: post.author })} accessibilityRole="link" accessibilityLabel={tl('Profilo di {0}', post.author)}>
            <RingAvatar name={post.author} size={40} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 15.5, fontWeight: '800' }}>{post.author}</Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{post.ts ? `${fmtDateTime(post.ts)} (${fmtAgo(post.ts)})` : 'Data non disponibile'}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => openSheet('postMenu', { author: post.author, tag: post.tag, ref: key, label: post.text })} hitSlop={6} accessibilityRole="button" accessibilityLabel={translateText('Altre azioni sul post')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="more-h" size={22} color={t.text} stroke={2.2} /></Pressable>
        </View>

        {layered ? null : <MediaArea post={post} w={win} heart={heart} onDouble={doubleLike} onSingle={() => { if (post.media) openMedia({ media: post.media, seed: post.author + post.text, uri: post.uri }); }} />}

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, marginTop: 4 }}>
          <IconBtn icon="heart" size={27} color={liked ? LIKE : t.text} fill={liked ? LIKE : 'none'} label={liked ? 'Togli il mi piace' : 'Mi piace'} onPress={() => net.likePost(key)} pop={liked} selected={liked} />
          <IconBtn icon="comment" label="Scrivi un commento…" onPress={() => input.current?.focus?.()} />
          <IconBtn icon="send" label="Condividi nell’app" onPress={() => setSharing(true)} />
          {!donated && post.author !== me && <IconBtn icon="coin" size={26} color={t.accent} label="Dona il LifePoint di oggi" onPress={() => openSheet('donate', { author: post.author, key })} />}
          <View style={{ flex: 1 }} />
          <IconBtn icon="bookmark" fill={saved ? t.text : 'none'} label={saved ? 'Rimuovi dai salvati' : 'Salva'} selected={saved} onPress={() => { const on = net.toggleSavePost(key); toast(on ? 'Post salvato' : 'Rimosso dai salvati'); }} />
        </View>

        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {focus && actor ? <Body small bold color={LIKE}>{tl(commentId !== undefined && commentId !== '' ? '{0} ha messo mi piace a un commento di questo post' : '{0} ha messo mi piace a questo post', actor)}</Body> : null}
          {post.hideLikes && post.author !== me ? null : <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{tl(post.likes === 1 ? 'Piace a {0} persona' : 'Piace a {0} persone', post.likes)}{post.hideLikes ? ` · ${translateText('nascosto agli altri')}` : ''}</Text>}
          {post.tag ? (
            post.community
              ? <Body small muted>Pubblicato nella community <Body small muted style={{ textDecorationLine: 'underline' }} onPress={() => go('communityProfile', { id: String(post.community!.id) })}>{post.community.name}</Body></Body>
              : <Body small muted>Argomento: {post.tag}</Body>
          ) : null}
          {(hasMedia || post.text.length > 220) && (
            <Text style={{ color: t.text, fontSize: 15.5, lineHeight: 23 }}>
              <Text style={{ fontWeight: '800' }} onPress={() => go('userProfile', { name: post.author })}>{post.author} </Text>{post.text}
            </Text>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: t.item, marginTop: 18, marginBottom: 6 }} />
        <View style={{ paddingHorizontal: 14 }} onLayout={(e) => { commentsTop.current = e.nativeEvent.layout.y; }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginVertical: 10 }}>{tl('Commenti ({0})', comments.length)}</Text>
          {comments.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
              <Icon name="comment" size={30} color={t.muted} stroke={1.5} />
              <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center' }}>Ancora nessun commento: scrivi il primo.</Text>
            </View>
          ) : comments.map((c) => (
            <Animated.View key={c.i} ref={(r) => { rowRefs.current[c.i] = r; }} onLayout={(e) => { rowY.current[c.i] = e.nativeEvent.layout.y; if (pendingFocus.current === c.i) focusComment(c.i); }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12, backgroundColor: flashIdx === c.i ? glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', t.accent + '40'] }) : 'transparent' }}>
              <UserAvatar name={c.author} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontSize: 14.5, lineHeight: 21 }}><Text style={{ fontWeight: '800' }} onPress={() => go('userProfile', { name: c.author })}>{c.author} </Text>{c.text}</Text>
                <Pressable onPress={() => reply(c.author)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 24 }} accessibilityRole="button" accessibilityLabel={tl('Rispondi a {0}', c.author)}><Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>Rispondi</Text></Pressable>
                {(() => { const qp = qaPairs(post.author, post.text, allComments).find((q) => q.index === c.i); return qp && qp.asker === me ? <QaVote from={me} to={c.author} refId={qaRef(key, c.i)} /> : null; })()}
              </View>
              {c.author !== me && <ModButton kind="comment" refId={`${key}#${c.i}`} label={c.text} author={c.author} size={18} />}
            </Animated.View>
          ))}
        </View>
        </View>
      </ScrollView>
      </View>

      {post.commentsOff ? <View style={{ paddingVertical: 12 }}><Body small muted style={{ textAlign: 'center' }}>I commenti di questo post sono disattivati.</Body></View> : (
      <View style={{ marginHorizontal: -16, paddingStart: 14, paddingEnd: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.item, backgroundColor: t.bg, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -8 }}>
        <UserAvatar name={me} size={32} />
        <TextInput ref={input as never} value={text} onChangeText={setText} placeholder="Scrivi un commento…" placeholderTextColor={t.muted} accessibilityLabel={translateText('Scrivi un commento…')} returnKeyType="send" onSubmitEditing={send} style={{ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: t.input, borderWidth: 1, borderColor: t.inputBorder, color: t.text, fontSize: 15.5, paddingHorizontal: 16, paddingVertical: 8, outlineStyle: 'none' } as never} />
        <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={translateText('Commenta')} accessibilityState={{ disabled: !canSend }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? t.text : t.chip }}>
          <Icon name="send" size={19} color={canSend ? t.onText : t.muted} stroke={2} />
        </Pressable>
      </View>
      )}
    </Page>
  );
}
