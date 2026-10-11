import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PracticalEditor, QuestionSheet, SkillPicker, Stepper, emptyPractical } from '@/components/jobBuilder';
import { Body, Btn, Card, Input, Page, Row, Seg, XBtn } from '@/components/ui';
import { bank, skillLabel, type Question } from '@/data/skillBank';
import { pickQuestions } from '@/lib/hiring';
import { asksForPersonalDocs, displayName } from '@/lib/interview';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useJobs, type Practical } from '@/store/jobs';
import { toast } from '@/store/toast';

const KINDS = ['Test aggiuntivo', 'Prova pratica', 'Verifica dal vivo'];

/** L'azienda chiede una verifica in più: test (banca + domande proprie), prova pratica a tempo o domande dal vivo. Mai documenti personali. */
export default function CheckRequest() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const app = useJobs((s) => s.applications.find((a) => a.id === id));
  const job = useJobs((s) => s.jobs.find((j) => j.id === app?.jobId));
  const [kind, setKind] = useState(KINDS[0]);
  const [skill, setSkill] = useState(job?.reqs[0]?.skill ?? 'vendite');
  const [title, setTitle] = useState('');
  const [per, setPer] = useState(3);
  const [limit, setLimit] = useState(15);
  const [custom, setCustom] = useState<Question[]>([]);
  const [qSheet, setQSheet] = useState(false);
  const [prac, setPrac] = useState<Practical>(emptyPractical(job?.reqs[0]?.skill ?? 'vendite'));
  const [live, setLive] = useState<string[]>(['']);
  if (!app || !job || job.owner !== me) return <Page id="checkRequest" back><Body muted>Candidatura non trovata.</Body></Page>;
  const name = displayName(app.candidate);
  const picked = job.reqs.map((r) => r.skill);

  const send = () => {
    const base = { skill, title: title.trim() || kind, timeLimitMin: limit };
    let ok: string | null = null;
    if (kind === KINDS[0]) {
      const ids = pickQuestions(bank, [skill], per, Date.now()).map((q) => q.id);
      if (!ids.length && !custom.length) { toast('Scegli una competenza della banca o scrivi una domanda'); return; }
      ok = useJobs.getState().requestCheck(app.id, { ...base, kind: 'test', questionIds: ids, custom, liveQuestions: [] });
    } else if (kind === KINDS[1]) {
      if (!prac.title.trim() || (!prac.instructions.trim() && !prac.files.length)) { toast('Scrivi titolo e istruzioni della prova'); return; }
      ok = useJobs.getState().requestCheck(app.id, { ...base, title: prac.title.trim(), skill: prac.skill, kind: 'practical', questionIds: [], custom: [], liveQuestions: [], practical: { instructions: prac.instructions.trim(), deliverables: prac.deliverables.trim(), files: prac.files, limitMin: prac.limitMin }, timeLimitMin: prac.limitMin });
    } else {
      const qs = live.map((x) => x.trim()).filter(Boolean);
      if (!qs.length) { toast('Scrivi almeno una domanda'); return; }
      ok = useJobs.getState().requestCheck(app.id, { ...base, kind: 'live', questionIds: [], custom: [], liveQuestions: qs });
    }
    if (!ok) { toast(asksForPersonalDocs(title) ? 'Non si possono chiedere documenti personali' : 'Non riesco a inviare la richiesta: non si chiedono CV, foto o documenti'); return; }
    toast(`Richiesta inviata a ${name}`); go('applicantView', { id: app.id });
  };

  return (
    <Page id="checkRequest" back title="Chiedi una verifica">
      <Card>
        <Body small muted>Per {name}. Il candidato vede cosa verrà valutato e il tempo, e può accettare o rifiutare: rifiutare non lo penalizza, tu la vedi come “verifica non effettuata”. Il risultato si aggiunge alle sue competenze per questa candidatura. Nessun documento personale viene richiesto.</Body>
      </Card>
      <Seg options={KINDS} value={kind} onChange={setKind} />
      <Body bold style={{ marginTop: 8, marginBottom: 6 }}>Competenza da verificare</Body>
      <SkillPicker value={skill} onChange={(v) => { setSkill(v); setPrac((p) => ({ ...p, skill: v })); }} options={picked} />

      {kind !== KINDS[1] && <Input style={{ marginTop: 10 }} placeholder="Titolo (es. Verifica su Excel)" value={title} onChangeText={setTitle} />}

      {kind === KINDS[0] && (
        <>
          <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>Domande dalla banca ({skillLabel(skill)})</Body><Stepper value={per} onChange={setPer} min={0} max={5} /></Row>
          <Row style={{ marginTop: 6 }}><Body style={{ flex: 1 }}>Tempo totale</Body><Stepper value={limit} onChange={setLimit} min={5} max={60} step={5} suffix=" min" /></Row>
          {custom.map((q) => <Card key={q.id}><Row><Body small style={{ flex: 1 }}>{q.prompt}</Body><XBtn onPress={() => setCustom((c) => c.filter((x) => x.id !== q.id))} /></Row></Card>)}
          <Btn small ghost icon="plus" style={{ marginTop: 8, alignSelf: 'flex-start' }} title="Scrivi una domanda tua" onPress={() => setQSheet(true)} />
          <QuestionSheet visible={qSheet} onClose={() => setQSheet(false)} onAdd={(q) => { setCustom((c) => [...c.filter((x) => x.id !== q.id), q]); setQSheet(false); }} defaultSkill={skill} extraSkills={[]} />
        </>
      )}
      {kind === KINDS[1] && <View style={{ marginTop: 8 }}><PracticalEditor value={prac} onChange={setPrac} picked={[prac.skill]} /></View>}
      {kind === KINDS[2] && (
        <View style={{ marginTop: 8 }}>
          <Body small muted style={{ marginBottom: 6 }}>Domande da porre in videochiamata. Le tue annotazioni restano private: il candidato non le vede.</Body>
          {live.map((q, i) => (
            <Row key={i} gap={6}><Input flex={1} placeholder={`Domanda ${i + 1}`} value={q} onChangeText={(v) => setLive((l) => l.map((x, j) => (j === i ? v : x)))} />{live.length > 1 && <XBtn onPress={() => setLive((l) => l.filter((_, j) => j !== i))} />}</Row>
          ))}
          <Btn small ghost icon="plus" title="Aggiungi domanda" onPress={() => setLive((l) => [...l, ''])} />
        </View>
      )}
      <Btn style={{ marginTop: 14 }} title="Invia la richiesta" onPress={send} />
    </Page>
  );
}
