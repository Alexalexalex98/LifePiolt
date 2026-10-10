import { LinearGradient } from 'expo-linear-gradient';
import * as Network from 'expo-network';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/network';
import { CommentsOverlay, Composer, NoticeChip, PinnedBanner, ReactionButtons, ReactionsLayer, RoundBtn, TopBar } from '@/components/live/Overlay';
import { CommentActionsSheet, Lobby, PeopleSheet, PREVIEW_NOTE, QuestionsSheet, SummaryCard } from '@/components/live/Panels';
import { useLiveRoom } from '@/components/live/useLiveRoom';
import { HostCamera, ViewerStage } from '@/components/live/VideoSurface';
import { useNow } from '@/lib/enroll';
import { alertT } from '@/lib/alert';
import { goBack } from '@/lib/nav';
import { useOnline } from '@/lib/offline';
import { lockPortrait, unlockRotation } from '@/lib/orientation';
import {
  can, countdownLabel, liveKey, modeFor, networkAdvice, pinnedComment, roomTiming, startReminder, summarize,
  type LiveComment, type LiveKind, type LiveSummary, type Participant,
} from '@/lib/liveRoom';
import { useApp } from '@/store/app';
import { useLive } from '@/store/live';
import { toast } from '@/store/toast';
import { fmtHour } from '@/lib/when';
import { t as tr } from '@/i18n/core';

/** Tipo di rete (Wi-Fi / dati mobili) per il consiglio sui dati. Difensivo: se il modulo manca resta null. */
function useNetType(): string | null {
  const [type, setType] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const read = (s: { type?: unknown }) => { if (alive) setType(s?.type ? String(s.type) : null); };
    try {
      void Network.getNetworkStateAsync().then(read).catch(() => {});
      const sub = Network.addNetworkStateListener(read);
      return () => { alive = false; sub?.remove?.(); };
    } catch { return () => { alive = false; }; }
  }, []);
  return type;
}

/**
 * Stanza live a tutto schermo: solo video, commenti e reazioni in sovraimpressione.
 * Seminari = un relatore e tanti spettatori; servizi = videochiamata a due.
 * Il trasporto e' SIMULATO finche' non si collega un servizio di streaming (docs/live.md).
 */
export default function LiveRoom() {
  const p = useLocalSearchParams<{ kind?: string; ref?: string; title?: string; host?: string; start?: string; dur?: string; guest?: string }>();
  const kind: LiveKind = p.kind === 'service' ? 'service' : 'seminar';
  const mode = modeFor(kind);
  const ref = String(p.ref ?? '');
  const title = String(p.title ?? (kind === 'seminar' ? 'Seminario' : 'Servizio'));
  const hostName = String(p.host ?? '');
  const startsAt = Number(p.start) || Date.now();
  const durationMin = Number(p.dur) || 60;
  const meName = useApp((a) => a.account.name) || 'Tu';
  const demoMode = useApp((a) => a.demo);
  const role = hostName && hostName === meName ? 'host' : 'viewer';
  const guestName = String(p.guest ?? '') || 'Ospite';
  const key = liveKey(kind, ref);

  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = win.width > win.height;
  const sideInset = Math.max(insets.left, insets.right);
  const online = useOnline();
  const netType = useNetType();
  const advice = networkAdvice(netType, online);
  const clock = useNow(1000);
  const timing = roomTiming(startsAt, durationMin, clock);

  // rotazione libera solo qui: all'uscita si torna in verticale
  useEffect(() => { void unlockRotation(); return () => { void lockPortrait(); }; }, []);

  const room = useMemo(() => ({ id: key, title, host: hostName, kind, mode }), [key, title, hostName, kind, mode]);
  const me = useMemo(() => ({ id: 'me', name: meName, role: role as 'host' | 'viewer' }), [meName, role]);

  const [hostLive, setHostLive] = useState(false);
  const [exited, setExited] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [torch, setTorch] = useState(false);
  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [picked, setPicked] = useState<LiveComment | null>(null);

  // chi guarda entra da solo quando la diretta e' in corso; il relatore inizia con il pulsante
  const stage: 'lobby' | 'live' | 'ended' = summary || (role === 'viewer' && timing.phase === 'ended' && startedAt) ? 'ended' : role === 'host' ? (hostLive ? 'live' : 'lobby') : timing.phase === 'live' && (online || startedAt !== null) ? 'live' : 'lobby';
  const live = stage === 'live';
  const lr = useLiveRoom({ room, me, active: live && !exited, online });

  useEffect(() => { if (live && startedAt === null) setStartedAt(Date.now()); }, [live, startedAt]);

  const finalized = useRef(false);
  const finalize = useCallback(() => {
    if (finalized.current || startedAt === null) return null;
    const endedAt = Date.now();
    if (endedAt - startedAt < 15000) return null; // meno di 15 secondi: nessun riepilogo
    finalized.current = true;
    const s = summarize({ key, kind, title, host: hostName, role, startedAt, endedAt, peakViewers: lr.peak, comments: lr.comments, reactions: lr.reactionCount, demo: true });
    useLive.getState().addSummary(s);
    return s;
  }, [startedAt, key, kind, title, hostName, role, lr.peak, lr.comments, lr.reactionCount]);

  // la diretta finisce all'orario previsto (per chi guarda): mostro il riepilogo
  useEffect(() => {
    if (role === 'viewer' && live && timing.phase === 'ended') { const s = finalize(); if (s) setSummary(s); setExited(true); }
  }, [role, live, timing.phase, finalize]);
  useEffect(() => { if (lr.removed) { toast('Sei stato rimosso dalla diretta'); setExited(true); goBack(); } }, [lr.removed]);

  const leave = () => { finalize(); goBack(); };
  const closeLive = () => {
    if (!live) { goBack(); return; }
    if (role === 'host') {
      alertT(mode === 'call' ? 'Terminare la videochiamata?' : 'Terminare la diretta?', mode === 'call' ? 'La chiamata si chiude per entrambi.' : 'Gli spettatori vedranno che la diretta è finita. Salveremo un riepilogo.', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Termina', style: 'destructive', onPress: () => { lr.endRoom(); const s = finalize(); setHostLive(false); setExited(true); if (s) setSummary(s); else goBack(); } },
      ]);
    } else {
      alertT(mode === 'call' ? 'Uscire dalla videochiamata?' : 'Uscire dalla diretta?', 'Potrai rientrare finché la sessione è in corso.', [
        { text: 'Resta', style: 'cancel' },
        { text: 'Esci', style: 'destructive', onPress: leave },
      ]);
    }
  };

  const startNow = () => {
    if (!online) { toast('Serve una connessione internet'); return; }
    if (!can(role, 'startStop')) return;
    setStartedAt(null); finalized.current = false; setExited(false); setHostLive(true);
  };

  const questions = useMemo(() => lr.comments.filter((c) => c.kind === 'question'), [lr.comments]);
  const pinned = pinnedComment(lr.comments);
  const elapsed = startedAt ? lr.now - startedAt : 0;
  const personOf = (c: LiveComment): Participant | undefined => lr.people.find((x) => x.name === c.author);
  const confirmRemove = (person: Participant) => alertT('Rimuovere dalla diretta?', tr('{0} non potrà più partecipare a questa diretta.', person.name), [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Rimuovi', style: 'destructive', onPress: () => { lr.remove(person.id); toast(tr('{0} rimosso dalla diretta', person.name)); } },
  ]);
  const toggleMute = (person: Participant) => { lr.mute(person.id, !person.muted); toast(person.muted ? tr('{0} può di nuovo commentare', person.name) : tr('{0} silenziato', person.name)); };

  const muted = personOf({ author: meName } as LiveComment)?.muted ?? false;
  const canWrite = online && can(role, 'comment', { muted });
  const isCall = mode === 'call';
  const bigName = isCall ? (role === 'host' ? guestName : hostName || 'Ospite') : hostName || 'Relatore';

  /* ---------- livello video ---------- */
  const showSelfBig = role === 'host' && (!isCall || stage !== 'live') && stage !== 'ended';
  const cameraBig = showSelfBig || (isCall && stage === 'lobby');
  const video = stage === 'ended' && !summary ? <View style={{ flex: 1, backgroundColor: '#0b0e14' }} />
    : cameraBig ? <HostCamera facing={facing} torch={torch} camOff={camOff} needMic={false} />
    : <ViewerStage host={bigName} label={isCall ? 'Anteprima della videochiamata' : 'Anteprima della diretta'} />;

  const selfTile = isCall && stage === 'live' ? (
    <View style={{ position: 'absolute', top: insets.top + 118, end: sideInset + 12, width: landscape ? 124 : 96, height: landscape ? 92 : 128, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: '#000' }}>
      <HostCamera facing={facing} torch={torch} camOff={camOff} needMic={false} small />
    </View>
  ) : null;

  /* ---------- lobby ---------- */
  const reminder = startReminder(startsAt, clock);
  let lobby: React.ReactNode = null;
  if (stage === 'lobby') {
    if (role === 'host') {
      const early = timing.phase === 'upcoming';
      const over = timing.phase === 'ended';
      lobby = (
        <Lobby
          title={isCall ? 'Videochiamata pronta' : 'Sei pronto?'}
          subtitle={over ? 'L\'orario previsto è passato: puoi comunque aprire la stanza per i partecipanti già collegati.' : early ? `Si apre ${countdownLabel(timing.msToOpen)} (alle ${fmtHour(startsAt - 10 * 60000)}). Intanto controlla la tua immagine.${demoMode ? ' In modalità demo puoi iniziare subito.' : ''}` : isCall ? 'Controlla fotocamera e microfono, poi avvia la chiamata.' : 'Controlla l\'inquadratura e il microfono, poi inizia la diretta.'}
          hint={reminder}
          advice={advice}
          primary={{ label: isCall ? 'Avvia la videochiamata' : 'Inizia la diretta', icon: 'play', onPress: startNow, disabled: (early && !demoMode) || !online }}
        />
      );
    } else if (timing.phase === 'ended') {
      lobby = <Lobby title="Sessione terminata" subtitle="Questa diretta è già finita." advice={null} primary={{ label: 'Indietro', onPress: goBack }} />;
    } else {
      const waiting = timing.phase === 'waiting' || timing.phase === 'live';
      lobby = (
        <Lobby
          title={waiting ? 'Sala d\'attesa' : 'Non ancora aperta'}
          subtitle={timing.phase === 'live' ? 'La sessione è in corso: serve una connessione internet per entrare.' : waiting ? `${isCall ? 'La videochiamata' : 'La diretta'} inizia ${countdownLabel(timing.msToStart)}, alle ${fmtHour(startsAt)}. Entrerai da solo all'orario.` : `La stanza si apre 10 minuti prima: ${countdownLabel(timing.msToOpen)}.`}
          hint={reminder}
          advice={advice}
          secondary={{ label: 'Esci dalla sala', onPress: goBack }}
        >
          {waiting ? <UserAvatar name={bigName} size={64} /> : null}
        </Lobby>
      );
    }
  }

  /* ---------- controlli ---------- */
  const hostBtns = (
    <>
      <RoundBtn icon="repeat" label={facing === 'front' ? 'Passa alla fotocamera posteriore' : 'Passa alla fotocamera frontale'} onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} />
      <RoundBtn icon="sparkle" label={torch ? 'Spegni il flash' : 'Accendi il flash'} on={torch} onPress={() => (facing === 'back' ? setTorch((v) => !v) : toast('Il flash funziona con la fotocamera posteriore'))} />
      <RoundBtn icon="mic" label={micOff ? 'Riattiva il microfono' : 'Silenzia il microfono'} slash={micOff} onPress={() => setMicOff((v) => !v)} />
      <RoundBtn icon="video" label={camOff ? 'Accendi la fotocamera' : 'Spegni la fotocamera'} slash={camOff} onPress={() => setCamOff((v) => !v)} />
    </>
  );

  const controlsCol = (
    <View style={{ gap: 8, alignItems: 'center', maxHeight: Math.max(120, win.height - insets.top - insets.bottom - 150), flexWrap: 'wrap-reverse' }}>
      {role === 'host' ? (
        <>
          {!isCall && <RoundBtn icon="users" label="Partecipanti" onPress={() => setPeopleOpen(true)} />}
          {!isCall && <RoundBtn icon="info" label={`Domande: ${questions.length}`} on={questions.length > 0} onPress={() => setQuestionsOpen(true)} />}
          {hostBtns}
        </>
      ) : (
        <>
          <ReactionButtons onReact={lr.react} disabled={!online} />
          <RoundBtn icon="contact" label={lr.handUp ? 'Abbassa la mano' : 'Alza la mano'} on={lr.handUp} onPress={lr.toggleHand} />
        </>
      )}
    </View>
  );

  const callBar = (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 18, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 14, alignItems: 'center' }}>
      <RoundBtn icon="mic" label={micOff ? 'Riattiva il microfono' : 'Silenzia il microfono'} slash={micOff} onPress={() => setMicOff((v) => !v)} size={54} />
      <RoundBtn icon="video" label={camOff ? 'Accendi la fotocamera' : 'Spegni la fotocamera'} slash={camOff} onPress={() => setCamOff((v) => !v)} size={54} />
      <RoundBtn icon="repeat" label="Cambia fotocamera" onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} size={54} />
      <RoundBtn icon="phone" label="Termina la chiamata" danger onPress={closeLive} size={54} />
    </View>
  );

  const hostEnd = role === 'host' && !isCall ? <RoundBtn icon="x" label="Termina la diretta" danger onPress={closeLive} size={46} /> : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>{video}</View>
      {selfTile}

      {stage !== 'ended' && (
        <TopBar
          title={title}
          host={isCall ? (role === 'host' ? `Con ${guestName}` : `Con ${hostName}`) : hostName}
          live={live}
          elapsedMs={elapsed}
          viewers={live && !isCall ? lr.viewers : null}
          onClose={closeLive}
          closeLabel={live ? (role === 'host' ? 'Termina la diretta' : 'Esci dalla diretta') : 'Chiudi'}
          topInset={insets.top}
          sideInset={sideInset}
        />
      )}

      {live && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 96, start: sideInset + 12, end: sideInset + 12, gap: 6, alignItems: 'flex-start' }}>
          <NoticeChip icon="info" text={PREVIEW_NOTE} />
          {!online ? <NoticeChip icon="alert" tone="bad" text="Serve una connessione internet" /> : lr.net === 'reconnecting' ? <NoticeChip icon="alert" tone="warn" text="Riconnessione in corso" /> : advice.level === 'warn' ? <NoticeChip icon="alert" tone="warn" text="Dati mobili: la diretta consuma molti dati" /> : null}
          {pinned && !isCall ? <PinnedBanner c={pinned} onUnpin={role === 'host' ? () => lr.pin(null) : undefined} /> : null}
        </View>
      )}

      {live && isCall && callBar}

      {live && !isCall && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, start: 0, end: 0 }}>
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', bottom: 0, start: 0, end: 0, height: landscape ? 190 : 330 }} />
          <ReactionsLayer reactions={lr.reactions} onDone={lr.dismissReaction} style={{ position: 'absolute', end: sideInset + 20, bottom: 70, width: 90, height: landscape ? 220 : 320 }} />
          <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', paddingStart: sideInset + 12, paddingEnd: sideInset + 12, gap: 10 }}>
            <CommentsOverlay
              comments={lr.comments}
              now={lr.now}
              onPickComment={role === 'host' ? (c) => { if (c.kind !== 'system') setPicked(c); } : undefined}
              style={{ flex: 1, maxWidth: landscape ? '46%' : '78%', maxHeight: landscape ? 140 : 260 }}
            />
            <View style={{ flex: landscape ? 1 : 0 }} pointerEvents="none" />
            {controlsCol}
          </View>
          <Composer
            onSend={(text, q) => { if (!lr.sendComment(text, q ? 'question' : 'comment')) toast('Non riesco a inviare il commento'); }}
            canWrite={canWrite}
            blockedReason={!online ? 'Serve una connessione internet' : muted ? 'L\'organizzatore ti ha silenziato' : undefined}
            allowQuestion={role === 'viewer'}
            bottomInset={insets.bottom}
            sideInset={sideInset}
            right={hostEnd}
          />
        </KeyboardAvoidingView>
      )}

      {lobby}
      {stage === 'ended' && summary ? <SummaryCard s={summary} onClose={goBack} /> : null}
      {stage === 'ended' && !summary ? <Lobby title="Diretta conclusa" subtitle="Questa sessione è terminata." advice={null} primary={{ label: 'Indietro', onPress: goBack }} /> : null}

      <PeopleSheet visible={peopleOpen} onClose={() => setPeopleOpen(false)} people={lr.people} onMute={toggleMute} onRemove={confirmRemove} />
      <QuestionsSheet visible={questionsOpen} onClose={() => setQuestionsOpen(false)} questions={questions} pinnedId={pinned?.id ?? null} onPin={(c) => { lr.pin(pinned?.id === c.id ? null : c.id); setQuestionsOpen(false); }} />
      <CommentActionsSheet
        comment={picked}
        pinned={!!picked && pinned?.id === picked.id}
        onClose={() => setPicked(null)}
        onPin={() => { if (picked) lr.pin(pinned?.id === picked.id ? null : picked.id); setPicked(null); }}
        onMute={() => { const pe = picked && personOf(picked); if (pe) toggleMute(pe); setPicked(null); }}
        onRemove={() => { const pe = picked && personOf(picked); setPicked(null); if (pe) confirmRemove(pe); }}
      />
    </View>
  );
}
