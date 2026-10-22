import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { MediaArea, LIKE, type FeedPostData } from '@/components/feed/FeedPost';
import { ArtPlaceholder, TextCard } from '@/components/feed/parts';
import { SharePostSheet } from '@/components/feed/SharePostSheet';
import { UserAvatar } from '@/components/network';
import { Body, Page } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { compactCount, hasReposted, repostCount, repostsOf } from '@/lib/threads';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Rail di azioni a destra (stile TikTok). */
function Rail({ icon, n, on, color, label, onPress }: { icon: string; n?: number; on?: boolean; color?: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={on ? color ?? '#fff' : '#fff'} fill={on && icon === 'heart' ? color : undefined} stroke={2} />
      </View>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{n ? compactCount(n) : ' '}</Text>
    </Pressable>
  );
}

function Slide({ post, likeKey, by, note, h, w }: { post: FeedPostData; likeKey: string; by: string; note?: string; h: number; w: number }) {
  const me = useApp((s) => s.account.name);
  const liked = useNet((s) => s.likedPosts.includes(likeKey));
  const comments = useNet((s) => (s.comments[likeKey] ?? []).length);
  const reposts = useNet((s) => s.reposts);
  const [sharing, setSharing] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const img = post.uri ?? post.uris?.[0];
  const like = () => useNet.getState().likePost(likeKey);
  const open = () => go('postPage', { key: likeKey });
  return (
    <View style={{ width: w, height: h, backgroundColor: '#05070d', overflow: 'hidden' }}>
      {post.media === 'photo' && img ? <Image source={{ uri: img }} style={{ position: 'absolute', width: w, height: h }} contentFit="cover" cachePolicy="memory-disk" />
        : post.media === 'video' && img ? <View style={{ position: 'absolute', top: 0, width: w, height: h, justifyContent: 'center' }}><MediaArea post={post} w={w} onDouble={like} onSingle={open} heart={heart} /></View>
        : post.media ? <ArtPlaceholder seed={post.author + post.text} width={w} height={h} video={post.media === 'video'} />
        : <View style={{ position: 'absolute', width: w, height: h, justifyContent: 'center' }}><TextCard seed={post.author + post.text} text={post.text} tag={post.tag} width={w} /></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri il post')} onPress={open} onLongPress={like} style={{ position: 'absolute', inset: 0 } as never} />
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} style={{ position: 'absolute', bottom: 0, start: 0, end: 0, height: h * 0.42 }} />
      <View pointerEvents="box-none" style={{ position: 'absolute', end: 12, bottom: 28, gap: 14, alignItems: 'center' }}>
        <Pressable accessibilityRole="link" accessibilityLabel={post.author} onPress={() => go('userProfile', { name: post.author })}><UserAvatar name={post.author} size={46} link={false} /></Pressable>
        <Rail icon="heart" n={post.hideLikes ? undefined : post.likes} on={liked} color={LIKE} label={tl('Mi piace')} onPress={like} />
        {post.commentsOff ? null : <Rail icon="comment" n={comments} label={tl('Rispondi')} onPress={open} />}
        <Rail icon="repeat" n={repostCount(reposts ?? [], likeKey)} on={hasReposted(reposts ?? [], likeKey, me)} color="#3ddc97" label={tl('Ripubblica')} onPress={() => { const on = useNet.getState().toggleRepost(likeKey, me); toast(on ? tl('Ripubblicato') : tl('Repost annullato')); }} />
        <Rail icon="share" label={tl('Condividi')} onPress={() => setSharing(true)} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', start: 16, end: 84, bottom: 30, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="repeat" size={14} color="#fff" /><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{by === me ? tl('Hai ripubblicato') : tl('{0} ha ripubblicato', by)}</Text></View>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{post.author}</Text>
        {note ? <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{note}</Text> : null}
        {post.media || note ? <Text numberOfLines={3} style={{ color: 'rgba(255,255,255,.92)', fontSize: 14.5, lineHeight: 20 }}>{post.text}</Text> : null}
      </View>
      <SharePostSheet visible={sharing} onClose={() => setSharing(false)} author={post.author} text={post.text} media={post.media} uri={img} likeKey={likeKey} />
    </View>
  );
}

/** I repost di una persona, a schermo intero e uno alla volta: si scorre in verticale come su TikTok. */
export default function RepostFeed() {
  const { name, start } = useLocalSearchParams<{ name?: string; start?: string }>();
  const me = useApp((s) => s.account.name);
  const who = name || me;
  const reposts = useNet((s) => s.reposts);
  const posts = useNet((s) => s.posts);
  const communities = useNet((s) => s.communities);
  const list = useMemo(() => repostsOf(reposts ?? [], who, posts, communities), [reposts, who, posts, communities]);
  const win = useWindowDimensions();
  const [h, setH] = useState(Math.round(win.height * 0.78));
  const idx = Math.min(Math.max(0, Number(start) || 0), Math.max(0, list.length - 1));
  return (
    <Page id="repostFeed" back title={tl('Repost di {0}', who)} scroll={false}>
      <View style={{ flex: 1, marginHorizontal: -16 }} onLayout={(e) => { const x = Math.round(e.nativeEvent.layout.height); if (x > 200 && x !== h) setH(x); }}>
        {list.length ? (
          <FlatList
            data={list}
            keyExtractor={(x) => `${x.r.by}:${x.r.key}:${x.r.ts}`}
            pagingEnabled snapToInterval={h} decelerationRate="fast" showsVerticalScrollIndicator={false}
            initialScrollIndex={idx} getItemLayout={(_d, i) => ({ length: h, offset: h * i, index: i })}
            renderItem={({ item }) => <Slide post={item.post as FeedPostData} likeKey={item.r.key} by={item.r.by} note={item.r.note} h={h} w={win.width} />}
          />
        ) : <Body muted style={{ margin: 24 }}>{tl('Ancora nessun repost.')}</Body>}
      </View>
    </Page>
  );
}
