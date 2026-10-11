import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { SkillRow } from '@/components/jobs';
import { FileList, QuestionView } from '@/components/jobFiles';
import { Body, Btn, Card, Input, Page, Row } from '@/components/ui';
import { skillLabel, traitLabel, traits, type FileRef, type Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { fmtLimit } from '@/lib/hiring';
import { pickFiles, pickImages } from '@/lib/jobFiles';
import { go, goBack } from '@/lib/nav';
import type { Answer, TestResult } from '@/lib/hiring';
import { useApp } from '@/store/app';
import { checkQuestions, jobQuestions, practiceQuestions, useJobs } from '@/store/jobs';
import { PrivacyCard } from '@/components/jobs/InterviewParts';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';
import { translateText } from '@/i18n/core';

const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export default function JobTest() {
  const t = useTheme();
  const { job: jobId, skill, check: checkParam } = useLocalSearchParams<{ job?: string; skill?: string; check?: string }>();
  const [chkApp = '', chkId = ''] = (checkParam ?? '').split(':');
  const chk = useJobs((s) => s.applications.find((a) => a.id === chkApp)?.checks?.find((c) => c.id === chkId));
  const me = useApp((s) => s.account.name);
  const job = useJobs((s) => s.jobs.find((j) => j.id === jobId));
  const already = useJobs((s) => !!jobId && s.applications.some((a) => a.jobId === jobId && a.candidate === me));
  const questions: Question[] = useMemo(() => (chk ? checkQuestions(chk) : job ? jobQuestions(job) : skill ? practiceQuestions(skill) : []), [job, skill, chk]);
  const limitSec = chk ? chk.timeLimitMin * 60 : job ? job.timeLimitMin * 60 : skill === 'atteggiamento' ? 12 * 60 : 8 * 60;

  const [stage, setStage] = useState<'intro' | 'run' | 'done'>('intro');
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [cur, setCur] = useState<number | string | null>(null);
  const [curFiles, setCurFiles] = useState<FileRef[]>([]);
  const [left, setLeft] = useState(limitSec);
  const [qLeft, setQLeft] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const qStart = useRef(Date.now());
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;

  useEffect(() => {
    if (stage !== 'run') return;
    const id = setInterval(() => { setLeft((x) => x - 1); setQLeft((x) => (x == null ? x : x - 1)); }, 1000);
    return () => clearInterval(id);
  }, [stage]);
  useEffect(() => { if (stage === 'run' && qLeft != null && qLeft <= 0) next(!hasValue()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [qLeft, stage]);
  useEffect(() => { if (stage === 'run' && left <= 0) finish(answersRef.current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [left, stage]);

  if (!questions.length) return <Page id="jobTest" back><Body muted>Test non trovato.</Body></Page>;
  if (chk && chk.status !== 'accepted' && stage !== 'done') return <Page id="jobTest" back title="Verifica"><Body>Questa verifica non è più disponibile.</Body><Btn style={{ marginTop: 12 }} title="Torna alla candidatura" onPress={() => go('interviewView', { id: chkApp })} /></Page>;
  if (job && already && stage !== 'done') return <Page id="jobTest" back title="Già inviato"><Body>Hai già completato il test per questa offerta. Puoi seguire lo stato dalla pagina dell’offerta.</Body><Btn style={{ marginTop: 12 }} title="Torna all’offerta" onPress={() => go('jobDetail', { id: job.id })} /></Page>;

  const q = questions[i];
  const title = chk ? chk.title : job ? job.title : skill === 'atteggiamento' ? 'Prova di atteggiamento' : skillLabel(skill ?? '');

  function commit(skip = false): Answer[] {
    const a: Answer = { qid: q.id, value: skip ? null : cur, ms: Date.now() - qStart.current, ...(!skip && curFiles.length ? { files: curFiles } : {}) };
    const next = [...answersRef.current.filter((x) => x.qid !== q.id), a];
    setAnswers(next); return next;
  }
  function finish(all: Answer[]) {
    if (stage === 'done') return;
    if (chk) {
      if (!useJobs.getState().submitCheckTest(chkApp, chkId, all)) { toast('Non riesco a inviare la verifica'); return; }
      setResult(useJobs.getState().applications.find((x) => x.id === chkApp)?.checks?.find((c) => c.id === chkId)?.result ?? null);
    } else if (job) {
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
    else { setI(i + 1); setCur(null); setCurFiles([]); qStart.current = Date.now(); setQLeft(questions[i + 1].limitSec ?? null); }
  }
  function hasValue() { return (cur != null && cur !== '') || curFiles.length > 0; }

  if (stage === 'intro') {
    return (
      <Page id="jobTest" back title={title}>
        <Card>
          <Body bold>{questions.length} domande · {fmtLimit(Math.round(limitSec / 60))}</Body>
          <Body small muted style={{ marginTop: 6 }}>{job ? `Per l’offerta “${job.title}” di ${job.company}. ` : ''}Si risponde una domanda alla volta e non si può tornare indietro. Alcune domande hanno una risposta giusta, altre misurano come ti comporteresti: rispondi come faresti davvero, non come pensi “si debba” rispondere. Le risposte incoerenti lo rendono visibile.{questions.some((x) => x.limitSec) ? ' Alcune domande hanno un tempo proprio: allo scadere si passa alla successiva.' : ''}{job?.practical ? ` Dopo il test trovi nella pagina dell’offerta la prova pratica (${job.practical.title}): il suo tempo parte solo quando scarichi i file.` : ''}</Body>
        </Card>
        {job && !chk && (
          <>
            <PrivacyCard />
            <Card>
              <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name={consent ? 'checksquare' : 'square'} size={20} color={consent ? t.accent : t.muted} /><Text style={{ color: t.text, flex: 1 }}>Accetto che {job.owner} veda questi dati (solo il mio nome e le mie prove)</Text></Pressable>
              <Body small muted style={{ marginTop: 6 }}>Finché non c’è il server, candidature e inviti funzionano solo tra utenti demo su questo telefono. Puoi ritirare la candidatura quando vuoi.</Body>
            </Card>
          </>
        )}
        <Btn title="Inizia" disabled={!!job && !chk && !consent} onPress={() => { qStart.current = Date.now(); setQLeft(questions[0].limitSec ?? null); setStage('run'); }} />
      </Page>
    );
  }

  if (stage === 'done') {
    return (
      <Page id="jobTest" title="Fatto">
        <Card>
          <Body bold style={{ fontSize: 18 }}>{chk ? 'Verifica inviata' : job ? 'Candidatura inviata' : 'Prova completata'}</Body>
          <Body small muted style={{ marginTop: 4 }}>{chk ? 'L’azienda vedrà il risultato, aggiunto alle tue competenze per questa candidatura.' : job ? `${job.owner} vedrà questi risultati.` : 'Il risultato è stato aggiunto al tuo profilo competenze.'}</Body>
        </Card>
        {result && (
          <Card>
            {Object.entries(result.skillScores).map(([sk, v]) => <SkillRow key={sk} skill={sk} value={v} note={result.pending.some((id) => questions.find((x) => x.id === id)?.skill === sk) ? 'domande aperte in valutazione' : undefined} />)}
            {traits.some((x) => result.traits[x] != null) && <Body small muted>{traits.filter((x) => result.traits[x] != null).map((x) => `${traitLabel[x]} ${result.traits[x]}`).join(' · ')}{result.consistency != null ? ` · coerenza ${result.consistency}` : ''}</Body>}
            {result.flags.map((f) => <Body key={f} small color={t.warn} style={{ marginTop: 4 }}>{f}</Body>)}
          </Card>
        )}
        <Btn title={chk ? 'Torna alla candidatura' : job ? 'Vai alla mia candidatura' : 'Vedi il mio profilo'} onPress={() => (chk ? go('interviewView', { id: chkApp }) : job ? go('interviewView', { id: useJobs.getState().applications.find((a) => a.jobId === job.id && a.candidate === me)?.id ?? '' }) : go('skillProfile'))} />
        <Btn ghost style={{ marginTop: 8 }} title="Chiudi" onPress={goBack} />
      </Page>
    );
  }

  return (
    <Page id="jobTest" title={title} noTop>
      <Row style={{ marginBottom: 8 }}>
        <Body small muted>Domanda {i + 1} di {questions.length}</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {qLeft != null && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="clock" size={15} color={qLeft < 10 ? t.danger : t.muted} /><Text style={{ color: qLeft < 10 ? t.danger : t.muted, fontWeight: '700' }} accessibilityLabel={translateText("Tempo per questa domanda")}>{fmt(qLeft)}</Text></View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="timer" size={16} color={left < 60 ? t.danger : t.text} /><Text style={{ color: left < 60 ? t.danger : t.text, fontWeight: '800' }} accessibilityLabel={translateText("Tempo totale rimasto")}>{fmt(left)}</Text></View>
        </View>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.item, marginBottom: 14 }}><View style={{ height: 4, borderRadius: 2, width: `${((i) / questions.length) * 100}%`, backgroundColor: t.accent }} /></View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <QuestionView q={q} />
        {q.kind === 'open' && <Input multiline placeholder="Scrivi la tua risposta…" value={String(cur ?? '')} onChangeText={setCur} />}
        {q.kind === 'number' && (
          <Row gap={8}>
            <Input flex={1} keyboardType="numeric" placeholder={`Scrivi solo il numero${q.unit ? ` (in ${q.unit})` : ''}`} value={String(cur ?? '')} onChangeText={setCur} />
            {q.unit ? <Body bold muted style={{ marginBottom: 8 }}>{q.unit}</Body> : null}
          </Row>
        )}
        {q.kind === 'file' && (
          <View>
            <Body small muted style={{ marginBottom: 4 }}>Carica il file della risposta (Excel, PDF, Word, immagini...).</Body>
            <FileList files={curFiles} onRemove={(k) => setCurFiles(curFiles.filter((_, j) => j !== k))} label="Allegato" />
            <Row style={{ justifyContent: 'flex-start', marginTop: 8, marginBottom: 8, flexWrap: 'wrap' }} gap={8}>
              <Btn small ghost icon="paperclip" title="Carica file" onPress={async () => { try { const f = await pickFiles(true); if (f.length) setCurFiles([...curFiles, ...f]); } catch { toast('Impossibile scegliere il file'); } }} />
              <Btn small ghost icon="image" title="Scegli immagine" onPress={async () => { try { const f = await pickImages(true); if (f.length) setCurFiles([...curFiles, ...f]); } catch { toast('Impossibile scegliere l’immagine'); } }} />
            </Row>
            <Input multiline style={{ minHeight: 70 }} placeholder="Nota per chi valuta (facoltativa)" value={String(cur ?? '')} onChangeText={setCur} />
          </View>
        )}
        {(q.kind === 'mc' || q.kind === 'scenario') && q.options!.map((o, idx) => (
          <Pressable key={idx} onPress={() => setCur(idx)} accessibilityRole="radio" accessibilityState={{ selected: cur === idx }} style={{ borderWidth: 1.5, borderColor: cur === idx ? t.accent : t.border, backgroundColor: cur === idx ? t.chip : t.card, borderRadius: 14, padding: 14, marginBottom: 8 }}>
            <Body>{o.t}</Body>
          </Pressable>
        ))}
        <Btn style={{ marginTop: 8 }} title={i + 1 >= questions.length ? 'Concludi' : 'Avanti'} onPress={() => next()} disabled={!hasValue()} />
        <Btn ghost small style={{ marginTop: 8 }} title="Salta questa domanda" onPress={() => next(true)} />
      </ScrollView>
    </Page>
  );
}
