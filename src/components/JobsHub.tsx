import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { SkillRow, scoreTone } from '@/components/jobs';
import { Body, Btn, Card, Empty, Row, Seg, Chev } from '@/components/ui';
import { skillLabel } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { fitOfPerson } from '@/lib/jobFit';
import { candidateStatus, candidateStatusLabel } from '@/lib/interview';
import { go } from '@/lib/nav';
import { trustFor } from '@/lib/trust';
import { useApp } from '@/store/app';
import { profileOf, useJobs } from '@/store/jobs';

/** Scheda "Lavoro" di LifeNetwork: si viene scelti per ciò che si sa fare, non per il curriculum. */
export function JobsHub() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const jobs = useJobs((s) => s.jobs), apps = useJobs((s) => s.applications), practice = useJobs((s) => s.practice);
  const [tab, setTab] = useState('Offerte');
  const profile = useMemo(() => profileOf(me), [me, apps, practice]);
  const trust = trustFor(me, me);
  const top = Object.entries(profile.skills).sort((a, b) => b[1].score - a[1].score).slice(0, 3);
  const open = jobs.filter((j) => j.owner !== me && j.status === 'open');
  const mine = jobs.filter((j) => j.owner === me);
  const myApps = apps.filter((a) => a.candidate === me);

  return (
    <>
      <Card>
        <Row>
          <Body bold>Il tuo profilo competenze</Body>
          <Text style={{ color: t.accent, fontWeight: '700' }} onPress={() => go('skillProfile')}>Apri</Text>
        </Row>
        {top.length === 0 ? <Body small muted style={{ marginTop: 6 }}>Nessun curriculum: qui ti presenti con ciò che sai fare. Fai una prova di 5 minuti per verificare la prima competenza.</Body> : (
          <View style={{ marginTop: 8 }}>{top.map(([sk, r]) => <SkillRow key={sk} skill={sk} value={r.score} />)}</View>
        )}
        <Row style={{ marginTop: 4 }}>
          <Body small muted>Affidabilità</Body>
          <Text style={{ color: scoreTone(trust.score, t), fontWeight: '800' }}>{trust.score == null ? 'dati insufficienti' : `${trust.score}/100`}</Text>
        </Row>
        <Btn small style={{ marginTop: 10 }} title={top.length ? 'Verifica un’altra competenza' : 'Verifica una competenza'} onPress={() => go('skillProfile')} />
      </Card>

      <Seg options={['Offerte', 'Candidature', 'Le mie offerte']} value={tab} onChange={setTab} />

      {tab === 'Offerte' && (open.length === 0 ? <Card><Empty text="Nessuna offerta aperta per ora." /></Card> : open.map((j) => {
        const fit = fitOfPerson(j, me, me);
        const done = myApps.some((a) => a.jobId === j.id);
        return (
          <Card key={j.id} onPress={() => go('jobDetail', { id: j.id })}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Body bold>{j.title}</Body>
                <Body small muted>{j.company} · {j.location} · {j.kind}</Body>
                <Body small muted style={{ marginTop: 4 }}>{j.reqs.map((r) => skillLabel(r.skill)).join(' · ')}</Body>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {done ? <Body small color={t.positive}>Candidato</Body> : <><Text style={{ color: scoreTone(fit.missing.length === j.reqs.length ? null : fit.skillFit, t), fontSize: 22, fontWeight: '800' }}>{fit.missing.length === j.reqs.length ? '—' : fit.skillFit}</Text><Body small muted>{fit.missing.length === j.reqs.length ? 'da verificare' : 'tuo profilo'}</Body></>}
              </View>
            </Row>
          </Card>
        );
      }))}

      {tab === 'Candidature' && (myApps.length === 0 ? <Card><Empty text="Non ti sei ancora candidato: scegli un’offerta e fai il test." /></Card> : myApps.map((a) => {
        const j = jobs.find((x) => x.id === a.jobId);
        const st = candidateStatus(a.status, a.iv);
        return j ? <Card key={a.id} onPress={() => go('interviewView', { id: a.id })}><Row><View style={{ flex: 1 }}><Body bold>{j.title}</Body><Body small muted>{j.company}</Body></View><Body small color={st === 'rejected' || st === 'declined' || st === 'expired' || st === 'not_held' ? t.danger : st === 'evaluating' || st === 'shortlist' ? t.muted : t.positive}>{candidateStatusLabel(st)}</Body></Row></Card> : null;
      }))}

      {tab === 'Le mie offerte' && (
        <>
          <Btn title="+ Pubblica un’offerta con test" onPress={() => go('jobEdit')} />
          {mine.length === 0 ? <Card><Empty text="Cerchi persone? Pubblica un’offerta, scegli cosa devono saper fare e ricevi candidati già misurati." /></Card> : mine.map((j) => {
            const n = apps.filter((a) => a.jobId === j.id).length;
            const pend = apps.filter((a) => a.jobId === j.id && a.result.pending.length).length;
            return <Card key={j.id} onPress={() => go('jobDetail', { id: j.id })}><Row><View style={{ flex: 1 }}><Body bold>{j.title}</Body><Body small muted>{n} {n === 1 ? 'candidato' : 'candidati'}{pend ? ` · ${pend} da valutare` : ''}{j.status === 'closed' ? ' · chiusa' : ''}</Body></View><Chev /></Row></Card>;
          })}
        </>
      )}
      <Body small muted style={{ marginTop: 8 }}>Niente curriculum, scuole o foto: contano prove e segnali verificabili. I punteggi sono un aiuto, la decisione è sempre di una persona.</Body>
    </>
  );
}
