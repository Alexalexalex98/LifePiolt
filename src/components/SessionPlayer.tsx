import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascot/Mascot';
import { Text } from '@/components/T';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { VOICE_STYLES } from '@/lib/mindLibrary';
import { sessionSeconds, type Session } from '@/lib/mindSessions';
import { SOUNDS, type SoundGroup } from '@/lib/sleepSounds';
import { mixer } from '@/lib/soundMixer';
import { stopNarration } from '@/lib/narrate';
import { makeSpeechStream } from '@/lib/voice/speechEngine';
import type { SpeechStream } from '@/lib/voice/speak';
import { useMindProgress } from '@/store/mindProgress';
import { toast } from '@/store/toast';

type Phase = 'before' | 'play' | 'after';
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Una sessione guidata a tutto schermo: cerchio che respira (o Theia), frase corrente, tempo, suono di sottofondo, come sta andando; prima e dopo ti chiede come ti senti. */
export function SessionPlayer({ session, color, onClose, next }: { session: Session | null; color: string; onClose: () => void; next?: () => void }) {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [phase, setPhase] = useState<Phase>('before');
  const [before, setBefore] = useState<number | undefined>();
  const [after, setAfter] = useState<number | undefined>();
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const stream = useRef<SpeechStream | null>(null);
  const beatIdx = useRef(0);
  const alive = useRef(true);
  const orb = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const total = session ? sessionSeconds(session) : 0;

  const stopAll = useCallback(() => { try { stream.current?.stop(); } catch { /* già fermo */ } stream.current = null; stopNarration(); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopAll(); }; }, [stopAll]);
  useEffect(() => { if (session) { setPhase('before'); setBefore(undefined); setAfter(undefined); setPlaying(false); setLine(''); setElapsed(0); setFailed(false); beatIdx.current = 0; } }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // il cerchio respira al ritmo della sessione; senza ritmo, un respiro lento e continuo
  useEffect(() => {
    if (!session || phase !== 'play' || !playing || reduce) { orb.stopAnimation(); return; }
    const p = session.pace ?? { in: 5, out: 6 };
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(orb, { toValue: 1, duration: p.in * 1000, easing: ease, useNativeDriver: true }),
      ...(p.hold1 ? [Animated.delay(p.hold1 * 1000)] : []),
      Animated.timing(orb, { toValue: 0, duration: p.out * 1000, easing: ease, useNativeDriver: true }),
      ...(p.hold2 ? [Animated.delay(p.hold2 * 1000)] : []),
    ]));
    loop.start(); return () => loop.stop();
  }, [session, phase, playing, reduce, orb]);
  useEffect(() => { Animated.timing(glow, { toValue: playing ? 1 : 0, duration: 800, useNativeDriver: true }).start(); }, [playing, glow]);

  // il tempo scorre solo mentre si ascolta
  useEffect(() => { if (!playing) return; const h = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(h); }, [playing]);

  const startFrom = useCallback((from: number) => {
    if (!session) return;
    stopAll();
    const s = makeSpeechStream((i) => { if (alive.current) { setFailed(false); const say = session.beats.filter((b) => b.say); const k = say.findIndex((_, n) => n === i + sayOffset.current); setLine(say[k]?.say ?? ''); } }, { style: VOICE_STYLES[session.style] });
    stream.current = s;
    // gli indici di Theia contano solo le frasi: li riporto alla posizione nella sessione
    sayOffset.current = session.beats.slice(0, from).filter((b) => b.say).length;
    session.beats.slice(from).forEach((b) => { if (b.say) s.push(b.say); else if (b.pause) s.pause(b.pause * 1000); });
    s.end();
    const t0 = Date.now();
    void s.done.then(() => {
      if (!alive.current || stream.current !== s) return;
      if (!s.started() && Date.now() - t0 < 20000) { setFailed(true); setPlaying(false); toast(tl('La voce non è disponibile adesso: leggi le frasi qui sullo schermo.')); return; }
      setPlaying(false); setPhase('after'); mixer.stopAll();
    });
    setPlaying(true);
  }, [session, stopAll]);
  const sayOffset = useRef(0);

  const begin = () => {
    if (!session) return;
    setPhase('play'); setElapsed(0); beatIdx.current = 0;
    const g = (session.ambient ?? 'natura') as SoundGroup;
    const snd = SOUNDS.find((x) => x.group === g) ?? SOUNDS.find((x) => x.group === 'natura');
    if (snd && !mixer.active().length) void mixer.toggle(snd.id);
    startFrom(0);
  };
  const toggle = () => {
    if (!session) return;
    if (playing) { stopAll(); setPlaying(false); mixer.setVolume(0.25); }
    else { mixer.setVolume(0.7); /* riparte dalla frase corrente: le già lette sono in cache */ const say = session.beats; let n = 0; for (let i = 0; i < say.length; i++) { if (say[i]!.say && n++ >= Math.max(0, sayOffset.current)) { startFrom(i); return; } } startFrom(0); }
  };
  const leave = () => { stopAll(); mixer.stopAll(); onClose(); };
  const done = () => { if (session) useMindProgress.getState().finish(session.id, before, after); stopAll(); mixer.stopAll(); onClose(); };

  if (!session) return null;
  const scale = orb.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.12] });
  const Scale = ({ n }: { n?: number }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <Pressable key={v} onPress={() => (phase === 'before' ? setBefore(v) : setAfter(v))} accessibilityRole="button" accessibilityLabel={String(v)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: n === v ? color : 'rgba(255,255,255,0.12)' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{v}</Text></Pressable>)}
    </View>
  );
  const bg = '#0b0f1e';
  return (
    <Modal visible animationType="fade" onRequestClose={leave} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18, paddingHorizontal: 24 }}>
        <View style={{ position: 'absolute', top: -120, left: -80, width: 360, height: 360, borderRadius: 180, backgroundColor: color + '33' }} />
        <View style={{ position: 'absolute', bottom: -140, right: -100, width: 380, height: 380, borderRadius: 190, backgroundColor: color + '22' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel={tl('Chiudi')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={22} color="#fff" stroke={2.2} /></Pressable>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' }}>{`${session.minutes} min`}</Text>
        </View>

        {phase === 'before' ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Mascot size={120} color={color} expression="happy" />
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 10 }}>{tl(session.title)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 4 }}>{tl(session.why)}</Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 22 }}>{tl('Come ti senti adesso?')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{tl('0 = molto agitato · 10 = tranquillo')}</Text>
            <Scale n={before} />
            <Pressable onPress={begin} accessibilityRole="button" style={{ marginTop: 26, backgroundColor: color, paddingVertical: 15, paddingHorizontal: 44, borderRadius: 999 }}><Text style={{ color: '#0b0f1e', fontSize: 17, fontWeight: '800' }}>{tl('Inizia')}</Text></Pressable>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, textAlign: 'center', marginTop: 14 }}>{tl('Metti le cuffie se puoi. Se ti senti peggio, fermati: puoi parlarne con una persona di fiducia o con un professionista.')}</Text>
          </View>
        ) : null}

        {phase === 'play' ? (
          <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Animated.View style={{ width: 260, height: 260, borderRadius: 130, backgroundColor: color + '3a', alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
                <View style={{ width: 190, height: 190, borderRadius: 95, backgroundColor: color + '66', alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={{ opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }}><Mascot size={120} color={color} expression={playing ? 'relaxed' : 'happy'} /></Animated.View>
                </View>
              </Animated.View>
              {session.pace ? <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 14 }}>{tl('Il cerchio si allarga: inspira. Si restringe: espira.')}</Text> : null}
            </View>
            <View style={{ minHeight: 110, justifyContent: 'center', width: '100%' }}>
              <Text style={{ color: '#fff', fontSize: 19, lineHeight: 27, textAlign: 'center', fontWeight: '600' }}>{line || (failed ? '' : tl('Un momento…'))}</Text>
            </View>
            <View style={{ width: '100%', gap: 12 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}><View style={{ width: `${Math.min(100, (elapsed / Math.max(1, total)) * 100)}%`, height: 4, backgroundColor: color }} /></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{fmt(elapsed)}</Text><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{fmt(total)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                <Pressable onPress={() => { stopAll(); setPlaying(false); setPhase('after'); mixer.stopAll(); }} accessibilityRole="button" accessibilityLabel={tl('Concludi')} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{tl('Concludi')}</Text></Pressable>
                <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? tl('Pausa') : tl('Riprendi')} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon name={playing ? 'pause' : 'play'} size={30} color="#0b0f1e" fill="#0b0f1e" /></Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {phase === 'after' ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Mascot size={120} color={color} expression="happy" />
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>{tl('Ben fatto')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center' }}>{tl('Come ti senti adesso?')}</Text>
            <Scale n={after} />
            {before != null && after != null ? <Text style={{ color: color, fontSize: 14, fontWeight: '700', marginTop: 14 }}>{after > before ? tl('Prima {0}, ora {1}: un passo avanti.', before, after) : after === before ? tl('Uguale a prima: a volte serve qualche seduta. Va bene così.') : tl('Se ti senti più agitato di prima, è normale che capiti: respira, e riprova con calma un\'altra volta.')}</Text> : null}
            <Pressable onPress={done} accessibilityRole="button" style={{ marginTop: 24, backgroundColor: color, paddingVertical: 15, paddingHorizontal: 44, borderRadius: 999 }}><Text style={{ color: '#0b0f1e', fontSize: 17, fontWeight: '800' }}>{tl('Salva e chiudi')}</Text></Pressable>
            {next ? <Pressable onPress={() => { done(); next(); }} style={{ marginTop: 12, padding: 10 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{tl('Passa alla prossima')}</Text></Pressable> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
