import { diversify } from '@/components/feed/feedLogic';
import { onPageRefresh } from '@/lib/pageRefresh';
import { useStoryPeek } from '@/store/storyPeek';
import { Safe } from '@/components/Safe';
import { applyToFeed } from '@/lib/swipeDeck';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { StoryPeekHost } from '@/components/stories/StoryPeekHost';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFeedVisible } from '@/store/feedVisible';
import { Animated, Easing, FlatList, PanResponder, Pressable, View, useWindowDimensions } from 'react-native';
import { SwipeDeck } from '@/components/feed/SwipeDeck';
import { useDeckCards } from '@/components/feed/useDeckCards';
import { useSeedMedia } from '@/lib/seedMedia';
import { pickQuotes, quoteCount, type Quote } from '@/lib/theiaQuotes';
import { carouselBusy } from '@/lib/feedSwipe';
import { adjacentSection } from '@/lib/sectionSwipe';
import { Text } from '@/components/T';

import { EmptyFeed, FeedSkeleton, FilterToggle, Composer, NetHeader, NetTabs } from '@/components/feed/Header';
import { FeedPost, type FeedPostData } from '@/components/feed/FeedPost';
import { byReach } from '@/lib/reach';
import { CommunityCard, JobFeedCard, ProductFeedCard, ServiceFeedCard } from '@/components/feed/TabCards';
import { SIGNAL, addSignal, rankMixed, type ThemeWeights } from '@/lib/relevance';
import type { Product } from '@/lib/shop';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';
import { IdeaHero, QuoteCard, SeminarFeedCard } from '@/components/feed/SpecialCards';
import { FEED_GUTTER, FEED_RADIUS } from '@/components/feed/parts';
import { JobsHub } from '@/components/JobsHub';
import { useJobs, type Job } from '@/store/jobs';
import { openSheet, UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, H, Input, Page, Select } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { Icon } from '@/lib/icons';
import { go, slideTo } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { SearchResults } from '@/components/feed/SearchResults';
import { t as tl } from '@/i18n/core';
import { useApp } from '@/store/app';
import { useFitGroups } from '@/store/fitGroups';
import { topicList, useNet, type Idea, type Provider, type Seminar } from '@/store/network';
import { toast } from '@/store/toast';

type Item =
  | { k: 'post'; id: string; post: FeedPostData; likeKey: string }
  | { k: 'idea'; id: string; idea: Idea }
  | { k: 'seminar'; id: string; s: Seminar }
  | { k: 'service'; id: string; p: Provider }
  | { k: 'product'; id: string; p: Product }
  | { k: 'quote'; id: string; q: Quote }
  | { k: 'community'; id: string; cid: number }
  | { k: 'jobs'; id: string }
  | { k: 'job'; id: string; job: Job }
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
  useSeedMedia();
  const tr = useT();
  const t = useTheme();
  const win = useWindowDimensions().width;
  const me = useApp((s) => s.account.name);
  // solo i dati che questa pagina usa: prima ogni cambio di qualsiasi parte dello store la ridisegnava tutta
  const net = useNet(useShallow((s) => ({ prefs: s.prefs, setPref: s.setPref, communities: s.communities, posts: s.posts, ideas: s.ideas, seminars: s.seminars, providers: s.providers, products: s.products, hideIdeas: s.hideIdeas, mutedIdeaAuthors: s.mutedIdeaAuthors, following: s.following, reach: s.reach, swipes: s.swipes, themeWeights: s.themeWeights, quoteLikes: s.quoteLikes, savedPosts: s.savedPosts, likedPosts: s.likedPosts, comments: s.comments, identity: s.identity, lifePoints: s.lifePoints, patch: s.patch })));
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
  /* i gesti orizzontali sulle storie restano delle storie: non cambiano scheda */
  const storiesPan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_e, g) => !useStoryPeek.getState().author && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) })).current;
  const listRef = useRef<FlatList<Item>>(null);
  /* i video partono solo quando sono a vista (almeno un terzo del post) */
  const viewCfg = useRef({ itemVisiblePercentThreshold: 35, minimumViewTime: 120 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Item }[] }) => {
    const u = new Set<string>();
    for (const v of viewableItems) { const it = v.item; if (it.k === 'post') { if (it.post.uri) u.add(it.post.uri); it.post.uris?.forEach((x) => u.add(x)); } }
    useFeedVisible.getState().set(u);
  }).current;
  const offsetRef = useRef(0);
  useEffect(() => onPageRefresh('lifenetwork', () => { listRef.current?.scrollToOffset({ offset: 0, animated: true }); offsetRef.current = 0; }), []);
  /* da «Per te» a «Seguiti» (e viceversa) resti allo stesso punto della pagina, non torni in cima */
  useEffect(() => { const y = offsetRef.current; const h = requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: y, animated: false })); return () => cancelAnimationFrame(h); }, [prefs.homeFilter]);
  const swipes = net.swipes;
  /* zone di Network: il recap (in alto) non cambia mai sezione; solo l'area dei post (da «Per te / Swipe / Seguiti» in giù) sì */
  const toggleRef = useRef<View>(null);
  const feedTop = useRef(0);
  const measureFeed = useCallback(() => { toggleRef.current?.measureInWindow?.((_x, y) => { if (Number.isFinite(y)) feedTop.current = y; }); }, []);
  const prevTab = useRef<'Per te' | 'Seguiti'>('Per te');
  const navItemsAll = useApp((a) => a.navItems);
  const quoteLikes = net.quoteLikes;

  const verified = net.identity.verified;
  const jobsList = useJobs((x) => x.jobs);
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
    communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner)).forEach((c) => c.posts.forEach((p, pi) => { if (p.media && !p.uri) return; comm.push({ k: 'post', id: `c${c.id}:${pi}`, likeKey: `community:${c.id}:${pi}`, post: keep(`c${c.id}:${pi}`, { author: p.author, text: p.text, media: p.media, tag: c.name, likes: p.likes, ts: p.ts, uri: p.uri, editedAt: p.editedAt }) }); }));
    const standalone: Item[] = posts.filter((p) => !p.sponsor && !p.hideFromFeed && !(p.media && !p.uri && !p.uris?.length) && visible('post', 'standalone:' + p.id, p.author)).map((p) => ({ k: 'post', id: 's' + p.id, likeKey: 'standalone:' + p.id, post: keep('s' + p.id, p) }));
    const ideaItems: Item[] = hideIdeas ? [] : ideas.filter((i) => !mutedIdeaAuthors.includes(i.author) && visible('idea', i.id, i.author)).map((idea) => ({ k: 'idea', id: 'i' + idea.id, idea }));
    /* nella Home c'è tutto: post, idee, seminari, servizi, marketplace e offerte di lavoro (nello Swipe solo post, idee e servizi) */
    const sem: Item[] = seminars.filter((s) => visible('seminar', s.id, s.host)).sort((a, b) => Number(b.promoted) - Number(a.promoted)).map((s) => ({ k: 'seminar', id: 'm' + s.id, s }));
    const svc: Item[] = providers.filter((p) => p.name !== me).map((p) => ({ k: 'service', id: 'p' + p.name, p }));
    const prod: Item[] = (products ?? []).filter((p) => p.shop !== me).map((p) => ({ k: 'product', id: 'pr' + p.id, p }));
    const jobItems: Item[] = jobsList.filter((j) => j.owner !== me && j.status === 'open').map((job) => ({ k: 'job', id: 'j' + job.id, job }));
    /* inserzioni: una ogni sei contenuti, a partire dal quarto (solo in «Per te») */
    const ads: Item[] = posts.filter((p) => p.sponsor && visible('post', 'standalone:' + p.id, p.author)).map((p) => ({ k: 'post', id: 's' + p.id, likeKey: 'standalone:' + p.id, post: keep('s' + p.id, p) }));
    const mot: Item[] = pickQuotes(quoteLikes, quoteCount(quoteLikes), Math.floor(Date.now() / 86400000)).map((q) => ({ k: 'quote', id: 'q:' + q.id, q }));
    const rk = (it: Item) => (it.k === 'post' ? it.likeKey : it.k === 'idea' ? `idea:${it.idea.id}` : '');
    /* intreccio: due post, poi un altro tipo di contenuto (idea, servizio, seminario, prodotto, lavoro, frase di Theia a turno), così in «Per te» c'è sempre varietà */
    const posts2: Item[] = [...byReach(standalone, rk, reach), ...byReach(comm, rk, reach)];
    const others = [byReach(ideaItems, rk, reach), svc, sem, prod, jobItems].filter((p) => p.length);
    const feed: Item[] = [];
    let oi = 0, n = 0;
    while (posts2.length || others.some((p) => p.length)) {
      const wantOther = n % 3 === 2 || !posts2.length;
      if (wantOther && others.some((p) => p.length)) {
        let pool = others[oi % others.length]; let tries = 0;
        while (!pool.length && tries++ < others.length) { oi++; pool = others[oi % others.length]; }
        oi++;
        if (pool.length) feed.push(pool.shift()!);
      } else if (posts2.length) feed.push(posts2.shift()!);
      n++;
    }
    /* i consigli di Theia sono sparsi lungo il feed (uno ogni sette contenuti circa), come una vera cronologia */
    const spread = (list: Item[], extra: Item[], first: number, every: number) => { const out = list.slice(); extra.forEach((x, i) => { out.splice(Math.min(out.length, first + i * every), 0, x); }); return out; };
    if (!following) {
      const sig = (it: Item) => (it.k === 'post' ? `post:${it.post.media ?? 'frase'}` : it.k);
      const base = diversify(applyToFeed(feed, (it) => (it.k === 'post' ? it.likeKey : null), (it) => (it.k === 'post' ? `${it.post.text} ${it.post.tag ?? ''}` : ''), swipes, themeWeights), sig);
      /* inserzioni: una ogni sei contenuti a partire dal quarto */
      return spread(spread(base, ads, 3, 6), mot, 4, 7);
    }
    return spread(feed.filter((it) => {
      const a = it.k === 'post' ? it.post.author : it.k === 'idea' ? it.idea.author : null;
      return a && followingList.includes(a);
    }), mot, 3, 7);
  }, [communities, posts, ideas, seminars, providers, products, jobsList, hideIdeas, mutedIdeaAuthors, followingList, following, me, visible, keep, reach, swipes, themeWeights, quoteLikes]);

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

  const compose = () => openSheet('newPost');

  const toggleJoin = (id: number) => {
    const c = net.communities.find((x) => x.id === id);
    if (!c) return;
    const grp = useFitGroups.getState().groups.find((x) => x.communityId === c.id);
    if (grp) { go('fitnessGroup', { id: grp.id }); return; } // community di un gruppo di allenamento: si entra dal gruppo
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
          <Composer me={me} onPress={compose} onPhoto={() => openSheet('create')} />
          <View style={{ height: 8 }} />
        </View>
      )}
      {!searching && curTab === 'Home' && <View {...storiesPan.panHandlers}><Safe name="recap"><StoriesBar mode={following ? 'Seguiti' : 'Per te'} /></Safe></View>}
      {!searching && curTab === 'Home' && (
        <View style={{ marginTop: 6 }}>
          <Composer me={me} onPress={compose} onPhoto={() => openSheet('create')} />
          <View ref={toggleRef} onLayout={measureFeed}>
            <FilterToggle options={[{ key: 'Per te', label: tr('lnFilterForYou') }, { key: 'Swipe', label: 'Swipe', bold: true }, { key: 'Seguiti', label: tr('lnFilterFollowing') }]} value={following ? 'Seguiti' : 'Per te'} onChange={(k) => { if (k === 'Swipe') { prevTab.current = following ? 'Seguiti' : 'Per te'; setDeckShown(true); settleRef.current('Swipe'); } else setPref('homeFilter', k); }} />
          </View>
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
      case 'quote': return <QuoteCard q={item.q} />;
      case 'community': {
        const c = net.communities.find((x) => x.id === item.cid);
        if (!c) return null;
        return <CommunityCard c={c} joined={c.members.includes(me)} onToggle={() => toggleJoin(c.id)} onPostHere={() => { if (c.owner !== me && !c.openPosting) { toast('Solo il proprietario può pubblicare qui'); return; } openSheet('postToCommunity', { id: c.id }); }} />;
      }
      case 'job': return <JobFeedCard job={item.job} />;
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

  /* Pager reale: Per te | Swipe | Seguiti affiancati; la schermata segue il dito e si vede quella accanto, come nei social. */
  const { width: W } = useWindowDimensions();
  const pos = useRef(new Animated.Value(following ? 2 * W : 0)).current;
  const [deckShown, setDeckShown] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const settle = (to: 'Per te' | 'Swipe' | 'Seguiti', fast?: boolean) => {
    const target = to === 'Per te' ? 0 : to === 'Swipe' ? W : 2 * W;
    if (to === 'Swipe') { setDeckShown(true); setDeckOpen(true); } else setDeckOpen(false);
    Animated.timing(pos, { toValue: target, duration: fast ? 140 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      if (to !== 'Swipe') setDeckShown(false);
    });
  };
  const settleRef = useRef(settle); settleRef.current = settle;
  /* se il filtro cambia da fuori (toggle), la posizione a riposo segue */
  useEffect(() => { if (!deckOpen) pos.setValue(following ? 2 * W : 0); }, [following]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTab = (dir: 1 | -1) => {
    if (curTab !== 'Home' || searching || deckOpen) return;
    const cur: 'Per te' | 'Seguiti' = following ? 'Seguiti' : 'Per te';
    /* Per te: a destra (dito verso destra) sezione precedente, a sinistra lo Swipe. Seguiti: a destra lo Swipe, a sinistra la sezione successiva. */
    const toDeck = cur === 'Per te' ? dir === 1 : dir === -1;
    if (toDeck) { prevTab.current = cur; setDeckShown(true); settleRef.current('Swipe'); return; }
    const to = adjacentSection(navItemsAll, 'lifenetwork', cur === 'Per te' ? -1 : 1);
    if (to) slideTo(to, cur === 'Per te' ? -1 : 1);
  };
  const goTabRef = useRef(goTab); goTabRef.current = goTab;
  const swipePan = useRef(PanResponder.create({
    /* si prende il gesto solo se c'è una scheda accanto; ai bordi passa alla sezione vicina della barra */
    onMoveShouldSetPanResponder: (e, g) => {
      const startY = (e.nativeEvent.pageY ?? g.moveY) - g.dy;
      return !carouselBusy() && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8 && startY >= feedTop.current;
    },
    onPanResponderGrant: () => { if (useNet.getState().prefs.homeFilter === 'Seguiti') prevTab.current = 'Seguiti'; else prevTab.current = 'Per te'; },
    onPanResponderMove: (_e, g) => {
      const fol = useNet.getState().prefs.homeFilter === 'Seguiti';
      if (!fol && g.dx < 0) { setDeckShown(true); pos.setValue(Math.min(W, -g.dx)); }
      else if (fol && g.dx > 0) { setDeckShown(true); pos.setValue(Math.max(W, 2 * W - g.dx)); }
    },
    onPanResponderRelease: (_e, g) => {
      const fol = useNet.getState().prefs.homeFilter === 'Seguiti';
      const toDeck = fol ? g.dx : -g.dx;
      const away = fol ? -g.dx : g.dx;
      if (toDeck > 70 || (toDeck > 28 && Math.abs(g.vx) > 0.6)) { prevTab.current = fol ? 'Seguiti' : 'Per te'; settleRef.current('Swipe'); }
      else if (away > 70 || (away > 28 && Math.abs(g.vx) > 0.6)) { settleRef.current(fol ? 'Seguiti' : 'Per te', true); const to = adjacentSection(navItemsAll, 'lifenetwork', fol ? 1 : -1); if (to) slideTo(to, fol ? 1 : -1); }
      else settleRef.current(fol ? 'Seguiti' : 'Per te', true);
    },
    onPanResponderTerminate: () => settleRef.current(useNet.getState().prefs.homeFilter === 'Seguiti' ? 'Seguiti' : 'Per te', true),
  })).current;
  /* due pallini ai lati dello Swipe: si trascinano verso Per te (sinistra) o Seguiti (destra) */
  const dotPan = (side: 'left' | 'right') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setPref('homeFilter', side === 'left' ? 'Per te' : 'Seguiti'); },
    onPanResponderMove: (_e, g) => pos.setValue(side === 'left' ? Math.max(0, W - Math.max(0, g.dx)) : Math.min(2 * W, W + Math.max(0, -g.dx))),
    onPanResponderRelease: (_e, g) => {
      const d = side === 'left' ? g.dx : -g.dx;
      if (d > 70 || (d > 28 && Math.abs(g.vx) > 0.6)) settleRef.current(side === 'left' ? 'Per te' : 'Seguiti');
      else settleRef.current('Swipe', true);
    },
    onPanResponderTerminate: () => settleRef.current('Swipe', true),
  });
  const leftDot = useRef(dotPan('left')).current, rightDot = useRef(dotPan('right')).current;
  const deckCards = useDeckCards();
  const homeX = useMemo(() => (following ? Animated.add(Animated.multiply(pos, -1), 2 * W) : Animated.multiply(pos, -1)), [following, pos, W]);
  const deckX = useMemo(() => Animated.add(Animated.multiply(pos, -1), W), [pos, W]);
  const dotStyle = (side: 'start' | 'end') => ({ position: 'absolute' as const, [side]: 6, top: '46%' as const, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' });

  const gate = !verified ? (
      <Page id="lifenetwork" title="LifeNetwork">
        <Card>
          <H>Verifica la tua identità</H>
          <Body small muted>Per accedere a LifeNetwork serve confermare l'età minima (di norma 16 anni, o l'età prevista dal tuo paese).</Body>
          <Btn style={{ marginTop: 10 }} title="Verifica identità" onPress={() => openSheet('verification')} />
        </Card>
      </Page>
  ) : null;

  if (gate) return gate;
  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#000' }}>
    <Animated.View style={{ flex: 1, transform: [{ translateX: homeX }] }} pointerEvents={deckOpen ? 'none' : 'auto'}>
    <Page id="lifenetwork" scroll={false}>
      <View style={{ flex: 1 }} {...swipePan.panHandlers}>
      <FlatList
        ref={listRef}
        onScroll={(e) => { offsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        onScrollEndDrag={measureFeed}
        onMomentumScrollEnd={measureFeed}
        style={{ flex: 1, marginHorizontal: -FEED_GUTTER }}
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        extraData={[curTab, net.likedPosts, net.comments, net.savedPosts, me, net.swipes]}
        removeClippedSubviews={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        viewabilityConfig={viewCfg}
        onViewableItemsChanged={onViewable}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      />
      </View>
      <Safe name="anteprima recap"><StoryPeekHost /></Safe>
    </Page>
    </Animated.View>
    {deckShown ? (
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: '#000', transform: [{ translateX: deckX }] }}>
        <SwipeDeck cards={deckCards} onClose={() => settleRef.current(prevTab.current)} />
        <View accessibilityRole="button" accessibilityLabel="Trascina verso destra per tornare a Per te" {...leftDot.panHandlers} style={dotStyle('start')} hitSlop={{ top: 14, bottom: 14, left: 6, right: 14 }} />
        <View accessibilityRole="button" accessibilityLabel="Trascina verso sinistra per andare a Seguiti" {...rightDot.panHandlers} style={dotStyle('end')} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} />
      </Animated.View>
    ) : null}
    </View>
  );
}
