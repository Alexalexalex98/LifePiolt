import { View } from 'react-native';

import { FeedPost } from '@/components/feed/FeedPost';
import { Body, Card, Empty, Page } from '@/components/ui';
import { postByKey } from '@/lib/network';
import { useNet } from '@/store/network';

/** I post che hai salvato con il segnalibro, dal più recente: per toglierli tocca di nuovo il segnalibro. */
export default function SavedPosts() {
  const saved = useNet((s) => s.savedPosts ?? []);
  useNet((s) => s.posts); useNet((s) => s.communities);
  const rows = [...saved].reverse().map((key) => ({ key, post: postByKey(key) })).filter((r): r is { key: string; post: NonNullable<ReturnType<typeof postByKey>> } => !!r.post);
  return (
    <Page id="savedPosts" back title="Post salvati">
      <Body small muted style={{ marginBottom: 10 }}>Qui trovi i post su cui hai toccato il segnalibro. Solo tu li vedi.</Body>
      {rows.length === 0 ? <Card><Empty text="Non hai ancora salvato nessun post: tocca il segnalibro sotto un post per ritrovarlo qui." /></Card> : rows.map((r) => <View key={r.key} style={{ marginHorizontal: -16 }}><FeedPost post={r.post} likeKey={r.key} /></View>)}
    </Page>
  );
}
