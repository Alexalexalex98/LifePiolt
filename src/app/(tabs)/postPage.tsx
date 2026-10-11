import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '@/components/T';

import { LIKE, MediaArea, useHeartBurst } from '@/components/feed/FeedPost';
import { IconBtn, RingAvatar } from '@/components/feed/parts';
import { ModButton, UserAvatar, openMedia, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, Page } from '@/components/ui';
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
import { t as tl, translateText } from '@/i18n/core';

export default function PostPage() {
  const t = useTheme();
  const win = useWindowDimensions().width;
  const { key } = useLocalSearchParams<{ key?: string }>();
  const me = useApp((a) => a.account.name);
  const net = useNet();
  const [text, setText] = useState('');
  const input = useRef<{ focus?: () => void } | null>(null);
  const { heart, flash } = useHeartBurst();
  const visible = useVisible();
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
  const share = async () => { try { await Share.share({ message: tl('Post di {0} su LifePilot: {1}', post.author, post.text) }); } catch { toast('Condivisione non disponibile su questo dispositivo'); } };
  const doubleLike = () => { flash(); if (!useNet.getState().likedPosts.includes(key)) net.likePost(key); };
  const reply = (author: string) => { setText((v) => (v.startsWith('@' + author) ? v : `@${author} ${v}`)); setTimeout(() => input.current?.focus?.(), 50); };
  const canSend = text.trim().length > 0;

  return (
    <Page id="postPage" scroll={false} back>
      <ScrollView style={{ flex: 1, marginHorizontal: -16 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

        <MediaArea post={post} w={win} heart={heart} onDouble={doubleLike} onSingle={() => { if (post.media) openMedia({ media: post.media, seed: post.author + post.text, uri: post.uri }); }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, marginTop: 4 }}>
          <IconBtn icon="heart" size={27} color={liked ? LIKE : t.text} fill={liked ? LIKE : 'none'} label={liked ? 'Togli il mi piace' : 'Mi piace'} onPress={() => net.likePost(key)} pop={liked} selected={liked} />
          <IconBtn icon="comment" label="Scrivi un commento…" onPress={() => input.current?.focus?.()} />
          <IconBtn icon="send" label="Condividi" onPress={share} />
          {!donated && post.author !== me && <IconBtn icon="coin" size={26} color={t.accent} label="Dona il LifePoint di oggi" onPress={() => openSheet('donate', { author: post.author })} />}
          <View style={{ flex: 1 }} />
          <IconBtn icon="bookmark" fill={saved ? t.text : 'none'} label={saved ? 'Rimuovi dai salvati' : 'Salva'} selected={saved} onPress={() => { const on = net.toggleSavePost(key); toast(on ? 'Post salvato' : 'Rimosso dai salvati'); }} />
        </View>

        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{tl(post.likes === 1 ? 'Piace a {0} persona' : 'Piace a {0} persone', post.likes)}</Text>
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
        <View style={{ paddingHorizontal: 14 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', marginVertical: 10 }}>{tl('Commenti ({0})', comments.length)}</Text>
          {comments.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
              <Icon name="comment" size={30} color={t.muted} stroke={1.5} />
              <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center' }}>Ancora nessun commento: scrivi il primo.</Text>
            </View>
          ) : comments.map((c) => (
            <View key={c.i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 }}>
              <UserAvatar name={c.author} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontSize: 14.5, lineHeight: 21 }}><Text style={{ fontWeight: '800' }} onPress={() => go('userProfile', { name: c.author })}>{c.author} </Text>{c.text}</Text>
                <Pressable onPress={() => reply(c.author)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 24 }} accessibilityRole="button" accessibilityLabel={tl('Rispondi a {0}', c.author)}><Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>Rispondi</Text></Pressable>
              </View>
              {c.author !== me && <ModButton kind="comment" refId={`${key}#${c.i}`} label={c.text} author={c.author} size={18} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ marginHorizontal: -16, paddingStart: 14, paddingEnd: 70, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.item, backgroundColor: t.bg, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -8 }}>
        <UserAvatar name={me} size={32} />
        <TextInput ref={input as never} value={text} onChangeText={setText} placeholder="Scrivi un commento…" placeholderTextColor={t.muted} accessibilityLabel={translateText('Scrivi un commento…')} returnKeyType="send" onSubmitEditing={send} style={{ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: t.input, borderWidth: 1, borderColor: t.inputBorder, color: t.text, fontSize: 15.5, paddingHorizontal: 16, paddingVertical: 8, outlineStyle: 'none' } as never} />
        <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={translateText('Commenta')} accessibilityState={{ disabled: !canSend }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? t.text : t.chip }}>
          <Icon name="send" size={19} color={canSend ? t.onText : t.muted} stroke={2} />
        </Pressable>
      </View>
    </Page>
  );
}
