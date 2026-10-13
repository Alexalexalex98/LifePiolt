import { useState } from 'react';
import { View } from 'react-native';

import { FeedPost } from '@/components/feed/FeedPost';
import { UserAvatar } from '@/components/network';
import { Body, Card, Empty, Item, Page, Pill, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { postByKey } from '@/lib/network';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

type Tab = 'likes' | 'comments' | 'saved' | 'ideas' | 'bookings' | 'following';
const TABS: [Tab, string][] = [['likes', 'Mi piace'], ['comments', 'Commenti'], ['saved', 'Salvati'], ['ideas', 'Idee sostenute'], ['bookings', 'Iscrizioni e prenotazioni'], ['following', 'Persone che segui']];

/** Tutto ciò che hai fatto nella rete: mi piace, commenti, salvati, idee sostenute, iscrizioni e persone che segui. Solo tu lo vedi. */
export default function Activity() {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const [tab, setTab] = useState<Tab>('likes');
  const likedKeys = [...(net.likedPosts ?? [])].reverse();
  const liked = likedKeys.map((key) => ({ key, post: postByKey(key) })).filter((r): r is { key: string; post: NonNullable<ReturnType<typeof postByKey>> } => !!r.post);
  const saved = [...(net.savedPosts ?? [])].reverse().map((key) => ({ key, post: postByKey(key) })).filter((r): r is { key: string; post: NonNullable<ReturnType<typeof postByKey>> } => !!r.post);
  const mine = Object.entries(net.comments ?? {}).flatMap(([key, list]) => list.map((c, i) => ({ key, i, text: c.text, author: c.author })).filter((c) => c.author === me));
  const myComments = mine.reverse().map((c) => ({ ...c, post: postByKey(c.key) })).filter((c) => !!c.post);
  const ideas = Object.entries(net.myContrib ?? {}).map(([id, amount]) => ({ idea: net.ideas.find((x) => x.id === Number(id)), amount })).filter((x) => x.idea && x.amount > 0);
  const bookings = [...net.enrollments].sort((a, b) => b.createdAt - a.createdAt);
  const counts: Record<Tab, number> = { likes: liked.length, comments: myComments.length, saved: saved.length, ideas: ideas.length, bookings: bookings.length, following: net.following.length };
  const FeedList = ({ rows, empty }: { rows: { key: string; post: NonNullable<ReturnType<typeof postByKey>> }[]; empty: string }) => rows.length === 0
    ? <Card><Empty text={empty} /></Card>
    : <>{rows.map((r) => <View key={r.key} style={{ marginHorizontal: -16 }}><FeedPost post={r.post} likeKey={r.key} /></View>)}</>;
  return (
    <Page id="activity" back title="La tua attività">
      <Body small muted style={{ marginBottom: 10 }}>Qui ritrovi tutto quello che hai fatto nella rete. Lo vedi solo tu.</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }} gap={8}>
        {TABS.map(([k, l]) => <Pill key={k} label={`${tl(l)} · ${counts[k]}`} on={tab === k} onPress={() => setTab(k)} />)}
      </Row>
      {tab === 'likes' && <FeedList rows={liked} empty="Non hai ancora messo mi piace a niente: tocca il cuore sotto un post." />}
      {tab === 'saved' && <FeedList rows={saved} empty="Non hai salvato niente: tocca il segnalibro sotto un post." />}
      {tab === 'comments' && (myComments.length === 0 ? <Card><Empty text="Non hai ancora commentato: apri un post e scrivi nella barra dei commenti." /></Card> : (
        <Card>
          {myComments.map((c, i) => (
            <Item key={`${c.key}:${c.i}`} last={i === myComments.length - 1} onPress={() => go('postPage', { key: c.key, focus: 'comment' })}>
              <Body bold>{c.text}</Body>
              <Body small muted numberOfLines={2}>{tl('Su un post di {0}', c.post!.author)}{c.post!.text ? `: ${c.post!.text}` : ''}</Body>
            </Item>
          ))}
        </Card>
      ))}
      {tab === 'ideas' && (ideas.length === 0 ? <Card><Empty text="Non hai ancora sostenuto nessuna idea." /></Card> : (
        <Card>
          {ideas.map((x, i) => (
            <Item key={x.idea!.id} last={i === ideas.length - 1} onPress={() => go('ideaProfile', { id: String(x.idea!.id) })}>
              <Body bold>{x.idea!.title}</Body>
              <Body small muted>{tl('Di {0} · hai versato {1} LP', x.idea!.author, x.amount)}</Body>
            </Item>
          ))}
        </Card>
      ))}
      {tab === 'bookings' && (bookings.length === 0 ? <Card><Empty text="Nessuna iscrizione o prenotazione per ora." /></Card> : (
        <Card>
          {bookings.map((b, i) => (
            <Item key={b.id} last={i === bookings.length - 1} onPress={() => go(b.kind === 'seminar' ? 'seminarPage' : 'servicePage', b.kind === 'seminar' ? { id: b.ref.replace(/^seminar:/, '') } : { name: b.host })}>
              <Body bold>{b.title}</Body>
              <Body small muted>{`${b.host} · ${new Date(b.startsAt).toLocaleDateString()} · ${b.status === 'attended' ? tl('Partecipato') : b.status === 'declined' ? tl('Non partecipato') : tl('Iscritto')}`}</Body>
            </Item>
          ))}
        </Card>
      ))}
      {tab === 'following' && (net.following.length === 0 ? <Card><Empty text="Non segui ancora nessuno." /></Card> : (
        <Card>
          {net.following.map((n, i) => (
            <Item key={n} last={i === net.following.length - 1} onPress={() => go('userProfile', { name: n })}>
              <Row gap={10}><UserAvatar name={n} size={36} /><Body bold style={{ flex: 1 }}>{n}</Body></Row>
            </Item>
          ))}
        </Card>
      ))}
    </Page>
  );
}
