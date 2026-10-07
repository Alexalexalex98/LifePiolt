import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SkillRow, scoreTone } from '@/components/jobs';
import { Avatar, Body, Btn, Card, Empty, Page, Pill, Row, Sheet } from '@/components/ui';
import { skillLabel } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { fitOfApplication, fitOfPerson, statusLabel } from '@/lib/jobFit';
import { go, goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { jobQuestions, profileOf, useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';

export default function JobDetail() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const job = useJobs((s) => s.jobs.find((j) => j.id === id));
  const apps = useJobs((s) => s.applications);
  useJobs((s) => s.practice);
  const [filter, setFilter] = useState('Tutti');
  const [del, setDel] = useState(false);

  const mine = job?.owner === me;
  const jobApps = useMemo(() => apps.filter((a) => a.jobId === id).sort((a, b) => a.submittedAt - b.submittedAt), [apps, id]);
  const ranked = useMemo(() => (job ? jobApps.map((a, n) => ({ a, n: n + 1, fit: fitOfApplication(job, a, me) })).sort((x, y) => y.fit.overall - x.fit.overall) : []), [jobApps, job, me]);
  if (!job) return <Page id="jobDetail" back><Body muted>Offerta non trovata.</Body></Page>;
  const myApp = jobApps.find((a) => a.candidate === me);
  const nQ = jobQuestions(job).length;
  const myFit = !mine ? fitOfPerson(job, me, me) : null;
  const myProf = profileOf(me);
  const shown = ranked.filter((r) => filter === 'Tutti' || (filter === 'Preferiti' ? r.a.status === 'shortlist' || r.a.status === 'invited' : filter === 'Da valutare' ? r.a.result.pending.length > 0 : true));

  return (
    <Page id="jobDetail" back>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 10 }}>{job.title}</Text>
      <Body muted>{job.company} · {job.location} · {job.kind}{job.pay ? ` · ${job.pay}` : ''}</Body>
      {job.status === 'closed' && <Body small color={t.warn} style={{ marginTop: 4 }}>Offerta chiusa</Body>}
      <Card style={{ marginTop: 10 }}><Body>{job.description || 'Nessuna descrizione.'}</Body></Card>

      <Body bold style={{ marginTop: 6, marginBottom: 6 }}>Cosa deve saper fare</Body>
      <Card>
        {job.reqs.map((r) => mine
          ? <Row key={r.skill} style={{ marginBottom: 8 }}><Body small bold style={{ flex: 1 }}>{skillLabel(r.skill)}</Body><Body small muted>importanza {r.weight}/5 · minimo {r.min}</Body></Row>
          : <SkillRow key={r.skill} skill={r.skill} value={myProf.skills[r.skill]?.score ?? null} min={r.min} note={`importanza ${r.weight}/5`} />)}
        <Body small muted>Il test dura circa {job.timeLimitMin} minuti ({nQ} domande). {job.blind ? 'Candidature alla cieca: chi assume non vede nome né foto finché non ti invita.' : ''}</Body>
      </Card>

      {!mine && (
        <>
          {myFit && (
            <Card>
              <Body bold>Il tuo profilo per questo ruolo</Body>
              <Body small muted style={{ marginTop: 4 }}>{myFit.missing.length === job.reqs.length ? 'Non hai ancora competenze verificate per questo ruolo: il test le misura.' : `Con le competenze già verificate: ${myFit.skillFit}/100${myFit.missing.length ? ` · da verificare: ${myFit.missing.map(skillLabel).join(', ')}` : ''}.`}</Body>
              <Btn small ghost style={{ marginTop: 8 }} title="Il mio profilo competenze" onPress={() => go('skillProfile')} />
            </Card>
          )}
          {myApp ? (
            <Card>
              <Body bold>La tua candidatura: {statusLabel[myApp.status]}</Body>
              {myApp.feedback ? <Body small style={{ marginTop: 6 }}>Messaggio di {job.owner}: “{myApp.feedback}”</Body> : null}
              {myApp.status === 'invited' && <Btn small style={{ marginTop: 8 }} title={`Scrivi a ${job.owner}`} onPress={() => go('conversationPage', { id: 'dm:' + job.owner })} />}
              {myApp.result.pending.length > 0 && <Body small muted style={{ marginTop: 6 }}>Alcune risposte aperte sono in attesa di valutazione.</Body>}
            </Card>
          ) : job.status === 'open' ? <Btn title="Fai il test e candidati" onPress={() => go('jobTest', { job: job.id })} /> : null}
        </>
      )}

      {mine && (
        <>
          <Row style={{ marginTop: 10, marginBottom: 6 }}><Body bold>{ranked.length} {ranked.length === 1 ? 'candidato' : 'candidati'}</Body></Row>
          <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 6 }} gap={6}>{['Tutti', 'Preferiti', 'Da valutare'].map((f) => <Pill key={f} label={f} on={filter === f} onPress={() => setFilter(f)} />)}</Row>
          {shown.length === 0 ? <Card><Empty text="Nessun candidato per ora." /></Card> : shown.map(({ a, n, fit }) => {
            const hidden = job.blind && !a.revealed;
            return (
              <Card key={a.id} onPress={() => go('applicantView', { id: a.id })}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
                    {hidden ? <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.muted, fontWeight: '800' }}>#{n}</Text></View> : <Avatar name={a.candidate} size={38} />}
                    <View style={{ flex: 1 }}>
                      <Body bold>{hidden ? `Candidato #${n}` : a.candidate}</Body>
                      <Body small muted>{statusLabel[a.status]}{a.result.pending.length ? ' · da valutare' : ''}</Body>
                    </View>
                  </Row>
                  <View style={{ alignItems: 'flex-end' }}><Text style={{ color: scoreTone(fit.overall, t), fontSize: 24, fontWeight: '800' }}>{fit.overall}</Text><Body small muted>adeguatezza</Body></View>
                </Row>
                <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 8 }} gap={6}>
                  {job.reqs.map((r) => { const v = a.result.skillScores[r.skill] ?? null; return <Text key={r.skill} style={{ color: v != null && v >= r.min ? t.positive : t.danger, fontSize: 11, backgroundColor: t.item, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>{skillLabel(r.skill).split(' ')[0]} {v ?? '—'}</Text>; })}
                  {fit.trust != null && <Text style={{ color: scoreTone(fit.trust, t), fontSize: 11, backgroundColor: t.item, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>Affidabilità {fit.trust}</Text>}
                </Row>
              </Card>
            );
          })}
          <Body small muted style={{ marginTop: 6 }}>L’ordine aiuta a leggere i risultati: non è una decisione. Guarda le risposte aperte e parla con le persone prima di scegliere.</Body>
          <Row style={{ marginTop: 12 }} gap={8}>
            <Btn small ghost style={{ flex: 1 }} title="Modifica" onPress={() => go('jobEdit', { id: job.id })} />
            <Btn small ghost style={{ flex: 1 }} title={job.status === 'open' ? 'Chiudi offerta' : 'Riapri'} onPress={() => useJobs.getState().updateJob(job.id, { status: job.status === 'open' ? 'closed' : 'open' })} />
            <Btn small ghost danger style={{ flex: 1 }} title="Elimina" onPress={() => setDel(true)} />
          </Row>
          <Sheet visible={del} title="Eliminare l’offerta?" onClose={() => setDel(false)}>
            <Body small muted style={{ marginBottom: 10 }}>Verranno eliminate anche le candidature ricevute.</Body>
            <Btn danger title="Elimina" onPress={() => { useJobs.getState().deleteJob(job.id); setDel(false); toast('Offerta eliminata'); goBack(); }} />
          </Sheet>
        </>
      )}
    </Page>
  );
}
void Pressable;
