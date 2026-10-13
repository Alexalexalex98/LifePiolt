import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
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
import { RecBanner } from '@/components/call/RecBanner';
import { DuoCall } from '@/components/call/DuoCall';
import { ReactionsLayer } from '@/components/live/Overlay';
import { REACTIONS, type LiveReaction, type ReactionKind } from '@/lib/liveRoom';
import { applyJoinPresence, endForAll, everyone, invite, leave, muteBy, raiseHand, removeBy, sendCallChat } from '@/lib/callActions';
import { buildNotes, hasNotes, type TLine } from '@/lib/callNotes';
import { canEnter, inviteCandidates, isHost, isInvolved, peopleOf, phase } from '@/lib/groupCall';
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
  const [speaker, setSpeaker] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [reactOpen, setReactOpen] = useState(false);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [giveUp, setGiveUp] = useState(false);

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
    useChat.getState().patchMsg(chatId, mid, { callRecord: { ...msg.callRecord, theia: on, theiaBy: on ? me : undefined, theiaAt: on ? Date.now() : undefined } });
    useChat.getState().receive(chatId, 'system', { kind: 'system', text: on ? tl('{0} ha attivato Theia: prende appunti della call', me) : tl('{0} ha disattivato gli appunti di Theia', me) });
    if (on) askConsent();
  };
  const sawRec = useRef(theiaOn);
  useEffect(() => {
    if (theiaOn && !sawRec.current && rec?.theiaBy && rec.theiaBy !== me) toast(tl('{0} ha attivato Theia: la call è registrata per gli appunti', rec.theiaBy));
    sawRec.current = theiaOn;
  }, [theiaOn]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const candidatesAll = call ? inviteCandidates(call, chat?.members ?? [], everyone(me)) : [];
  const host = !!call && isHost(call, me);
  const forcedMute = !!call?.muted?.includes(me);
  const handUp = !!call?.hands?.includes(me);
  // chiamata a due (una chat singola, nessun altro aggiunto): schermata come WhatsApp; con una terza persona diventa una griglia
  const other = chat?.type === 'dm' ? chat.name : null;
  const duo = !!call && call.kind === 'instant' && !!other && call.invited.filter((n) => n !== me).length <= 1 && call.joined.filter((n) => n !== me && n !== other).length === 0 && (call.by === me || call.by === other);
  const otherIn = !!other && !!call?.joined.includes(other);
  useEffect(() => { if (!duo || otherIn || demo) return; const h = setTimeout(() => setGiveUp(true), 45000); return () => clearTimeout(h); }, [duo, otherIn, demo]);
  useEffect(() => { if (otherIn) setGiveUp(false); }, [otherIn]);
  useEffect(() => { if (forcedMute) setMicOff(true); }, [forcedMute]);

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

  const addSheets = (
    <Sheet visible={addOpen} title="Aggiungi alla chiamata" onClose={() => setAddOpen(false)}>
      <Body small muted style={{ marginBottom: 6 }}>{call.restrictToGroup ? 'Questa call è del gruppo: puoi invitare solo le persone del gruppo che non hanno confermato.' : 'Puoi aggiungere chiunque, come su WhatsApp.'}</Body>
      {candidatesAll.length === 0 ? <Body muted>Non c'è nessun altro da invitare.</Body> : candidatesAll.map((n, i) => (
        <Item key={n} last={i === candidatesAll.length - 1}>
          <Row gap={10}><UserAvatar name={n} size={36} /><Body bold style={{ flex: 1 }}>{n}</Body>
            <Btn small title="Invita" onPress={() => { const e = invite(chatId, mid, me, n); toast(e ?? tl('{0} è stato invitato', n)); if (!e) setAddOpen(false); }} /></Row>
        </Item>
      ))}
    </Sheet>
  );
  if (duo && other) {
    return (
      <>
        <DuoCall other={other} me={me} video={call.video} state={otherIn ? 'connected' : giveUp ? 'noanswer' : 'ringing'} elapsedMs={Math.max(0, now - joinedAt.current)}
          micOff={micOff} camOff={camOff} speaker={speaker} facing={facing}
          theiaOn={theiaOn} theiaBy={rec?.theiaBy} onTheia={() => toggleTheia(!theiaOn)}
          onMic={() => setMicOff((v) => !v)} onCam={() => setCamOff((v) => !v)} onSpeaker={() => setSpeaker((v) => !v)} onFlip={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          onAdd={() => setAddOpen(true)} onEnd={() => finish(false)} onShare={() => setShareOpen(true)} onRetry={() => { setGiveUp(false); joinedAt.current = Date.now(); }} />
        {addSheets}
      </>
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
          {(n === me && micOff) || call.muted?.includes(n) ? <Icon name="mic" size={12} color="#ff6b6b" /> : null}
          {call.hands?.includes(n) ? <Icon name="contact" size={12} color="#ffd166" /> : null}
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{n === me ? tl('Tu') : n}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {pres ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}><Presenter pres={pres} isHost={pres.by === me} onStop={() => setPres(null)} topInset={insets.top - 40} /></View> : null}
      {theiaOn ? <RecBanner by={rec?.theiaBy} me={me} top={insets.top + 6} /> : null}
      <View style={{ paddingTop: insets.top + (theiaOn ? 62 : 8), paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{call.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{clockLabel(Math.max(0, now - joinedAt.current))} · {tl('{0} nella stanza', call.joined.length)}</Text>
        </View>
      </View>

      {!pres ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, paddingBottom: 200 }}>{people.map(tile)}</ScrollView> : <View style={{ flex: 1 }} />}

      {theiaOn ? (
        <View style={{ position: 'absolute', start: 10, end: 10, bottom: insets.bottom + 108, backgroundColor: 'rgba(8,10,16,0.85)', borderRadius: 16, padding: 10, gap: 4 }}>
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

      <ReactionsLayer reactions={reactions} onDone={(id) => setReactions((l) => l.filter((r) => r.id !== id))} style={{ position: 'absolute', end: 14, bottom: insets.bottom + 200, width: 90, height: 280 }} />
      {reactOpen ? (
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: insets.bottom + 140, flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          {REACTIONS.map((r) => <RoundBtn key={r.kind} icon={r.icon} label={r.label} color={r.color} size={46} onPress={() => { setReactions((l) => [...l, { id: `${Date.now()}${r.kind}`, kind: r.kind as ReactionKind, ts: Date.now(), from: me }].slice(-18)); setReactOpen(false); }} />)}
        </View>
      ) : null}
      <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, backgroundColor: 'rgba(8,10,16,0.92)', paddingTop: 8, paddingBottom: insets.bottom + 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6, alignItems: 'center' }}>
          {([
            [micOff ? 'mic' : 'mic', micOff ? 'Attiva' : 'Muto', micOff, forcedMute ? () => toast('L\'organizzatore ti ha silenziato') : () => setMicOff((v) => !v), true],
            ...(call.video ? [['video', camOff ? 'Accendi' : 'Video', camOff, () => setCamOff((v) => !v), true], ['repeat', 'Gira', false, () => setFacing((f) => (f === 'front' ? 'back' : 'front')), false]] : []),
            ['share', pres ? 'Smetti' : 'Condividi', !!pres, () => (pres ? setPres(null) : setShareOpen(true)), false],
            ['contact', handUp ? 'Abbassa' : 'Mano', handUp, () => raiseHand(chatId, mid, me, !handUp), false],
            ['smile', 'Reazioni', reactOpen, () => setReactOpen((v) => !v), false],
            ['comment', 'Chat', false, () => setChatOpen(true), false],
            ['users', 'Persone', false, () => setPeopleOpen(true), false],
            ['sparkle', 'Theia', theiaOn, () => toggleTheia(!theiaOn), false],
            ['plus', 'Aggiungi', false, () => setAddOpen(true), false],
          ] as [string, string, boolean, () => void, boolean][]).map(([ic, label, on, fn, slash]) => (
            <View key={label} style={{ alignItems: 'center', width: 62 }}>
              <RoundBtn icon={ic} label={label} on={on && !slash} slash={slash && on} onPress={fn} size={46} />
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10.5, marginTop: 3 }}>{tl(label)}</Text>
            </View>
          ))}
          <View style={{ alignItems: 'center', width: 70 }}>
            <RoundBtn icon="phone" label="Esci dalla chiamata" danger onPress={confirmEnd} size={50} />
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10.5, marginTop: 3 }}>{tl('Esci')}</Text>
          </View>
        </ScrollView>
      </View>

      {addSheets}
      <Sheet visible={peopleOpen} title={tl('Persone ({0})', peopleOf(call).length)} onClose={() => setPeopleOpen(false)}>
        {peopleOf(call).map((pp, i, arr) => (
          <Item key={pp.name} last={i === arr.length - 1}>
            <Row gap={10}>
              <UserAvatar name={pp.name} size={36} />
              <View style={{ flex: 1 }}>
                <Body bold>{pp.name === me ? `${pp.name} (${tl('tu')})` : pp.name}{pp.name === call.by ? ` · ${tl('organizza')}` : ''}</Body>
                <Body small muted>{pp.state === 'presente' ? tl('Nella stanza') : pp.state === 'confermato' ? tl('Ha confermato') : pp.state === 'invitato' ? tl('Invitato') : tl('Non può')}{call.hands?.includes(pp.name) ? ` · ${tl('mano alzata')}` : ''}{call.muted?.includes(pp.name) ? ` · ${tl('silenziato')}` : ''}</Body>
              </View>
              {host && pp.state === 'presente' && pp.name !== me ? (
                <>
                  <Btn small ghost title={call.muted?.includes(pp.name) ? 'Riattiva' : 'Silenzia'} onPress={() => muteBy(chatId, mid, me, pp.name, !call.muted?.includes(pp.name))} />
                  <Btn small ghost icon="x" title="" label="Rimuovi" onPress={() => alertT('Rimuovere dalla chiamata?', tl('{0} non potrà più entrare.', pp.name), [{ text: 'Annulla', style: 'cancel' }, { text: 'Rimuovi', style: 'destructive', onPress: () => removeBy(chatId, mid, me, pp.name) }])} />
                </>
              ) : null}
            </Row>
          </Item>
        ))}
      </Sheet>
      <Sheet visible={chatOpen} title="Chat della call" onClose={() => setChatOpen(false)}>
        {(rec?.chat ?? []).length === 0 ? <Body small muted>Nessun messaggio: quello che scrivi qui lo vedono solo i partecipanti della call.</Body> : (rec?.chat ?? []).map((m) => (
          <View key={m.id} style={{ marginBottom: 6 }}><Body small bold>{m.from === me ? tl('Tu') : m.from}</Body><Body small>{m.text}</Body></View>
        ))}
        <Row gap={8} style={{ marginTop: 8 }}>
          <TextInput value={chatText} onChangeText={setChatText} placeholder="Scrivi un messaggio" placeholderTextColor={t.muted} returnKeyType="send" onSubmitEditing={() => { sendCallChat(chatId, mid, me, chatText); setChatText(''); }} style={{ flex: 1, color: t.text, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }} />
          <Btn small icon="send" title="" label="Invia" onPress={() => { sendCallChat(chatId, mid, me, chatText); setChatText(''); }} />
        </Row>
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
