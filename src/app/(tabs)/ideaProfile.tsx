import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { heroPaletteFor } from '@/components/feed/feedColors';
import { raisedPct } from '@/components/feed/feedLogic';
import { ArtShapes, FEED_RADIUS, SoftPill } from '@/components/feed/parts';
import { LpTag, ModButton, UserAvatar, contribute, gradientFor, openMedia, openSheet } from '@/components/network';
import { Btn, Card, Empty, H, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { pubLabel } from '@/lib/when';
import { rateIdea, scoreColor } from '@/lib/network';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { Icon } from '@/lib/icons';
import { t as tl, translateText } from '@/i18n/core';

export default function IdeaProfile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idea = useNet((s) => s.ideas.find((x) => String(x.id) === id));
  const me = useApp((s) => s.account.name);
  const visible = useVisible();
  if (idea && !visible('idea', idea.id, idea.author)) return <Page id="ideaProfile" title="Idea" back><Card><Empty text="Hai nascosto o segnalato questa idea, oppure l’autore è bloccato." /><Btn small ghost style={{ marginTop: 10 }} title="Segnalazioni inviate" onPress={() => go('reports')} /></Card></Page>;
  if (!idea) return <Page id="ideaProfile" title="Idea" back><Card><Empty text="Idea non trovata." /></Card></Page>;
  const score = rateIdea(idea.desc);
  const pct = raisedPct(idea.raised, idea.target);
  const p = heroPaletteFor(idea.title);
  const tiles = [0, 1, 2, 3].map((n) => gradientFor(idea.title + n));
  const gv = gradientFor(idea.title + 'video');
  const reward = idea.rewardType === 'fisso' ? tl('Contributo fisso: {0} LP', idea.fixedAmount ?? 0) + (idea.rewardDesc ? ' · ' + idea.rewardDesc : '') : idea.rewardDesc ? tl('Importo libero · In cambio: {0}', idea.rewardDesc) : tl('Importo libero · nessuna ricompensa specificata');
  return (
    <Page id="ideaProfile" back>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 6 }}>
        <Pressable onPress={() => Share.share({ message: 'Guarda questa idea su LifePilot: ' + idea.title }).catch(() => {})} accessibilityRole="button" accessibilityLabel={translateText('Condividi')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={22} color={t.text} /></Pressable>
        {idea.author !== me && <ModButton kind="idea" refId={idea.id} label={idea.title} author={idea.author} />}
      </View>

      <View style={{ borderRadius: FEED_RADIUS, overflow: 'hidden' }}>
        <LinearGradient colors={[p.from, p.to]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={{ padding: 22, minHeight: 250, justifyContent: 'space-between' }}>
          {idea.uri ? <Image source={{ uri: idea.uri }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" /> : <ArtShapes seed={idea.title} size={400} />}
          {idea.uri ? <LinearGradient colors={['rgba(8,10,20,0.3)', 'rgba(8,10,20,0.88)']} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SoftPill label="Idea" icon="sparkle" color="#ffffff" bg="rgba(255,255,255,0.18)" />
            <Pressable onPress={() => openSheet('scoreExpl', { id: idea.id })} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Punteggio AI {0} su 100: come viene calcolato', score)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: scoreColor(score) }} /><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{tl('Punteggio AI')} {score}/100</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 60 }}>
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -0.6 }}>{idea.title}</Text>
            {idea.ts ? <Text style={{ color: p.sub, fontSize: 13, marginTop: 6 }}>{pubLabel(idea.ts, 'Pubblicata')}</Text> : null}
          </View>
        </LinearGradient>
      </View>

      <View style={{ marginTop: 18, backgroundColor: t.card, borderRadius: FEED_RADIUS, padding: 20, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}><Text style={{ color: t.text, fontSize: 30, fontWeight: '800' }}>{formatCHF(idea.raised)}</Text><LpTag size={20} /></View>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{pct}%</Text>
        </View>
        <Text style={{ color: t.muted, fontSize: 13.5, marginTop: 2 }}>{tl('su {0} raccolti', formatCHF(idea.target || 500))}</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 10, borderRadius: 5, backgroundColor: t.chip, overflow: 'hidden', marginTop: 14, direction: 'ltr' }}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: t.accent }} />
        </View>
        <Row style={{ marginTop: 8 }}>{[25, 50, 75, 100].map((m) => <Text key={m} style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: pct >= m ? '800' : '500', color: pct >= m ? t.positive : t.muted }}>{m}%</Text>)}</Row>
        <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20, marginTop: 12 }}>{reward}</Text>
        <Btn style={{ marginTop: 16 }} icon="coin" title="Contribuisci con LifePoints" onPress={() => contribute(idea)} />
      </View>

      <Card style={{ marginTop: 18 }}>
        <H>Descrizione</H>
        <Text style={{ color: t.text, fontSize: 15.5, lineHeight: 24 }}>{idea.desc}</Text>
      </Card>

      <Card>
        <H>Titolare</H>
        <Pressable onPress={() => go('userProfile', { name: idea.author })} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
          <UserAvatar name={idea.author} size={44} />
          <View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{idea.author}</Text><Text style={{ color: t.muted, fontSize: 13 }}>Fondatore</Text></View>
          <Icon name="chevron-right" size={18} color={t.muted} />
        </Pressable>
      </Card>

      {idea.uri ? null : (
        <View style={{ marginTop: 4 }}>
          <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Anteprime</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {tiles.map((g, i) => <Pressable key={i} onPress={() => openMedia({ media: 'photo', seed: idea.title + i })} accessibilityRole="imagebutton" accessibilityLabel={translateText('Apri la foto a schermo intero')}><LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 120, height: 120, borderRadius: 16 }} /></Pressable>)}
            <Pressable onPress={() => openMedia({ media: 'video', seed: idea.title + 'video' })} accessibilityRole="imagebutton" accessibilityLabel={translateText('Apri il video a schermo intero')}><LinearGradient colors={gv} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 120, height: 120, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color="#fff" fill="#fff" /></LinearGradient></Pressable>
          </ScrollView>
        </View>
      )}
    </Page>
  );
}
