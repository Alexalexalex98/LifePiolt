import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SkillRow } from '@/components/jobs';
import { Body, Btn, Card, Input, Page, Row } from '@/components/ui';
import { skillLabel, traitLabel, traits, type Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { go, goBack } from '@/lib/nav';
import type { Answer, TestResult } from '@/lib/hiring';
import { useApp } from '@/store/app';
import { jobQuestions, practiceQuestions, useJobs } from '@/store/jobs';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export default function JobTest() {
  const t = useTheme();
  const { job: jobId, skill } = useLocalSearchParams<{ job?: string; skill?: string }>();
  const me = useApp((s) => s.account.name);
  const job = useJobs((s) => s.jobs.find((j) => j.id === jobId));
  const already = useJobs((s) => !!jobId && s.applications.some((a) => a.jobId === jobId && a.candidate === me));
  const questions: Question[] = useMemo(() => (job ? jobQuestions(job) : skill ? practiceQuestions(skill) : []), [job, skill]);
  const limitSec = job ? job.timeLimitMin * 60 : skill === 'atteggiamento' ? 12 * 60 : 8 * 60;

  const [stage, setStage] = useState<'intro' | 'run' | 'done'>('intro');
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [cur, setCur] = useState<number | string | null>(null);
  const [left, setLeft] = useState(limitSec);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const qStart = useRef(Date.now());
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;

  useEffect(() => {
    if (stage !== 'run') return;
    const id = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(id);
  }, [stage]);
  useEffect(() => { if (stage === 'run' && left <= 0) finish(answersRef.current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [left, stage]);

  if (!questions.length) return <Page id="jobTest" back><Body muted>Test non trovato.</Body></Page>;
  if (job && already && stage !== 'done') return <Page id="jobTest" back title="Già inviato"><Body>Hai già completato il test per questa offerta. Puoi seguire lo stato dalla pagina dell’offerta.</Body><Btn style={{ marginTop: 12 }} title="Torna all’offerta" onPress={() => go('jobDetail', { id: job.id })} /></Page>;

  const q = questions[i];
  const title = job ? job.title : skill === 'atteggiamento' ? 'Prova di atteggiamento' : skillLabel(skill ?? '');

  function commit(skip = false): Answer[] {
    const a: Answer = { qid: q.id, value: skip ? null : cur, ms: Date.now() - qStart.current };
    const next = [...answersRef.current.filter((x) => x.qid !== q.id), a];
    setAnswers(next); return next;
  }
  function finish(all: Answer[]) {
    if (stage === 'done') return;
    if (job) {
      const id = useJobs.getState().apply(job.id, me, all);
      if (!id) { toast('Candidatura già inviata'); return; }
      setResult(useJobs.getState().applications.find((x) => x.id === id)?.result ?? null);
    } else if (skill) {
      setResult(useJobs.getState().recordPractice(me, skill, questions, all).result);
    }
    setStage('done');
  }
  function next(skip = false) {
    const all = commit(skip);
    if (i + 1 >= questions.length) finish(all);
    else { setI(i + 1); setCur(null); qStart.current = Date.now(); }
  }

  if (stage === 'intro') {
    return (
      <Page id="jobTest" back title={title}>
        <Card>
          <Body bold>{questions.length} domande · {Math.round(limitSec / 60)} minuti</Body>
          <Body small muted style={{ marginTop: 6 }}>{job ? `Per l’offerta “${job.title}” di ${job.company}. ` : ''}Si risponde una domanda alla volta e non si può tornare indietro. Alcune domande hanno una risposta giusta, altre misurano come ti comporteresti: rispondi come faresti davvero, non come pensi “si debba” rispondere. Le risposte incoerenti lo rendono visibile.</Body>
        </Card>
        {job && (
          <Card>
            <Body bold>Cosa vede chi assume</Body>
            <Body small muted style={{ marginTop: 4 }}>• I tuoi punteggi per ogni competenza richiesta e l’indice di affidabilità (con le sue componenti).{'\n'}• I tempi di risposta e le tue risposte alle domande aperte.{'\n'}• {job.blind ? 'Il tuo nome e la tua foto restano nascosti finché non ti invitano.' : 'Il tuo nome e la tua foto.'}{'\n'}Non vengono richiesti scuola, età, foto o curriculum.</Body>
            <Pressable onPress={() => setConsent(!consent)} style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name={consent ? 'checksquare' : 'square'} size={20} color={consent ? t.accent : t.muted} /><Text style={{ color: t.text, flex: 1 }}>Accetto che questi dati siano visibili a {job.owner}</Text></Pressable>
          </Card>
        )}
        <Btn title="Inizia" disabled={!!job && !consent} onPress={() => { qStart.current = Date.now(); setStage('run'); }} />
      </Page>
    );
  }

  if (stage === 'done') {
    return (
      <Page id="jobTest" title="Fatto">
        <Card>
          <Body bold style={{ fontSize: 18 }}>{job ? 'Candidatura inviata' : 'Prova completata'}</Body>
          <Body small muted style={{ marginTop: 4 }}>{job ? `${job.owner} vedrà questi risultati.` : 'Il risultato è stato aggiunto al tuo profilo competenze.'}</Body>
        </Card>
        {result && (
          <Card>
            {Object.entries(result.skillScores).map(([sk, v]) => <SkillRow key={sk} skill={sk} value={v} note={result.pending.some((id) => questions.find((x) => x.id === id)?.skill === sk) ? 'domande aperte in valutazione' : undefined} />)}
            {traits.some((x) => result.traits[x] != null) && <Body small muted>{traits.filter((x) => result.traits[x] != null).map((x) => `${traitLabel[x]} ${result.traits[x]}`).join(' · ')}{result.consistency != null ? ` · coerenza ${result.consistency}` : ''}</Body>}
            {result.flags.map((f) => <Body key={f} small color={t.warn} style={{ marginTop: 4 }}>{f}</Body>)}
          </Card>
        )}
        <Btn title={job ? 'Vai all’offerta' : 'Vedi il mio profilo'} onPress={() => (job ? go('jobDetail', { id: job.id }) : go('skillProfile'))} />
        <Btn ghost style={{ marginTop: 8 }} title="Chiudi" onPress={goBack} />
      </Page>
    );
  }

  return (
    <Page id="jobTest" title={title} noTop>
      <Row style={{ marginBottom: 8 }}>
        <Body small muted>Domanda {i + 1} di {questions.length}</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="timer" size={16} color={left < 60 ? t.danger : t.text} /><Text style={{ color: left < 60 ? t.danger : t.text, fontWeight: '800' }}>{fmt(left)}</Text></View>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.item, marginBottom: 14 }}><View style={{ height: 4, borderRadius: 2, width: `${((i) / questions.length) * 100}%`, backgroundColor: t.accent }} /></View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Body bold style={{ fontSize: 17, marginBottom: 12 }}>{q.prompt}</Body>
        {q.kind === 'open' && <Input multiline placeholder="Scrivi la tua risposta…" value={String(cur ?? '')} onChangeText={setCur} />}
        {q.kind === 'number' && <Input keyboardType="numeric" placeholder="Scrivi solo il numero" value={String(cur ?? '')} onChangeText={setCur} />}
        {(q.kind === 'mc' || q.kind === 'scenario') && q.options!.map((o, idx) => (
          <Pressable key={idx} onPress={() => setCur(idx)} style={{ borderWidth: 1.5, borderColor: cur === idx ? t.accent : t.border, backgroundColor: cur === idx ? t.chip : t.card, borderRadius: 14, padding: 14, marginBottom: 8 }}>
            <Body>{o.t}</Body>
          </Pressable>
        ))}
        <Btn style={{ marginTop: 8 }} title={i + 1 >= questions.length ? 'Concludi' : 'Avanti'} onPress={() => next()} disabled={cur == null || cur === ''} />
        <Btn ghost small style={{ marginTop: 8 }} title="Salta questa domanda" onPress={() => next(true)} />
      </ScrollView>
    </Page>
  );
}
