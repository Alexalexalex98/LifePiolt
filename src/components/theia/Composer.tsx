import { Image } from 'expo-image';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Input, Sheet } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { infoOf } from '@/i18n/languages';
import { roomLeft } from '@/lib/assistant/imageCore';
import { Icon } from '@/lib/icons';
import {
  createTransport, initialSpeech, isActive, isSpeechLang, liveText, localeFor, shouldAutoSend, speechErrorText, speechReducer, speechSupport,
  type SpeechErrorCode, type SpeechTransport,
} from '@/lib/speech';
import { useTheia } from '@/store/theia';
import { MAX_IMAGES, pickFromGallery, takePhoto, type Attachment } from './images';
import { LangSheet } from './LangSheet';
import { PrivacyBadge } from './PrivacyBadge';

export type ComposerSend = { text: string; images: Attachment[]; source: 'typed' | 'voice'; lang: string; forced: boolean };

const BARS = 7;

/** Onda del microfono: si muove col livello se il motore lo dà, altrimenti pulsa. Ferma con "riduci movimento". */
function Wave({ level }: { level: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const vals = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (reduce) return;
    const loops = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 380 + i * 55, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.25, duration: 380 + i * 55, useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, vals]);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: t.accent, opacity: 0.55 + Math.min(0.45, level), transform: [{ scaleY: reduce ? 0.6 : v }] }} />
      ))}
    </View>
  );
}

/** Compositore di Theia: testo, microfono in 12 lingue, allegati immagine (fotocamera/galleria, max 4). */
export function Composer({ appLang, busy, placeholder, onSend }: {
  appLang: string; busy: boolean; placeholder: string; onSend: (m: ComposerSend) => void;
}) {
  const t = useTheme();
  const auto = useTheia((s) => s.voiceAuto);
  const setAuto = useTheia((s) => s.setVoiceAuto);
  const [text, setText] = useState('');
  const [images, setImages] = useState<Attachment[]>([]);
  const [over, setOver] = useState<string | null>(null); // lingua scelta al volo
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const [err, setErr] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const transport = useRef<SpeechTransport | null>(null);
  const voiceFrom = useRef<string | null>(null); // lingua della trascrizione nel campo di testo
  const lang = over ?? appLang;
  const speechLang = isSpeechLang(lang) ? lang : 'it';
  const active = isActive(speech);
  const sup = speechSupport();

  const say = useCallback((m: string) => { try { AccessibilityInfo.announceForAccessibility(m); } catch { /* facoltativo */ } }, []);

  const stopAll = useCallback(() => {
    transport.current?.cancel();
    transport.current = null;
    dispatch({ type: 'cancel' });
  }, []);

  // mai in background e mai dopo aver lasciato la schermata
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') stopAll(); });
    return () => { sub.remove(); transport.current?.cancel(); };
  }, [stopAll]);

  const fail = useCallback((code: SpeechErrorCode) => { setErr(translateText(speechErrorText(code))); say(translateText(speechErrorText(code))); }, [say]);

  const send = useCallback((m: Partial<ComposerSend> & { text: string }) => {
    onSend({ text: m.text, images: m.images ?? images, source: m.source ?? 'typed', lang: m.lang ?? lang, forced: m.forced ?? over != null });
    setText(''); setImages([]); setOver(null); setHint(null); setErr(null); voiceFrom.current = null;
  }, [onSend, images, lang, over]);

  // fine dell'ascolto: invio automatico oppure trascrizione nel campo per conferma
  useEffect(() => {
    if (speech.phase === 'error' && speech.error) { fail(speech.error); dispatch({ type: 'reset' }); return; }
    if (speech.phase !== 'done' || !speech.result) return;
    const res = speech.result;
    dispatch({ type: 'reset' });
    transport.current = null;
    if (shouldAutoSend(auto ? 'auto' : 'confirm', res)) {
      send({ text: res, source: 'voice', lang: speechLang, forced: true });
    } else {
      setText((prev) => (prev.trim() ? `${prev.trim()} ${res}` : res));
      voiceFrom.current = speechLang;
      setHint(translateText('Controlla il testo e premi Invia.'));
      say(`${translateText('Trascrizione pronta')}: ${res}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.phase]);

  async function startVoice() {
    setErr(null); setHint(null);
    if (!sup.ok) { fail(sup.reason); return; }
    const tr = createTransport();
    if (!tr) { fail('unavailable'); return; }
    transport.current = tr;
    const locale = localeFor(speechLang);
    dispatch({ type: 'start', locale });
    say(`${translateText('Sto ascoltando')}: ${infoOf(speechLang).native}`);
    try { await tr.start({ locale, onEvent: dispatch }); }
    catch (c) { transport.current = null; dispatch({ type: 'error', code: typeof c === 'string' ? (c as SpeechErrorCode) : 'unknown' }); }
  }

  async function addImages(fn: (room: number) => Promise<Attachment[]>) {
    setAttachOpen(false); setErr(null);
    try {
      const got = await fn(roomLeft(images.length));
      if (got.length) setImages((cur) => [...cur, ...got].slice(0, MAX_IMAGES));
    } catch (e) { setErr(e instanceof Error ? e.message : translateText('Non riesco ad aprire le immagini.')); }
  }

  const canSend = !busy && !active && (text.trim().length > 0 || images.length > 0);
  const doSend = () => {
    if (!canSend) return;
    const fromVoice = voiceFrom.current != null && text.trim().length > 0;
    send({ text: text.trim(), source: fromVoice ? 'voice' : 'typed', lang: fromVoice ? voiceFrom.current! : lang, forced: fromVoice ? true : over != null });
  };
  const circle = (bg: string, on = true) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: bg, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: on ? 1 : 0.4 });
  const native = infoOf(lang).native;
  const live = liveText(speech, speechLang);

  return (
    <View style={{ paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <PrivacyBadge />
        <Pressable
          onPress={() => setLangOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${translateText('Lingua di questo messaggio')}: ${native}`}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: over ? t.text : t.chip, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, minHeight: 28 }}>
          <Icon name="compass" size={13} color={over ? t.bg : t.text} stroke={2} />
          <Text style={{ color: over ? t.bg : t.text, fontSize: 12, fontWeight: '600' }}>{native}</Text>
        </Pressable>
      </View>

      {err ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: t.dangerBg, borderRadius: 12, padding: 10, marginBottom: 6, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="alert" size={16} color={t.danger} stroke={2} />
          <Text style={{ color: t.danger, fontSize: 13, lineHeight: 18, flex: 1 }}>{err}</Text>
          <Pressable onPress={() => setErr(null)} accessibilityRole="button" accessibilityLabel={translateText('Chiudi')} hitSlop={10}><Icon name="x" size={16} color={t.danger} stroke={2.2} /></Pressable>
        </View>
      ) : null}

      {active ? (
        <View style={{ backgroundColor: t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 6 }}>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Wave level={speech.level} />
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
              {speech.phase === 'starting' ? translateText('Apro il microfono…') : `${translateText('Sto ascoltando')} · ${native}`}
            </Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={{ color: live ? t.text : t.muted, fontSize: 16, lineHeight: 22, marginTop: 8, minHeight: 22 }}>
            {live || translateText('Parla pure…')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <Btn small ghost icon="x" title="Annulla" onPress={stopAll} />
            <Btn small icon="check" title="Fatto" onPress={() => transport.current?.stop()} />
          </View>
          <Text style={{ color: t.muted, fontSize: 11, marginTop: 8 }}>{translateText('Il microfono è acceso solo ora. Nessun audio viene salvato.')}</Text>
        </View>
      ) : null}

      {hint ? <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{hint}</Text> : null}

      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: 4 }}>
          {images.map((im, i) => (
            <View key={im.id} style={{ width: 64, height: 64 }}>
              <Image source={{ uri: im.uri }} accessible accessibilityRole="image" accessibilityLabel={`${translateText('Immagine allegata')} ${i + 1}/${images.length}`} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.item }} contentFit="cover" />
              <Pressable
                onPress={() => setImages((cur) => cur.filter((x) => x.id !== im.id))}
                accessibilityRole="button"
                accessibilityLabel={`${translateText('Rimuovi immagine')} ${i + 1}`}
                hitSlop={10}
                style={{ position: 'absolute', top: -6, end: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={12} color={t.bg} stroke={2.6} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Pressable onPress={() => setAttachOpen(true)} disabled={active || images.length >= MAX_IMAGES} accessibilityRole="button" accessibilityLabel={translateText('Allega immagini')} accessibilityState={{ disabled: active || images.length >= MAX_IMAGES }} style={circle(t.chip, !active && images.length < MAX_IMAGES)}>
          <Icon name="paperclip" size={20} color={t.text} stroke={2} />
        </Pressable>
        <Input flex={1} placeholder={placeholder} value={text} onChangeText={(v) => { setText(v); if (!v) voiceFrom.current = null; }} onSubmitEditing={doSend} returnKeyType="send" editable={!active} style={{ marginBottom: 0, minWidth: 0 }} />
        <Pressable
          onPress={active ? stopAll : startVoice}
          accessibilityRole="button"
          accessibilityLabel={active ? translateText('Ferma l\'ascolto') : `${translateText('Parla a Theia')} (${native})`}
          accessibilityState={{ selected: active }}
          style={circle(active ? t.danger : t.chip)}>
          <Icon name={active ? 'square' : 'mic'} size={active ? 16 : 20} color={active ? t.onText : t.text} stroke={2} />
        </Pressable>
        <Pressable onPress={doSend} disabled={!canSend} accessibilityRole="button" accessibilityLabel={translateText('Invia')} accessibilityState={{ disabled: !canSend }} style={circle(t.accent, canSend)}>
          <Icon name="arrow-up" size={20} color={t.onText} stroke={2.4} />
        </Pressable>
      </View>

      {!sup.ok ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>{translateText(speechErrorText(sup.reason))}</Text> : null}

      <Sheet visible={attachOpen} title="Allega immagini" onClose={() => setAttachOpen(false)}>
        <Body muted small style={{ marginBottom: 10 }}>Fino a 4 immagini. Restano sul tuo telefono: non vengono inviate a nessuno senza il tuo consenso.</Body>
        <View style={{ gap: 8 }}>
          <Btn icon="camera" title="Scatta una foto" onPress={() => void addImages(takePhoto)} />
          <Btn ghost icon="image" title="Scegli dalla galleria" onPress={() => void addImages(pickFromGallery)} />
        </View>
      </Sheet>
      <LangSheet visible={langOpen} onClose={() => setLangOpen(false)} value={lang} appLang={appLang} onPick={(c) => setOver(c === appLang ? null : c)} auto={auto} onAuto={setAuto} />
    </View>
  );
}
