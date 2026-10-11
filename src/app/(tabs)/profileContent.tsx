import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FeedPost } from '@/components/feed/FeedPost';
import { IdeaHero } from '@/components/feed/SpecialCards';
import { Body, Btn, Card, Chev, Empty, Item, Page, Row } from '@/components/ui';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { fmtDateTime } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { t as tl } from '@/i18n/core';

const CONTENT_KINDS = ['post', 'idee', 'servizi', 'contributi'] as const;
type ContentKind = (typeof CONTENT_KINDS)[number];
const TITLE: Record<ContentKind, string> = { post: 'Post', idee: 'Idee', servizi: 'Servizi e seminari', contributi: 'Contributi' };

/** Elenco dedicato di un tipo di contenuto del profilo (lista con carte, non griglia di foto). */
export default function ProfileContent() {
  const { name: param, kind: k } = useLocalSearchParams<{ name?: string; kind?: string }>();
  const me = useApp((s) => s.account.name);
  const name = param || me;
  const isMe = name === me;
  const kind: ContentKind = (CONTENT_KINDS as readonly string[]).includes(k ?? '') ? (k as ContentKind) : 'post';
  const net = useNet();

  const posts = [
    ...net.posts.filter((p) => p.author === name).map((p) => ({ key: 'standalone:' + p.id, post: p })),
    ...net.communities.flatMap((c) => c.posts.map((p, pi) => ({ key: `community:${c.id}:${pi}`, post: { ...p, tag: c.name } })).filter((x) => x.post.author === name)),
  ];
  const ideas = net.ideas.filter((i) => i.author === name);
  const provider = net.providers.find((x) => x.name === name);
  const seminars = net.seminars.filter((x) => x.host === name);
  const given = net.ledger.filter((l) => l.desc.startsWith('Contributo a'));

  return (
    <Page id="profileContent" back title={`${TITLE[kind]} · ${name}`}>
      {kind === 'post' && (posts.length ? posts.map((x) => <View key={x.key} style={{ marginHorizontal: -16 }}><FeedPost post={x.post} likeKey={x.key} /></View>) : <Empty text="Ancora nessun post." />)}
      {kind === 'idee' && (ideas.length ? ideas.map((i) => <IdeaHero key={i.id} idea={i} inset={false} />) : <Empty text="Ancora nessuna idea pubblicata." />)}
      {kind === 'servizi' && (provider || seminars.length ? (
        <Card>
          {provider && <Item last={!seminars.length} onPress={() => go('servicePage', { name })}><Row><View style={{ flex: 1 }}><Body bold>{provider.role}</Body><Body small muted>{tl('Servizio · {0} LP a sessione', provider.price)}</Body></View><Chev /></Row></Item>}
          {seminars.map((sm, i) => <Item key={sm.id} last={i === seminars.length - 1} onPress={() => go('seminarPage', { id: String(sm.id) })}><Row><View style={{ flex: 1 }}><Body bold>{sm.title}</Body><Body small muted>{tl('Seminario · {0}', sm.startsAt ? fmtDateTime(sm.startsAt) : tl('data da definire'))}</Body></View><Chev /></Row></Item>)}
        </Card>
      ) : <Empty text={isMe ? 'Non offri ancora servizi o seminari.' : 'Nessun servizio o seminario.'} />)}
      {kind === 'servizi' && isMe && <Btn style={{ marginTop: 12 }} ghost icon="plus" title="Nuovo seminario o servizio" onPress={() => go('lifenetwork')} />}
      {kind === 'contributi' && (isMe ? (given.length ? <Card>{given.map((l, i) => <Item key={i} last={i === given.length - 1}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}</Body></View><Body bold>{formatCHF(l.amount)} LP</Body></Row></Item>)}</Card> : <Empty text="Nessun contributo ancora." />) : <Empty text="I contributi dati sono visibili solo alla persona che li fa." />)}
    </Page>
  );
}
