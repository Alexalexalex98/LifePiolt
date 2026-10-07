import { useLocalSearchParams } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { EnrollmentBox, Price, SPONSORED_TEXT, modeLabel, useSeminarEnrollment } from '@/components/market';
import { Badge, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Chev, Empty, H, IL, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { enrollSeminar, hasEnded, seminarFacts, useNow } from '@/lib/enroll';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { ratingFor } from '@/lib/network';
import { fmtDuration, fmtRange, pubLabel } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export default function SeminarPage() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((a) => a.account.name);
  const s = useNet((st) => st.seminars.find((x) => String(x.id) === id));
  const enr = useSeminarEnrollment(Number(id));
  const now = useNow(20000);
  useNet((st) => st.votes); // aggiorna la valutazione del relatore
  if (!s) return <Page id="seminarPage" title="Seminario" back><Card><Empty text="Seminario non trovato." /></Card></Page>;
  const f = seminarFacts(s);
  const isHost = s.host === me;
  const started = f.startsAt !== null && f.startsAt <= now;
  const r = ratingFor(s.host);
  const canEnroll = !isHost && f.startsAt !== null && !started && f.seatsLeft !== 0 && (!enr || enr.status === 'declined');
  const activeEnr = enr && enr.status !== 'declined' ? enr : undefined;
  const ended = f.startsAt !== null && hasEnded({ startsAt: f.startsAt, durationMin: f.durationMin }, now);

  return (
    <Page id="seminarPage" title={s.title} back right={<Btn small ghost icon="share" title="Condividi" onPress={() => Share.share({ message: `Seminario su LifePilot: ${s.title} (${s.host})` })} />}>
      <Card>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={6}>
          {s.promoted && <Badge label="Sponsorizzato" color="#c9b6ff" onPress={() => openSheet('sponsoredInfo')} />}
          <Badge label={modeLabel(s.mode)} color="#8fa4ff" />
          {ended && <Badge label="Concluso" color="#8e98a8" />}
        </Row>
        {s.promoted && <Body small muted style={{ marginBottom: 8 }}>{SPONSORED_TEXT}</Body>}
        {s.ts ? <Body small muted style={{ marginBottom: 8 }}>{pubLabel(s.ts)}</Body> : null}
        <View style={{ gap: 8 }}>
          <IL icon="calendar" bold>{f.startsAt ? fmtRange(f.startsAt, f.durationMin) : 'Data da definire'}</IL>
          <IL icon="clock">Durata: {fmtDuration(f.durationMin)}</IL>
          <IL icon={s.mode === 'presenza' ? 'location' : 'video'}>{s.place || modeLabel(s.mode)}</IL>
          {f.seats > 0 && <IL icon="users">{f.seatsLeft === 0 ? 'Posti esauriti' : `${f.seatsLeft} posti liberi su ${f.seats}`}</IL>}
          <IL icon="euro"><Price n={s.price} /></IL>
        </View>
      </Card>

      <Card>
        <H>Descrizione</H>
        <Body small>{s.desc || 'Il relatore non ha ancora aggiunto una descrizione per questo seminario.'}</Body>
        {s.learn && s.learn.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Body bold style={{ marginBottom: 6 }}>Cosa imparerai</Body>
            {s.learn.map((l, i) => <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}><Icon name="check" size={15} color={t.positive} stroke={2.4} /><Body small style={{ flex: 1 }}>{l}</Body></View>)}
          </View>
        )}
        {s.audience ? <View style={{ marginTop: 12 }}><Body bold style={{ marginBottom: 2 }}>A chi è rivolto</Body><Body small>{s.audience}</Body></View> : null}
        {s.included ? <View style={{ marginTop: 12 }}><Body bold style={{ marginBottom: 2 }}>Cosa è incluso</Body><Body small>{s.included}</Body></View> : null}
        {s.language ? <View style={{ marginTop: 12 }}><Body bold style={{ marginBottom: 2 }}>Lingua</Body><Body small>{s.language}</Body></View> : null}
      </Card>

      <Card>
        <H>Relatore</H>
        <Pressable onPress={() => go('userProfile', { name: s.host })} accessibilityRole="link" accessibilityLabel={`Apri il profilo di ${s.host}`}>
          <Row>
            <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
              <UserAvatar name={s.host} size={42} />
              <View style={{ flex: 1 }}><Body bold>{s.host}{isHost ? ' (tu)' : ''}</Body><Body small muted>{r.avg ? `Voto ${r.avg}/5 (${r.count})` : 'Ancora nessun voto'} · vedi profilo</Body></View>
            </Row>
            <Chev />
          </Row>
        </Pressable>
      </Card>

      <Card>
        <H>Prezzo, pagamento e annullamento</H>
        <Body small>{s.price ? `Prezzo: ${s.price} LP. Ti iscrivi senza pagare; i LifePoints vengono addebitati solo dopo il seminario, quando confermi di aver partecipato.` : 'Gratuito. Dopo il seminario ti chiederemo comunque di confermare la partecipazione.'}</Body>
        <Body small muted style={{ marginTop: 8 }}>{s.cancelPolicy || 'Puoi annullare l\'iscrizione fino all\'inizio.'}</Body>
      </Card>

      {isHost ? (
        <Card>
          <H>Sei il relatore</H>
          <Body small muted>{f.seats ? `Iscritti: ${f.joined} su ${f.seats} posti.` : `Iscritti: ${f.joined}.`} I LifePoints dei partecipanti ti vengono accreditati quando confermano la partecipazione.</Body>
          {!s.promoted && <Btn small ghost style={{ marginTop: 10, alignSelf: 'flex-start' }} title="Promuovi con LifePoints" onPress={() => openSheet('promoteSeminar', { id: s.id })} />}
        </Card>
      ) : (
        <Card>
          <H>La tua iscrizione</H>
          {canEnroll && (
            <>
              <Body small muted style={{ marginBottom: 10 }}>{s.price ? `Iscrizione senza pagamento. Pagherai ${s.price} LP solo dopo il seminario.` : 'Iscrizione gratuita.'} Verrà aggiunto al tuo Plan; se hai già un impegno nello stesso orario ti avviseremo prima.</Body>
              <Btn title="Iscriviti" icon="check" onPress={() => enrollSeminar(s, me)} />
            </>
          )}
          {!canEnroll && !activeEnr && (
            <Body small muted>{f.startsAt === null ? 'Il relatore non ha ancora indicato la data: non è possibile iscriversi.' : started ? (ended ? 'Questo seminario è concluso.' : 'Questo seminario è già iniziato: le iscrizioni sono chiuse.') : f.seatsLeft === 0 ? 'Posti esauriti.' : ''}</Body>
          )}
          {activeEnr && <EnrollmentBox e={activeEnr} />}
        </Card>
      )}
    </Page>
  );
}
