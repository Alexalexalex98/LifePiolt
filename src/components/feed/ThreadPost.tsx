import { memo, useRef, useState } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { MediaArea, LIKE, type FeedPostData } from '@/components/feed/FeedPost';
import { SharePostSheet } from '@/components/feed/SharePostSheet';
import { MentionText } from '@/components/MentionBox';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Input, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { compactCount, hasReposted, quoteCount, repostCount } from '@/lib/threads';
import { fmtAgo } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const AV = 40;
const GUTTER = 16;

/** Un'azione sotto il post: icona e numero. */
function Act({ icon, n, on, color, label, onPress }: { icon: string; n?: number; on?: boolean; color?: string; label: string; onPress: () => void }) {
  const t = useTheme();
  const c = on ? color ?? t.accent : t.muted;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} hitSlop={8} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, minWidth: 44 }}>
      <Icon name={icon} size={19} color={c} fill={on && icon === 'heart' ? c : undefined} stroke={on ? 2.2 : 1.8} />
      {n ? <Text style={{ color: c, fontSize: 13, fontWeight: '600' }}>{compactCount(n)}</Text> : null}
    </Pressable>
  );
}

/**
 * Post in stile Threads/X: avatar a sinistra, nome e testo a destra, foto o video sotto, azioni in riga (rispondi, ripubblica, mi piace, salva, condividi).
 * Se la stessa persona scrive più post di fila si vede la linea del filo; `by` indica chi lo ha ripubblicato.
 */
export const ThreadPost = memo(function ThreadPost({ post, likeKey, up, down, by, note }: { post: FeedPostData; likeKey: string; up?: boolean; down?: boolean; by?: string; note?: string }) {
  const t = useTheme();
  const win = useWindowDimensions().width;
  const me = useApp((s) => s.account.name);
  const liked = useNet((s) => s.likedPosts.includes(likeKey));
  const saved = useNet((s) => (s.savedPosts ?? []).includes(likeKey));
  const comments = useNet((s) => (s.comments[likeKey] ?? []).length);
  const reposts = useNet((s) => s.reposts);
  const rn = repostCount(reposts ?? [], likeKey), qn = quoteCount(reposts ?? [], likeKey);
  const mine = hasReposted(reposts ?? [], likeKey, me);
  const [menu, setMenu] = useState(false);
  const [quote, setQuote] = useState(false);
  const [text, setText] = useState('');
  const [sharing, setSharing] = useState(false);
  const heart = useRef(new Animated.Value(0)).current;
  const w = win - GUTTER * 2 - AV - 12;
  const open = () => go('postPage', { key: likeKey });
  const like = () => useNet.getState().likePost(likeKey);
  const repost = () => { setMenu(false); const on = useNet.getState().toggleRepost(likeKey, me); toast(on ? tl('Ripubblicato: lo vedono i tuoi follower') : tl('Repost annullato')); };
  const sendQuote = () => { useNet.getState().toggleRepost(likeKey, me, text); setQuote(false); setText(''); toast(tl('Citazione pubblicata')); };

  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      {by ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingStart: AV - 14 }}>
          <Icon name="repeat" size={14} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>{by === me ? tl('Hai ripubblicato') : tl('{0} ha ripubblicato', by)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: by ? 6 : 12 }}>
        <View style={{ width: AV, alignItems: 'center' }}>
          {up ? <View style={{ position: 'absolute', top: -12, height: 12, width: 2, backgroundColor: t.border }} /> : null}
          <UserAvatar name={post.author} size={AV} />
          {down ? <View style={{ flex: 1, width: 2, marginTop: 4, backgroundColor: t.border, minHeight: 20 }} /> : null}
        </View>
        <View style={{ flex: 1, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text onPress={() => go('userProfile', { name: post.author })} numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: '800', flexShrink: 1 }}>{post.author}</Text>
            {post.ts ? <Text style={{ color: t.muted, fontSize: 14 }}>· {fmtAgo(post.ts)}</Text> : null}
            {post.editedAt ? <Text style={{ color: t.muted, fontSize: 12 }}>{tl('modificato')}</Text> : null}
          </View>
          {note ? <Text style={{ color: t.text, fontSize: 15.5, lineHeight: 22, marginTop: 2 }}>{note}</Text> : null}
          {post.text ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri il post')} onPress={open}>
              <Text style={{ color: t.text, fontSize: 15.5, lineHeight: 22, marginTop: 2 }}><MentionText text={post.text} /></Text>
            </Pressable>
          ) : null}
          {post.media ? (
            <View style={{ marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}>
              <MediaArea post={post} w={w} onDouble={like} onSingle={open} heart={heart} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginEnd: 6 }}>
            {post.commentsOff ? <View style={{ width: 44 }} /> : <Act icon="comment" n={comments} label={tl('Rispondi')} onPress={open} />}
            <Act icon="repeat" n={rn + qn} on={mine} color="#3ddc97" label={mine ? tl('Annulla il repost') : tl('Ripubblica')} onPress={() => setMenu(true)} />
            <Act icon="heart" n={post.hideLikes ? undefined : post.likes} on={liked} color={LIKE} label={tl('Mi piace')} onPress={like} />
            <Act icon="bookmark" on={saved} label={saved ? tl('Togli dai salvati') : tl('Salva')} onPress={() => { const s = useNet.getState().toggleSavePost(likeKey); toast(s ? tl('Salvato') : tl('Tolto dai salvati')); }} />
            <Act icon="share" label={tl('Condividi')} onPress={() => setSharing(true)} />
          </View>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: t.border, marginStart: AV + 12, opacity: 0.7 }} />

      <Sheet visible={menu} title={tl('Ripubblica')} onClose={() => setMenu(false)}>
        <Btn icon="repeat" title={mine ? tl('Annulla il repost') : tl('Ripubblica')} onPress={repost} />
        <Btn style={{ marginTop: 8 }} ghost icon="edit" title={tl('Cita con un commento')} onPress={() => { setMenu(false); setQuote(true); }} />
        <Body small muted style={{ marginTop: 10 }}>{tl('Il repost compare nel tuo profilo, nella scheda Repost.')}</Body>
      </Sheet>
      <Sheet visible={quote} title={tl('Cita il post')} onClose={() => setQuote(false)}>
        <Body small muted style={{ marginBottom: 8 }}>{post.author}: {post.text.slice(0, 120)}</Body>
        <Input value={text} onChangeText={setText} placeholder={tl('Aggiungi il tuo commento')} multiline maxLines={5} />
        <Btn style={{ marginTop: 10 }} title={tl('Pubblica')} disabled={!text.trim()} onPress={sendQuote} />
      </Sheet>
      <SharePostSheet visible={sharing} onClose={() => setSharing(false)} author={post.author} text={post.text} media={post.media} uri={post.uri ?? post.uris?.[0]} likeKey={likeKey} />
    </View>
  );
});
