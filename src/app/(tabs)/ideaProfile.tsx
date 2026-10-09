import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { Badge, LpTag, MediaBlock, ModButton, contribute, gradientFor, openMedia, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, Page, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { pubLabel } from '@/lib/when';
import { rateIdea, scoreColor } from '@/lib/network';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { Icon } from '@/lib/icons';
import { translateText } from '@/i18n/core';

export default function IdeaProfile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const idea = useNet((s) => s.ideas.find((x) => String(x.id) === id));
  const me = useApp((s) => s.account.name);
  const visible = useVisible();
  if (idea && !visible('idea', idea.id, idea.author)) return <Page id="ideaProfile" title="Idea" back><Card><Empty text="Hai nascosto o segnalato questa idea, oppure l’autore è bloccato." /><Btn small ghost style={{ marginTop: 10 }} title="Segnalazioni inviate" onPress={() => go('reports')} /></Card></Page>;
  if (!idea) return <Page id="ideaProfile" title="Idea" back><Card><Empty text="Idea non trovata." /></Card></Page>;
  const score = rateIdea(idea.desc);
  const pct = Math.min(100, Math.round((idea.raised / (idea.target || 500)) * 100));
  const tiles = [0, 1, 2, 3].map((n) => gradientFor(idea.title + n));
  const gv = gradientFor(idea.title + 'video');
  return (
    <Page id="ideaProfile" title={idea.title} back right={<Row gap={10}><Btn small ghost title="Condividi" onPress={() => Share.share({ message: 'Guarda questa idea su LifePilot: ' + idea.title })} />{idea.author !== me && <ModButton kind="idea" refId={idea.id} label={idea.title} author={idea.author} />}</Row>}>
      {idea.uri ? <MediaBlock media={idea.media ?? 'photo'} seed={idea.title} uri={idea.uri} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, marginHorizontal: -3 }}>
        {tiles.map((g, i) => <Pressable key={i} onPress={() => openMedia({ media: 'photo', seed: idea.title + i })} accessibilityRole="imagebutton" accessibilityLabel={translateText("Apri la foto a schermo intero")} style={{ width: '33.33%', padding: 3 }}><LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1, borderRadius: 14 }} /></Pressable>)}
        <Pressable onPress={() => openMedia({ media: 'video', seed: idea.title + 'video' })} accessibilityRole="imagebutton" accessibilityLabel={translateText("Apri il video a schermo intero")} style={{ width: '33.33%', padding: 3 }}><LinearGradient colors={gv} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color="#fff" fill="#fff" /></LinearGradient></Pressable>
      </View>}
      <Card><Row><Body small muted>Punteggio AI</Body><Badge label={`${score}/100`} color={scoreColor(score)} onPress={() => openSheet('scoreExpl', { id: idea.id })} /></Row></Card>
      <Card><H>Descrizione</H>{idea.ts ? <Body small muted style={{ marginBottom: 6 }}>{pubLabel(idea.ts, 'Pubblicata')}</Body> : null}<Body small>{idea.desc}</Body></Card>
      <Card><H>Titolare</H><Row><Body muted>Fondatore</Body><Body bold onPress={() => go('userProfile', { name: idea.author })} style={{ textDecorationLine: 'underline' }}>{idea.author}</Body></Row></Card>
      <Card>
        <Row><Body small muted>LP raccolti</Body><Row gap={2}><Body bold>{formatCHF(idea.raised)}</Body><LpTag size={14} /><Body bold> · obiettivo {formatCHF(idea.target || 500)}</Body><LpTag size={14} /></Row></Row>
        <Progress value={pct} />
        <Row style={{ marginTop: 6 }}>{[25, 50, 75, 100].map((m) => <Body key={m} small color={pct >= m ? t.positive : t.muted} style={{ flex: 1, textAlign: 'center' }}>{m}%</Body>)}</Row>
        <Btn style={{ marginTop: 14 }} title="Contribuisci con LifePoints" onPress={() => contribute(idea)} />
      </Card>
    </Page>
  );
}
