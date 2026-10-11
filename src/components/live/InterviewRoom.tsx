import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeChip, RoundBtn, TopBar } from '@/components/live/Overlay';
import { Lobby } from '@/components/live/Panels';
import { HostCamera, ViewerStage } from '@/components/live/VideoSurface';
import { alertT } from '@/lib/alert';
import { useNow } from '@/lib/enroll';
import { callWindow, canCall, contactText, displayName } from '@/lib/interview';
import { answerIncoming, callCandidate, cancelCallNow, isDemo, rejectIncoming } from '@/lib/interviewActions';
import { goBack } from '@/lib/nav';
import { clockLabel } from '@/lib/liveRoom';
import { useOnline } from '@/lib/offline';
import { fmtHour } from '@/lib/when';
import { useApp } from '@/store/app';
import { useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';
import { t as tr } from '@/i18n/core';

/**
 * Stanza del colloquio (1-a-1). Chiama SEMPRE l'azienda; il candidato vede "chiamata in arrivo" e il contatto si sblocca
 * solo quando risponde (store/jobs: answerCall). La trasmissione e' un'anteprima finche' non c'e' il server.
 */
export function InterviewRoom({ appId, title }: { appId: string; title: string }) {
  const insets = useSafeAreaInsets();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === appId));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  const online = useOnline();
  const now = useNow(1000);
  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  useEffect(() => { useJobs.getState().settleInterviews(now); }, [now]);
  if (!app || !job || !app.iv) return <View style={{ flex: 1, backgroundColor: '#000' }}><Lobby title="Colloquio non trovato" subtitle="Questa stanza non esiste più." advice={null} primary={{ label: 'Indietro', onPress: goBack }} /></View>;

  const iv = app.iv;
  const isCompany = job.owner === me;
  if (!isCompany && app.candidate !== me) return <View style={{ flex: 1, backgroundColor: '#000' }}><Lobby title="Stanza riservata" subtitle="Questo colloquio non è tuo." advice={null} primary={{ label: 'Indietro', onPress: goBack }} /></View>;
  const other = isCompany ? displayName(app.candidate) : job.company;
  const demo = isDemo();
  const w = iv.chosen ? callWindow(iv.chosen) : null;
  const can = canCall(iv, now);
  const live = iv.stage === 'connected';
  const note = <NoticeChip icon="info" text="Videochiamata: anteprima, la trasmissione reale si attiva col server" />;

  const end = () => alertT('Terminare la videochiamata?', 'La chiamata si chiude per entrambi.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Termina', style: 'destructive', onPress: () => { toast(isCompany ? 'Colloquio concluso: scrivi l’esito dalla scheda del candidato' : 'Colloquio concluso'); goBack(); } },
  ]);

  let lobby: React.ReactNode = null;
  if (!live) {
    if (iv.stage === 'calling') {
      lobby = isCompany ? (
        <Lobby title={tr('Sto chiamando {0}…', other)} subtitle="Squilla per 45 secondi. Il contatto si sblocca solo se risponde." advice={null} primary={demo ? { label: 'Anteprima: risponde', icon: 'phone', onPress: () => answerIncoming(appId) } : undefined} secondary={{ label: 'Annulla la chiamata', onPress: () => { cancelCallNow(appId); } }}>
          {demo ? <NoticeChip icon="info" text="Anteprima: il candidato è un utente demo" /> : null}
        </Lobby>
      ) : (
        <Lobby title="Chiamata in arrivo" subtitle={tr('{0} ti chiama per il colloquio “{1}”. Se rispondi condividi: {2}.', job.company, title, contactText(iv.share.fullName || iv.share.email || iv.share.phone ? { fullName: iv.share.fullName ? me : undefined, email: iv.share.email || undefined, phone: iv.share.phone || undefined } : {}))} advice={null} primary={{ label: 'Rispondi', icon: 'phone', onPress: () => { if (!answerIncoming(appId)) toast('La chiamata non è più attiva'); } }} secondary={{ label: 'Rifiuta', onPress: () => { rejectIncoming(appId); toast('Chiamata rifiutata: nessun dato condiviso'); } }} />
      );
    } else if (isCompany && (iv.stage === 'accepted' || iv.stage === 'missed')) {
      lobby = (
        <Lobby
          title={iv.stage === 'missed' ? 'Nessuna risposta' : 'Colloquio pronto'}
          subtitle={can.ok ? tr('Chiama {0} quando sei pronto. Nessun contatto è condiviso finché non risponde.', other) : can.reason === 'too_early' && w ? tr('Potrai chiamare dalle {0}.', fmtHour(w.opens)) : 'Il tempo per chiamare è finito.'}
          advice={null}
          primary={{ label: iv.stage === 'missed' ? tr('Richiama {0}', other) : tr('Chiama {0}', other), icon: 'phone', disabled: !can.ok || !online, onPress: () => { if (!callCandidate(appId)) toast('Non è ancora il momento di chiamare'); } }}
          secondary={{ label: 'Esci', onPress: goBack }}
        >{note}</Lobby>
      );
    } else if (iv.stage === 'accepted' || iv.stage === 'missed') {
      lobby = <Lobby title="Sala d’attesa" subtitle={tr('{0} ti chiamerà all’ora fissata{1}. Resta qui o torna alla candidatura: riceverai “chiamata in arrivo”.', job.company, w ? tr(' (da {0})', fmtHour(w.opens)) : '')} advice={null} secondary={{ label: 'Esci dalla sala', onPress: goBack }}>{note}</Lobby>;
    } else if (iv.stage === 'not_held') {
      lobby = <Lobby title="Colloquio non avvenuto" subtitle="La chiamata non è stata risposta in tempo. Nessun contatto è stato sbloccato." advice={null} primary={{ label: 'Indietro', onPress: goBack }} />;
    } else if (iv.stage === 'done') {
      lobby = <Lobby title="Colloquio concluso" subtitle="Grazie. L’esito è nella scheda della candidatura." advice={null} primary={{ label: 'Indietro', onPress: goBack }} />;
    } else {
      lobby = <Lobby title="Colloquio non ancora fissato" subtitle="La videochiamata si apre dopo che il candidato ha accettato l’invito." advice={null} primary={{ label: 'Indietro', onPress: goBack }} />;
    }
  }

  const elapsed = iv.unlockedAt ? now - iv.unlockedAt : 0;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
        {live ? <ViewerStage host={other} label="Anteprima della videochiamata" /> : <HostCamera facing={facing} torch={false} camOff={camOff} needMic={false} />}
      </View>
      {live && (
        <View style={{ position: 'absolute', top: insets.top + 150, end: 12, width: 96, height: 128, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: '#000' }}>
          <HostCamera facing={facing} torch={false} camOff={camOff} needMic={false} small />
        </View>
      )}
      <TopBar title={title} host={tr('Con {0}', other)} live={live} elapsedMs={elapsed} viewers={null} onClose={live ? end : goBack} closeLabel={live ? 'Termina la chiamata' : 'Chiudi'} topInset={insets.top} sideInset={0} />
      {live && (
        <>
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 96, start: 12, end: 12, gap: 6, alignItems: 'flex-start' }}>
            {note}
            <NoticeChip icon="lock" text={tr('Contatto sbloccato · {0}', clockLabel(elapsed))} />
          </View>
          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 18, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
            <RoundBtn icon="mic" label={micOff ? 'Riattiva il microfono' : 'Silenzia il microfono'} slash={micOff} onPress={() => setMicOff((v) => !v)} size={54} />
            <RoundBtn icon="video" label={camOff ? 'Accendi la fotocamera' : 'Spegni la fotocamera'} slash={camOff} onPress={() => setCamOff((v) => !v)} size={54} />
            <RoundBtn icon="repeat" label="Cambia fotocamera" onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} size={54} />
            <RoundBtn icon="phone" label="Termina la chiamata" danger onPress={end} size={54} />
          </View>
        </>
      )}
      {lobby}
    </View>
  );
}
