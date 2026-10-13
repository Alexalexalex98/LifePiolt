import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { useCallTranscription } from '@/components/call/useTheiaNotes';
import { Presenter, ShareSheet } from '@/components/live/Present';
import { RoundBtn } from '@/components/live/Overlay';
import { HostCamera } from '@/components/live/VideoSurface';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { applyJoinPresence, endForAll, everyone, invite, leave } from '@/lib/callActions';
import { buildNotes, hasNotes, type TLine } from '@/lib/callNotes';
import { canEnter, inviteCandidates, isInvolved, phase } from '@/lib/groupCall';
import { Icon } from '@/lib/icons';
import { useNow } from '@/lib/enroll';
import { clockLabel } from '@/lib/liveRoom';
import { go, goBack } from '@/lib/nav';
import type { Presentation } from '@/lib/presentation';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { toast } from '@/store/toast';

/** Frasi di esempio degli altri partecipanti: solo in demo, per vedere come lavora Theia. */
const SIM = [
  'Abbiamo deciso di spostare la riunione a giovedì alle 10',
  'Io mi occupo di prenotare la sala entro venerdì',
  'Quanto costa la sala per mezza giornata?',
  'Dobbiamo inviare l\'ordine del giorno entro domani',
  'Il budget è di 1200 CHF e i partecipanti sono 18 persone',
];

export default function GroupCall() {
  const { chat: chatId = '', mid = '' } = useLocalSearchParams<{ chat?: string; mid?: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const lang = useApp((s) => s.language);
  const msg = useChat((s) => s.messages[chatId]?.find((m) => m.id === mid));
  const chat = useChat((s) => s.chats[chatId]);
  const now = useNow(1000);
  const call = msg?.call;
  const rec = msg?.callRecord;

  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(!call?.video);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pres, setPres] = useState<Presentation | null>(null);
  const [mine, setMine] = useState<boolean | null>(null); // consenso a trascrivere la MIA voce
  const [notesOpen, setNotesOpen] = useState(false);
  const joinedAt = useRef(Date.now());

  const open = call ? phase(call, now) === 'open' : false;
  const allowed = !!call && canEnter(call, me, now);
  const theiaOn = !!rec?.theia;

  // i presenti si aggiornano da soli (demo: gli altri entrano uno alla volta)
  useEffect(() => { if (call && allowed) applyJoinPresence(chatId, mid, me); }, [chatId, mid, me, allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!demo || !call) return;
    const others = [...new Set([...Object.keys(call.rsvp).filter((n) => call.rsvp[n] === 'yes'), ...call.invited])].filter((n) => n !== me && !call.joined.includes(n));
    const timers = others.slice(0, 4).map((n, i) => setTimeout(() => applyJoinPresence(chatId, mid, n), 2500 + i * 2800));
    return () => timers.forEach(clearTimeout);
  }, [demo, chatId, mid]); // eslint-disable-line react-hooks/exhaustive-deps

  const addLine = useCallback((l: TLine) => {
    const cur = useChat.getState().messages[chatId]?.find((m) => m.id === mid);
    if (!cur?.callRecord) return;
    useChat.getState().patchMsg(chatId, mid, { callRecord: { ...cur.callRecord, transcript: [...cur.callRecord.transcript, l] } });
  }, [chatId, mid]);

  // demo: gli altri «parlano»
  useEffect(() => {
    if (!demo || !theiaOn || !call) return;
    const others = call.joined.filter((n) => n !== me);
    if (!others.length) return;
    let i = 0;
    const h = setInterval(() => {
      if (i >= SIM.length) { clearInterval(h); return; }
      addLine({ at: Date.now() - call.startsAt, speaker: others[i % others.length], text: SIM[i] });
      i++;
    }, 7000);
    return () => clearInterval(h);
  }, [demo, theiaOn, call?.joined.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const tr = useCallTranscription({ enabled: theiaOn && mine === true && !micOff && open, speaker: me, lang, startedAt: call?.startsAt ?? Date.now(), onLine: addLine });
  const transcript = rec?.transcript ?? [];
  const live = useMemo(() => buildNotes(transcript), [transcript]);

  const toggleTheia = (on: boolean) => {
    if (!msg?.callRecord) return;
    useChat.getState().patchMsg(chatId, mid, { callRecord: { ...msg.callRecord, theia: on } });
    useChat.getState().receive(chatId, 'system', { kind: 'system', text: on ? tl('{0} ha attivato Theia: prende appunti della call', me) : tl('{0} ha disattivato gli appunti di Theia', me) });
    if (on) askConsent();
  };
  const askConsent = () => alertT('Theia prende appunti', 'Vuoi che Theia trascriva la tua voce, sul tuo telefono, per gli appunti della call? Ognuno decide solo per sé e puoi smettere quando vuoi. Non viene salvato nessun audio.', [
    { text: 'Non ora', style: 'cancel', onPress: () => setMine(false) },
    { text: 'Consenti', onPress: () => setMine(true) },
  ]);
  useEffect(() => { if (theiaOn && mine === null && open) askConsent(); }, [theiaOn, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (all: boolean) => {
    const cur = useChat.getState().messages[chatId]?.find((m) => m.id === mid);
    if (cur?.callRecord && cur.callRecord.transcript.length) {
      const notes = buildNotes(cur.callRecord.transcript);
      useChat.getState().patchMsg(chatId, mid, { callRecord: { ...cur.callRecord, notes } });
      if (hasNotes(notes)) setTimeout(() => alertT('Appunti pronti', 'Theia ha segnato decisioni, cose da fare e domande della call.', [{ text: 'Più tardi', style: 'cancel' }, { text: 'Apri', onPress: () => go('callNotes', { chat: chatId, mid }) }]), 400);
    }
    if (all) endForAll(chatId, mid); else leave(chatId, mid, me);
    goBack();
  };
  const confirmEnd = () => {
    if (call?.by === me) {
      alertT('Terminare la call?', 'Puoi uscire e lasciarla aperta agli altri oppure chiuderla per tutti.', [
        { text: 'Annulla', style: 'cancel' }, { text: 'Esci', onPress: () => finish(false) }, { text: 'Termina per tutti', style: 'destructive', onPress: () => finish(true) },
      ]);
    } else finish(false);
  };

  if (!msg || !call) return <View style={{ flex: 1, backgroundColor: '#0b0e14', alignItems: 'center', justifyContent: 'center' }}><Body muted>Chiamata non trovata.</Body></View>;
  if (!allowed) {
    const ph = phase(call, now);
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0e14', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{call.title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>{ph === 'ended' ? tl('Questa call è conclusa.') : ph === 'upcoming' ? tl('La stanza non è ancora aperta.') : !isInvolved(call, me) ? tl('Non hai confermato la presenza: chiedi a chi è nella stanza di invitarti.') : tl('Non puoi entrare.')}</Text>
        <Btn title="Indietro" onPress={goBack} />
      </View>
    );
  }

  const people = call.joined.length ? call.joined : [me];
  const cols = people.length > 4 ? 3 : people.length > 1 ? 2 : 1;
  const tile = (n: string) => (
    <View key={n} style={{ width: `${100 / cols}%`, padding: 4 }}>
      <View style={{ aspectRatio: cols === 1 ? 0.75 : 0.85, borderRadius: 18, overflow: 'hidden', backgroundColor: '#161b26', alignItems: 'center', justifyContent: 'center' }}>
        {n === me && call.video && !camOff ? <HostCamera facing={facing} torch={false} camOff={false} needMic={false} small />
          : <LinearGradient colors={['#1b2440', '#0b0e14']} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}><UserAvatar name={n} size={cols === 1 ? 110 : 64} /></LinearGradient>}
        <View style={{ position: 'absolute', start: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8 }}>
          {n === me && micOff ? <Icon name="mic" size={12} color="#ff6b6b" /> : null}
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{n === me ? tl('Tu') : n}</Text>
        </View>
      </View>
    </View>
  );
  const candidates = inviteCandidates(call, chat?.members ?? [], everyone(me));

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {pres ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}><Presenter pres={pres} isHost={pres.by === me} onStop={() => setPres(null)} topInset={insets.top - 40} /></View> : null}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{call.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{clockLabel(Math.max(0, now - joinedAt.current))} · {tl('{0} nella stanza', call.joined.length)}</Text>
        </View>
        {theiaOn ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(143,164,255,0.25)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}><Icon name="sparkle" size={13} color="#c9d3ff" /><Text style={{ color: '#c9d3ff', fontSize: 11.5, fontWeight: '800' }}>{tl('Theia')}</Text></View> : null}
      </View>

      {!pres ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, paddingBottom: 190 }}>{people.map(tile)}</ScrollView> : <View style={{ flex: 1 }} />}

      {theiaOn ? (
        <View style={{ position: 'absolute', start: 10, end: 10, bottom: insets.bottom + 152, backgroundColor: 'rgba(8,10,16,0.85)', borderRadius: 16, padding: 10, gap: 4 }}>
          <Row gap={6} style={{ justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Icon name="sparkle" size={14} color="#c9d3ff" />
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 }}>{tr.listening ? tl('Theia ascolta e prende appunti') : mine === false ? tl('La tua voce non viene trascritta') : tl('Theia prende appunti')}</Text>
            </View>
            <Text onPress={() => setNotesOpen(true)} style={{ color: '#8fa4ff', fontSize: 13, fontWeight: '800' }}>{tl('Appunti')} ({live.decisions.length + live.actions.length + live.questions.length})</Text>
          </Row>
          {tr.problem ? <Text style={{ color: '#ffd166', fontSize: 11.5 }}>{tr.problem}</Text> : null}
          {transcript.slice(-2).map((l, i) => <Text key={i} numberOfLines={2} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5 }}><Text style={{ fontWeight: '800' }}>{l.speaker === me ? tl('Tu') : l.speaker}: </Text>{l.text}</Text>)}
          {tr.partial ? <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontStyle: 'italic' }}>{tr.partial}</Text> : null}
          {demo ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>{tl('Demo: le frasi degli altri sono simulate.')}</Text> : null}
        </View>
      ) : null}

      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 18, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 10 }}>
        <RoundBtn icon="mic" label={micOff ? 'Riattiva il microfono' : 'Silenzia il microfono'} slash={micOff} onPress={() => setMicOff((v) => !v)} size={50} />
        {call.video ? <RoundBtn icon="video" label={camOff ? 'Accendi la fotocamera' : 'Spegni la fotocamera'} slash={camOff} onPress={() => setCamOff((v) => !v)} size={50} /> : null}
        {call.video ? <RoundBtn icon="repeat" label="Cambia fotocamera" onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} size={50} /> : null}
        <RoundBtn icon="share" label="Condividi un file" on={!!pres} onPress={() => (pres ? setPres(null) : setShareOpen(true))} size={50} />
        <RoundBtn icon="sparkle" label={theiaOn ? 'Disattiva gli appunti di Theia' : 'Attiva gli appunti di Theia'} on={theiaOn} onPress={() => toggleTheia(!theiaOn)} size={50} />
        <RoundBtn icon="plus" label="Aggiungi persone" onPress={() => setAddOpen(true)} size={50} />
        <RoundBtn icon="phone" label="Esci dalla chiamata" danger onPress={confirmEnd} size={54} />
      </View>

      <Sheet visible={addOpen} title="Aggiungi alla chiamata" onClose={() => setAddOpen(false)}>
        <Body small muted style={{ marginBottom: 6 }}>{call.restrictToGroup ? 'Questa call è del gruppo: puoi invitare solo le persone del gruppo che non hanno confermato.' : 'Puoi aggiungere chiunque, come su WhatsApp.'}</Body>
        {candidates.length === 0 ? <Body muted>Non c'è nessun altro da invitare.</Body> : candidates.map((n, i) => (
          <Item key={n} last={i === candidates.length - 1}>
            <Row gap={10}><UserAvatar name={n} size={36} /><Body bold style={{ flex: 1 }}>{n}</Body>
              <Btn small title="Invita" onPress={() => { const e = invite(chatId, mid, me, n); toast(e ?? tl('{0} è stato invitato', n)); }} /></Row>
          </Item>
        ))}
      </Sheet>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} onPick={(p) => { setPres(p); toast('Stai presentando: ' + p.name); }} by={me} />
      <Sheet visible={notesOpen} title="Appunti di Theia finora" onClose={() => setNotesOpen(false)}>
        {!hasNotes(live) ? <Body muted>Ancora niente di importante: parla e Theia segna decisioni, cose da fare e domande.</Body> : (
          <>
            {live.decisions.map((d, i) => <Body key={`d${i}`} small style={{ marginBottom: 4 }}>• {tl('Deciso')}: {d.text}</Body>)}
            {live.actions.map((a, i) => <Body key={`a${i}`} small style={{ marginBottom: 4 }}>• {tl('Da fare')}: {a.text} · {a.owner}{a.due ? ` · ${a.due}` : ''}</Body>)}
            {live.questions.map((q, i) => <Body key={`q${i}`} small style={{ marginBottom: 4 }}>• {tl('Domanda')}: {q.text}</Body>)}
          </>
        )}
        <Btn small ghost style={{ marginTop: 10 }} title={theiaOn ? 'Disattiva Theia' : 'Attiva Theia'} onPress={() => { setNotesOpen(false); toggleTheia(!theiaOn); }} />
      </Sheet>
    </View>
  );
}
