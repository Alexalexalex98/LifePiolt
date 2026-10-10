import { useLocalSearchParams } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { LiveAccess } from '@/components/live/LiveAccess';
import { EnrollmentBox, Price, datedSlots, modeLabel } from '@/components/market';
import { Badge, MediaBlock, ModButton, UserAvatar } from '@/components/network';
import { Body, Btn, Card, Chev, Empty, H, IL, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { providerInfoFor } from '@/data/marketSeed';
import { bookService } from '@/lib/enroll';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { ratingFor } from '@/lib/network';
import { fmtDateTime, fmtDuration, fmtHour } from '@/lib/when';
import { useApp } from '@/store/app';
import { useVisible } from '@/lib/moderation';
import { useNet } from '@/store/network';
import { translateText } from '@/i18n/core';

export default function ServicePage() {
  const t = useTheme();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((a) => a.account.name);
  const p = useNet((s) => s.providers.find((x) => x.name === name));
  const enrollments = useNet((s) => s.enrollments);
  useNet((s) => s.votes);
  const visible = useVisible();
  if (p && !visible('service', p.name, p.name)) return <Page id="servicePage" title="Servizio" back><Card><Empty text="Hai nascosto o segnalato questo servizio, oppure il professionista è bloccato." /><Btn small ghost style={{ marginTop: 10 }} title="Segnalazioni inviate" onPress={() => go('reports')} /></Card></Page>;
  if (!p) return <Page id="servicePage" title="Servizio" back><Card><Empty text="Servizio non trovato." /></Card></Page>;
  const info = providerInfoFor(p);
  const isMine = p.name === me;
  const slots = datedSlots(p);
  const mine = enrollments.filter((e) => e.kind === 'service' && e.host === p.name && e.status !== 'declined');
  const r = ratingFor(p.name);
  // sessione per la videochiamata: la prossima prenotazione dell'utente oppure, per il professionista, il prossimo slot libero
  const nextBooking = [...mine].filter((e) => e.status === 'enrolled' && e.startsAt + e.durationMin * 60000 > Date.now()).sort((a, b) => a.startsAt - b.startsAt)[0];
  const live = isMine ? (slots[0] ? { startsAt: slots[0].ts, durationMin: info.durationMin } : null) : nextBooking ? { startsAt: nextBooking.startsAt, durationMin: nextBooking.durationMin } : { startsAt: null as number | null, durationMin: info.durationMin };

  return (
    <Page id="servicePage" title={p.role} back right={<Row gap={10}><Btn small ghost icon="share" title="Condividi" onPress={() => Share.share({ message: `${p.role} con ${p.name} su LifePilot` })} />{!isMine && <ModButton kind="service" refId={p.name} label={`${p.role} · ${p.name}`} author={p.name} />}</Row>}>
      <Card>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }} gap={6}>
          <Badge label={p.tag} color="#8fa4ff" />
          <Badge label={modeLabel(info.mode)} color="#8fa4ff" />
        </Row>
        <View style={{ gap: 8 }}>
          <IL icon="clock" bold>Sessione di {fmtDuration(info.durationMin)}</IL>
          <IL icon={info.mode === 'presenza' ? 'location' : 'video'}>{info.place}</IL>
          <IL icon="euro"><Price n={p.price} per="/ sessione" /></IL>
          <IL icon="info" muted small>Lingua: {info.language}</IL>
        </View>
        <MediaBlock media={p.media} seed={p.name + p.role} />
      </Card>

      {live && <LiveAccess kind="service" refId={p.name} title={p.role} host={p.name} dataMode={info.mode} startsAt={live.startsAt} durationMin={live.durationMin} isHost={isMine} enrolled={!!nextBooking} guest={isMine ? 'Cliente' : undefined} />}

      <Card>
        <H>Cosa offre</H>
        <Body small>{info.desc}</Body>
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Cosa ottieni</Body>
        {info.gets.map((g, i) => <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}><Icon name="check" size={15} color={t.positive} stroke={2.4} /><Body small style={{ flex: 1 }}>{g}</Body></View>)}
        <Body bold style={{ marginTop: 12, marginBottom: 2 }}>A chi è rivolto</Body>
        <Body small>{info.forWho}</Body>
      </Card>

      <Card>
        <H>Professionista</H>
        <Pressable onPress={() => go('userProfile', { name: p.name })} accessibilityRole="link" accessibilityLabel={translateText(`Apri il profilo di ${p.name}`)}>
          <Row>
            <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
              <UserAvatar name={p.name} size={42} />
              <View style={{ flex: 1 }}><Body bold>{p.name}{isMine ? ' (tu)' : ''}</Body><Body small muted>{r.avg ? `Voto ${r.avg}/5 (${r.count})` : `Valutazione indicata ${p.rating}/5`} · vedi profilo</Body></View>
            </Row>
            <Chev />
          </Row>
        </Pressable>
      </Card>

      <Card>
        <H>Pagamento e annullamento</H>
        <Body small>Prenoti senza pagare. I {p.price} LP vengono addebitati solo dopo la sessione, quando confermi di aver partecipato.</Body>
        <Body small muted style={{ marginTop: 8 }}>{info.cancel}</Body>
      </Card>

      {mine.length > 0 && (
        <Card>
          <H>Le tue prenotazioni</H>
          {mine.map((e) => <EnrollmentBox key={e.id} e={e} />)}
        </Card>
      )}

      <Card>
        <H>Slot disponibili</H>
        {isMine ? <Body small muted>Questo è il tuo servizio: gli altri utenti possono prenotare questi slot.</Body> : (
          <Body small muted style={{ marginBottom: 6 }}>Scegli una data: verrà aggiunta al tuo Plan, e se hai già un impegno ti avviseremo prima.</Body>
        )}
        {slots.length === 0 ? <Empty text="Nessuno slot libero al momento." /> : slots.map(({ slot, ts }, i) => (
          <Item key={slot} last={i === slots.length - 1}>
            <Row>
              <View style={{ flex: 1 }}><Body bold>{fmtDateTime(ts)}</Body><Body small muted>Dalle {fmtHour(ts)} alle {fmtHour(ts + info.durationMin * 60000)} · slot settimanale "{slot}"</Body></View>
              {!isMine && <Btn small title="Prenota" onPress={() => bookService(p, slot, info.durationMin, me)} />}
            </Row>
          </Item>
        ))}
      </Card>
    </Page>
  );
}
