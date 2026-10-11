import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { FileChip, QuestionView } from '@/components/jobFiles';
import { SkillRow, scoreTone } from '@/components/jobs';
import { ContactBox, Fact, GradeBox, ServerNote, StatusTag } from '@/components/jobs/InterviewParts';
import { Avatar, Body, Btn, Card, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { skillLabel, traitLabel, traits } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { deadlineOf, fmtDuration, fmtLimit, levelOf } from '@/lib/hiring';
import { callWindow, canCall, checkStatusLabel, CHECK_KIND_LABEL, companyStatusLabel, companyView, contactVisible, OUTCOME_REASONS, retryUntil } from '@/lib/interview';
import { answerIncoming, callCandidate, acceptCounterSlot, cancelCallNow, demoStartSoon, fmtSlot, finishWith, isDemo, rejectIncoming, simulateCandidateAccepts } from '@/lib/interviewActions';
import { attitudeOfApplication, fitOfApplication, scoresOfApplication } from '@/lib/jobFit';
import { useNow } from '@/lib/enroll';
import { go } from '@/lib/nav';
import { fmtDateTime, fmtHour } from '@/lib/when';
import { useApp } from '@/store/app';
import { CHECK_PRACTICAL_QID, PRACTICAL_QID, checkQuestions, questionsOfApp, useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';

const fmtMs = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${Math.round(ms / 1000)} s`);

export default function ApplicantView() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === id));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  const run = useJobs((s) => (s.practicals ?? []).find((x) => x.jobId === app?.jobId && x.candidate === app?.candidate));
  const now = useNow(1000);
  const [reject, setReject] = useState(false);
  const [msg, setMsg] = useState('');
  const [outcome, setOutcome] = useState(false);
  const [res, setRes] = useState<'next' | 'rejected'>('next');
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => { useJobs.getState().settleInterviews(now); }, [now]);
  if (!app || !job || job.owner !== me) return <Page id="applicantView" back><Body muted>Candidatura non trovata.</Body></Page>;

  const iv = app.iv;
  const view = companyView(app.candidate, iv);
  const fit = fitOfApplication(job, app);
  const scores = scoresOfApplication(app);
  const attitude = attitudeOfApplication(app);
  const qs = questionsOfApp(job, app);
  const open = qs.filter((q) => (q.kind === 'open' || q.kind === 'file') && q.id !== PRACTICAL_QID);
  const prac = job.practical;
  const pAns = app.answers.find((x) => x.qid === PRACTICAL_QID);
  const pFiles = run?.submittedAt ? run.files : pAns?.files ?? [];
  const pNote = run?.submittedAt ? run.note : String(pAns?.value ?? '');
  const pDone = !!run?.submittedAt || !!pAns;
  const lateMs = run?.submittedAt && prac ? run.submittedAt - deadlineOf(run.startedAt, prac.limitMin) : 0;
  const r = app.result;
  const checks = app.checks ?? [];
  const demo = isDemo();
  const status = companyStatusLabel(app.status, iv);
  const can = iv ? canCall(iv, now) : null;
  const roomParams = iv?.chosen ? { kind: 'interview', ref: app.id, title: job.title, host: me, start: String(iv.chosen.start), dur: String(iv.chosen.durationMin), guest: view.name } : null;
  const gradeApp = (qid: string) => (v: number) => useJobs.getState().gradeOpen(app.id, qid, v);

  const doCall = () => {
    if (!callCandidate(app.id) || !roomParams) { toast('Non è ancora il momento di chiamare'); return; }
    go('liveRoom', roomParams);
  };

  const interviewCard = () => {
    if (app.status === 'rejected') return <Card><Body bold>Non selezionato</Body>{app.feedback ? <Body small muted style={{ marginTop: 4 }}>{app.feedback}</Body> : null}</Card>;
    if (!iv) {
      return (
        <Card>
          <Body bold>Colloquio conoscitivo</Body>
          <Body small muted style={{ marginTop: 4 }}>Se vuoi conoscere {view.name}, invitala o invitalo a una videochiamata. Con l’invito non vedi nient’altro che il nome: il contatto si sblocca solo se accetta e risponde alla tua chiamata.</Body>
          <Btn style={{ marginTop: 10 }} icon="video" title="Invita a un colloquio" onPress={() => go('interviewInvite', { id: app.id })} />
        </Card>
      );
    }
    const win = iv.chosen ? callWindow(iv.chosen) : null;
    return (
      <Card>
        <Row><Body bold style={{ flex: 1 }}>Colloquio in videochiamata</Body><StatusTag text={status} tone={iv.stage === 'connected' || iv.stage === 'accepted' ? 'ok' : iv.stage === 'declined' || iv.stage === 'expired' || iv.stage === 'not_held' ? 'bad' : 'muted'} /></Row>
        {iv.stage === 'invited_interview' && (
          <>
            {iv.slots.map((s, i) => <Fact key={i} icon="calendar">{fmtSlot(s)}</Fact>)}
            <Body small muted style={{ marginTop: 8 }}>In attesa della risposta. L’invito scade il {fmtDateTime(iv.expiresAt)}. Nessun dato del candidato è stato condiviso.</Body>
            {demo && <Btn small ghost style={{ marginTop: 8 }} title="Anteprima: simula che accetti" onPress={() => simulateCandidateAccepts(app.id)} />}
          </>
        )}
        {iv.stage === 'proposed_other' && iv.counter && (
          <>
            <Fact icon="calendar">Propone: {fmtSlot(iv.counter)}</Fact>
            <Row style={{ marginTop: 10 }} gap={8}>
              <Btn small style={{ flex: 1 }} title="Accetta la fascia" onPress={() => acceptCounterSlot(app.id)} />
              <Btn small ghost style={{ flex: 1 }} title="Proponi altre fasce" onPress={() => go('interviewInvite', { id: app.id })} />
            </Row>
          </>
        )}
        {(iv.stage === 'accepted' || iv.stage === 'missed' || iv.stage === 'calling') && iv.chosen && (
          <>
            <Fact icon="calendar">{fmtSlot(iv.chosen)}</Fact>
            <Fact icon="clock">Puoi chiamare da 10 minuti prima ({fmtHour(win!.opens)}) fino alla fine ({fmtHour(win!.closes)}). Chiami sempre tu.</Fact>
            {iv.stage === 'missed' && retryUntil(iv) != null && <Fact icon="phone" tone={t.warn}>Nessuna risposta. Puoi riprovare fino alle {fmtHour(retryUntil(iv)!)}. Nessun contatto è stato sbloccato.</Fact>}
            {iv.stage === 'calling' ? (
              <>
                <Body bold style={{ marginTop: 10 }}>Sto chiamando {view.name}…</Body>
                <Row style={{ marginTop: 8 }} gap={8}>
                  <Btn small style={{ flex: 1 }} icon="video" title="Apri la stanza" onPress={() => roomParams && go('liveRoom', roomParams)} />
                  <Btn small ghost style={{ flex: 1 }} title="Annulla" onPress={() => cancelCallNow(app.id)} />
                </Row>
                {demo && (
                  <Row style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={8}>
                    <Btn small ghost title="Anteprima: risponde" onPress={() => answerIncoming(app.id)} />
                    <Btn small ghost title="Anteprima: rifiuta" onPress={() => rejectIncoming(app.id)} />
                  </Row>
                )}
              </>
            ) : (
              <Btn style={{ marginTop: 10 }} icon="phone" title={iv.stage === 'missed' ? `Richiama ${view.name}` : `Chiama ${view.name}`} disabled={!can?.ok} onPress={doCall} />
            )}
            {iv.stage !== 'calling' && !can?.ok && can?.reason === 'too_early' && <Body small muted style={{ marginTop: 6 }}>Potrai chiamare dalle {fmtHour(win!.opens)}.</Body>}
            {demo && iv.stage !== 'calling' && !can?.ok && <Btn small ghost style={{ marginTop: 8 }} title="Anteprima: porta il colloquio a tra 2 minuti" onPress={() => demoStartSoon(app.id)} />}
            <Body small muted style={{ marginTop: 8 }}>Il candidato ha scelto quali contatti sbloccare e può cambiare idea fino alla chiamata. Li vedrai solo se risponde.</Body>
          </>
        )}
        {iv.stage === 'connected' && (
          <>
            <Body small muted style={{ marginTop: 6 }}>Il candidato ha risposto. Ora puoi concludere con un esito.</Body>
            {iv.chosen && roomParams && <Btn small ghost icon="video" style={{ marginTop: 8 }} title="Rientra nella stanza" onPress={() => go('liveRoom', roomParams)} />}
          </>
        )}
        {iv.stage === 'not_held' && (
          <>
            <Body small muted style={{ marginTop: 6 }}>Colloquio non avvenuto: il candidato non ha risposto in tempo. Nessun contatto è stato sbloccato.</Body>
            <Btn style={{ marginTop: 10 }} icon="calendar" title="Riproponi il colloquio" onPress={() => go('interviewInvite', { id: app.id })} />
          </>
        )}
        {(iv.stage === 'declined' || iv.stage === 'expired') && (
          <>
            <Body small muted style={{ marginTop: 6 }}>{iv.stage === 'declined' ? `Invito rifiutato${iv.declineReason ? `: “${iv.declineReason}”` : ''}. Non c’è nessun giudizio sul profilo.` : 'L’invito è scaduto senza risposta.'}</Body>
            {iv.stage === 'expired' && <Btn style={{ marginTop: 10 }} title="Invita di nuovo" onPress={() => go('interviewInvite', { id: app.id })} />}
          </>
        )}
        {iv.stage === 'done' && iv.outcome && (
          <>
            <Body small style={{ marginTop: 6 }}>Esito: {iv.outcome.result === 'next' ? 'si va avanti' : 'non si va avanti'}{iv.outcome.reasons.length ? ` · ${iv.outcome.reasons.join(', ')}` : ''}</Body>
            {iv.outcome.note ? <Body small muted>{iv.outcome.note}</Body> : null}
          </>
        )}
        {iv.unlockedAt != null && (contactVisible(iv) && view.contact
          ? <ContactBox contact={view.contact} unlockedAt={iv.unlockedAt} />
          : iv.stage === 'done' || iv.keep === false ? <Body small muted style={{ marginTop: 10 }}>Il contatto non è più disponibile: il candidato non lo ha mantenuto per questa azienda.</Body> : null)}
        {iv.stage === 'connected' && <Btn style={{ marginTop: 10 }} title="Scrivi l’esito del colloquio" onPress={() => setOutcome(true)} />}
        {demo && iv.stage !== 'calling' && <ServerNote call />}
      </Card>
    );
  };

  return (
    <Page id="applicantView" back>
      <Row style={{ justifyContent: 'flex-start', marginTop: 8, marginBottom: 6 }} gap={12}>
        <Avatar name={view.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{view.name}</Text>
          <Body small muted>{job.title} · {status}</Body>
        </View>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: scoreTone(fit.overall, t), fontSize: 30, fontWeight: '800' }}>{fit.overall}</Text><Body small muted>adeguatezza</Body></View>
      </Row>
      <Body small muted style={{ marginBottom: 6 }}>Vedi solo il nome e come ha risposto al test: niente foto, contatti, città o storia lavorativa. Decidi guardando cosa sa fare.</Body>

      {interviewCard()}

      <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Competenze richieste</Body>
      <Card>
        {job.reqs.map((q) => <SkillRow key={q.skill} skill={q.skill} value={scores[q.skill] ?? null} min={q.min} note={r.pending.some((id) => qs.find((x) => x.id === id)?.skill === q.skill) ? 'parte da valutare' : levelOf(scores[q.skill] ?? null)} />)}
        {fit.unmet.length > 0 && <Body small color={t.warn}>Sotto soglia: {fit.unmet.map((u) => skillLabel(u.skill)).join(', ')}. Non è un rifiuto automatico: valuta tu.</Body>}
        {r.flags.map((f) => <Body key={f} small color={t.warn} style={{ marginTop: 4 }}>{f}</Body>)}
        <Body small muted style={{ marginTop: 6 }}>Tempo totale: {fmtMs(r.timeMs)} · {r.answered}/{r.total} domande risposte</Body>
      </Card>

      {traits.some((x) => r.traits[x] != null) && (
        <>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Atteggiamento nel test</Body>
          <Card>
            <Body small muted>{traits.filter((x) => r.traits[x] != null).map((x) => `${traitLabel[x]} ${r.traits[x]}`).join(' · ')}{r.consistency != null ? ` · coerenza ${r.consistency}` : ''}</Body>
            <Body small muted style={{ marginTop: 4 }}>Indice dal solo test{attitude.score != null ? `: ${attitude.score}/100` : ''}. Risposte a scenari, auto-dichiarate: un indicatore, non una prova.</Body>
          </Card>
        </>
      )}

      {prac && (
        <>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Prova pratica: {prac.title}</Body>
          <Card>
            <Body small muted>{skillLabel(prac.skill)} · tempo concesso {fmtLimit(prac.limitMin)} dal download · peso {prac.weight}/5</Body>
            {!run && !pDone && <Body style={{ marginTop: 8 }}>Il candidato non ha ancora scaricato il test.</Body>}
            {run && !run.submittedAt && !pAns && (
              <Body style={{ marginTop: 8 }} color={Date.now() > deadlineOf(run.startedAt, prac.limitMin) ? t.danger : t.muted}>
                {Date.now() > deadlineOf(run.startedAt, prac.limitMin) ? 'Tempo scaduto e nessuna consegna.' : 'Test scaricato: il candidato sta lavorando.'}
              </Body>
            )}
            {pDone && (
              <View style={{ marginTop: 8 }}>
                {run?.submittedAt && prac ? (
                  <>
                    <Body bold color={run.late ? t.warn : t.positive}>{run.late ? `Consegnata in ritardo di ${fmtDuration(lateMs)}` : 'Consegnata nei tempi'}</Body>
                    <Body small muted style={{ marginTop: 2 }}>Impiegato {fmtDuration(run.submittedAt - run.startedAt)} su {fmtLimit(prac.limitMin)}.{run.late ? ' Decidi tu se tenerne conto: il voto che dai conta comunque.' : ''}</Body>
                  </>
                ) : <Body small muted>Consegna ricevuta.</Body>}
                {pFiles.length === 0 && <Body small muted style={{ marginTop: 6 }}>Nessun file consegnato.</Body>}
                {pFiles.map((f, i) => <FileChip key={i} f={f} label="Apri / scarica" />)}
                {pNote ? <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 8 }}><Body>{pNote}</Body></View> : null}
                {prac.deliverables ? <Body small muted style={{ marginTop: 8 }}>Richiesto: {prac.deliverables}</Body> : null}
                <GradeBox score={app.openScores[PRACTICAL_QID]} onGive={gradeApp(PRACTICAL_QID)} />
              </View>
            )}
          </Card>
        </>
      )}

      {open.length > 0 && (
        <>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Risposte aperte e consegne</Body>
          {open.map((q) => {
            const ans = app.answers.find((a) => a.qid === q.id);
            return (
              <Card key={q.id}>
                <Body small muted>{skillLabel(q.skill)}{q.w && q.w > 1 ? ` · ${q.w} punti` : ''}{q.kind === 'file' ? ' · consegna file' : ''}</Body>
                <View style={{ marginTop: 4 }}><QuestionView q={q} /></View>
                {q.kind === 'file' && (ans?.files?.length ? ans.files.map((f, i) => <FileChip key={i} f={f} label="Apri / scarica" />) : <Body small muted>Nessun file consegnato.</Body>)}
                {(q.kind === 'open' || ans?.value) ? <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 8 }}><Body>{ans?.value ? String(ans.value) : 'Nessuna risposta'}</Body></View> : null}
                {q.rubric ? <Body small muted style={{ marginTop: 6 }}>Cosa cercare: {q.rubric}</Body> : null}
                <GradeBox score={app.openScores[q.id]} onGive={gradeApp(q.id)} />
              </Card>
            );
          })}
        </>
      )}

      <Row style={{ marginTop: 8, marginBottom: 6 }}><Body bold style={{ flex: 1 }}>Ulteriori verifiche</Body><Btn small ghost icon="plus" title="Chiedi una verifica" onPress={() => go('checkRequest', { id: app.id })} disabled={app.status === 'rejected'} /></Row>
      {checks.length === 0 ? <Card><Body small muted>Puoi chiedere in ogni momento un test aggiuntivo, una prova pratica o una verifica dal vivo durante il colloquio. Non si chiedono mai documenti personali.</Body></Card> : checks.map((c) => (
        <Card key={c.id}>
          <Row><View style={{ flex: 1 }}><Body bold>{c.title}</Body><Body small muted>{CHECK_KIND_LABEL[c.kind]()} · {skillLabel(c.skill)}</Body></View><StatusTag text={checkStatusLabel(c)} tone={c.status === 'done' ? 'ok' : c.status === 'declined' || c.status === 'not_done' ? 'warn' : 'muted'} /></Row>
          {c.status === 'declined' && <Body small muted style={{ marginTop: 4 }}>Il candidato ha scelto di non farla. Non è una penalità: la vedi solo come verifica non effettuata.</Body>}
          {c.status === 'done' && c.result && Object.entries(c.result.skillScores).map(([sk, v]) => <SkillRow key={sk} skill={sk} value={v} note={c.result!.pending.length ? 'parte da valutare' : undefined} />)}
          {c.late ? <Body small color={t.warn}>Consegnata in ritardo.</Body> : null}
          {c.status === 'done' && c.kind !== 'live' && checkQuestions(c).filter((q) => q.kind === 'open' || q.kind === 'file').map((q) => {
            const ans = c.answers.find((a) => a.qid === q.id);
            return (
              <View key={q.id} style={{ marginTop: 8 }}>
                {q.id !== CHECK_PRACTICAL_QID && <QuestionView q={q} />}
                {(ans?.files ?? []).map((f, i) => <FileChip key={i} f={f} label="Apri / scarica" />)}
                {ans?.value ? <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 6 }}><Body>{String(ans.value)}</Body></View> : null}
                <GradeBox score={c.openScores[q.id]} onGive={(v) => useJobs.getState().gradeCheckOpen(app.id, c.id, q.id, v)} />
              </View>
            );
          })}
          {c.kind === 'live' && (c.status === 'accepted' || c.status === 'done') && (
            <View style={{ marginTop: 8 }}>
              <Body small bold>Domande da porre</Body>
              {c.liveQuestions.map((q, i) => <Body key={i} small style={{ marginTop: 2 }}>{i + 1}. {q}</Body>)}
              <Body small bold style={{ marginTop: 8 }}>Le tue annotazioni (private: il candidato non le vede)</Body>
              <LiveNotes appId={app.id} checkId={c.id} notes={c.privateNotes} score={c.liveScore} done={c.status === 'done'} />
            </View>
          )}
        </Card>
      ))}

      <Row style={{ marginTop: 14, flexWrap: 'wrap' }} gap={8}>
        <Btn small ghost={app.status !== 'shortlist'} icon="star" title={app.status === 'shortlist' ? 'Nei preferiti' : 'Preferiti'} onPress={() => useJobs.getState().setStatus(app.id, app.status === 'shortlist' ? 'submitted' : 'shortlist')} />
        <Btn small ghost danger title="Non selezionare" onPress={() => setReject(true)} disabled={app.status === 'rejected'} />
      </Row>
      <Body small muted style={{ marginTop: 12 }}>I punteggi aiutano a leggere le risposte, non decidono al posto tuo: decide sempre una persona, e il candidato può contestare. Chi non viene selezionato vede il tuo messaggio: un feedback breve e rispettoso è una buona pratica.</Body>

      <Sheet visible={reject} title="Non selezionare" onClose={() => setReject(false)}>
        <Input multiline style={{ minHeight: 90 }} placeholder="Feedback per il candidato (facoltativo)" value={msg} onChangeText={setMsg} />
        <Btn danger title="Conferma" onPress={() => { useJobs.getState().setStatus(app.id, 'rejected', msg.trim() || 'Grazie per aver fatto il test: per questo ruolo abbiamo scelto altri profili.'); setReject(false); toast('Candidatura chiusa'); }} />
      </Sheet>
      <Sheet visible={outcome} title="Esito del colloquio" onClose={() => setOutcome(false)}>
        <Row style={{ marginBottom: 10 }} gap={8}>
          <Pill label="Si va avanti" on={res === 'next'} onPress={() => setRes('next')} />
          <Pill label="Non si va avanti" on={res === 'rejected'} onPress={() => setRes('rejected')} />
        </Row>
        <Body small muted style={{ marginBottom: 6 }}>Motivi (fino a 3, il candidato li vedrà)</Body>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 8 }} gap={6}>
          {OUTCOME_REASONS.map((x) => <Pill key={x} label={x} on={reasons.includes(x)} onPress={() => setReasons((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : cur.length >= 3 ? cur : [...cur, x]))} />)}
        </Row>
        <Input multiline style={{ minHeight: 80 }} placeholder="Una riga di feedback (facoltativa)" value={note} onChangeText={setNote} />
        <Body small muted style={{ marginBottom: 10 }}>Il contatto sbloccato resta visibile solo se il candidato sceglie di mantenerlo. Nessuna documentazione extra viene richiesta.</Body>
        <Btn title="Salva l’esito" onPress={() => { if (finishWith(app.id, res, reasons, note)) { setOutcome(false); toast('Esito salvato'); } }} />
      </Sheet>
    </Page>
  );
}

function LiveNotes({ appId, checkId, notes, score, done }: { appId: string; checkId: string; notes: string; score?: number; done: boolean }) {
  const [txt, setTxt] = useState(notes);
  const [sc, setSc] = useState<number | undefined>(score);
  return (
    <View>
      <Input multiline style={{ minHeight: 80 }} placeholder="Annotazioni sulle risposte" value={txt} onChangeText={setTxt} />
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>
        {[0, 25, 50, 75, 100].map((v) => <Pill key={v} label={String(v)} on={sc === v} onPress={() => setSc(v)} />)}
      </Row>
      <Row style={{ marginTop: 8 }} gap={8}>
        <Btn small ghost style={{ flex: 1 }} title="Salva" onPress={() => { useJobs.getState().saveLiveCheck(appId, checkId, txt, sc, done); toast('Annotazioni salvate'); }} />
        <Btn small style={{ flex: 1 }} title={done ? 'Aggiorna il voto' : 'Segna come svolta'} onPress={() => { useJobs.getState().saveLiveCheck(appId, checkId, txt, sc, true); toast('Verifica registrata'); }} disabled={sc == null} />
      </Row>
    </View>
  );
}
