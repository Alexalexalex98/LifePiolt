import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/T';

import { StoryPlayer, StoryVideo } from '@/components/stories/StoryPlayer';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Item, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { activeStories, addGift, addView, ago, dayParts, fixedMoments, timeLabel, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const ATTACH_ICON: Record<string, string> = { event: 'calendar', seminar: 'users', idea: 'sparkle', place: 'pin' };

/** Dove porta il collegamento allegato a un momento. */
function openAttach(a: NonNullable<Story['attach']>) {
  if (a.kind === 'event') go('plan', a.ref ? { day: a.ref, at: String(Date.now()) } : {});
  else if (a.kind === 'seminar' && a.ref) go('seminarPage', { id: a.ref });
  else if (a.kind === 'idea' && a.ref) go('ideaProfile', { id: a.ref });
  else if (a.kind === 'place') go('searchPage', { q: a.label });
}

function Moment({ s, me }: { s: Story; me: string }) {
  const t = useTheme();
  const net = useNet();
  const mine = s.author === me;
  const [reply, setReply] = useState('');
  const gifted = (s.gifts ?? []).includes(me);
  const send = () => {
    const x = reply.trim(); if (!x) return;
    const chat = useChat.getState();
    chat.send(chat.ensureDm(s.author, me), me, { kind: 'text', text: `${tl('Risposta alla tua storia')}: ${x}` });
    setReply(''); toast(tl('Inviato a {0}', s.author));
  };
  const gift = () => {
    if (gifted) { toast('Hai già regalato il LifePoint a questo momento'); return; }
    if (!net.donateDaily(s.author, 'story:' + s.id, me)) { toast('Oggi hai già donato il tuo LifePoint giornaliero'); return; }
    net.patch({ stories: addGift(useNet.getState().stories ?? [], s.id, me) });
    toast(tl('Hai regalato il LifePoint giornaliero a {0}', s.author));
  };
  const remove = () => confirmDelete(tl('questo momento'), () => net.patch({ stories: (net.stories ?? []).filter((x) => x.id !== s.id) }));
  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      {s.kind === 'text' ? (
        <LinearGradient colors={s.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{s.text}</Text>
        </LinearGradient>
      ) : (
        <View style={{ aspectRatio: 4 / 5, backgroundColor: '#000' }}>
          {s.kind === 'video' && s.uri ? <StoryVideo uri={s.uri} controls /> : <Image source={{ uri: s.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
        </View>
      )}
      <View style={{ padding: 12, gap: 8 }}>
        <Row gap={8}>
          <Text style={{ color: t.text, fontWeight: '800' }}>{timeLabel(s.ts)}</Text>
          <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>{tl(ago(s.ts, Date.now()))}{s.keep === 'week' ? ` · ${tl('7 giorni')}` : ''}</Text>
          {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina')} onPress={remove} hitSlop={10}><Icon name="trash" size={18} color={t.muted} /></Pressable> : null}
        </Row>
        {s.kind !== 'text' && s.text ? <Body>{s.text}</Body> : null}
        {s.attach ? (
          <Pressable accessibilityRole="button" accessibilityLabel={s.attach.label} onPress={() => openAttach(s.attach!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.chip, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 }}>
            <Icon name={(ATTACH_ICON[s.attach.kind] ?? 'link') as never} size={16} color={t.accent} />
            <Text numberOfLines={1} style={{ color: t.text, fontWeight: '700', flex: 1 }}>{s.attach.label}</Text>
            <Icon name="arrow-right" size={15} color={t.muted} />
          </Pressable>
        ) : null}
        {mine ? (
          <Body small muted>{tl('{0} visualizzazioni', s.views.length)}{(s.gifts ?? []).length ? ` · ${tl('{0} LifePoint regalati', (s.gifts ?? []).length)}` : ''}{s.views.length ? ` · ${s.views.join(', ')}` : ''}</Body>
        ) : (
          <Row gap={8}>
            <TextInput value={reply} onChangeText={setReply} onSubmitEditing={send} returnKeyType="send" placeholder={tl('Rispondi…')} placeholderTextColor={t.muted} accessibilityLabel={tl('Rispondi al momento')} style={{ flex: 1, color: t.text, backgroundColor: t.input, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }} />
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Invia')} onPress={send} hitSlop={8}><Icon name="send" size={20} color={t.accent} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Regala il LifePoint giornaliero')} onPress={gift} hitSlop={8}><Icon name={gifted ? 'coin' : 'heart'} size={22} color={gifted ? t.positive : t.accent} /></Pressable>
          </Row>
        )}
      </View>
    </Card>
  );
}

/** «La giornata» di una persona: i suoi momenti in ordine, per parte del giorno. Si scorre con il proprio ritmo; «Riproduci» li mostra uno dopo l'altro. */
export default function StoryDay() {
  const { author } = useLocalSearchParams<{ author?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const who = author || me;
  const all = useMemo(() => activeStories(net.stories, Date.now()).filter((s) => s.author === who), [net.stories, who]);
  const parts = dayParts(all);
  const fixed = fixedMoments(all);
  const flow = parts.flatMap((p) => p.stories);
  const [play, setPlay] = useState(false);
  const [viewers, setViewers] = useState(false);
  const t = useTheme();
  // li segno visti all'apertura (non i miei)
  useMemo(() => {
    if (who === me) return;
    const st = useNet.getState();
    const seen = new Set(st.storySeen ?? []);
    const fresh = all.filter((s) => !seen.has(s.id));
    if (!fresh.length) return;
    let stories = st.stories ?? [];
    fresh.forEach((s) => { stories = addView(stories, s.id, me); });
    setTimeout(() => useNet.getState().patch({ storySeen: [...seen, ...fresh.map((s) => s.id)], stories }), 0);
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  if (play) return <StoryPlayer stories={flow} start={0} onClose={() => setPlay(false)} />;
  const mineView = who === me;
  const viewerSet = [...new Set(all.flatMap((s) => s.views))];
  return (
    <Page id="storyDay" back title={mineView ? 'La tua giornata' : tl('La giornata di {0}', who)}>
      <Row gap={10} style={{ marginBottom: 12 }}>
        <UserAvatar name={who} size={44} />
        <View style={{ flex: 1 }}>
          <Body bold>{who}</Body>
          <Body small muted>{tl('Momenti oggi: {0}', flow.length)}</Body>
        </View>
        {flow.length ? <Btn small icon="video" title="Riproduci" onPress={() => setPlay(true)} /> : null}
      </Row>
      {mineView ? (
        <Row gap={8} style={{ marginBottom: 12 }}>
          <Btn small style={{ flex: 1 }} icon="plus" title="Aggiungi un momento" onPress={() => go('storyCreate')} />
          {viewerSet.length ? <Btn small ghost icon="eye" title={tl('{0} persone', viewerSet.length)} onPress={() => setViewers(true)} /> : null}
        </Row>
      ) : null}
      {all.length === 0 ? <Card><Body muted>{tl('Nessun momento per ora.')}</Body></Card> : null}
      {parts.map((p) => (
        <View key={p.part}>
          <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 }}>{tl(p.part).toUpperCase()}</Text>
          {p.stories.map((s) => <Moment key={s.id} s={s} me={me} />)}
        </View>
      ))}
      {fixed.length ? (
        <View>
          <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 8 }}>{tl('MOMENTI FISSI NEL PROFILO')}</Text>
          {fixed.map((s) => <Moment key={s.id} s={s} me={me} />)}
        </View>
      ) : null}
      <Sheet visible={viewers} title={tl('Chi ha visto i tuoi momenti')} onClose={() => setViewers(false)}>
        {viewerSet.map((n, k) => <Item key={n} last={k === viewerSet.length - 1}><Row gap={10}><UserAvatar name={n} size={34} /><Body bold>{n}</Body></Row></Item>)}
      </Sheet>
    </Page>
  );
}
