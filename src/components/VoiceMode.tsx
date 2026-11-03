import { type ComponentRef, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useAudioRecorder } from 'expo-audio';
import { Animated, Easing, Modal, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascot/Mascot';
import { ThinkingStars } from '@/components/mascot/ThinkingStars';
import { Text } from '@/components/T';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { sendTheia } from '@/lib/assistant/theiaFlow';
import { Icon } from '@/lib/icons';
import { createTransport, initialSpeech, liveText, localeFor, speechReducer, speechSupport, type SpeechErrorCode, type SpeechTransport } from '@/lib/speech';
import { listenByRecording, REC_OPTIONS } from '@/lib/voice/recordListen';
import type { SpeechStream } from '@/lib/voice/speak';
import { makeSpeechStream } from '@/lib/voice/speechEngine';
import { cleanForSpeech, isEcho, sentenceSpans, takeChunks, wantsToStop } from '@/lib/voice/voiceText';
import { useApp } from '@/store/app';
import { useAssistant } from '@/store/assistant';
import { toast } from '@/store/toast';
import { useVoiceMode } from '@/store/voiceMode';

const SPOKEN_MAX = 1100;
const FOLLOW_BACK_MS = 5000;

type Phase = 'listening' | 'thinking' | 'speaking' | 'error';

/**
 * Conversazione a voce con Theia, come in ChatGPT e Claude: lo schermo si scurisce al 75%, Theia si ingrandisce al centro e ascolta;
 * quando smetti di parlare risponde a voce (Gemini) e poi torna ad ascoltare. Tutto passa dalla stessa strada della chat,
 * quindi ogni parola resta nella LifeChat, nella sezione dell'argomento di cui si parlava.
 */
export function VoiceModeHost() {
  const open = useVoiceMode((s) => s.open);
  return open ? <VoiceMode /> : null;
}

function VoiceMode() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const hide = useVoiceMode((s) => s.hide);
  const minimized = useVoiceMode((s) => s.minimized);
  const minimize = useVoiceMode((s) => s.minimize);
  const expand = useVoiceMode((s) => s.expand);
  const lang = useApp((s) => s.language);
  const name = useApp((s) => s.assistantName);
  const [phase, setPhaseS] = useState<Phase>('listening');
  const setPhase = useCallback((p: Phase) => { phaseRef.current = p; setPhaseS(p); }, []);
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const [heard, setHeard] = useState('');
  const [spoken, setSpoken] = useState('');
  const [pos, setPos] = useState(0);
  const [canBarge, setCanBarge] = useState(false);
  const [note, setNote] = useState('');
  const recorder = useAudioRecorder(REC_OPTIONS);
  const rec = useRef<ReturnType<typeof listenByRecording> | null>(null);
  const alive = useRef(true);
  const tr = useRef<SpeechTransport | null>(null);
  const talking = useRef<SpeechStream | null>(null);
  const bargeT = useRef<SpeechTransport | null>(null);
  const spokenRef = useRef('');
  const starts = useRef<{ s: number; len: number }[]>([]);
  const phaseRef = useRef<Phase>('listening');
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<number[]>([]);
  const follow = useRef(true);
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silent = useRef(0);
  const turn = useRef(0);
  const fade = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // apertura: lo sfondo si scurisce, Theia si ingrandisce
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 260, useNativeDriver: true }),
      Animated.spring(grow, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // il cerchio intorno a Theia segue la voce (mentre ascolta) o respira (mentre parla)
  useEffect(() => { Animated.spring(ring, { toValue: speech.level, friction: 6, tension: 80, useNativeDriver: true }).start(); }, [speech.level, ring]);
  useEffect(() => {
    if (reduce || phase !== 'speaking') { pulse.setValue(0); return; }
    const l = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    l.start(); return () => l.stop();
  }, [phase, reduce, pulse]);

  const close = useCallback(() => {
    alive.current = false;
    try { tr.current?.cancel(); } catch { /* già fermo */ }
    rec.current?.cancel();
    talking.current?.stop();
    try { bargeT.current?.cancel(); } catch { /* già fermo */ }
    hide();
  }, [hide]);
  useEffect(() => () => { alive.current = false; try { tr.current?.cancel(); } catch { /* già fermo */ } try { bargeT.current?.cancel(); } catch { /* già fermo */ } rec.current?.cancel(); talking.current?.stop(); if (followTimer.current) clearTimeout(followTimer.current); }, []);

  const fail = useCallback((code: SpeechErrorCode | 'text', text?: string) => {
    setPhase('error');
    setNote(text ?? (code === 'denied' || code === 'denied_forever' ? tl('Per ascoltarti mi serve il microfono: lo attivi dalle impostazioni del telefono. Intanto scrivimi in chat e ti rispondo subito.') : tl('Dammi un attimo e riproviamo: tocca il microfono. Se preferisci, scrivimi in chat e ti rispondo subito.')));
  }, []);

  const listen = useCallback(async () => {
    if (!alive.current) return;
    turn.current += 1;
    talking.current?.stop(); talking.current = null;
    try { bargeT.current?.cancel(); } catch { /* già fermo */ } bargeT.current = null;
    setPhase('listening'); setSpoken(''); spokenRef.current = ''; starts.current = []; setPos(0); setNote('');
    const sup = speechSupport();
    const t = sup.ok ? createTransport() : null;
    if (!t) {
      // senza il riconoscimento vocale del telefono (es. Expo Go) si usa il microfono e Gemini trascrive
      const r = listenByRecording(recorder, lang, (v) => dispatch({ type: 'level', value: v * 10 }));
      rec.current = r;
      dispatch({ type: 'start', locale: localeFor(lang) }); dispatch({ type: 'started' });
      const end = await r.done;
      if (!alive.current || rec.current !== r) return;
      if ('text' in end) { setPhase('thinking'); dispatch({ type: 'final', text: end.text }); dispatch({ type: 'end' }); }
      else if (end.error === 'denied') { dispatch({ type: 'cancel' }); fail('denied'); }
      else if (end.error === 'no_speech') dispatch({ type: 'error', code: 'no_speech' });
      else { dispatch({ type: 'cancel' }); fail('unknown'); }
      return;
    }
    tr.current = t;
    const locale = localeFor(lang);
    dispatch({ type: 'start', locale });
    try { await t.start({ locale, onEvent: dispatch }); }
    catch (c) { dispatch({ type: 'cancel' }); fail(typeof c === 'string' ? (c as SpeechErrorCode) : 'unknown'); }
  }, [lang, fail]);

  /* mentre Theia parla il microfono resta in ascolto: se parli sopra (e non è l'eco della sua voce) smette e ti ascolta, senza che tu tocchi niente */
  const barge = useCallback(async (my: number) => {
    const sup = speechSupport();
    if (!sup.ok) return;
    setCanBarge(true);
    let tries = 0;
    while (alive.current && my === turn.current && phaseRef.current === 'speaking' && tries < 40) {
      tries += 1;
      const t = createTransport();
      if (!t) return;
      bargeT.current = t;
      let hit = false; let over: () => void = () => undefined;
      const ended = new Promise<void>((res) => { over = res; });
      try {
        await t.start({ locale: localeFor(lang), onEvent: (e) => {
          if (hit) { dispatch(e); return; }
          if ((e.type === 'partial' || e.type === 'final') && e.text) {
            const words = e.text.trim().split(/\s+/).filter(Boolean);
            if (words.length >= 2 && !isEcho(e.text, spokenRef.current) && alive.current && my === turn.current && phaseRef.current === 'speaking') {
              hit = true; turn.current += 1;
              talking.current?.stop(); talking.current = null;
              tr.current = t; bargeT.current = null;
              setPhase('listening'); setNote(''); setPos(0);
              dispatch({ type: 'start', locale: localeFor(lang) }); dispatch({ type: 'started' }); dispatch(e);
              over();
            }
          } else if (e.type === 'end' || e.type === 'error') over();
        } });
      } catch { try { t.cancel(); } catch { /* già fermo */ } return; }
      await ended;
      if (hit) return;
      try { t.cancel(); } catch { /* già fermo */ }
      await new Promise((r) => setTimeout(r, 250));
    }
  }, [lang, setPhase]);

  useEffect(() => { void listen(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // fine dell'ascolto: se ha detto qualcosa lo passo a Theia (stessa strada della chat), poi la leggo a voce
  useEffect(() => {
    if (speech.phase === 'error' && speech.error) {
      const code = speech.error; dispatch({ type: 'reset' });
      if (code === 'no_speech') { silent.current += 1; if (silent.current >= 2) { toast(tl('Non ti sento: chiudo. Tieni premuto quando vuoi parlare.')); close(); } else void listen(); return; }
      fail(code); return;
    }
    if (speech.phase !== 'done' || !speech.result) return;
    const said = speech.result; dispatch({ type: 'reset' });
    silent.current = 0; setHeard(said);
    if (wantsToStop(said)) { close(); return; }
    void (async () => {
      const my = turn.current;
      setPhase('thinking'); setSpoken(''); spokenRef.current = ''; starts.current = []; setPos(0); ys.current = []; follow.current = true;
      const before = useAssistant.getState().log.length;
      const stream = makeSpeechStream((i, frac) => {
        if (!alive.current || my !== turn.current) return;
        const c = starts.current[i]; if (!c) return;
        if (phaseRef.current === 'thinking') { setPhase('speaking'); void barge(my); }
        setPos(c.s + frac * c.len);
      });
      talking.current = stream;
      let given = 0, givenText = '', first = true, capped = false;
      /* i testi della risposta fin qui: l'ultimo, se si sta ancora scrivendo, si legge solo fino all'ultima frase finita */
      const feed = (final: boolean) => {
        if (!alive.current || my !== turn.current || capped) return;
        const texts = useAssistant.getState().log.slice(before).filter((m) => m.who === 'ai').map((m) => m.text);
        if (!final && texts.length) { const k = texts.length - 1; const m = /^[\s\S]*[.!?…](?=\s|$)/.exec(texts[k]); texts[k] = m ? m[0] : ''; }
        const clean = cleanForSpeech(texts);
        if (given > 0 && !clean.startsWith(givenText)) return;
        const r = takeChunks(clean, given, final, first);
        for (const ch of r.chunks) {
          const s0 = spokenRef.current ? spokenRef.current.length + 1 : 0;
          starts.current.push({ s: s0, len: ch.length });
          spokenRef.current = spokenRef.current ? `${spokenRef.current} ${ch}` : ch;
          stream.push(ch); first = false;
        }
        if (r.chunks.length) setSpoken(spokenRef.current);
        given = r.to; givenText = clean.slice(0, given);
        if (given >= SPOKEN_MAX && !final) { capped = true; }
      };
      const unsub = useAssistant.subscribe(() => feed(false));
      try { await sendTheia({ text: said, lang, appLang: lang, forced: true, source: 'voice' }); } catch { /* la chat mostra l'errore */ }
      unsub();
      if (!alive.current || my !== turn.current) { stream.stop(); return; }
      capped = false; feed(true);
      if (given >= SPOKEN_MAX || spokenRef.current.length >= SPOKEN_MAX) {
        const more = tl('Il resto lo trovi nella chat.'); starts.current.push({ s: spokenRef.current.length + 1, len: more.length }); spokenRef.current = `${spokenRef.current} ${more}`; stream.push(more); setSpoken(spokenRef.current);
      }
      stream.end();
      if (!spokenRef.current) { talking.current = null; void listen(); return; }
      try { await stream.done; } catch { /* finita */ }
      if (!stream.started() && alive.current && my === turn.current) { toast(tl('La voce non è disponibile adesso: la risposta è scritta qui e nella chat.')); await new Promise((r) => setTimeout(r, 2500)); }
      if (talking.current === stream) talking.current = null;
      if (alive.current && my === turn.current) void listen();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.phase]);

  const live = liveText(speech, lang);
  const status = phase === 'listening' ? (live ? tl('Ti ascolto…') : tl('Di cosa vuoi parlare?')) : phase === 'thinking' ? tl('Ci penso…') : phase === 'speaking' ? (canBarge ? tl('Parlami sopra quando vuoi') : tl('Ti sto rispondendo') ) : tl('Di cosa vuoi parlare?');
  const expr = phase === 'listening' ? 'understood' : phase === 'thinking' ? 'thinking' : phase === 'speaking' ? 'happy' : 'doubtful';
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const breathe = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const say = (text: string) => {
    try { tr.current?.cancel(); } catch { /* già fermo */ }
    rec.current?.cancel();
    dispatch({ type: 'cancel' }); dispatch({ type: 'start', locale: localeFor(lang) }); dispatch({ type: 'started' });
    dispatch({ type: 'final', text }); dispatch({ type: 'end' });
  };
  const ideas = [tl('Cosa devo fare oggi?'), tl('Com\'è andata la mia giornata?'), tl('Aiutami a organizzare domani')];
  /* il pulsante del microfono: se Theia sta parlando la interrompe (lo schermo invece no: si può toccare e scorrere senza fermarla) */
  const interrupt = () => { if (phase === 'speaking' || phase === 'thinking' || phase === 'error') void listen(); else { tr.current?.stop(); rec.current?.finish(); } };

  // testo che segue la voce, come i testi delle canzoni: la frase che sta dicendo è in evidenza e lo scorrimento la segue
  const lines = sentenceSpans(spoken);
  const activeIdx = Math.max(0, lines.reduce((acc, l, i) => (l.start <= pos + 0.5 ? i : acc), 0));
  useEffect(() => {
    if (phase !== 'speaking' || !follow.current) return;
    const y = ys.current[activeIdx];
    if (typeof y === 'number') scroller.current?.scrollTo({ y: Math.max(0, y - 60), animated: !reduce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, phase, spoken]);
  const userScrolled = () => {
    follow.current = false;
    if (followTimer.current) clearTimeout(followTimer.current);
    followTimer.current = setTimeout(() => {
      follow.current = true;
      const y = ys.current[activeIdx];
      if (typeof y === 'number') scroller.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
    }, FOLLOW_BACK_MS);
  };
  const lay = (i: number) => (e: LayoutChangeEvent) => { ys.current[i] = e.nativeEvent.layout.y; };
  const showLyrics = (phase === 'speaking' || phase === 'thinking') && lines.length > 0;

  return (
    <>
      <Modal visible={!minimized} transparent animationType="none" statusBarTranslucent onRequestClose={minimize}>
        <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 24, paddingHorizontal: 28 }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <View style={{ width: showLyrics ? 190 : 280, height: showLyrics ? 190 : 280, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: th.accent + (phase === 'listening' ? '33' : '1a'), transform: [{ scale: (phase === 'speaking' ? breathe : ringScale) }, { scale: showLyrics ? 0.72 : 1 }] }} />
                <Animated.View style={{ position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: th.accent + '26', transform: [{ scale: grow }, { scale: showLyrics ? 0.72 : 1 }] }} />
                <Animated.View style={{ transform: [{ scale: Animated.multiply(grow, phase === 'speaking' ? breathe : 1) }, { scale: showLyrics ? 0.72 : 1 }] }}>
                  <Mascot size={190} color={th.accent} expression={expr} />
                </Animated.View>
                {phase === 'thinking' ? <View style={{ position: 'absolute', right: 8, top: 6 }}><ThinkingStars size={44} color="#FFFFFF" /></View> : null}
              </View>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 10 }}>{status}</Text>
              {(phase === 'listening' && !live) || phase === 'error' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                  {ideas.map((x) => <Pressable key={x} accessibilityRole="button" onPress={() => say(x)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' }}><Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600' }}>{x}</Text></Pressable>)}
                </View>
              ) : null}
              <ScrollView ref={scroller} style={{ maxHeight: showLyrics ? 300 : 190, marginTop: 14, alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', gap: showLyrics ? 12 : 10, paddingVertical: showLyrics ? 40 : 0 }} showsVerticalScrollIndicator={false}
                onScrollBeginDrag={userScrolled} onMomentumScrollBegin={userScrolled}>
                {phase === 'listening' && live ? <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 29 }}>{live}</Text> : null}
                {phase !== 'listening' && heard && !showLyrics ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' }}>{`“${heard}”`}</Text> : null}
                {showLyrics ? lines.map((l, i) => (
                  <Text key={`${i}-${l.start}`} onLayout={lay(i)} style={{ color: '#fff', opacity: i === activeIdx ? 1 : i < activeIdx ? 0.5 : 0.32, fontSize: i === activeIdx ? 21 : 19, fontWeight: i === activeIdx ? '700' : '600', lineHeight: 28, textAlign: 'center' }}>{l.text}</Text>
                )) : null}
                {phase === 'error' && note ? <Text style={{ color: '#fff', fontSize: 16, lineHeight: 22, textAlign: 'center' }}>{note}</Text> : null}
              </ScrollView>
            </View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Riduci: continuo mentre usi l\'app')} onPress={minimize} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron" size={24} color="#fff" stroke={2.2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={phase === 'speaking' ? tl('Interrompi e parla') : tl('Parla')} onPress={interrupt} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={26} color="#fff" stroke={2.2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={close} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={24} color="#fff" stroke={2.2} />
            </Pressable>
          </View>
          <Text style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 8, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{tl('Tutto quello che ci diciamo resta nella tua chat con {0}.', name)}</Text>
        </Animated.View>
      </Modal>
      {minimized ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Riapri la conversazione con {0}', name)} onPress={expand}
          style={{ position: 'absolute', right: 12, top: insets.top + 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(20,20,28,0.92)', borderWidth: 1, borderColor: th.accent + '88' }}>
          <Animated.View style={{ transform: [{ scale: phase === 'speaking' ? breathe : 1 }] }}><Mascot size={34} color={th.accent} expression={expr} /></Animated.View>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{phase === 'speaking' ? tl('Sto parlando…') : phase === 'thinking' ? tl('Ci penso…') : tl('Ti ascolto…')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}
