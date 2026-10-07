import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SkillRow, TrustCard, scoreTone } from '@/components/jobs';
import { Avatar, Body, Btn, Card, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { skillLabel, traitLabel, traits } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { levelOf } from '@/lib/hiring';
import { fitOfApplication, statusLabel } from '@/lib/jobFit';
import { go } from '@/lib/nav';
import { trustFor } from '@/lib/trust';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { jobQuestions, profileOf, useJobs } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const fmtMs = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${Math.round(ms / 1000)} s`);

export default function ApplicantView() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === id));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  useJobs((s) => s.practice); useNet((s) => s.votes);
  const [reject, setReject] = useState(false);
  const [msg, setMsg] = useState('');
  const [invite, setInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  if (!app || !job || job.owner !== me) return <Page id="applicantView" back><Body muted>Candidatura non trovata.</Body></Page>;

  const n = useJobs.getState().applications.filter((a) => a.jobId === job.id).sort((a, b) => a.submittedAt - b.submittedAt).findIndex((a) => a.id === app.id) + 1;
  const hidden = job.blind && !app.revealed;
  const fit = fitOfApplication(job, app, me);
  const trust = trustFor(app.candidate, me);
  const prof = profileOf(app.candidate);
  const qs = jobQuestions(job);
  const open = qs.filter((q) => q.kind === 'open');
  const r = app.result;

  const sendInvite = () => {
    const text = inviteMsg.trim() || `Ciao! Il tuo test per “${job.title}” ci è piaciuto: vorremmo parlarne con te.`;
    useJobs.getState().setStatus(app.id, 'invited', text);
    const chatId = useChat.getState().ensureDm(app.candidate, me);
    useChat.getState().send(chatId, me, { kind: 'text', text });
    setInvite(false); toast(`${app.candidate} invitato: ora puoi scrivergli`);
  };

  return (
    <Page id="applicantView" back>
      <Row style={{ justifyContent: 'flex-start', marginTop: 8, marginBottom: 6 }} gap={12}>
        {hidden ? <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.muted, fontWeight: '800' }}>#{n}</Text></View> : <Avatar name={app.candidate} size={52} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{hidden ? `Candidato #${n}` : app.candidate}</Text>
          <Body small muted>{job.title} · {statusLabel[app.status]}</Body>
        </View>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: scoreTone(fit.overall, t), fontSize: 30, fontWeight: '800' }}>{fit.overall}</Text><Body small muted>adeguatezza</Body></View>
      </Row>
      {hidden && <Body small muted style={{ marginBottom: 6 }}>Candidatura alla cieca: il nome si rivela quando la inviti. Decidi guardando cosa sa fare.</Body>}

      <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Competenze richieste</Body>
      <Card>
        {job.reqs.map((q) => <SkillRow key={q.skill} skill={q.skill} value={r.skillScores[q.skill] ?? null} min={q.min} note={r.pending.some((id) => qs.find((x) => x.id === id)?.skill === q.skill) ? 'parte da valutare' : levelOf(r.skillScores[q.skill] ?? null)} />)}
        {fit.unmet.length > 0 && <Body small color={t.warn}>Sotto soglia: {fit.unmet.map((u) => skillLabel(u.skill)).join(', ')}. Non è un rifiuto automatico: valuta tu.</Body>}
        {r.flags.map((f) => <Body key={f} small color={t.warn} style={{ marginTop: 4 }}>{f}</Body>)}
        <Body small muted style={{ marginTop: 6 }}>Tempo totale: {fmtMs(r.timeMs)} · {r.answered}/{r.total} domande risposte</Body>
      </Card>

      <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Che persona è</Body>
      <TrustCard trust={trust} profile={prof} />
      {traits.some((x) => r.traits[x] != null) && <Body small muted style={{ marginBottom: 6 }}>In questo test: {traits.filter((x) => r.traits[x] != null).map((x) => `${traitLabel[x]} ${r.traits[x]}`).join(' · ')}{r.consistency != null ? ` · coerenza ${r.consistency}` : ''}</Body>}

      {open.length > 0 && (
        <>
          <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Risposte aperte</Body>
          {open.map((q) => {
            const ans = app.answers.find((a) => a.qid === q.id);
            const score = app.openScores[q.id];
            return (
              <Card key={q.id}>
                <Body small muted>{skillLabel(q.skill)}</Body>
                <Body bold style={{ marginTop: 2 }}>{q.prompt}</Body>
                <View style={{ backgroundColor: t.item, borderRadius: 10, padding: 10, marginTop: 8 }}><Body>{ans?.value ? String(ans.value) : 'Nessuna risposta'}</Body></View>
                {q.rubric ? <Body small muted style={{ marginTop: 6 }}>Cosa cercare: {q.rubric}</Body> : null}
                <Body small style={{ marginTop: 8, marginBottom: 4 }}>Il tuo voto: {score != null ? score : 'da dare'}</Body>
                <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>
                  {[0, 25, 50, 75, 100].map((v) => <Pill key={v} label={String(v)} on={score === v} onPress={() => useJobs.getState().gradeOpen(app.id, q.id, v)} />)}
                </Row>
              </Card>
            );
          })}
        </>
      )}

      <Row style={{ marginTop: 14, flexWrap: 'wrap' }} gap={8}>
        <Btn small ghost={app.status !== 'shortlist'} title={app.status === 'shortlist' ? '★ Nei preferiti' : '☆ Preferiti'} onPress={() => useJobs.getState().setStatus(app.id, app.status === 'shortlist' ? 'submitted' : 'shortlist')} />
        <Btn small title="Invita al colloquio" onPress={() => setInvite(true)} disabled={app.status === 'invited'} />
        <Btn small ghost danger title="Non selezionare" onPress={() => setReject(true)} disabled={app.status === 'rejected'} />
      </Row>
      {app.status === 'invited' && !hidden && <Btn small ghost style={{ marginTop: 8 }} title={`Scrivi a ${app.candidate}`} onPress={() => go('conversationPage', { id: 'dm:' + app.candidate })} />}
      <Body small muted style={{ marginTop: 12 }}>I punteggi aiutano a leggere le risposte, non decidono al posto tuo. Chi non viene selezionato vede il tuo messaggio: un feedback breve e rispettoso è una buona pratica.</Body>

      <Sheet visible={invite} title="Invita al colloquio" onClose={() => setInvite(false)}>
        <Body small muted style={{ marginBottom: 8 }}>Inviandolo, {hidden ? `si rivela il nome del candidato (${app.candidate}) e ` : ''}parte un messaggio nella chat.</Body>
        <Input multiline style={{ minHeight: 90 }} placeholder="Messaggio (facoltativo)" value={inviteMsg} onChangeText={setInviteMsg} />
        <Btn title="Invita" onPress={sendInvite} />
      </Sheet>
      <Sheet visible={reject} title="Non selezionare" onClose={() => setReject(false)}>
        <Input multiline style={{ minHeight: 90 }} placeholder="Feedback per il candidato (facoltativo)" value={msg} onChangeText={setMsg} />
        <Btn danger title="Conferma" onPress={() => { useJobs.getState().setStatus(app.id, 'rejected', msg.trim() || 'Grazie per aver fatto il test: per questo ruolo abbiamo scelto altri profili.'); setReject(false); toast('Candidatura chiusa'); }} />
      </Sheet>
    </Page>
  );
}
