import { Safe } from '@/components/Safe';
import { applyToFeed } from '@/lib/swipeDeck';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { StoryPeekHost } from '@/components/stories/StoryPeekHost';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { EmptyFeed, FeedSkeleton, FilterToggle, Composer, NetHeader, NetTabs } from '@/components/feed/Header';
import { FeedPost, type FeedPostData } from '@/components/feed/FeedPost';
import { byReach } from '@/lib/reach';
import { CommunityCard, ProductFeedCard, ServiceFeedCard } from '@/components/feed/TabCards';
import { SIGNAL, addSignal, rankMixed, type ThemeWeights } from '@/lib/relevance';
import type { Product } from '@/lib/shop';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';
import { IdeaHero, QuoteCard, SeminarFeedCard } from '@/components/feed/SpecialCards';
import { FEED_GUTTER, FEED_RADIUS } from '@/components/feed/parts';
import { JobsHub } from '@/components/JobsHub';
import { openSheet, UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, H, Input, Page, Select } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { SearchResults } from '@/components/feed/SearchResults';
import { t as tl } from '@/i18n/core';
import { useApp } from '@/store/app';
import { topicList, useNet, type Idea, type Provider, type Seminar } from '@/store/network';
import { toast } from '@/store/toast';

type Item =
  | { k: 'post'; id: string; post: FeedPostData; likeKey: string }
  | { k: 'idea'; id: string; idea: Idea }
  | { k: 'seminar'; id: string; s: Seminar }
  | { k: 'service'; id: string; p: Provider }
  | { k: 'product'; id: string; p: Product }
  | { k: 'quote'; id: string; text: string; author: string }
  | { k: 'community'; id: string; cid: number }
  | { k: 'jobs'; id: string }
  | { k: 'tools'; id: string }
  | { k: 'empty'; id: string; text: string };

/** true quando lo store salvato su dispositivo è stato letto (finché non lo è si mostra lo scheletro). */
function useHydrated() {
  const [ok, setOk] = useState(() => { try { return useNet.persist.hasHydrated(); } catch { return true; } });
  useEffect(() => {
    try {
      if (useNet.persist.hasHydrated()) { setOk(true); return; }
      return useNet.persist.onFinishHydration(() => setOk(true));
    } catch { setOk(true); }
  }, []);
  return ok;
}

export default function LifeNetwork() {
  const tr = useT();
  const t = useTheme();
  const win = useWindowDimensions().width;
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const { prefs, setPref } = net;
  const [people, setPeople] = useState('');
  const [commQ, setCommQ] = useState(''); const [commTopic, setCommTopic] = useState('Tutti');
  const [ideaQ, setIdeaQ] = useState('');
  const visible = useVisible();
  const hydrated = useHydrated();
  // oggetti post stabili tra un render e l'altro: FeedPost è memoizzato e non si ridisegna senza motivo
  const stable = useRef(new Map<string, FeedPostData>()).current;
  const keep = useCallback((id: string, p: FeedPostData): FeedPostData => {
    const old = stable.get(id);
    if (old && (Object.keys(p) as (keyof FeedPostData)[]).every((k) => old[k] === p[k])) return old;
    stable.set(id, p);
    return p;
  }, [stable]);

  // i messaggi si aprono dall'icona in alto: qui restano solo queste schede
  const tabs = ['Home', 'Post', 'Marketplace', 'Community', 'Idee', 'Lavoro'];
  const tabLabel = (k: string) => ({ Home: tr('lnTabHome'), Community: tr('lnTabCommunity'), Idee: tr('lnTabIdeas'), Marketplace: tr('lnTabMarketplace') }[k] ?? k);
  const curTab = tabs.includes(prefs.lnTab) ? prefs.lnTab : 'Home';
  const following = prefs.homeFilter === 'Seguiti';
  const swipes = net.swipes;

  const verified = net.identity.verified;
  const { communities, posts, ideas, seminars, providers, products, hideIdeas, mutedIdeaAuthors, following: followingList, reach } = net;

  const interestLabels = useInterests((x) => x.selected);
  const customInterests = useInterests((x) => x.custom);
  const themeWeights = net.themeWeights;
  const weights = useMemo<ThemeWeights>(() => {
    let w: ThemeWeights = { ...(themeWeights ?? {}) };
    for (const id of interestLabels) w = addSignal(w, INTEREST_CATALOG.find((c) => c.id === id)?.label ?? '', SIGNAL.interest);
    for (const c of customInterests) w = addSignal(w, c.label, SIGNAL.interest);
    return w;
  }, [themeWeights, interestLabels, customInterests]);

  /* feed misto: stesso intreccio di prima (post, community, idee, seminari sponsorizzati, citazioni) */
  const feedItems = useMemo<Item[]>(() => {
    const comm: Item[] = [];
    communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner)).forEach((c) => c.posts.forEach((p, pi) => comm.push({ k: 'post', id: `c${c.id}:${pi}`, likeKey: `community:${c.id}:${pi}`, post: keep(`c${c.id}:${pi}`, { author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes, ts: p.ts, uri: p.uri, editedAt: p.editedAt }) })));
    const standalone: Item[] = posts.filter((p) => !p.hideFromFeed && visible('post', 'standalone:' + p.id, p.author)).map((p) => ({ k: 'post', id: 's' + p.id, likeKey: 'standalone:' + p.id, post: keep('s' + p.id, p) }));
    const ideaItems: Item[] = hideIdeas ? [] : ideas.filter((i) => !mutedIdeaAuthors.includes(i.author) && visible('idea', i.id, i.author)).map((idea) => ({ k: 'idea', id: 'i' + idea.id, idea }));
    const sem: Item[] = seminars.filter((s) => s.promoted && visible('seminar', s.id, s.host)).map((s) => ({ k: 'seminar', id: 'm' + s.id, s }));
    const mot: Item[] = [{ k: 'quote', id: 'q0', text: tl('Il progresso non è lineare: anche un piccolo passo oggi conta.'), author: 'LifePilot' }, { k: 'quote', id: 'q1', text: tl('Non devi vedere tutta la scala, basta il primo gradino.'), author: 'LifePilot' }];
    const rk = (it: Item) => (it.k === 'post' ? it.likeKey : it.k === 'idea' ? `idea:${it.idea.id}` : '');
    const pools = [byReach(standalone, rk, reach), byReach(comm, rk, reach), byReach(ideaItems, rk, reach), sem, mot].filter((p) => p.length);
    const feed: Item[] = [];
    let idx = 0;
    while (pools.some((p) => p.length)) { const pool = pools[idx % pools.length]; if (pool.length) feed.push(pool.shift()!); idx++; }
    if (!following) return applyToFeed(feed, (it) => (it.k === 'post' ? it.likeKey : null), (it) => (it.k === 'post' ? `${it.post.text} ${it.post.tag ?? ''}` : ''), swipes, themeWeights);
    return feed.filter((it) => {
      const a = it.k === 'post' ? it.post.author : it.k === 'idea' ? it.idea.author : null;
      return a && followingList.includes(a);
    });
  }, [communities, posts, ideas, seminars, hideIdeas, mutedIdeaAuthors, followingList, following, me, visible, keep, reach, swipes, themeWeights]);

  const searching = people.trim().length >= 1;
  const data = useMemo<Item[]>(() => {
    if (searching) return [];
    if (curTab === 'Home') return feedItems.length ? feedItems : [{ k: 'empty', id: 'empty', text: '' }];
    if (curTab === 'Post') {
      const only = feedItems.filter((it) => it.k === 'post');
      return only.length ? only : [{ k: 'empty', id: 'empty', text: 'Ancora nessun post.' }];
    }
    if (curTab === 'Lavoro') return [{ k: 'jobs', id: 'jobs' }];
    if (curTab === 'Community') {
      const list = communities.filter((c) => (commTopic === 'Tutti' || c.topic === commTopic) && c.name.toLowerCase().includes(commQ.toLowerCase()) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner));
      return [{ k: 'tools', id: 'tools' }, ...(list.length ? list.map((c): Item => ({ k: 'community', id: 'k' + c.id, cid: c.id })) : [{ k: 'empty' as const, id: 'empty', text: 'Nessuna community trovata.' }])];
    }
    if (curTab === 'Idee') {
      const l = ideas.filter((i) => (i.title.toLowerCase().includes(ideaQ.toLowerCase()) || i.desc.toLowerCase().includes(ideaQ.toLowerCase())) && visible('idea', i.id, i.author));
      return [{ k: 'tools', id: 'tools' }, ...(l.length ? l.map((idea): Item => ({ k: 'idea', id: 'i' + idea.id, idea })) : [{ k: 'empty' as const, id: 'empty', text: 'Nessuna idea trovata.' }])];
    }
    const upcoming = [...seminars].sort((a, b) => ((a.startsAt ?? 9e15) < Date.now() ? 1e16 : 0) + (a.startsAt ?? 9e15) - (((b.startsAt ?? 9e15) < Date.now() ? 1e16 : 0) + (b.startsAt ?? 9e15)));
    const sellable = (products ?? []).filter((p) => p.stock > 0 || true);
    // l'algoritmo mette in alto ciò che interessa di più (interessi, mi piace, cose aperte e comprate); i tipi restano mescolati
    const semItems = upcoming.map((s): Item & { text: string; kind: string } => ({ k: 'seminar', id: 'm' + s.id, s, text: `${s.title} ${s.desc ?? ''}`, kind: 'seminario' }));
    const svcItems = providers.map((p): Item & { text: string; kind: string } => ({ k: 'service', id: 'p' + p.name, p, text: `${p.role} ${p.name}`, kind: 'servizio' }));
    const prodItems = sellable.map((p): Item & { text: string; kind: string } => ({ k: 'product', id: 'pr' + p.id, p, text: `${p.name} ${p.desc}`, kind: 'prodotto' }));
    const strip = (xs: (Item & { text: string; kind: string })[]): Item[] => xs.map(({ text: _t, kind: _k, ...rest }) => rest as Item);
    const f = prefs.marketFilter;
    let body: Item[];
    if (f === 'Servizi') body = svcItems.length ? strip(rankMixed(svcItems, weights)) : [{ k: 'empty', id: 'empty', text: 'Ancora nessun professionista in elenco.' }];
    else if (f === 'Seminari') body = semItems.length ? strip(rankMixed(semItems, weights)) : [{ k: 'empty', id: 'empty', text: 'Nessun seminario ancora.' }];
    else if (f === 'Prodotti') body = prodItems.length ? strip(rankMixed(prodItems, weights)) : [{ k: 'empty', id: 'empty', text: 'Ancora nessun prodotto: li pubblicano le attività con uno store.' }];
    else { const all = [...semItems, ...svcItems, ...prodItems]; body = all.length ? strip(rankMixed(all, weights)) : [{ k: 'empty', id: 'empty', text: 'Ancora nessuna proposta.' }]; }
    return [{ k: 'tools', id: 'tools' }, ...body];
  }, [curTab, feedItems, communities, commTopic, commQ, ideas, ideaQ, seminars, providers, products, weights, prefs.marketFilter, visible, searching]);

  if (!verified) {
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

  const compose = () => openSheet('newPost');

  const toggleJoin = (id: number) => {
    const c = net.communities.find((x) => x.id === id);
    if (!c) return;
    const joined = c.members.includes(me);
    net.patch({ communities: net.communities.map((x) => (x.id === c.id ? { ...x, members: joined ? x.members.filter((m) => m !== me) : [...x.members, me] } : x)) });
    toast(joined ? tl('Hai lasciato {0}', c.name) : tl('Iscritto a {0}', c.name));
  };

  const pillRow = (options: string[], value: string, onChange: (v: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.text : t.chip }}>
            <Text style={{ color: on ? t.onText : t.text, fontSize: 14, fontWeight: on ? '800' : '600' }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const header = (
    <View>
      <View style={{ paddingHorizontal: FEED_GUTTER }}>
        <NetHeader balance={net.lifePoints} query={people} onQuery={setPeople} placeholder="Cerca persone, post, idee, lavori…" />
        {searching && <SearchResults query={people} />}
        {!searching && <NetTabs tabs={tabs.map((k) => ({ key: k, label: tabLabel(k) }))} value={curTab} onChange={(k) => setPref('lnTab', k)} />}
      </View>
      {!searching && curTab === 'Post' && (
        <View style={{ marginTop: 6 }}>
          <Composer me={me} onPress={compose} />
          <View style={{ height: 8 }} />
        </View>
      )}
      {!searching && curTab === 'Home' && <Safe name="recap"><StoriesBar /></Safe>}
      {!searching && curTab === 'Home' && (
        <View style={{ marginTop: 6 }}>
          <Composer me={me} onPress={compose} />
          <FilterToggle options={[{ key: 'Per te', label: tr('lnFilterForYou') }, { key: 'Swipe', label: 'Swipe' }, { key: 'Seguiti', label: tr('lnFilterFollowing') }]} value={following ? 'Seguiti' : 'Per te'} onChange={(k) => { if (k === 'Swipe') go('swipeDeck'); else setPref('homeFilter', k); }} />
          <View style={{ height: 8 }} />
        </View>
      )}
      {!searching && curTab !== 'Home' && curTab !== 'Post' && <View style={{ height: 14 }} />}
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.k) {
      case 'post': return <FeedPost post={item.post} likeKey={item.likeKey} />;
      case 'idea': return <IdeaHero idea={item.idea} />;
      case 'seminar': return <SeminarFeedCard s={item.s} />;
      case 'service': return <ServiceFeedCard p={item.p} />;
      case 'product': return <ProductFeedCard p={item.p} />;
      case 'quote': return <QuoteCard text={item.text} author={item.author} />;
      case 'community': {
        const c = net.communities.find((x) => x.id === item.cid);
        if (!c) return null;
        return <CommunityCard c={c} joined={c.members.includes(me)} onToggle={() => toggleJoin(c.id)} onPostHere={() => { if (c.owner !== me && !c.openPosting) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} />;
      }
      case 'jobs': return <View style={{ paddingHorizontal: FEED_GUTTER }}><JobsHub /></View>;
      case 'empty':
        return curTab === 'Home'
          ? (hydrated ? <EmptyFeed following={following} onCompose={compose} /> : <FeedSkeleton width={win} />)
          : <View style={{ paddingHorizontal: FEED_GUTTER }}><Card><Empty text={item.text} /></Card></View>;
      case 'tools':
        return (
          <View style={{ paddingHorizontal: FEED_GUTTER }}>
            {curTab === 'Community' && (
              <>
                <Input placeholder="Cerca community…" value={commQ} onChangeText={setCommQ} />
                <Select title="Argomento" value={commTopic} options={['Tutti', ...topicList]} onChange={setCommTopic} />
                <Btn small ghost icon="plus" style={{ marginBottom: 16, alignSelf: 'flex-start' }} title="Crea la tua community" onPress={() => openSheet('newCommunity')} />
              </>
            )}
            {curTab === 'Idee' && (
              <>
                <Body small muted style={{ marginBottom: 12 }}>Ogni idea è legata a chi la pubblica. Se ne pubblichi una simile a una già esistente, viene segnalata come correlata a quella creata prima.</Body>
                <Input placeholder="Cerca idee…" value={ideaQ} onChangeText={setIdeaQ} />
                <Btn small ghost icon="plus" style={{ marginBottom: 16, alignSelf: 'flex-start' }} title="Crea la tua idea" onPress={() => openSheet('newIdea')} />
              </>
            )}
            {curTab === 'Marketplace' && (
              <>
                {pillRow(['Per te', 'Seminari', 'Servizi', 'Prodotti'], ['Seminari', 'Servizi', 'Prodotti'].includes(prefs.marketFilter) ? prefs.marketFilter : 'Per te', (v) => setPref('marketFilter', v))}
                {prefs.marketFilter === 'Prodotti'
                  ? <Body small muted style={{ marginBottom: 14 }}>Prodotti dei negozi su LifePilot: li paghi in LifePoints e li spedisce direttamente il negozio. Dopo l'acquisto si apre una chat per resi e assistenza.</Body>
                  : prefs.marketFilter === 'Per te'
                  ? <Body small muted style={{ marginBottom: 14 }}>Prodotti, seminari e servizi scelti in base a ciò che ti interessa.</Body>
                  : prefs.marketFilter === 'Servizi'
                  ? <Body small muted style={{ marginBottom: 14 }}>Psicologi, personal trainer, insegnanti di lingua e altri professionisti. Apri un servizio per leggere cosa offre e scegliere una data: paghi in LifePoints al momento della prenotazione e solo allora lo slot è tuo.</Body>
                  : <>
                    <Body small muted style={{ marginBottom: 12 }}>Seminari gratuiti o a pagamento. Apri un seminario per vedere data, contenuti e relatore: ti iscrivi senza pagare e i LifePoints si addebitano solo dopo, quando confermi di aver partecipato. Promuoverli in home costa LifePoints.</Body>
                    <Btn small ghost icon="plus" style={{ marginBottom: 16, alignSelf: 'flex-start' }} title="Crea seminario" onPress={() => openSheet('newSeminar')} />
                  </>}
              </>
            )}
          </View>
        );
    }
  };

  return (
    <Page id="lifenetwork" scroll={false}>
      <FlatList
        style={{ flex: 1, marginHorizontal: -FEED_GUTTER }}
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        extraData={[curTab, net.likedPosts, net.comments, net.savedPosts, me, net.swipes]}
        removeClippedSubviews={false}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      />
      <Safe name="anteprima recap"><StoryPeekHost /></Safe>
    </Page>
  );
}
