import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Btn, Input } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { infoOf } from '@/i18n/languages';
import { Icon } from '@/lib/icons';
import {
  createTransport, getLastSpeechError, getTranscriber, initialSpeech, isActive, isSpeechLang, liveText, localeFor, shouldAutoSend, speechReducer, speechSupport,
  type SpeechErrorCode, type SpeechTransport,
} from '@/lib/speech';
import { MAX_ATTACHMENTS, type Att } from '@/lib/attachments';
import { PermissionError, explainDenied } from '@/lib/chatMedia';
import { fmtDur } from '@/store/chat';
import { toast } from '@/store/toast';
import { useTheia } from '@/store/theia';
import type { Attachment } from './images';
import { AttachChip, BillChip } from './AttachChips';
import { AttachSheet } from './AttachSheet';
import { LangSheet } from './LangSheet';
import { PrivacyBadge } from './PrivacyBadge';
import { useVoiceNote } from './useVoiceNote';
import { VoiceDiagSheet } from './VoiceDiagSheet';
import { VoiceNotice } from './VoiceNotice';

/** `images` = foto (vanno al router come prima); `attachments` = tutto il resto (documenti, testo, posizione, contatto, nota, impegno). */
export type ComposerSend = { text: string; images: Attachment[]; attachments?: Att[]; source: 'typed' | 'voice'; lang: string; forced: boolean; /** audio registrato: va in chat comunque, anche se non si può trascrivere */ voiceNote?: { uri: string; durationMs: number } };

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

/** Compositore di Theia: testo (cresce fino a 5 righe), microfono in 12 lingue, allegati come in Claude (foto, file, testo, posizione, contatto, nota, impegno). */
export function Composer({ appLang, busy, placeholder, onSend }: {
  appLang: string; busy: boolean; placeholder: string; onSend: (m: ComposerSend) => void;
}) {
  const t = useTheme();
  const auto = useTheia((s) => s.voiceAuto);
  const setAuto = useTheia((s) => s.setVoiceAuto);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Att[]>([]);
  const [over, setOver] = useState<string | null>(null); // lingua scelta al volo
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const [voiceErr, setVoiceErr] = useState<{ code: SpeechErrorCode; raw?: string } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const transport = useRef<SpeechTransport | null>(null);
  const voiceFrom = useRef<string | null>(null); // lingua della trascrizione nel campo di testo
  const note = useVoiceNote();
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

  const fail = useCallback((code: SpeechErrorCode, raw?: string) => {
    setVoiceErr({ code, raw: raw ?? getLastSpeechError() ?? undefined });
    say(translateText('Voce non disponibile'));
  }, [say]);

  const send = useCallback((m: Partial<ComposerSend> & { text: string }) => {
    const images: Attachment[] = atts.filter((a) => a.kind === 'image' && a.uri).map((a) => ({ id: a.id, uri: a.uri!, mime: a.mime ?? 'image/jpeg', width: a.width, height: a.height }));
    onSend({ text: m.text, images: m.images ?? images, attachments: atts.filter((a) => a.kind !== 'image'), source: m.source ?? 'typed', lang: m.lang ?? lang, forced: m.forced ?? over != null, ...(m.voiceNote ? { voiceNote: m.voiceNote } : {}) });
    setText(''); setAtts([]); setOver(null); setHint(null); setVoiceErr(null); voiceFrom.current = null;
  }, [onSend, atts, lang, over]);

  // fine dell'ascolto: invio automatico oppure trascrizione nel campo per conferma
  useEffect(() => {
    if (speech.phase === 'error' && speech.error) { fail(speech.error, speech.rawError); dispatch({ type: 'reset' }); return; }
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

  /** Il tasto dà SEMPRE un riscontro: parte l'ascolto oppure compare un messaggio che spiega cosa fare. */
  async function startVoice() {
    setVoiceErr(null); setHint(null);
    try {
      // senza riconoscimento vocale (es. Expo Go) il microfono registra direttamente, come nelle chat con le persone
      if (!sup.ok) { if (Platform.OS !== 'web' && !getTranscriber().available) { void startNote(); return; } fail(sup.reason, `piattaforma=${Platform.OS}; ${sup.reason}`); return; }
      const tr = createTransport();
      if (!tr) { fail('unavailable'); return; }
      transport.current = tr;
      const locale = localeFor(speechLang);
      dispatch({ type: 'start', locale });
      say(`${translateText('Sto ascoltando')}: ${infoOf(speechLang).native}`);
      try { await tr.start({ locale, onEvent: dispatch }); }
      catch (c) {
        transport.current = null;
        dispatch({ type: 'cancel' });
        fail(typeof c === 'string' ? (c as SpeechErrorCode) : 'unknown', typeof c === 'string' ? undefined : String(c));
      }
    } catch (e) {
      transport.current = null; dispatch({ type: 'cancel' });
      fail('unknown', String(e));
    }
  }

  async function startNote() {
    setVoiceErr(null); setHint(null);
    try { await note.start(); }
    catch (e) {
      if (e instanceof PermissionError) explainDenied(e.message, e.canAskAgain);
      else toast(Platform.OS === 'web' ? 'La registrazione richiede l\'app sul telefono o un browser con microfono' : 'Impossibile avviare la registrazione');
    }
  }
  async function stopNote() {
    const n = await note.stop();
    if (!n) { toast('Registrazione troppo breve'); return; }
    const tcr = getTranscriber();
    if (!tcr.available) { send({ text: '', source: 'voice', voiceNote: n }); note.discard(); return; }
    if (tcr.available) {
      try { const txt = await tcr.transcribe(n.uri, localeFor(speechLang)); if (txt.trim()) { setText((p) => (p.trim() ? `${p.trim()} ${txt}` : txt)); note.discard(); } }
      catch { setHint(translateText('Non sono riuscita a trascrivere l\'audio: resta salvato sul telefono.')); }
    }
  }

  function addAtts(list: Att[]) { setAtts((cur) => [...cur, ...list].slice(0, MAX_ATTACHMENTS)); }

  const canSend = !busy && !active && !note.recording && (text.trim().length > 0 || atts.length > 0);
  const doSend = () => {
    if (!canSend) return;
    const fromVoice = voiceFrom.current != null && text.trim().length > 0;
    send({ text: text.trim(), source: fromVoice ? 'voice' : 'typed', lang: fromVoice ? voiceFrom.current! : lang, forced: fromVoice ? true : over != null });
  };
  const circle = (bg: string, on = true) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: bg, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: on ? 1 : 0.4 });
  const native = infoOf(lang).native;
  const live = liveText(speech, speechLang);
  const bills = atts.filter((a) => a.billish && a.kind !== 'image');

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

      {voiceErr ? <VoiceNotice code={voiceErr.code} raw={voiceErr.raw} onClose={() => setVoiceErr(null)} onRetry={() => void startVoice()} onRecord={() => { setVoiceErr(null); void startNote(); }} onDiag={() => setDiagOpen(true)} /> : null}

      {note.recording ? (
        <View accessibilityLiveRegion="polite" style={{ backgroundColor: t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.danger }} />
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{translateText('Registro un audio')} · {fmtDur(note.ms)}</Text>
          <Btn small icon="check" title="Fatto" onPress={() => void stopNote()} />
        </View>
      ) : note.saved ? (
        <View style={{ backgroundColor: t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 6, gap: 6 }}>
          <Text style={{ color: t.text, fontSize: 13, lineHeight: 18 }}>{translateText('Audio salvato solo sul tuo telefono')} ({fmtDur(note.saved.durationMs)}). {translateText('La trascrizione richiede il servizio di trascrizione (non ancora collegato)')}.</Text>
          <View style={{ flexDirection: 'row' }}><Btn small ghost icon="trash" title="Elimina audio" onPress={note.discard} /></View>
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

      {atts.length ? (
        <View style={{ marginBottom: 4 }}>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8, paddingEnd: 8 }}>
            {atts.map((a) => <AttachChip key={a.id} a={a} onRemove={() => setAtts((cur) => cur.filter((x) => x.id !== a.id))} />)}
          </ScrollView>
          {bills.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{bills.map((a) => <BillChip key={a.id} a={a} />)}</View> : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Pressable onPress={() => setAttachOpen(true)} disabled={active || note.recording} accessibilityRole="button" accessibilityLabel={translateText('Allega')} accessibilityState={{ disabled: active || note.recording }} style={circle(t.chip, !active && !note.recording)}>
          <Icon name="paperclip" size={20} color={t.text} stroke={2} />
        </Pressable>
        <Input
          flex={1}
          placeholder={placeholder}
          value={text}
          onChangeText={(v) => { setText(v); if (!v) voiceFrom.current = null; }}
          onSubmitEditing={Platform.OS === 'web' ? doSend : undefined}
          returnKeyType={Platform.OS === 'web' ? 'send' : 'default'}
          // su telefono Invio va a capo e il campo cresce fino a 5 righe; sul web Invio invia
          maxLines={Platform.OS === 'web' ? undefined : 5}
          editable={!active}
          style={{ marginBottom: 0, minWidth: 0 }}
        />
        <Pressable
          onPress={active ? stopAll : () => void startVoice()}
          onLongPress={() => setDiagOpen(true)}
          delayLongPress={500}
          accessibilityRole="button"
          accessibilityLabel={active ? translateText('Ferma l\'ascolto') : `${translateText('Parla a Theia')} (${native})`}
          accessibilityHint={translateText('Tieni premuto per la diagnostica della voce')}
          accessibilityState={{ selected: active }}
          style={circle(active ? t.danger : t.chip)}>
          <Icon name={active ? 'square' : 'mic'} size={active ? 16 : 20} color={active ? t.onText : t.text} stroke={2} />
        </Pressable>
        <Pressable onPress={doSend} disabled={!canSend} accessibilityRole="button" accessibilityLabel={translateText('Invia')} accessibilityState={{ disabled: !canSend }} style={circle(t.accent, canSend)}>
          <Icon name="arrow-up" size={20} color={t.onText} stroke={2.4} />
        </Pressable>
      </View>

      <AttachSheet visible={attachOpen} onClose={() => setAttachOpen(false)} current={atts} onAdd={addAtts} />
      <VoiceDiagSheet visible={diagOpen} onClose={() => setDiagOpen(false)} locale={localeFor(speechLang)} />
      <LangSheet visible={langOpen} onClose={() => setLangOpen(false)} value={lang} appLang={appLang} onPick={(c) => setOver(c === appLang ? null : c)} auto={auto} onAuto={setAuto} />
    </View>
  );
}
