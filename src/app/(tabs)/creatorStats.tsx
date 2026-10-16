import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Card, Empty, Page, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { computeStats, type Bar, type CreatorItem, type Fmt, type Kpi, type Range, type Suggestion } from '@/lib/creatorStats';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n));
const KIND_LABEL = { tutto: 'Tutto', post: 'Post', idea: 'Idee', seminar: 'Seminari', service: 'Servizi' } as const;
type KindFilter = keyof typeof KIND_LABEL;

/** I contenuti di chi guarda, nel formato che serve alle statistiche. */
function useMyItems(): CreatorItem[] {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  return useMemo(() => {
    const now = Date.now();
    const out: CreatorItem[] = [];
    net.posts.filter((p) => p.author === me).forEach((p) => {
      const fmt: Fmt = p.media === 'video' ? 'video' : p.media === 'photo' ? 'foto' : 'frase';
      out.push({ key: 'standalone:' + p.id, kind: 'post', fmt, title: p.text.slice(0, 60) || 'Post', ts: p.ts ?? now - 5 * 86400000, likes: p.likes, comments: (net.comments?.['standalone:' + p.id] ?? []).length, conv: 0, lp: 0, ...(fmt === 'video' ? { durationSec: 20 } : {}) });
    });
    net.ideas.filter((i) => i.author === me).forEach((i) => {
      const per = i.fixedAmount ?? 10;
      out.push({ key: 'idea:' + i.id, kind: 'idea', fmt: 'idea', title: i.title, ts: i.ts ?? now - 6 * 86400000, likes: Math.round(i.raised / Math.max(5, per) * 2), comments: 0, conv: Math.round(i.raised / Math.max(1, per)), capacity: i.target, lp: i.raised });
    });
    net.seminars.filter((s) => s.host === me).forEach((s) => {
      const joined = (net.participants?.['seminar:' + s.id] ?? []).length || s.joined || 0;
      out.push({ key: 'seminar:' + s.id, kind: 'seminar', fmt: 'seminario', title: s.title, ts: s.ts ?? s.startsAt ?? now - 3 * 86400000, likes: joined * 2, comments: 0, conv: joined, capacity: s.seats ?? 20, lp: joined * s.price });
    });
    net.providers.filter((p) => p.name === me).forEach((p) => {
      const booked = (net.participants?.['service:' + me] ?? []).length;
      out.push({ key: 'service:' + p.name, kind: 'service', fmt: 'servizio', title: p.role, ts: now - 7 * 86400000, likes: booked * 2 + Math.round(p.rating), comments: 0, conv: booked, capacity: Math.max(6, p.slots.length), lp: booked * p.price });
    });
    return out;
  }, [net.posts, net.ideas, net.seminars, net.providers, net.participants, net.comments, me]);
}

function Delta({ k, suffix = '' }: { k: Kpi; suffix?: string }) {
  const t = useTheme();
  const up = k.deltaPct > 0, down = k.deltaPct < 0;
  const col = up ? t.positive : down ? t.danger : t.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={up ? 'arrow-up' : down ? 'arrow-down' : 'minus'} size={12} color={col} stroke={2.6} />
      <Text style={{ color: col, fontSize: 12, fontWeight: '800' }}>{Math.abs(k.deltaPct)}%{suffix}</Text>
    </View>
  );
}

function KpiCard({ label, k, fmt = compact, suffix }: { label: string; k: Kpi; fmt?: (n: number) => string; suffix?: string }) {
  const t = useTheme();
  return (
    <View accessibilityLabel={`${label}: ${fmt(k.value)}${suffix ?? ''}, ${k.deltaPct >= 0 ? 'più' : 'meno'} ${Math.abs(k.deltaPct)}% rispetto al periodo prima`} style={{ width: '48.5%', padding: 14, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.item, gap: 4 }}>
      <Text style={{ color: t.muted, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 }}>{fmt(k.value)}{suffix ?? ''}</Text>
      <Delta k={k} />
    </View>
  );
}

function Bars({ rows, highlight }: { rows: Bar[]; highlight?: string }) {
  const t = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.pct));
  return (
    <View style={{ gap: 9 }}>
      {rows.map((r) => {
        const on = highlight ? r.label === highlight : r.pct === max;
        return (
          <View key={r.label} accessibilityLabel={`${r.label}: ${r.pct}%`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: t.muted, width: 58, fontSize: 12.5, fontWeight: '600' }}>{r.label}</Text>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: t.item, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(2, (r.pct / max) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: on ? t.accent : t.accent + '66' }} />
            </View>
            <Text style={{ color: t.text, width: 38, textAlign: 'right', fontSize: 12.5, fontWeight: '800' }}>{r.pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
      {sub ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

const AREA_ICON: Record<Suggestion['area'], string> = { orari: 'clock', formato: 'image', pubblico: 'users', video: 'video', azione: 'trend-up', costanza: 'calendar', conversazione: 'comment' };

function SuggestionCard({ s }: { s: Suggestion }) {
  const t = useTheme();
  return (
    <View style={{ padding: 14, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: s.priority === 1 ? t.accent + '88' : t.item, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accent + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={AREA_ICON[s.area]} size={17} color={t.accent} /></View>
        <Text style={{ flex: 1, color: t.text, fontSize: 15.5, fontWeight: '800', lineHeight: 20 }}>{tl(s.title)}</Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 19 }}>{tl(s.why)}</Text>
      {s.action ? <Pressable accessibilityRole="button" onPress={() => go(s.action!.page)} style={{ alignSelf: 'flex-start', marginTop: 2 }}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 13.5 }}>{tl(s.action.label)}</Text></Pressable> : null}
    </View>
  );
}

/** Statistiche per chi crea: tutto organizzato per pubblico, orari, contenuti e azioni, con i consigli di Theia in cima. */
export default function CreatorStats() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const items = useMyItems();
  const [range, setRange] = useState<Range>(30);
  const [kind, setKind] = useState<KindFilter>('tutto');
  const [allTips, setAllTips] = useState(false);
  const kinds = (['tutto', 'post', 'idea', 'seminar', 'service'] as KindFilter[]).filter((k) => k === 'tutto' || items.some((x) => x.kind === k));
  const shown = kind === 'tutto' ? items : items.filter((x) => x.kind === kind);
  const stats = useMemo(() => computeStats(shown, me + ':' + kind, range, Date.now()), [shown, me, kind, range]);
  const tips = allTips ? stats.suggestions : stats.suggestions.slice(0, 3);
  const fmtLabel: Record<Fmt, string> = { foto: 'Foto', video: 'Video', frase: 'Frasi', idea: 'Idee', seminario: 'Seminari', servizio: 'Servizi' };

  return (
    <Page id="creatorStats" back title="Le tue statistiche">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.chip, marginBottom: 12 }}>
        <Icon name="info" size={14} color={t.muted} />
        <Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Dati dimostrativi: stime basate sui tuoi mi piace, commenti e iscrizioni')}</Text>
      </View>
      <Seg options={[tl('7 giorni'), tl('30 giorni'), tl('90 giorni')]} value={tl(range === 7 ? '7 giorni' : range === 30 ? '30 giorni' : '90 giorni')} onChange={(v) => setRange(v === tl('7 giorni') ? 7 : v === tl('30 giorni') ? 30 : 90)} />
      {kinds.length > 2 ? (
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
          {kinds.map((k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: kind === k }} onPress={() => setKind(k)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: kind === k ? t.text : t.chip }}>
              <Text style={{ color: kind === k ? t.bg : t.text, fontWeight: '700', fontSize: 13 }}>{tl(KIND_LABEL[k])}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}

      {items.length === 0 ? <Card><Empty text="Non hai ancora pubblicato niente: appena lo fai, qui trovi pubblico, orari migliori e consigli." /></Card> : (
        <>
          <Section title={tl('Cosa migliorare')} sub={tl('I consigli di Theia, dal più importante')}>
            <View style={{ gap: 10 }}>{tips.map((s) => <SuggestionCard key={s.id} s={s} />)}</View>
            {stats.suggestions.length > 3 ? <Pressable accessibilityRole="button" onPress={() => setAllTips((v) => !v)} style={{ alignSelf: 'center', marginTop: 10, padding: 8 }}><Text style={{ color: t.accent, fontWeight: '800' }}>{allTips ? tl('Mostra meno') : tl('Altri {0} consigli', stats.suggestions.length - 3)}</Text></Pressable> : null}
          </Section>

          <Section title={tl('In breve')} sub={tl('Rispetto al periodo precedente')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
              <KpiCard label={tl('Persone raggiunte')} k={stats.kpis.reach} />
              <KpiCard label={tl('Interazioni')} k={stats.kpis.interactions} />
              <KpiCard label={tl('Tasso di interazione')} k={stats.kpis.rate} fmt={(n) => String(n).replace('.', ',')} suffix="%" />
              <KpiCard label={tl('Nuovi follower')} k={stats.kpis.followers} />
              <KpiCard label={tl('Iscrizioni e azioni')} k={stats.kpis.conversions} />
              <KpiCard label={tl('LifePoints guadagnati')} k={stats.kpis.lp} />
            </View>
          </Section>

          <Section title={tl('Chi ti segue')} sub={tl('Per età, genere, città e interessi')}>
            <Card>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10 }}>{tl('ETÀ')}</Text>
              <Bars rows={stats.audience.age} />
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 }}>{tl('GENERE')}</Text>
              <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                {stats.audience.gender.map((g, i) => <View key={g.label} style={{ flex: Math.max(1, g.pct), backgroundColor: t.accent, opacity: [1, 0.6, 0.3][i] }} />)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                {stats.audience.gender.map((g, i) => <Text key={g.label} style={{ color: t.text, fontSize: 12.5, fontWeight: '700', opacity: [1, 0.8, 0.6][i] }}>{tl(g.label)} {g.pct}%</Text>)}
              </View>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 }}>{tl('CITTÀ')}</Text>
              <Bars rows={stats.audience.cities} />
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 }}>{tl('INTERESSI')}</Text>
              <Bars rows={stats.audience.interests} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
                <Icon name="repeat" size={16} color={t.accent} />
                <Text style={{ color: t.text, fontSize: 14, flex: 1 }}>{tl('{0}% del pubblico torna ogni settimana', stats.audience.returning)}</Text>
              </View>
            </Card>
          </Section>

          <Section title={tl('Quando pubblicare')} sub={tl('Il tuo momento migliore: {0}, tra le {1}', tl(stats.timing.bestDay), stats.timing.bestHours.replace('-', ' e le '))}>
            <Card>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10 }}>{tl('GIORNO')}</Text>
              <Bars rows={stats.timing.days} highlight={stats.timing.bestDay} />
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 }}>{tl('ORA')}</Text>
              <Bars rows={stats.timing.hours} highlight={stats.timing.bestHours} />
            </Card>
          </Section>

          <Section title={tl('Cosa funziona')} sub={tl('Per formato e per contenuto')}>
            <Card>
              {stats.content.byFmt.length ? <Bars rows={stats.content.byFmt.map((f) => ({ label: tl(fmtLabel[f.fmt]), pct: Math.round(f.rate) }))} /> : <Body small muted>Nessun contenuto in questo periodo.</Body>}
              {stats.content.top.length ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 }}>{tl('I MIGLIORI')}</Text> : null}
              {stats.content.top.map((r) => <ContentRow key={r.key} r={r} />)}
              {stats.content.low.length ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 }}>{tl('DA RIVEDERE')}</Text> : null}
              {stats.content.low.map((r) => <ContentRow key={r.key} r={r} />)}
            </Card>
          </Section>

          <Section title={tl('Dal vedere all\'agire')} sub={tl('Quante persone arrivano a ogni passo')}>
            <Card>
              <View style={{ gap: 10 }}>
                {stats.funnel.map((f, i) => {
                  const w = stats.funnel[0].value ? Math.max(4, (f.value / stats.funnel[0].value) * 100) : 4;
                  const prev = i ? stats.funnel[i - 1].value : 0;
                  return (
                    <View key={f.label} accessibilityLabel={`${f.label}: ${f.value}`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: t.text, fontSize: 13.5, fontWeight: '700' }}>{tl(f.label)}</Text>
                        <Text style={{ color: t.text, fontSize: 13.5, fontWeight: '800' }}>{compact(f.value)}{i && prev ? <Text style={{ color: t.muted, fontWeight: '600' }}>{`  ${Math.round((f.value / prev) * 100)}%`}</Text> : null}</Text>
                      </View>
                      <View style={{ height: 12, borderRadius: 6, backgroundColor: t.item, overflow: 'hidden' }}><View style={{ width: `${w}%`, height: 12, borderRadius: 6, backgroundColor: t.accent, opacity: 1 - i * 0.18 }} /></View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Section>

          {stats.video ? (
            <Section title={tl('I tuoi video')} sub={tl('Quanto restano a guardarli')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
                <KpiCard label={tl('Visto in media')} k={{ value: stats.video.avgWatchPct, prev: stats.video.avgWatchPct, deltaPct: 0 }} suffix="%" fmt={String} />
                <KpiCard label={tl('Guardati fino in fondo')} k={{ value: stats.video.completionPct, prev: stats.video.completionPct, deltaPct: 0 }} suffix="%" fmt={String} />
              </View>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 10 }}>{tl('Molti lasciano dopo circa {0} secondi.', stats.video.dropAtSec)}</Text>
            </Section>
          ) : null}
        </>
      )}
      <View style={{ height: 24 }} />
    </Page>
  );
}

function ContentRow({ r }: { r: { key: string; title: string; fmt: Fmt; reach: number; rate: number; conv: number } }) {
  const t = useTheme();
  return (
    <View accessibilityLabel={`${r.title}: ${compact(r.reach)} persone, interazione ${r.rate}%`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.item }}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 14.5, fontWeight: '700' }}>{r.title}</Text>
        <Text style={{ color: t.muted, fontSize: 12.5 }}>{`${compact(r.reach)} ${tl('persone')} · ${String(r.rate).replace('.', ',')}% ${tl('interazione')}${r.conv ? ` · ${r.conv} ${tl('azioni')}` : ''}`}</Text>
      </View>
    </View>
  );
}
