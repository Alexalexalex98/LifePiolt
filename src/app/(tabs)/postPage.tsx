import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { LpTag, MediaBlock, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { postByKey } from '@/lib/network';
import { fmtDateTime, fmtAgo } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function PostPage() {
  const t = useTheme();
  const { key } = useLocalSearchParams<{ key?: string }>();
  const me = useApp((a) => a.account.name);
  const net = useNet();
  const [text, setText] = useState('');
  const post = key ? postByKey(key) : null;
  if (!key || !post) return <Page id="postPage" title="Post" back><Card><Empty text="Post non trovato: potrebbe essere stato rimosso." /></Card></Page>;
  const liked = net.likedPosts.includes(key);
  const comments = net.comments[key] || [];
  const donated = net.dailyPoint.lastGiven === weekdayShortDate();
  const send = () => {
    if (!text.trim()) { toast('Scrivi qualcosa prima di commentare'); return; }
    net.addComment(key, me, text.trim());
    setText('');
  };
  return (
    <Page id="postPage" title="Post" back right={<Btn small ghost icon="share" title="Condividi" onPress={() => Share.share({ message: `Post di ${post.author} su LifePilot: ${post.text}` })} />}>
      <Card>
        <Row style={{ marginBottom: 10 }}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} onPress={() => go('userProfile', { name: post.author })} accessibilityRole="link">
            <UserAvatar name={post.author} size={40} />
            <View style={{ flex: 1 }}>
              <Body bold>{post.author}</Body>
              <Text style={{ color: t.muted, fontSize: 12 }}>{post.ts ? `${fmtDateTime(post.ts)} (${fmtAgo(post.ts)})` : 'Data non disponibile'}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => openSheet('postMenu', { author: post.author, tag: post.tag })} hitSlop={10}><Icon name="more-h" size={20} color={t.text} /></Pressable>
        </Row>
        {post.tag ? (
          post.community
            ? <Body small muted style={{ marginBottom: 8 }}>Pubblicato nella community <Body small muted style={{ textDecorationLine: 'underline' }} onPress={() => go('communityProfile', { id: String(post.community!.id) })}>{post.community.name}</Body></Body>
            : <Body small muted style={{ marginBottom: 8 }}>Argomento: {post.tag}</Body>
        ) : null}
        <Body>{post.text}</Body>
        <MediaBlock media={post.media} seed={post.author + post.text} uri={post.uri} />
        <Row style={{ marginTop: 8 }}>
          <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={16}>
            <Pressable onPress={() => net.likePost(key)} accessibilityRole="button" accessibilityLabel={liked ? 'Togli il mi piace' : 'Mi piace'} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="heart" size={22} color={liked ? '#ff5d7a' : t.text} fill={liked ? '#ff5d7a' : 'none'} /><Body muted>{post.likes}</Body>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="ai" size={22} color={t.text} /><Body muted>{comments.length}</Body></View>
          </Row>
          {!donated && post.author !== me && <Pressable onPress={() => openSheet('donate', { author: post.author })} accessibilityLabel="Dona il LifePoint di oggi"><LpTag size={24} dark={false} /></Pressable>}
        </Row>
      </Card>

      <Card>
        <H>Commenti ({comments.length})</H>
        {comments.length === 0 ? <Body small muted>Ancora nessun commento: scrivi il primo.</Body> : comments.map((c, i) => (
          <Item key={i} last={i === comments.length - 1}>
            <Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={8}>
              <UserAvatar name={c.author} size={26} />
              <View style={{ flex: 1 }}><Body small bold onPress={() => go('userProfile', { name: c.author })}>{c.author}</Body><Body small muted>{c.text}</Body></View>
            </Row>
          </Item>
        ))}
        <Input multiline style={{ marginTop: 12, minHeight: 60 }} placeholder="Scrivi un commento…" value={text} onChangeText={setText} />
        <Btn small title="Commenta" onPress={send} />
      </Card>
    </Page>
  );
}
