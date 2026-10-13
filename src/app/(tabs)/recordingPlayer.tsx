import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';

import { useRecordingCtx } from '@/components/live/RecordingsSection';
import { Body, Btn, Page } from '@/components/ui';
import { canWatch, lockedReason, ACCESS_LABEL, type LiveRecording } from '@/lib/recordings';
import { goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useLive } from '@/store/live';
import { clockLabel } from '@/lib/liveRoom';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 560, borderRadius: 16, backgroundColor: '#000' }} nativeControls contentFit="contain" />;
}

function Inner({ rec }: { rec: LiveRecording }) {
  const me = useApp((s) => s.account.name);
  const ctx = useRecordingCtx(rec);
  if (!canWatch(rec, ctx)) return <Body muted>{tl(lockedReason(rec) ?? 'Non disponibile')}</Body>;
  return (
    <View style={{ gap: 12 }}>
      {rec.uri ? <Player uri={rec.uri} /> : <Body muted>Questa registrazione è un segnaposto: il video vero si registra con la fotocamera del telefono quando si fa una diretta dall&apos;app.</Body>}
      <Body small muted>{`${clockLabel(rec.durationMs)} · ${tl('di {0}', rec.host)}`}</Body>
      {rec.host === me ? (
        <>
          <Body small muted>{`${tl('Visibile a')}: ${tl(ACCESS_LABEL[rec.access])}`}</Body>
          <Btn small ghost icon="trash" title="Elimina la registrazione" onPress={() => confirmDelete('questa registrazione', () => { useLive.getState().removeRecording(rec.id); goBack(); })} />
        </>
      ) : null}
    </View>
  );
}

/** Rivedere una registrazione: solo chi può (chi l'ha tenuta, chi ha pagato, iscritti al LifeClub in cui è salvata). */
export default function RecordingPlayer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rec = useLive((s) => (s.recordings ?? []).find((r) => r.id === id));
  return (
    <Page id="recordingPlayer" back title={rec?.title ?? 'Registrazione'}>
      {rec ? <Inner rec={rec} /> : <Body muted>Questa registrazione non c&apos;è più.</Body>}
    </Page>
  );
}
