import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, View } from 'react-native';
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
import { speak, type Speaking } from '@/lib/voice/speak';
import { speakable, wantsToStop } from '@/lib/voice/voiceText';
import { useApp } from '@/store/app';
import { useAssistant } from '@/store/assistant';
import { toast } from '@/store/toast';
import { useVoiceMode } from '@/store/voiceMode';

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
  const lang = useApp((s) => s.language);
  const name = useApp((s) => s.assistantName);
  const [phase, setPhase] = useState<Phase>('listening');
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const alive = useRef(true);
  const tr = useRef<SpeechTransport | null>(null);
  const talking = useRef<Speaking | null>(null);
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
    talking.current?.stop();
    hide();
  }, [hide]);
  useEffect(() => () => { alive.current = false; try { tr.current?.cancel(); } catch { /* già fermo */ } talking.current?.stop(); }, []);

  const fail = useCallback((code: SpeechErrorCode | 'text', text?: string) => {
    setPhase('error');
    setNote(text ?? (code === 'denied' || code === 'denied_forever' ? tl('Per parlare con me serve il permesso del microfono: puoi darlo dalle impostazioni del telefono.') : code === 'needs_build' || code === 'unavailable' || code === 'service_missing' ? tl('Su questo telefono il riconoscimento vocale non c\'è ancora: in un\'app installata funziona. Intanto scrivimi in chat.') : tl('Non riesco ad ascoltarti adesso. Riprova tra poco.')));
  }, []);

  const listen = useCallback(async () => {
    if (!alive.current) return;
    turn.current += 1;
    talking.current?.stop(); talking.current = null;
    setPhase('listening'); setReply(''); setNote('');
    const sup = speechSupport();
    if (!sup.ok) { fail(sup.reason); return; }
    const t = createTransport();
    if (!t) { fail('unavailable'); return; }
    tr.current = t;
    const locale = localeFor(lang);
    dispatch({ type: 'start', locale });
    try { await t.start({ locale, onEvent: dispatch }); }
    catch (c) { dispatch({ type: 'cancel' }); fail(typeof c === 'string' ? (c as SpeechErrorCode) : 'unknown'); }
  }, [lang, fail]);
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
      setPhase('thinking');
      const before = useAssistant.getState().log.length;
      try { await sendTheia({ text: said, lang, appLang: lang, forced: true, source: 'voice' }); } catch { /* la chat mostra l'errore */ }
      if (!alive.current || my !== turn.current) return;
      const texts = useAssistant.getState().log.slice(before).filter((m) => m.who === 'ai').map((m) => m.text);
      const out = speakable(texts, { more: tl('Il resto lo trovi nella chat.') });
      if (!out) { void listen(); return; }
      setReply(out);
      try {
        const sp = await speak(out);
        if (!alive.current || my !== turn.current) { sp.stop(); return; }
        talking.current = sp; setPhase('speaking');
        await sp.done;
        talking.current = null;
      } catch { toast(tl('La voce non è disponibile adesso: la risposta è scritta qui e nella chat.')); await new Promise((r) => setTimeout(r, 2500)); }
      if (alive.current && my === turn.current) void listen();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.phase]);

  const live = liveText(speech, lang);
  const status = phase === 'listening' ? (speech.phase === 'starting' ? tl('Apro il microfono…') : tl('Ti ascolto…')) : phase === 'thinking' ? tl('Ci penso…') : phase === 'speaking' ? tl('Sto parlando… tocca per interrompermi') : tl('Qualcosa non va');
  const expr = phase === 'listening' ? 'understood' : phase === 'thinking' ? 'thinking' : phase === 'speaking' ? 'happy' : 'doubtful';
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const breathe = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const interrupt = () => { if (phase === 'speaking' || phase === 'thinking' || phase === 'error') void listen(); else tr.current?.stop(); };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Tocca per parlare o per interrompere')} onPress={interrupt} style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 24, paddingHorizontal: 28 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: th.accent + (phase === 'listening' ? '33' : '1a'), transform: [{ scale: phase === 'speaking' ? breathe : ringScale }] }} />
              <Animated.View style={{ position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: th.accent + '26', transform: [{ scale: grow }] }} />
              <Animated.View style={{ transform: [{ scale: Animated.multiply(grow, phase === 'speaking' ? breathe : 1) }] }}>
                <Mascot size={190} color={th.accent} expression={expr} />
              </Animated.View>
              {phase === 'thinking' ? <View style={{ position: 'absolute', right: 8, top: 6 }}><ThinkingStars size={44} color="#FFFFFF" /></View> : null}
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 14 }}>{status}</Text>
            <ScrollView style={{ maxHeight: 190, marginTop: 14, alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', gap: 10 }} showsVerticalScrollIndicator={false}>
              {phase === 'listening' && live ? <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 29 }}>{live}</Text> : null}
              {phase !== 'listening' && heard ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' }}>{`“${heard}”`}</Text> : null}
              {(phase === 'speaking' || (phase === 'thinking' && reply)) && reply ? <Text style={{ color: '#fff', fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{reply}</Text> : null}
              {phase === 'error' && note ? <Text style={{ color: '#fff', fontSize: 16, lineHeight: 22, textAlign: 'center' }}>{note}</Text> : null}
            </ScrollView>
          </View>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 26 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Parla')} onPress={interrupt} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={26} color="#fff" stroke={2.2} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={close} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={26} color="#fff" stroke={2.2} />
          </Pressable>
        </View>
        <Text style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 8, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{tl('Tutto quello che ci diciamo resta nella tua chat con {0}.', name)}</Text>
      </Animated.View>
    </Modal>
  );
}

