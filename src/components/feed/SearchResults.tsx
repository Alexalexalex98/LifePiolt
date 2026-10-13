import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';
import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl, translateText } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { peoplePool } from '@/lib/network';
import { KIND_LABEL, SEARCH_KINDS, groupHits, searchAll, type SearchDoc, type SearchHit, type SearchKind } from '@/lib/netSearch';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { FEED_RADIUS } from './parts';

const KIND_ICON: Record<SearchKind, 'profile' | 'comment' | 'sparkle' | 'calendar' | 'contact' | 'grid' | 'users' | 'briefcase'> = { persona: 'profile', post: 'comment', idea: 'sparkle', seminario: 'calendar', servizio: 'contact', prodotto: 'grid', community: 'users', lavoro: 'briefcase' };
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Apre il risultato nella sua pagina. */
function open(h: SearchHit) {
  switch (h.kind) {
    case 'persona': return go('userProfile', { name: h.id });
    case 'post': return go('postPage', { key: h.id });
    case 'idea': return go('ideaProfile', { id: h.id });
    case 'seminario': return go('seminarPage', { id: h.id });
    case 'servizio': return go('servicePage', { name: h.id });
    case 'prodotto': return go('shopPage', { name: h.id.split('|')[0] });
    case 'community': return go('communityProfile', { id: h.id });
    case 'lavoro': return go('jobDetail', { id: h.id });
  }
}

/** Tutto ciò che si può cercare, costruito dai dati locali (rispetta moderazione e blocchi). */
function useDocs(): SearchDoc[] {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const jobs = useJobs((s) => s.jobs);
  const visible = useVisible();
  return useMemo(() => {
    const docs: SearchDoc[] = [];
    peoplePool(me).filter((n) => visible('profile', n, n)).forEach((n) => docs.push({ kind: 'persona', id: n, title: n, sub: net.following.includes(n) ? tl('Segui già') : undefined }));
    net.posts.filter((p) => visible('post', 'standalone:' + p.id, p.author)).forEach((p) => docs.push({ kind: 'post', id: 'standalone:' + p.id, title: short(p.text), sub: p.author, text: p.tag }));
    net.communities.forEach((c) => {
      if (!visible('community', c.id, c.owner === 'system' ? undefined : c.owner)) return;
      docs.push({ kind: 'community', id: String(c.id), title: c.name, sub: c.topic, text: c.desc });
      c.posts.forEach((p, i) => docs.push({ kind: 'post', id: `community:${c.id}:${i}`, title: short(p.text), sub: p.author, text: c.name }));
    });
    net.ideas.filter((i) => visible('idea', i.id, i.author)).forEach((i) => docs.push({ kind: 'idea', id: String(i.id), title: i.title, sub: i.author, text: i.desc }));
    net.seminars.filter((s) => visible('seminar', s.id, s.host)).forEach((s) => docs.push({ kind: 'seminario', id: String(s.id), title: s.title, sub: s.host, text: s.desc }));
    net.providers.forEach((p) => docs.push({ kind: 'servizio', id: p.name, title: p.role, sub: p.name, text: p.tag }));
    (net.products ?? []).forEach((p) => docs.push({ kind: 'prodotto', id: `${p.shop}|${p.id}`, title: p.name, sub: p.shop, text: p.desc }));
    jobs.filter((j) => j.status === 'open').forEach((j) => docs.push({ kind: 'lavoro', id: j.id, title: j.title, sub: j.company, text: `${j.location} ${j.description}` }));
    return docs;
  }, [me, net.following, net.posts, net.communities, net.ideas, net.seminars, net.providers, net.products, jobs, visible]);
}

/** Barra unica come su Instagram: filtri per tipo e risultati raggruppati (persone per prime). */
export function SearchResults({ query }: { query: string }) {
  const t = useTheme();
  const docs = useDocs();
  const [kind, setKind] = useState<SearchKind | null>(null);
  const hits = useMemo(() => searchAll(docs, query, { kind, per: kind ? 30 : 4 }), [docs, query, kind]);
  const all = useMemo(() => searchAll(docs, query, {}), [docs, query]);
  const present = new Set(all.map((h) => h.kind));
  const groups = groupHits(hits);
  const chip = (k: SearchKind | null, label: string) => {
    const on = kind === k;
    return (
      <Pressable key={label} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.text : t.chip }}>
        <Text style={{ color: on ? t.onText : t.text, fontSize: 14, fontWeight: on ? '800' : '600' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ marginTop: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
        {chip(null, translateText('Tutto'))}
        {SEARCH_KINDS.filter((k) => present.has(k) || kind === k).map((k) => chip(k, translateText(KIND_LABEL[k])))}
      </ScrollView>
      {groups.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
          <Icon name="search" size={26} color={t.muted} />
          <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{translateText('Nessun risultato')}</Text>
          <Text style={{ color: t.muted, fontSize: 13.5, textAlign: 'center' }}>{translateText('Prova con un nome, un argomento o una parola del post.')}</Text>
        </View>
      ) : groups.map((g) => (
        <View key={g.kind} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
            <Text style={{ color: t.muted, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{translateText(KIND_LABEL[g.kind])}</Text>
            {!kind && all.filter((h) => h.kind === g.kind).length > g.hits.length ? <Pressable onPress={() => setKind(g.kind)} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 13.5, fontWeight: '700' }}>{translateText('Vedi tutti')}</Text></Pressable> : null}
          </View>
          <View style={{ backgroundColor: t.card, borderRadius: FEED_RADIUS, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border }}>
            {g.hits.map((h, i) => (
              <Pressable key={h.kind + h.id} onPress={() => open(h)} accessibilityRole="link" accessibilityLabel={`${h.title}${h.sub ? ', ' + h.sub : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: i === g.hits.length - 1 ? 0 : 1, borderBottomColor: t.item }}>
                {h.kind === 'persona' ? <UserAvatar name={h.id} size={38} /> : <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={KIND_ICON[h.kind]} size={18} color={t.text} /></View>}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{h.title}</Text>
                  {h.sub ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>{h.sub}</Text> : null}
                </View>
                <Icon name="chevron-right" size={18} color={t.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
