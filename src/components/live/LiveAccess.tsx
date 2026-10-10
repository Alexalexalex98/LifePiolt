import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/network';
import { Body, Btn, Card, H, Pill, Row } from '@/components/ui';
import { SummaryRow } from '@/components/live/Panels';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { useNow } from '@/lib/enroll';
import { go } from '@/lib/nav';
import { useOnline } from '@/lib/offline';
import { countdownLabel, liveKey, networkAdvice, resolveOnline, roomTiming, startReminder, type LiveKind } from '@/lib/liveRoom';
import { fmtHour } from '@/lib/when';
import { useLive } from '@/store/live';
import { t as tr } from '@/i18n/core';

function useNetType(): string | null {
  const [type, setType] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    try { void Network.getNetworkStateAsync().then((s) => { if (alive) setType(s?.type ? String(s.type) : null); }).catch(() => {}); } catch { /* modulo non disponibile */ }
    return () => { alive = false; };
  }, []);
  return type;
}

/**
 * Blocco "Diretta online" delle pagine seminario e servizio: modalita' (in presenza/online) per chi organizza,
 * pulsante per entrare (da 10 minuti prima fino alla fine), consiglio sulla rete e riepiloghi salvati.
 */
export function LiveAccess({ kind, refId, title, host, dataMode, startsAt, durationMin, isHost, enrolled, guest }: {
  kind: LiveKind; refId: string; title: string; host: string; dataMode: string | null | undefined; startsAt: number | null; durationMin: number; isHost: boolean; enrolled: boolean; guest?: string;
}) {
  const t = useTheme();
  const key = liveKey(kind, refId);
  const override = useLive((s) => s.online[key]);
  const setOnline = useLive((s) => s.setOnline);
  const all = useLive((s) => s.summaries);
  const summaries = all.filter((s) => s.key === key);
  const online = resolveOnline(override, dataMode);
  const net = useOnline();
  const netType = useNetType();
  const now = useNow(5000);
  const noun = kind === 'seminar' ? 'seminario' : 'sessione';
  const timing = startsAt ? roomTiming(startsAt, durationMin, now) : null;
  const advice = networkAdvice(netType, net);

  const open = () => {
    if (!startsAt) return;
    go('liveRoom', { kind, ref: refId, title, host, start: String(startsAt), dur: String(durationMin), ...(guest ? { guest } : null) });
  };

  const remove = (id: string) => {
    const s = useLive.getState().summaries.find((x) => x.id === id);
    if (!s) return;
    confirmDelete('questo riepilogo della diretta', () => useLive.getState().removeSummary(id), () => useLive.getState().restoreSummary(s));
  };

  const mode = (
    isHost ? (
      <View style={{ marginBottom: 10 }}>
        <Body small muted style={{ marginBottom: 6 }}>Scegli come si svolge questo {noun}. Se è online, chi è iscritto entra dalla stanza live dell&apos;app.</Body>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>
          <Pill label="In presenza" icon="location" on={!online} onPress={() => setOnline(key, false)} />
          <Pill label="Online" icon="video" on={online} onPress={() => setOnline(key, true)} />
        </Row>
      </View>
    ) : null
  );

  if (!online && !isHost) return summaries.length ? <SummariesCard summaries={summaries} remove={remove} /> : null;

  let body: React.ReactNode = null;
  let badge: React.ReactNode = null;
  if (online) {
    if (!isHost && !enrolled) {
      body = <Body small muted>La diretta è riservata a chi è iscritto: {kind === 'seminar' ? 'iscriviti per entrare nella stanza' : 'prenota uno slot per entrare nella videochiamata'}.</Body>;
    } else if (!startsAt || !timing) {
      body = <Body small muted>La data non è ancora stata indicata: la stanza si apre 10 minuti prima dell&apos;inizio.</Body>;
    } else if (timing.phase === 'ended') {
      badge = <Badge label="Terminata" color="#8e98a8" />;
      body = <Body small muted>La diretta è terminata.</Body>;
    } else if (isHost) {
      badge = <Badge label={timing.phase === 'live' ? 'In corso' : timing.phase === 'waiting' ? 'Sala aperta' : 'Non ancora iniziata'} color={timing.phase === 'live' ? '#ff5d7a' : '#8fa4ff'} />;
      body = (
        <>
          <Body small muted style={{ marginBottom: 8 }}>{timing.phase === 'upcoming' ? `Inizia ${countdownLabel(timing.msToStart)}, alle ${fmtHour(startsAt)}. Puoi aprire la stanza per controllare fotocamera e microfono.` : 'La stanza è aperta: controlla l\'inquadratura e inizia quando sei pronto.'}</Body>
          <Btn icon="video" title="Apri la stanza" onPress={open} />
        </>
      );
    } else {
      const rem = startReminder(startsAt, now);
      badge = <Badge label={timing.phase === 'live' ? 'In corso' : timing.phase === 'waiting' ? 'Sta per iniziare' : 'Non ancora iniziata'} color={timing.phase === 'live' ? '#ff5d7a' : timing.phase === 'waiting' ? '#e0a64a' : '#8fa4ff'} />;
      body = (
        <>
          <Body small muted style={{ marginBottom: 8 }}>
            {timing.phase === 'upcoming' ? `Inizia ${countdownLabel(timing.msToStart)}, alle ${fmtHour(startsAt)}. Il pulsante si attiva 10 minuti prima (${countdownLabel(timing.msToOpen)}).` : timing.phase === 'waiting' ? `${rem ?? 'Sta per iniziare'}: entra nella sala d'attesa.` : 'È in corso: entra adesso.'}
          </Body>
          <Btn icon="video" title="Entra nella diretta" disabled={!timing.canEnter || !net} onPress={open} />
          {!net && timing.canEnter ? <Body small color={t.danger} style={{ marginTop: 6 }}>Serve una connessione internet</Body> : null}
        </>
      );
    }
  }

  return (
    <>
      <Card>
        <Row style={{ alignItems: 'center' }}>
          <H style={{ marginBottom: 0 }}>Diretta online</H>
          {badge}
        </Row>
        <View style={{ height: 8 }} />
        {mode}
        {online ? body : <Body small muted>Questo {noun} è in presenza: non c&apos;è una stanza online.</Body>}
        {online && (
          <Body small color={advice.level === 'ok' ? undefined : advice.level === 'warn' ? t.warn : t.danger} muted={advice.level === 'ok'} style={{ marginTop: 10 }}>
            {advice.text}
          </Body>
        )}
        {online && <Body small muted style={{ marginTop: 6 }}>{tr('Anteprima: la diretta tra telefoni si attiva collegando il servizio di streaming')}</Body>}
      </Card>
      {summaries.length > 0 && <SummariesCard summaries={summaries} remove={remove} />}
    </>
  );
}

function SummariesCard({ summaries, remove }: { summaries: ReturnType<typeof useLive.getState>['summaries']; remove: (id: string) => void }) {
  return (
    <Card>
      <H>Riepiloghi delle dirette</H>
      {summaries.map((s, i) => <SummaryRow key={s.id} s={s} last={i === summaries.length - 1} onDelete={() => remove(s.id)} />)}
    </Card>
  );
}
