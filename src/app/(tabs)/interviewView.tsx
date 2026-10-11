import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { ContactPicker, Fact, PrivacyCard, ServerNote, StatusTag, Timeline } from '@/components/jobs/InterviewParts';
import { Avatar, Body, Btn, Card, Input, Page, Pill, Row, Select, Sheet } from '@/components/ui';
import { skillLabel } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { callWindow, candidateStatus, candidateStatusLabel, candidateTimeline, CHECK_KIND_LABEL, checkStatusLabel, contactText, canCall, displayName, SLOT_DURATIONS, type Share } from '@/lib/interview';
import { acceptInvite, answerIncoming, declineInvite, demoStartSoon, fmtSlot, isDemo, proposeAnother, rejectIncoming, simulateCompanyCalls, withdrawApplication } from '@/lib/interviewActions';
import { useNow } from '@/lib/enroll';
import { go, goBack } from '@/lib/nav';
import { fmtDateTime, fmtDuration, fmtHour, nextDays, timeOptions, tsOf } from '@/lib/when';
import { useApp } from '@/store/app';
import { useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';

/** La mia candidatura: stato, invito al colloquio, chiamata, contatto condiviso, verifiche e cronologia. */
export default function InterviewView() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === id));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  const now = useNow(1000);
  const [pick, setPick] = useState(0);
  const [share, setShare] = useState<Share>({ fullName: false, email: '', phone: '' });
  const [sheet, setSheet] = useState<null | 'accept' | 'other' | 'decline' | 'share'>(null);
  const [reason, setReason] = useState('');
  const days = nextDays(21);
  const [oDay, setODay] = useState(days[1].key);
  const [oTime, setOTime] = useState('11:00');
  const [oDur, setODur] = useState(30);
  useEffect(() => { useJobs.getState().settleInterviews(now); }, [now]);
  useEffect(() => { if (app?.iv) setShare(app.iv.share); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [app?.iv?.stage]);
  if (!app || !job || app.candidate !== me) return <Page id="interviewView" back><Body muted>Candidatura non trovata.</Body></Page>;

  const iv = app.iv;
  const status = candidateStatus(app.status, iv);
  const demo = isDemo() && job.owner !== me;
  const checks = app.checks ?? [];
  const can = iv ? canCall(iv, now) : null;
  const roomParams = iv?.chosen ? { kind: 'interview', ref: app.id, title: job.title, host: job.owner, start: String(iv.chosen.start), dur: String(iv.chosen.durationMin), guest: displayName(me) } : null;
  const tone = status === 'shared' || status === 'scheduled' || status === 'calling' ? 'ok' : status === 'declined' || status === 'expired' || status === 'not_held' || status === 'rejected' ? 'bad' : 'muted';
  const timeline = candidateTimeline({ submittedAt: app.submittedAt, candidateFull: me, iv, fmt: fmtDateTime, checks });
  const dayLabel = (k: string) => days.find((d) => d.key === k)?.label ?? days[0].label;

  const answer = () => { if (answerIncoming(app.id) && roomParams) go('liveRoom', roomParams); else toast('La chiamata non è più attiva'); };

  return (
    <Page id="interviewView" back title="La mia candidatura">
      <Row style={{ justifyContent: 'flex-start', marginBottom: 6 }} gap={12}>
        <Avatar name={job.company} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{job.title}</Text>
          <Body small muted>{job.company}</Body>
        </View>
      </Row>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={8}><StatusTag text={candidateStatusLabel(status)} tone={tone} /></Row>

      {iv?.stage === 'calling' && (
        <Card accent={t.positive}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}><Avatar name={job.company} size={44} /><View style={{ flex: 1 }}><Body bold>Chiamata in arrivo</Body><Body small muted>{job.company} · colloquio per “{job.title}”</Body></View></Row>
          <Body small muted style={{ marginTop: 8 }}>Se rispondi, condividi con l’azienda solo questo: {contactText(iv.share.fullName || iv.share.email || iv.share.phone ? { fullName: iv.share.fullName ? me : undefined, email: iv.share.email || undefined, phone: iv.share.phone || undefined } : {})}.</Body>
          <Row style={{ marginTop: 10 }} gap={8}>
            <Btn style={{ flex: 1 }} icon="phone" title="Rispondi" onPress={answer} />
            <Btn style={{ flex: 1 }} ghost danger title="Rifiuta" onPress={() => { rejectIncoming(app.id); toast('Chiamata rifiutata: nessun dato condiviso'); }} />
          </Row>
        </Card>
      )}

      {app.status === 'rejected' && <Card><Body bold>Non selezionato</Body>{app.feedback ? <Body small style={{ marginTop: 4 }}>{app.feedback}</Body> : null}<Body small muted style={{ marginTop: 6 }}>È una decisione di una persona, non di un algoritmo. Se vuoi contestarla, scrivi all’azienda dalla pagina dell’offerta.</Body></Card>}

      {iv?.stage === 'invited_interview' && (
        <Card>
          <Body bold>Invito al colloquio</Body>
          <Body small muted style={{ marginTop: 2 }}>{job.company} ti invita a un colloquio conoscitivo per “{job.title}”.</Body>
          {iv.message ? <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 8 }}><Body>{iv.message}</Body></View> : null}
          <Body small bold style={{ marginTop: 10 }}>Fasce proposte</Body>
          {iv.slots.map((s, i) => <Fact key={i} icon="calendar">{fmtSlot(s)}</Fact>)}
          <Fact icon="clock">Durata {fmtDuration(iv.slots[0].durationMin)} · fuso {iv.tz} · lingua {iv.lang}</Fact>
          <Fact icon="video">Sarà una videochiamata: il tuo contatto verrà condiviso con l’azienda SOLO quando risponderai alla chiamata.</Fact>
          <Fact icon="phone">Ti chiama l’azienda: tu non devi chiamare nessuno.</Fact>
          <Btn style={{ marginTop: 12 }} title="Accetta" onPress={() => { setPick(0); setSheet('accept'); }} />
          <Row style={{ marginTop: 8 }} gap={8}>
            <Btn small ghost style={{ flex: 1 }} title="Proponi un’altra fascia" onPress={() => setSheet('other')} />
            <Btn small ghost style={{ flex: 1 }} title="Rifiuta" onPress={() => setSheet('decline')} />
          </Row>
          <Body small muted style={{ marginTop: 8 }}>Se non rispondi, l’invito scade il {fmtDateTime(iv.expiresAt)}. Rifiutare o lasciar scadere non ha conseguenze sul tuo profilo.</Body>
        </Card>
      )}

      {iv?.stage === 'proposed_other' && iv.counter && <Card><Body bold>Attendi la risposta</Body><Fact icon="calendar">Hai proposto: {fmtSlot(iv.counter)}</Fact><Body small muted style={{ marginTop: 6 }}>L’azienda deve accettare la nuova fascia. Nessun dato è stato condiviso.</Body></Card>}

      {(iv?.stage === 'accepted' || iv?.stage === 'missed') && iv.chosen && (
        <Card>
          <Body bold>{iv.stage === 'missed' ? 'Chiamata persa' : 'Colloquio fissato'}</Body>
          <Fact icon="calendar">{fmtSlot(iv.chosen)}</Fact>
          <Fact icon="video">Videochiamata. L’azienda ti chiamerà da 10 minuti prima ({fmtHour(callWindow(iv.chosen).opens)}). Tieni l’app aperta: riceverai “chiamata in arrivo”.</Fact>
          <Fact icon="lock">Contatti che sbloccherai quando rispondi: {iv.share.fullName || iv.share.email || iv.share.phone ? [iv.share.fullName ? 'nome completo' : '', iv.share.email, iv.share.phone].filter(Boolean).join(', ') : 'nessuno (solo il canale della videochiamata)'}.</Fact>
          <Row style={{ marginTop: 10 }} gap={8}>
            <Btn small ghost style={{ flex: 1 }} title="Cambia cosa sblocchi" onPress={() => setSheet('share')} />
            <Btn small ghost danger style={{ flex: 1 }} title="Non posso più" onPress={() => setSheet('decline')} />
          </Row>
          {demo && (
            <View style={{ marginTop: 10 }}>
              {!can?.ok && <Btn small ghost title="Anteprima: porta il colloquio a tra 2 minuti" onPress={() => demoStartSoon(app.id)} />}
              {can?.ok && <Btn small ghost title="Anteprima: simula la chiamata dell’azienda" onPress={() => simulateCompanyCalls(app.id)} />}
              <Body small muted style={{ marginTop: 6 }}>Anteprima su questo telefono: l’azienda è un utente demo.</Body>
            </View>
          )}
        </Card>
      )}

      {(iv?.stage === 'connected' || iv?.stage === 'done') && (
        <Card>
          <Body bold>{iv.stage === 'connected' ? 'Colloquio in corso' : 'Colloquio concluso'}</Body>
          {iv.unlockedAt != null && <Fact icon="lock">Hai risposto il {fmtDateTime(iv.unlockedAt)}. Condiviso con l’azienda: {contactText(iv.contact)}.</Fact>}
          {iv.stage === 'connected' && roomParams && <Btn small ghost icon="video" style={{ marginTop: 8 }} title="Rientra nella stanza" onPress={() => go('liveRoom', roomParams)} />}
          {iv.outcome && (
            <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 10 }}>
              <Body bold>{iv.outcome.result === 'next' ? 'Esito: si va avanti' : 'Esito: non si va avanti'}</Body>
              {iv.outcome.reasons.map((r) => <Body key={r} small style={{ marginTop: 2 }}>• {r}</Body>)}
              {iv.outcome.note ? <Body small muted style={{ marginTop: 4 }}>{iv.outcome.note}</Body> : null}
            </View>
          )}
          {iv.unlockedAt != null && (
            <View style={{ marginTop: 12 }}>
              <Body bold>Mantieni il mio contatto per questa azienda</Body>
              <Body small muted style={{ marginTop: 2 }}>{iv.keep === true ? 'L’azienda continua a vedere il contatto che hai scelto. Puoi revocare quando vuoi.' : iv.keep === false ? 'L’azienda non vede più il contatto.' : 'Fino a quando non scegli, l’azienda lo vede solo durante il colloquio; al termine torna nascosto.'}</Body>
              <Row style={{ marginTop: 8, justifyContent: 'flex-start' }} gap={8}>
                <Pill label="Sì, mantieni" on={iv.keep === true} onPress={() => useJobs.getState().setKeepContact(app.id, true)} />
                <Pill label="No, nascondi" on={iv.keep === false} onPress={() => useJobs.getState().setKeepContact(app.id, false)} />
              </Row>
            </View>
          )}
        </Card>
      )}

      {(iv?.stage === 'not_held') && <Card><Body bold>Colloquio non avvenuto</Body><Body small muted style={{ marginTop: 4 }}>La chiamata non è stata risposta in tempo. Nessun dato è stato condiviso. L’azienda può riproporre il colloquio.</Body></Card>}
      {(iv?.stage === 'declined' || iv?.stage === 'expired') && <Card><Body bold>{iv.stage === 'declined' ? 'Invito rifiutato' : 'Invito scaduto'}</Body><Body small muted style={{ marginTop: 4 }}>Nessun dato è stato condiviso e il tuo profilo non cambia.</Body></Card>}

      {checks.length > 0 && (
        <>
          <Body bold style={{ marginTop: 10, marginBottom: 6 }}>Verifiche richieste</Body>
          {checks.map((c) => (
            <Card key={c.id}>
              <Row><View style={{ flex: 1 }}><Body bold>{c.title}</Body><Body small muted>{CHECK_KIND_LABEL[c.kind]()} · {skillLabel(c.skill)}</Body></View><StatusTag text={checkStatusLabel(c)} tone={c.status === 'done' ? 'ok' : 'muted'} /></Row>
              {(c.status === 'requested' || c.status === 'accepted') && <Body small muted style={{ marginTop: 4 }}>{c.kind === 'test' ? `Test con ${c.questionIds.length + c.custom.length} domande, ${c.timeLimitMin} minuti.` : c.kind === 'practical' ? `Prova pratica con tempo limite: ${fmtDuration(c.practical?.limitMin ?? c.timeLimitMin)}. Il tempo parte quando accetti.` : 'Domande dal vivo durante il colloquio. L’azienda può prendere appunti che tu non vedi.'} Valuta: {skillLabel(c.skill)}.</Body>}
              {c.status === 'requested' && (
                <Row style={{ marginTop: 8 }} gap={8}>
                  <Btn small style={{ flex: 1 }} title="Accetta" onPress={() => { useJobs.getState().respondCheck(app.id, c.id, true); if (c.kind === 'test') go('jobTest', { check: `${app.id}:${c.id}` }); else if (c.kind === 'practical') go('extraCheck', { app: app.id, check: c.id }); else toast('Verifica accettata'); }} />
                  <Btn small ghost style={{ flex: 1 }} title="Rifiuta" onPress={() => { useJobs.getState().respondCheck(app.id, c.id, false); toast('Rifiutata: nessuna penalità sul tuo profilo'); }} />
                </Row>
              )}
              {c.status === 'accepted' && c.kind !== 'live' && <Btn small style={{ marginTop: 8 }} title={c.kind === 'test' ? 'Inizia il test' : 'Apri la prova'} onPress={() => (c.kind === 'test' ? go('jobTest', { check: `${app.id}:${c.id}` }) : go('extraCheck', { app: app.id, check: c.id }))} />}
            </Card>
          ))}
          <Body small muted>Rifiutare una verifica non ti penalizza; l’azienda la vede come “verifica non effettuata”. Nessun documento personale viene mai richiesto.</Body>
        </>
      )}

      <Body bold style={{ marginTop: 12, marginBottom: 6 }}>Cosa ha visto l’azienda e quando</Body>
      <Card><Timeline items={timeline} /></Card>
      <PrivacyCard />

      <Row style={{ marginTop: 12 }} gap={8}>
        <Btn small ghost style={{ flex: 1 }} title="Vedi l’offerta" onPress={() => go('jobDetail', { id: job.id })} />
        <Btn small ghost danger style={{ flex: 1 }} title="Ritira la candidatura" onPress={() => withdrawApplication(app.id, goBack)} />
      </Row>
      <ServerNote call />

      <Sheet visible={sheet === 'accept'} title="Scegli la fascia e cosa sbloccare" onClose={() => setSheet(null)}>
        {iv?.slots.map((s, i) => <Pill key={i} label={fmtSlot(s)} on={pick === i} onPress={() => setPick(i)} />)}
        <View style={{ height: 12 }} />
        <Body bold style={{ marginBottom: 4 }}>Quali contatti sbloccare quando rispondi alla chiamata?</Body>
        <ContactPicker value={share} onChange={setShare} />
        <Btn style={{ marginTop: 8 }} title="Accetta il colloquio" onPress={() => { if (acceptInvite(app.id, pick, share)) { setSheet(null); toast('Colloquio fissato: lo trovi nel Plan'); } else toast('Non riesco ad accettare: forse l’invito è scaduto'); }} />
      </Sheet>
      <Sheet visible={sheet === 'share'} title="Cosa sblocchi alla risposta" onClose={() => setSheet(null)}>
        <ContactPicker value={share} onChange={setShare} />
        <Btn style={{ marginTop: 8 }} title="Salva" onPress={() => { useJobs.getState().updateShare(app.id, share); setSheet(null); toast('Scelta salvata'); }} />
      </Sheet>
      <Sheet visible={sheet === 'other'} title="Proponi un’altra fascia" onClose={() => setSheet(null)}>
        <Select title="Giorno" value={dayLabel(oDay)} options={days.map((d) => d.label)} onChange={(l) => setODay(days.find((d) => d.label === l)!.key)} />
        <Row gap={8}>
          <View style={{ flex: 1 }}><Select title="Ora" value={oTime} options={timeOptions(7, 21)} onChange={setOTime} /></View>
          <View style={{ flex: 1 }}><Select title="Durata" value={fmtDuration(oDur)} options={SLOT_DURATIONS.map((d) => fmtDuration(d))} onChange={(v) => setODur(SLOT_DURATIONS.find((d) => fmtDuration(d) === v) ?? 30)} /></View>
        </Row>
        <Btn title="Invia la proposta" onPress={() => { if (proposeAnother(app.id, { start: tsOf(oDay, oTime), durationMin: oDur })) { setSheet(null); toast('Proposta inviata'); } else toast('Scegli una fascia nel futuro'); }} />
      </Sheet>
      <Sheet visible={sheet === 'decline'} title="Rifiuta il colloquio" onClose={() => setSheet(null)}>
        <Body small muted style={{ marginBottom: 8 }}>Nessuna conseguenza sul tuo profilo. Il motivo è facoltativo.</Body>
        <Input multiline style={{ minHeight: 70 }} placeholder="Motivo (facoltativo)" value={reason} onChangeText={setReason} />
        <Btn danger title="Rifiuta" onPress={() => { if (declineInvite(app.id, reason)) { setSheet(null); toast('Invito rifiutato'); } }} />
      </Sheet>
    </Page>
  );
}
