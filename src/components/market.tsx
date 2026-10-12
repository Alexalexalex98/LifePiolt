import { View } from 'react-native';
import { Text } from '@/components/T';

import { Badge, LpTag, MediaBlock, openSheet } from '@/components/network';
import { providerInfoFor } from '@/data/marketSeed';
import { Body, Btn, Card, Chev, IL, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { useState } from 'react';
import { canCancel, canReschedule, hoursToCancelDeadline } from '@/lib/booking';
import { cancelEnrollment, declineAttendance, demoFinish, hasEnded, otherSeminarDates, rescheduleSeminar, rescheduleService, seminarFacts, useNow } from '@/lib/enroll';
import { go } from '@/lib/nav';
import { canVote } from '@/lib/network';
import { fmtDateTime, fmtDuration, fmtRange, nextOccurrence, pubLabel } from '@/lib/when';
import { useVisible } from '@/lib/moderation';
import { useApp } from '@/store/app';
import { useNet, type Enrollment, type Provider, type Seminar } from '@/store/network';

export const SPONSORED_TEXT = 'Sponsorizzato significa che il relatore ha pagato LifePoints per mettere questo seminario in evidenza nella home di LifeNetwork. Non vuol dire che sia verificato, consigliato o controllato da LifePilot: valuta tu descrizione, relatore e valutazioni prima di iscriverti.';

export const modeLabel = (m?: string | null) => (m === 'online' ? 'Online' : m === 'presenza' ? 'In presenza' : 'Modalità da definire');

export function Price({ n, per }: { n: number; per?: string }) {
  if (!n) return <Body bold>Gratuito</Body>;
  return <Row gap={2} style={{ justifyContent: 'flex-start' }}><Body bold>{formatCHF(n)}</Body><LpTag size={13} />{per ? <Body bold> {per}</Body> : null}</Row>;
}

/** Etichetta di stato di un'iscrizione. */
export function statusOf(e: Enrollment | undefined, now = Date.now()): { label: string; color: string } | null {
  if (!e) return null;
  if (e.status === 'attended') return { label: 'Partecipazione confermata', color: '#7be0b0' };
  if (e.status === 'declined') return { label: 'Non partecipato', color: '#8e98a8' };
  return hasEnded(e, now) ? { label: 'Da confermare', color: '#ffb84f' } : { label: e.kind === 'seminar' ? 'Iscritto' : 'Prenotato', color: '#8fa4ff' };
}

/** L'iscrizione "piu' rilevante" dell'utente a un seminario (quella ancora aperta, altrimenti l'ultima). */
export function useSeminarEnrollment(id: number): Enrollment | undefined {
  const list = useNet((s) => s.enrollments);
  const mine = list.filter((e) => e.kind === 'seminar' && e.ref === String(id));
  return mine.find((e) => e.status === 'enrolled') ?? mine[0];
}

export function SeminarCard({ s }: { s: Seminar }) {
  const t = useTheme();
  const me = useApp((a) => a.account.name);
  const now = useNow(30000);
  const f = seminarFacts(s);
  const enr = useSeminarEnrollment(s.id);
  const st = statusOf(enr, now);
  const visible = useVisible();
  if (!visible('seminar', s.id, s.host)) return null;
  return (
    <Card onPress={() => go('seminarPage', { id: String(s.id) })}>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 4 }} gap={6}>
        {s.promoted && <Badge label="Sponsorizzato" color="#c9b6ff" onPress={() => openSheet('sponsoredInfo')} />}
        {st && <Badge label={st.label} color={st.color} />}
      </Row>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 2 }}>{s.title}</Text>
      <Body small muted>di <Body small muted style={{ textDecorationLine: 'underline' }} onPress={() => go('userProfile', { name: s.host })}>{s.host}</Body>{s.ts ? ' · ' + pubLabel(s.ts) : ''}</Body>
      <View style={{ gap: 5, marginTop: 8 }}>
        <IL icon="calendar" small>{f.startsAt ? `${fmtRange(f.startsAt, f.durationMin)} (${fmtDuration(f.durationMin)})` : 'Data da definire'}</IL>
        <IL icon={s.mode === 'presenza' ? 'location' : 'video'} small>{modeLabel(s.mode)}</IL>
        {f.seatsLeft !== null && <IL icon="users" small muted>{f.seatsLeft === 0 ? 'Posti esauriti' : `${f.seatsLeft} posti liberi su ${f.seats}`}</IL>}
      </View>
      <Row style={{ marginTop: 10 }}>
        <Price n={s.price} />
        {s.host === me && !s.promoted ? <Btn small ghost title="Promuovi con LifePoints" onPress={() => openSheet('promoteSeminar', { id: s.id })} /> : <Row gap={4}><Body small muted>Dettagli</Body><Chev /></Row>}
      </Row>
    </Card>
  );
}

/** Slot di un professionista ordinati per data reale. */
export function datedSlots(p: Provider) {
  return p.slots.map((slot) => ({ slot, ts: nextOccurrence(slot) })).filter((x): x is { slot: string; ts: number } => x.ts !== null).sort((a, b) => a.ts - b.ts);
}

export function ServiceCard({ p }: { p: Provider }) {
  const me = useApp((a) => a.account.name);
  const info = providerInfoFor(p);
  const slots = datedSlots(p);
  const enrollments = useNet((s) => s.enrollments);
  const open = enrollments.filter((e) => e.kind === 'service' && e.host === p.name && e.status === 'enrolled').length;
  const visible = useVisible();
  if (!visible('service', p.name, p.name)) return null;
  return (
    <Card onPress={() => go('servicePage', { name: p.name })}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body bold>{p.name}</Body>
          <Body small muted>{p.role} · {p.rating}/5 · {slots.length} slot liberi</Body>
        </View>
        <Badge label={p.tag} color="#8fa4ff" />
      </Row>
      <MediaBlock media={p.media} seed={p.name + p.role} />
      <View style={{ gap: 5, marginTop: 6 }}>
        <IL icon="clock" small>{fmtDuration(info.durationMin)} · {modeLabel(info.mode)}</IL>
        <IL icon="calendar" small muted>{slots.length ? `Prossimo slot: ${fmtDateTime(slots[0].ts)}` : 'Nessuno slot libero al momento'}</IL>
        {open > 0 && <IL icon="check" small color="#8fa4ff">Hai {open} {open === 1 ? 'prenotazione' : 'prenotazioni'} con {p.name}</IL>}
      </View>
      <Row style={{ marginTop: 10 }}>
        <Price n={p.price} per="/ sessione" />
        <Btn small ghost={p.name === me} disabled={!slots.length && p.name !== me} title={p.name === me ? 'Il tuo servizio' : 'Vedi e prenota'} onPress={() => go('servicePage', { name: p.name })} />
      </Row>
    </Card>
  );
}


/** Stato e azioni di una singola iscrizione/prenotazione (seminari e servizi). */
export function EnrollmentBox({ e }: { e: Enrollment }) {
  const t = useTheme();
  const me = useApp((a) => a.account.name);
  const demo = useApp((a) => a.demo);
  const now = useNow(20000);
  const ended = hasEnded(e, now);
  const st = statusOf(e, now)!;
  const voteOk = canVote(me, e.host);
  const noun = e.kind === 'seminar' ? 'seminario' : 'sessione';
  const [resched, setResched] = useState(false);
  const cancelOk = canCancel(e.startsAt, now);
  const prov = useNet((s) => s.providers.find((p) => p.name === e.host));
  const options = e.kind === 'service' ? datedSlots(prov ?? ({ slots: [] } as unknown as Provider)).filter((x) => x.slot !== e.slot) : [];
  const dates = e.kind === 'seminar' ? otherSeminarDates(e.id) : [];
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.item, paddingTop: 12, marginTop: 12 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Body bold>{e.kind === 'seminar' ? e.title : `${e.title} con ${e.host}`}</Body>
          <Body small muted>{fmtRange(e.startsAt, e.durationMin)}</Body>
        </View>
        <Badge label={st.label} color={st.color} />
      </Row>
      {e.status === 'enrolled' && !ended && (
        <>
          <Body small muted style={{ marginTop: 8 }}>{e.paid ? `Hai pagato ${e.paid} LP alla prenotazione. ` : e.price ? '' : 'Gratuito. '}È nel tuo Plan. {cancelOk ? `Puoi disdire (con rimborso) fino a 24 ore prima: ancora ${Math.max(1, Math.floor(hoursToCancelDeadline(e.startsAt, now)))} ore.` : 'Non si può più disdire (meno di 24 ore): puoi ancora riprogrammare.'}</Body>
          <Row style={{ marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            {canReschedule(e, now) && <Btn small ghost icon="repeat" title="Riprogramma" onPress={() => setResched(true)} />}
            <Btn small ghost danger icon="x" disabled={!cancelOk} title={e.kind === 'seminar' ? 'Disiscriviti' : 'Annulla prenotazione'} onPress={() => cancelEnrollment(e.id)} />
            {demo && <Btn small ghost icon="timer" title="Solo demo: segna come concluso" onPress={() => demoFinish(e.id)} />}
          </Row>
        </>
      )}
      {e.status === 'enrolled' && ended && (
        <>
          <Body small style={{ marginTop: 8 }}>Il {noun} è terminato. Conferma di aver partecipato{e.paid == null && e.price ? `: solo allora vengono addebitati ${e.price} LP e accreditati a ${e.host}` : ''}.</Body>
          <Row style={{ marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            <Btn small icon="check" title="Conferma partecipazione" onPress={() => openSheet('confirmAttendance', { id: e.id })} />
            <Btn small ghost title="Non ho partecipato" onPress={() => declineAttendance(e.id)} />
          </Row>
        </>
      )}
      <Sheet visible={resched} title="Riprogramma" onClose={() => setResched(false)}>
        <Body small muted>Scegli un'altra data: non devi pagare di nuovo.</Body>
        {e.kind === 'service' && (options.length ? options.map((o, i) => <Item key={o.slot} last={i === options.length - 1} onPress={() => { if (rescheduleService(e.id, o.slot)) setResched(false); }}><Row><Body style={{ flex: 1 }}>{fmtDateTime(o.ts)}</Body><Chev /></Row></Item>) : <Body small muted style={{ marginTop: 8 }}>Non ci sono altri orari liberi al momento.</Body>)}
        {e.kind === 'seminar' && (dates.length ? dates.map((d, i) => <Item key={d.id} last={i === dates.length - 1} onPress={() => { if (rescheduleSeminar(e.id, d.id)) setResched(false); }}><Row><Body style={{ flex: 1 }}>{d.startsAt ? fmtDateTime(d.startsAt) : ''}</Body><Chev /></Row></Item>) : <Body small muted style={{ marginTop: 8 }}>Questo seminario non ha altre date: puoi disiscriverti fino a 24 ore prima.</Body>)}
      </Sheet>
      {e.status === 'attended' && (
        <Row style={{ marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          <Body small color={t.positive}>{e.price ? `Pagati ${e.price} LP a ${e.host}.` : 'Partecipazione registrata.'}</Body>
          {voteOk ? <Btn small ghost icon="award" title={`Vota ${e.host}`} onPress={() => openSheet('vote', { name: e.host })} /> : e.voted ? <Body small muted>Hai già votato.</Body> : null}
        </Row>
      )}
    </View>
  );
}
