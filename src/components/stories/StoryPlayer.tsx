import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Body, Item, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { STORY_SECONDS, addView, ago, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Il video parte sempre senza audio: il suono si attiva solo toccando il volume. */
export function StoryVideo({ uri, controls, sound }: { uri: string; controls?: boolean; sound?: boolean }) {
  const p = useVideoPlayer(uri, (pl) => { pl.loop = false; pl.muted = true; if (!controls) pl.play(); });
  useEffect(() => { p.muted = !sound; }, [p, sound]);
  return <VideoView player={p} style={{ width: '100%', height: '100%' }} nativeControls={!!controls} contentFit="cover" />;
}

/** Visualizzatore a schermo intero: tocca a destra per avanzare, a sinistra per tornare, tieni premuto per fermare. */
export function StoryPlayer({ stories, start, onClose }: { stories: Story[]; start: number; onClose: () => void }) {
  const me = useApp((s) => s.account.name);
  const insets = useSafeAreaInsets();
  const net = useNet();
  const goBack = onClose;
  const [i, setI] = useState(start);
  const [p, setP] = useState(0);
  const [held, setHeld] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [sound, setSound] = useState(false);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const cur = stories[Math.min(i, stories.length - 1)];
  const mine = cur?.author === me;
  const paused = held || viewers || typing;
  const secs = cur?.kind === 'video' ? 10 : STORY_SECONDS;
  const iRef = useRef(i); iRef.current = i;

  // segno la storia come vista
  useEffect(() => {
    if (!cur || mine) return;
    const st = useNet.getState();
    if (!(st.storySeen ?? []).includes(cur.id)) st.patch({ storySeen: [...(st.storySeen ?? []), cur.id], stories: addView(st.stories ?? [], cur.id, me) });
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setP(0); }, [i]);
  const next = () => { if (iRef.current >= stories.length - 1) goBack(); else setI(iRef.current + 1); };
  useEffect(() => {
    if (!cur || paused) return;
    const h = setInterval(() => setP((x) => x + 50 / (secs * 1000)), 50);
    return () => clearInterval(h);
  }, [cur?.id, paused, secs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p >= 1) next(); }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) return <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}><Body style={{ color: '#fff' }}>{tl('Non ci sono storie.')}</Body><Text onPress={goBack} style={{ color: '#8fa4ff', marginTop: 14, fontWeight: '800' }}>{tl('Indietro')}</Text></View>;

  const send = (text: string) => {
    const t = text.trim(); if (!t) return;
    const chat = useChat.getState();
    const id = chat.ensureDm(cur.author, me);
    chat.send(id, me, { kind: 'text', text: `${tl('Risposta alla tua storia')}: ${t}` });
    setReply(''); setTyping(false); toast(tl('Inviato a {0}', cur.author));
  };
  const remove = () => confirmDelete(tl('questa storia'), () => {
    net.patch({ stories: (net.stories ?? []).filter((s) => s.id !== cur.id) });
    if (stories.length <= 1) goBack(); else setI(Math.max(0, i - 1));
  });
  const viewerList = cur.views;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {cur.kind === 'text' ? (
        <LinearGradient colors={cur.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' }}>{cur.text}</Text>
        </LinearGradient>
      ) : (
        <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
          {cur.kind === 'video' && cur.uri ? <StoryVideo uri={cur.uri} sound={sound} /> : <Image source={{ uri: cur.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
          {cur.text ? <Text style={{ position: 'absolute', bottom: insets.bottom + 90, start: 16, end: 16, color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 }}>{cur.text}</Text> : null}
        </View>
      )}
      {/* zone di tocco: sinistra indietro, destra avanti, pressione lunga ferma */}
      <View style={{ position: 'absolute', top: insets.top + 70, bottom: insets.bottom + 80, start: 0, end: 0, flexDirection: 'row' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Storia precedente')} style={{ flex: 1 }} onPress={() => (i > 0 ? setI(i - 1) : setP(0))} onLongPress={() => setHeld(true)} onPressOut={() => setHeld(false)} delayLongPress={200} />
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Storia successiva')} style={{ flex: 2 }} onPress={next} onLongPress={() => setHeld(true)} onPressOut={() => setHeld(false)} delayLongPress={200} />
      </View>
      <View pointerEvents="box-none" style={{ paddingTop: insets.top + 8, paddingHorizontal: 10 }}>
        {/* miniature delle foto, appena visibili in alto: tocca per saltare; la linea sotto la corrente mostra lo scorrere del tempo */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -2 }}>
          {stories.map((s, k) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={tl('Vai al momento {0}', k + 1)} accessibilityState={{ selected: k === i }} onPress={() => setI(k)} hitSlop={6}
              style={{ width: k === i ? 34 : 28, opacity: k === i ? 1 : 0.55 }}>
              <View style={{ height: k === i ? 22 : 16, borderRadius: 7, overflow: 'hidden', borderWidth: k === i ? 1.5 : 0, borderColor: '#fff', backgroundColor: '#222' }}>
                {s.kind === 'photo' ? <Image source={{ uri: s.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  : s.kind === 'text' ? <LinearGradient colors={s.bg ?? ['#6c8cff', '#3b2a7a']} style={{ flex: 1 }} />
                  : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={9} color="#fff" /></View>}
              </View>
              {k === i ? <View style={{ height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 3, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, p * 100)}%`, height: 2, backgroundColor: '#fff' }} /></View> : null}
            </Pressable>
          ))}
        </View>
        <Row style={{ marginTop: 10 }} gap={10}>
          <UserAvatar name={cur.author} size={36} />
          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{mine ? tl('La tua storia') : cur.author}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{tl(ago(cur.ts, Date.now()))}</Text></View>
          {cur.kind === 'video' ? <Pressable accessibilityRole="button" accessibilityLabel={sound ? tl('Spegni il volume') : tl('Attiva il volume')} onPress={() => setSound((v) => !v)} hitSlop={10} style={{ padding: 6 }}><Icon name={sound ? 'volume' : 'volume-off'} size={22} color="#fff" /></Pressable> : null}
          {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Gestisci il recap')} onPress={() => { onClose(); go('storyDay'); }} hitSlop={10} style={{ padding: 6 }}><Icon name="gear" size={22} color="#fff" /></Pressable> : null}
          {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina la storia')} onPress={remove} hitSlop={10} style={{ padding: 6 }}><Icon name="trash" size={22} color="#fff" /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={goBack} hitSlop={10} style={{ padding: 6 }}><Icon name="x" size={24} color="#fff" /></Pressable>
        </Row>
      </View>
      <View style={{ flex: 1 }} pointerEvents="none" />
      <View style={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 12 }}>
        {mine ? (
          <Pressable accessibilityRole="button" onPress={() => setViewers(true)} style={{ alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 }}>
            <Icon name="eye" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800' }}>{tl('{0} visualizzazioni', viewerList.length)}</Text>
          </Pressable>
        ) : (
          <Row gap={10}>
            <TextInput value={reply} onChangeText={setReply} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onSubmitEditing={() => send(reply)} returnKeyType="send" placeholder={tl('Rispondi a {0}…', cur.author.split(' ')[0])} placeholderTextColor="rgba(255,255,255,0.7)" accessibilityLabel={tl('Rispondi alla storia')} style={{ flex: 1, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 }} />
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Mi piace alla storia')} onPress={() => send(tl('mi piace'))} hitSlop={8} style={{ padding: 8 }}><Icon name="heart" size={26} color="#fff" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Invia')} onPress={() => send(reply)} hitSlop={8} style={{ padding: 8 }}><Icon name="send" size={24} color="#fff" /></Pressable>
          </Row>
        )}
      </View>
      <Sheet visible={viewers} title={tl('Chi ha visto la storia')} onClose={() => setViewers(false)}>
        {viewerList.length === 0 ? <Body muted>{tl('Nessuno l’ha ancora vista.')}</Body> : viewerList.map((n, k) => (
          <Item key={n} last={k === viewerList.length - 1}><Row gap={10}><UserAvatar name={n} size={34} /><Body bold>{n}</Body></Row></Item>
        ))}
      </Sheet>
    </View>
  );
}
