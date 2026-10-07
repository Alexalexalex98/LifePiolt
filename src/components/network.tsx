import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, Text, View } from 'react-native';
import { create } from 'zustand';

import { Avatar, Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF, hashStr, weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { rateIdea, scoreColor } from '@/lib/network';
import { useApp } from '@/store/app';
import { useNet, type Idea, type Post } from '@/store/network';
import { toast } from '@/store/toast';

export const photoGradients: [string, string][] = [['#3a2a5c', '#171224'], ['#1f3b2c', '#131c17'], ['#3a2a1a', '#221a10'], ['#2a1f45', '#181128'], ['#1a2f3a', '#111c22'], ['#3a1f2c', '#22131a']];
export const gradientFor = (seed: string) => photoGradients[Math.abs(hashStr(seed)) % photoGradients.length];

/* ---------- gestione schede (una sola host nel layout) ---------- */
export type SheetKind =
  | 'comments' | 'postMenu' | 'donate' | 'scoreExpl' | 'ideaMenu' | 'contribute' | 'newIdea' | 'newCommunity' | 'postToCommunity' | 'newSeminar'
  | 'promoteSeminar' | 'booking' | 'vote' | 'rating' | 'createClub' | 'clubManage' | 'statDetail' | 'following' | 'editProfile' | 'verification'
  | 'topup' | 'cardPicker' | 'addCard' | 'newGroup' | 'groupSettings' | 'convSettings' | 'cv' | 'newPost' | 'purchaseFinal';

type SheetState = { kind: SheetKind | null; p: Record<string, any>; open: (kind: SheetKind, p?: Record<string, any>) => void; close: () => void };
export const useNetSheet = create<SheetState>((set) => ({ kind: null, p: {}, open: (kind, p = {}) => set({ kind, p }), close: () => set({ kind: null, p: {} }) }));
export const openSheet = (kind: SheetKind, p?: Record<string, any>) => useNetSheet.getState().open(kind, p);

/* ---------- conferma acquisto in una pagina dedicata ---------- */
type Purchase = { title: string; rows: [string, string][]; onConfirm: (() => void) | null; returnTo: string };
export const usePurchase = create<{ pending: Purchase | null; set: (p: Purchase | null) => void }>((set) => ({ pending: null, set: (pending) => set({ pending }) }));
export function openPurchaseConfirm(title: string, rows: [string, string][], onConfirm: () => void, returnTo = 'lifenetwork') {
  usePurchase.getState().set({ title, rows, onConfirm, returnTo });
  go('purchaseConfirm');
}

/* ---------- elementi ---------- */
export function LpTag({ size = 13, dark }: { size?: number; dark?: boolean }) {
  const t = useTheme();
  const light = t.bg === '#eef1f6';
  const useDark = dark ?? light;
  return <Image source={useDark ? require('../../assets/proto/lp-icon-b.png') : require('../../assets/proto/lp-icon-w.png')} style={{ height: size, width: size * 0.8, marginHorizontal: 1 }} resizeMode="contain" />;
}

export const LpAmount = ({ n, size = 13, bold = true, color }: { n: number; size?: number; bold?: boolean; color?: string }) => (
  <Text style={{ flexDirection: 'row' }}>
    <Body bold={bold} color={color}>{formatCHF(n)} </Body>
    <LpTag size={size} />
  </Text>
);

export function UserAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  // la foto del prototipo compare solo nella modalità demo
  return name === me && demo ? <Avatar name={name} size={size} uri={require('../../assets/proto/user-photo.jpg')} /> : <Avatar name={name} size={size} />;
}

export function MediaBlock({ media, seed }: { media?: 'photo' | 'video' | null; seed: string }) {
  if (!media) return null;
  const g = gradientFor(seed);
  return (
    <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1, borderRadius: 14, marginVertical: 8, alignItems: 'center', justifyContent: 'center' }}>
      {media === 'video' && <Text style={{ fontSize: 26, color: '#fff' }}>▶</Text>}
    </LinearGradient>
  );
}

export function Badge({ label, color, onPress }: { label: string; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', backgroundColor: color + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function PostCard({ post, likeKey }: { post: { author: string; text: string; media?: 'photo' | 'video' | null; tag?: string; likes: number }; likeKey: string }) {
  const t = useTheme();
  const net = useNet();
  if (net.mutedAuthors.includes(post.author) || (post.tag && net.mutedTopics.includes(post.tag))) return null;
  const liked = net.likedPosts.includes(likeKey);
  const donated = net.dailyPoint.lastGiven === weekdayShortDate();
  const commentCount = (net.comments[likeKey] || []).length;
  return (
    <Card>
      <Row style={{ marginBottom: 8 }}>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }} onPress={() => go('userProfile', { name: post.author })}>
          <UserAvatar name={post.author} size={30} />
          <Body bold style={{ fontSize: 14 }}>{post.author}</Body>
          {post.tag ? <Text style={{ color: t.muted, fontSize: 11 }}>{post.tag}</Text> : null}
        </Pressable>
        <Pressable onPress={() => openSheet('postMenu', { author: post.author, tag: post.tag })} hitSlop={10}><Text style={{ color: t.text, fontSize: 16 }}>⋯</Text></Pressable>
      </Row>
      <Body small style={{ marginBottom: 2 }}>{post.text}</Body>
      <MediaBlock media={post.media} seed={post.author + post.text} />
      <Row style={{ marginTop: 8 }}>
        <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={16}>
          <Pressable onPress={() => net.likePost(likeKey)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="heart" size={19} color={liked ? '#ff5d7a' : t.text} fill={liked ? '#ff5d7a' : 'none'} /><Body small muted>{post.likes}</Body>
          </Pressable>
          <Pressable onPress={() => openSheet('comments', { key: likeKey })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="ai" size={19} color={t.text} /><Body small muted>{commentCount}</Body>
          </Pressable>
        </Row>
        {!donated && <Pressable onPress={() => openSheet('donate', { author: post.author })} accessibilityLabel="Dona il LifePoint di oggi"><LpTag size={24} dark={false} /></Pressable>}
      </Row>
    </Card>
  );
}

export function IdeaCard({ idea }: { idea: Idea }) {
  const t = useTheme();
  const ideas = useNet((s) => s.ideas);
  const score = rateIdea(idea.desc);
  const color = scoreColor(score);
  const dup = idea.similarTo ? ideas.find((x) => x.id === idea.similarTo) : null;
  const reward = idea.rewardType === 'fisso' ? `Contributo fisso: ${idea.fixedAmount} LP${idea.rewardDesc ? ' · ' + idea.rewardDesc : ''}` : idea.rewardDesc ? `Importo libero · In cambio: ${idea.rewardDesc}` : 'Importo libero · nessuna ricompensa specificata';
  return (
    <Card>
      <Row style={{ alignItems: 'flex-start' }}>
        <Pressable style={{ flex: 1 }} onPress={() => go('ideaProfile', { id: String(idea.id) })}><Body bold style={{ fontSize: 17 }}>{idea.title}</Body></Pressable>
        <Row gap={6}>
          <Badge label={`${score}/100`} color={color} onPress={() => openSheet('scoreExpl', { id: idea.id })} />
          <Pressable onPress={() => openSheet('ideaMenu', { author: idea.author })} hitSlop={10}><Text style={{ color: t.text, fontSize: 16 }}>⋯</Text></Pressable>
        </Row>
      </Row>
      {dup && <Body small color="#ffb84f" style={{ marginVertical: 4 }}>Simile a "{dup.title}" di {dup.author}, creata prima</Body>}
      <Body small muted style={{ marginVertical: 6 }}>{idea.desc}</Body>
      <Body small color="#c9b6ff" style={{ marginBottom: 6 }}>{reward}</Body>
      <Row>
        <Body small muted onPress={() => go('userProfile', { name: idea.author })} style={{ textDecorationLine: 'underline' }}>Titolare: {idea.author}</Body>
        <Row gap={2}><Body bold>{formatCHF(idea.raised)} raccolti</Body><LpTag size={13} /></Row>
      </Row>
      <Btn small ghost style={{ marginTop: 10 }} title="Contribuisci con LifePoints" onPress={() => contribute(idea)} />
    </Card>
  );
}

export function contribute(idea: Idea) {
  if (idea.rewardType === 'fisso' && idea.fixedAmount) {
    openPurchaseConfirm('Contribuisci a ' + idea.title, [['Titolare', idea.author], ['Contributo', 'importo fisso'], ['Importo', idea.fixedAmount + ' LP'], ['In cambio', idea.rewardDesc || 'Nessuna ricompensa specificata']], () => doContribute(idea.id, idea.fixedAmount!));
  } else openSheet('contribute', { id: idea.id });
}

export function doContribute(id: number, amt: number) {
  const net = useNet.getState();
  const idea = net.ideas.find((x) => x.id === id);
  if (!idea) return;
  if (!net.spend(amt, 'Contributo a "' + idea.title + '"', undefined)) { toast('LifePoints insufficienti'); return; }
  const before = Math.floor(((idea.raised / idea.target) * 100) / 25) * 25;
  const raised = idea.raised + amt;
  useNet.setState((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, raised } : i)) }));
  const after = Math.floor(((raised / idea.target) * 100) / 25) * 25;
  const me = useApp.getState().account.name;
  if (idea.author === me && after > before && after > 0) useNet.getState().notify('goal', `"${idea.title}" ha raggiunto il ${after}% dell'obiettivo`, after >= 100);
  toast(`Hai versato ${formatCHF(amt)} LP a "${idea.title}"`);
}

export type { Post };
