import { useState } from 'react';
import { Text, View } from 'react-native';

import { JobsHub } from '@/components/JobsHub';
import { SeminarCard, ServiceCard } from '@/components/market';
import { IdeaCard, LpTag, PostCard, openSheet, UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, H, Input, Page, Row, Seg, TabRow, Item, Chev } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { peoplePool } from '@/lib/network';
import { describeCommunity } from '@/data/marketSeed';
import { useApp } from '@/store/app';
import { topicList, useNet } from '@/store/network';
import { toast } from '@/store/toast';

export default function LifeNetwork() {
  const tr = useT();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const { prefs, setPref } = net;
  const [people, setPeople] = useState('');
  const [commQ, setCommQ] = useState(''); const [commTopic, setCommTopic] = useState('Tutti');
  const [ideaQ, setIdeaQ] = useState('');
  const visible = useVisible();

  // i messaggi si aprono dall'icona in alto: qui restano solo queste schede
  const tabs = ['Home', 'Lavoro', 'Community', 'Idee', 'Marketplace'];
  const tabLabel = (k: string) => ({ Home: tr('lnTabHome'), Community: tr('lnTabCommunity'), Idee: tr('lnTabIdeas'), Marketplace: tr('lnTabMarketplace') }[k] ?? k);
  const curTab = tabs.includes(prefs.lnTab) ? prefs.lnTab : 'Home';

  if (!net.identity.verified) {
    return (
      <Page id="lifenetwork" title="LifeNetwork">
        <Card>
          <H>Verifica la tua identità</H>
          <Body small muted>Per accedere a LifeNetwork serve confermare l'età minima (di norma 16 anni, o l'età prevista dal tuo paese).</Body>
          <Btn style={{ marginTop: 10 }} title="Verifica identità" onPress={() => openSheet('verification')} />
        </Card>
      </Page>
    );
  }

  /* feed misto */
  function buildFeed() {
    const comm: any[] = [];
    net.communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner)).forEach((c) => c.posts.forEach((p, pi) => comm.push({ type: 'community', community: c.name, cid: c.id, pi, ...p })));
    const standalone = net.posts.filter((p) => visible('post', 'standalone:' + p.id, p.author)).map((p) => ({ type: 'standalone', post: p }));
    const ideaItems = net.hideIdeas ? [] : net.ideas.filter((i) => !net.mutedIdeaAuthors.includes(i.author) && visible('idea', i.id, i.author)).map((idea) => ({ type: 'idea', idea }));
    const sem = net.seminars.filter((s) => s.promoted && visible('seminar', s.id, s.host)).map((s) => ({ type: 'seminar', ...s }));
    const mot = [{ type: 'motivational', text: 'Il progresso non è lineare: anche un piccolo passo oggi conta.', author: 'LifePilot' }, { type: 'motivational', text: 'Non devi vedere tutta la scala, basta il primo gradino.', author: 'LifePilot' }];
    const pools = [standalone, comm, ideaItems, sem, mot].filter((p) => p.length);
    const feed: any[] = [];
    let idx = 0;
    while (pools.some((p) => p.length)) { const pool = pools[idx % pools.length]; if (pool.length) feed.push(pool.shift()); idx++; }
    return feed;
  }

  const renderFeedItem = (it: any, i: number) => {
    if (it.type === 'standalone') return <PostCard key={'s' + it.post.id} post={it.post} likeKey={'standalone:' + it.post.id} />;
    if (it.type === 'community') return <PostCard key={`c${it.cid}${it.pi}`} post={{ author: it.author, text: it.text, media: it.media, tag: it.community, likes: it.likes, ts: it.ts, uri: it.uri }} likeKey={`community:${it.cid}:${it.pi}`} />;
    if (it.type === 'idea') return <IdeaCard key={'i' + it.idea.id} idea={it.idea} />;
    if (it.type === 'seminar') return <SeminarCard key={'m' + it.id} s={it} />;
    return <Card key={'q' + i}><Body small style={{ fontStyle: 'italic' }}>"{it.text}"</Body><Body small muted style={{ marginTop: 6 }}>— {it.author}</Body></Card>;
  };

  const q = people.trim().toLowerCase();
  const matches = q.length >= 2 ? peoplePool(me).filter((n) => n.toLowerCase().includes(q) && visible('profile', n, n)) : [];

  let feed = buildFeed();
  if (prefs.homeFilter === 'Seguiti') {
    feed = feed.filter((it) => {
      const a = it.type === 'standalone' ? it.post.author : it.type === 'community' ? it.author : it.type === 'idea' ? it.idea.author : null;
      return a && net.following.includes(a);
    });
  }

  return (
    <Page id="lifenetwork" title="LifeNetwork">
      <Card><Row><Body small muted>Il tuo saldo</Body><Row gap={2}><Text style={{ color: '#fff' }}> </Text><Body bold style={{ fontSize: 19 }}>{formatCHF(net.lifePoints)}</Body><LpTag size={15} /></Row></Row></Card>
      <Input placeholder="Cerca persone su LifeNetwork…" value={people} onChangeText={setPeople} />
      {q.length >= 2 && (
        <Card>{matches.length === 0 ? <Empty text="Nessuna persona trovata." /> : matches.map((n, i) => (
          <Item key={n} last={i === matches.length - 1} onPress={() => go('userProfile', { name: n })}><Row><Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}><UserAvatar name={n} size={28} /><Body>{n}</Body></Row><Chev /></Row></Item>
        ))}</Card>
      )}
      <TabRow options={tabs.map(tabLabel)} value={tabLabel(curTab)} onChange={(v) => setPref('lnTab', tabs.find((x) => tabLabel(x) === v) ?? 'Home')} />

      {curTab === 'Home' && (
        <>
          <Row style={{ marginBottom: 8 }}>
            <View style={{ flex: 1 }}><TabRow options={[tr('lnFilterForYou'), tr('lnFilterFollowing')]} value={prefs.homeFilter === 'Seguiti' ? tr('lnFilterFollowing') : tr('lnFilterForYou')} onChange={(v) => setPref('homeFilter', v === tr('lnFilterFollowing') ? 'Seguiti' : 'Per te')} /></View>
            <Btn small ghost title="+ Post" onPress={() => openSheet('newPost')} />
          </Row>
          {feed.length ? feed.map(renderFeedItem) : <Card><Empty text={prefs.homeFilter === 'Seguiti' ? 'Nessun post da chi segui, per ora.' : 'Ancora niente da mostrare: pubblica il primo post o crea una community.'} /></Card>}
        </>
      )}

            {curTab === 'Lavoro' && <JobsHub />}

      {curTab === 'Community' && (
        <>
          <Input placeholder="Cerca community…" value={commQ} onChangeText={setCommQ} />
          <TabRow options={['Tutti', ...topicList]} value={commTopic} onChange={setCommTopic} />
          <Btn small ghost style={{ marginBottom: 12 }} title="+ Crea la tua community" onPress={() => openSheet('newCommunity')} />
          {(() => {
            const list = net.communities.filter((c) => (commTopic === 'Tutti' || c.topic === commTopic) && c.name.toLowerCase().includes(commQ.toLowerCase()) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner));
            if (!list.length) return <Card><Empty text="Nessuna community trovata." /></Card>;
            return list.map((c) => {
              const joined = c.members.includes(me);
              const d = describeCommunity(c);
              return (
                <View key={c.id}>
                  <Card onPress={() => go('communityProfile', { id: String(c.id) })}>
                    <Row>
                      <View style={{ flex: 1 }}>
                        <Body bold>{c.name}</Body>
                        <Body small muted>{c.topic} · {c.members.length} membri · {c.openPosting ? 'tutti possono pubblicare' : 'solo il proprietario pubblica'}</Body>
                      </View>
                      <Btn small ghost={joined} title={joined ? 'Iscritto' : 'Iscriviti'} onPress={() => {
                        net.patch({ communities: net.communities.map((x) => (x.id === c.id ? { ...x, members: joined ? x.members.filter((m) => m !== me) : [...x.members, me] } : x)) });
                        toast(joined ? 'Hai lasciato ' + c.name : 'Iscritto a ' + c.name);
                      }} />
                    </Row>
                    <Body small muted numberOfLines={3} style={{ marginTop: 8 }}>{d.desc}</Body>
                    <Row style={{ marginTop: 8 }}>
                      {joined ? <Btn small ghost title="Pubblica qui" onPress={() => { if (c.owner !== me && !c.openPosting) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} /> : <View />}
                      <Row gap={4}><Body small muted>Apri la community</Body><Chev /></Row>
                    </Row>
                  </Card>
                  {c.posts.slice(0, 2).map((p, pi) => <PostCard key={pi} post={{ author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes, ts: p.ts, uri: p.uri }} likeKey={`community:${c.id}:${pi}`} />)}
                </View>
              );
            });
          })()}
        </>
      )}

      {curTab === 'Idee' && (
        <>
          <Body small muted style={{ marginBottom: 10 }}>Ogni idea è legata a un titolare, come nel registro di commercio. Se ne pubblichi una simile a una già esistente, viene segnalata come correlata a quella creata prima.</Body>
          <Btn small ghost style={{ marginBottom: 12 }} title="+ Crea la tua idea" onPress={() => openSheet('newIdea')} />
          <Input placeholder="Cerca idee…" value={ideaQ} onChangeText={setIdeaQ} />
          {(() => {
            const l = net.ideas.filter((i) => (i.title.toLowerCase().includes(ideaQ.toLowerCase()) || i.desc.toLowerCase().includes(ideaQ.toLowerCase())) && visible('idea', i.id, i.author));
            return l.length ? l.map((i) => <IdeaCard key={i.id} idea={i} />) : <Card><Empty text="Nessuna idea trovata." /></Card>;
          })()}
        </>
      )}

      {curTab === 'Marketplace' && (
        <>
          <Seg options={['Seminari', 'Servizi']} value={prefs.marketFilter} onChange={(v) => setPref('marketFilter', v)} />
          {prefs.marketFilter === 'Servizi' ? (
            <>
              <Body small muted style={{ marginBottom: 10 }}>Psicologi, personal trainer, insegnanti di lingua e altri professionisti. Apri un servizio per leggere cosa offre e scegliere una data: prenoti senza pagare e paghi in LifePoints solo dopo la sessione, quando confermi di aver partecipato.</Body>
              {net.providers.length === 0 && <Card><Empty text="Ancora nessun professionista in elenco." /></Card>}
              {net.providers.map((p) => <ServiceCard key={p.name} p={p} />)}
            </>
          ) : (
            <>
              <Body small muted style={{ marginBottom: 10 }}>Seminari gratuiti o a pagamento. Apri un seminario per vedere data, contenuti e relatore: ti iscrivi senza pagare e i LifePoints si addebitano solo dopo, quando confermi di aver partecipato. Promuoverli in home costa LifePoints.</Body>
              <Btn small ghost style={{ marginBottom: 12 }} title="+ Crea seminario" onPress={() => openSheet('newSeminar')} />
              {net.seminars.length === 0 && <Card><Empty text="Nessun seminario ancora." /></Card>}
              {[...net.seminars].sort((a, b) => ((a.startsAt ?? 9e15) < Date.now() ? 1e16 : 0) + (a.startsAt ?? 9e15) - (((b.startsAt ?? 9e15) < Date.now() ? 1e16 : 0) + (b.startsAt ?? 9e15))).map((s) => <SeminarCard key={s.id} s={s} />)}
            </>
          )}
        </>
      )}
    </Page>
  );
}
