import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Btn, Card, Input, Page, Pill, Row, Seg, Sheet, Toggle, IL } from '@/components/ui';
import { bank, skills, skillLabel, type Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { uid } from '@/lib/format';
import { pickQuestions } from '@/lib/hiring';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useJobs, type JobKind } from '@/store/jobs';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

function Stepper({ value, onChange, min, max, step = 1, suffix = '' }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const t = useTheme();
  const b = (label: string, d: number) => <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 18 }}>{label}</Text></Pressable>;
  return <Row gap={8} style={{ justifyContent: 'flex-end' }}>{b('−', -step)}<Text style={{ color: t.text, minWidth: 44, textAlign: 'center', fontWeight: '700' }}>{value}{suffix}</Text>{b('+', step)}</Row>;
}

type Sel = Record<string, { weight: number; min: number }>;

export default function JobEdit() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const existing = useJobs((s) => (id ? s.jobs.find((j) => j.id === id) : undefined));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [company, setCompany] = useState(existing?.company ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [loc, setLoc] = useState(existing?.location ?? '');
  const [kind, setKind] = useState<JobKind>(existing?.kind ?? 'Tempo pieno');
  const [pay, setPay] = useState(existing?.pay ?? '');
  const [sel, setSel] = useState<Sel>(Object.fromEntries((existing?.reqs ?? []).map((r) => [r.skill, { weight: r.weight, min: r.min }])));
  const [per, setPer] = useState(3);
  const [custom, setCustom] = useState<Question[]>(existing?.custom ?? []);
  const [limit, setLimit] = useState(existing?.timeLimitMin ?? 25);
  const [blind, setBlind] = useState(existing?.blind ?? true);
  const [tw, setTw] = useState(String(Math.round((existing?.trustWeight ?? 0.2) * 100)));
  const [qSheet, setQSheet] = useState(false);

  const picked = Object.keys(sel);
  const nQ = existing ? existing.questionIds.length + custom.length : picked.length * per + custom.length;

  function publish() {
    if (!title.trim() || !company.trim()) { toast('Scrivi il ruolo e il nome dell’azienda'); return; }
    if (!picked.length) { toast('Scegli almeno una competenza da verificare'); return; }
    const reqs = picked.map((skill) => ({ skill, ...sel[skill] }));
    const base = { owner: me, company: company.trim(), title: title.trim(), description: desc.trim(), location: loc.trim(), kind, pay: pay.trim(), reqs, custom, timeLimitMin: limit, blind, trustWeight: Number(tw) / 100 };
    if (existing) { useJobs.getState().updateJob(existing.id, { ...base }); toast('Offerta aggiornata'); go('jobDetail', { id: existing.id }); return; }
    const questionIds = pickQuestions(bank, picked, per, Date.now() % 100000).map((q) => q.id);
    const jid = useJobs.getState().createJob({ ...base, questionIds });
    toast('Offerta pubblicata'); go('jobDetail', { id: jid });
  }

  return (
    <Page id="jobEdit" back title={existing ? 'Modifica offerta' : 'Nuova offerta'}>
      <Body small muted style={{ marginBottom: 8 }}>Descrivi il ruolo e scegli cosa deve saper fare chi si candida. Niente richiesta di curriculum: i candidati si dimostrano con prove.</Body>
      <Input placeholder="Ruolo (es. Addetto vendite)" value={title} onChangeText={setTitle} />
      <Input placeholder="Azienda" value={company} onChangeText={setCompany} />
      <Input multiline style={{ minHeight: 90 }} placeholder="Cosa farà, in che contesto, cosa offrite" value={desc} onChangeText={setDesc} />
      <Input placeholder="Dove (es. Lugano · ibrido)" value={loc} onChangeText={setLoc} />
      <Input placeholder="Retribuzione (facoltativo, ma chiara: più candidature)" value={pay} onChangeText={setPay} />
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 6 }} gap={6}>{(['Tempo pieno', 'Part-time', 'Freelance', 'Stage'] as JobKind[]).map((k) => <Pill key={k} label={k} on={kind === k} onPress={() => setKind(k)} />)}</Row>

      <Body bold style={{ marginTop: 10, marginBottom: 6 }}>Competenze da verificare</Body>
      {skills.map((s) => {
        const on = !!sel[s.id];
        return (
          <Card key={s.id} style={{ marginVertical: 4 }}>
            <Pressable onPress={() => setSel((x) => { const n = { ...x }; if (on) delete n[s.id]; else n[s.id] = { weight: 3, min: 60 }; return n; })}>
              <Row><View style={{ flex: 1 }}><IL icon={on ? 'checksquare' : 'square'} bold>{s.label}</IL><Body small muted>{s.desc}</Body></View></Row>
            </Pressable>
            {on && (
              <View style={{ marginTop: 8 }}>
                <Row><Body small>Importanza (1-5)</Body><Stepper value={sel[s.id].weight} min={1} max={5} onChange={(v) => setSel((x) => ({ ...x, [s.id]: { ...x[s.id], weight: v } }))} /></Row>
                <Row style={{ marginTop: 6 }}><Body small>Punteggio minimo</Body><Stepper value={sel[s.id].min} min={0} max={100} step={5} onChange={(v) => setSel((x) => ({ ...x, [s.id]: { ...x[s.id], min: v } }))} /></Row>
              </View>
            )}
          </Card>
        );
      })}
      {!existing && <Row style={{ marginTop: 6 }}><Body small>Domande per competenza</Body><Stepper value={per} min={2} max={5} onChange={setPer} /></Row>}

      <Body bold style={{ marginTop: 12, marginBottom: 6 }}>Le tue domande</Body>
      <Body small muted style={{ marginBottom: 6 }}>Aggiungi una prova pratica tua (es. “scrivi la risposta a questo cliente”). Le domande aperte le valuti tu.</Body>
      {custom.map((q) => <Card key={q.id} style={{ marginVertical: 3 }}><Row><Body small style={{ flex: 1 }} numberOfLines={2}>{q.prompt}</Body><Pressable onPress={() => setCustom(custom.filter((x) => x.id !== q.id))}><Text style={{ color: t.danger }}>Rimuovi</Text></Pressable></Row></Card>)}
      <Btn small ghost title="+ Aggiungi domanda" onPress={() => setQSheet(true)} />

      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Regole</Body>
      <Card>
        <Row><Body small>Tempo massimo</Body><Stepper value={limit} min={5} max={90} step={5} suffix=" min" onChange={setLimit} /></Row>
        <Toggle label="Candidature alla cieca" hint="Vedi competenze e affidabilità, non nome né foto, finché non scegli di invitare. Riduce i pregiudizi." value={blind} onChange={setBlind} />
        <Body small muted style={{ marginTop: 6, marginBottom: 6 }}>Peso dell’affidabilità nel punteggio finale</Body>
        <Seg options={['0', '10', '20', '30']} value={tw} onChange={setTw} />
        <Body small muted style={{ marginTop: 6 }}>{tw}% affidabilità · {100 - Number(tw)}% competenze</Body>
      </Card>

      <Card>
        <Body bold>Riepilogo</Body>
        <Body small muted style={{ marginTop: 4 }}>{nQ} domande · {limit} min · {picked.map(skillLabel).join(', ') || 'nessuna competenza'}</Body>
        <Body small muted style={{ marginTop: 4 }}>I punteggi aiutano a ordinare i candidati: la decisione resta tua. Non chiedere né usare età, foto, nazionalità o altri dati personali per scartare candidati.</Body>
      </Card>
      <Btn title={existing ? 'Salva modifiche' : 'Pubblica offerta'} onPress={publish} />
      <QuestionSheet visible={qSheet} onClose={() => setQSheet(false)} onAdd={(q) => { setCustom((c) => [...c, q]); setQSheet(false); }} />
    </Page>
  );
}

function QuestionSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (q: Question) => void }) {
  const t = useTheme();
  const [kind, setKind] = useState('Aperta');
  const [prompt, setPrompt] = useState('');
  const [rubric, setRubric] = useState('');
  const [opts, setOpts] = useState(['', '', '']);
  const [correct, setCorrect] = useState(0);
  const [answer, setAnswer] = useState('');
  const [skill, setSkill] = useState('problem');
  function add() {
    if (!prompt.trim()) { toast('Scrivi la domanda'); return; }
    const id = 'c-' + uid();
    if (kind === 'Aperta') onAdd({ id, skill, kind: 'open', prompt: prompt.trim(), rubric: rubric.trim() || undefined });
    else if (kind === 'Numero') { const n = Number(answer.replace(',', '.')); if (!Number.isFinite(n)) { toast('Scrivi la risposta esatta (numero)'); return; } onAdd({ id, skill, kind: 'number', prompt: prompt.trim(), answer: n, tol: 0.01 }); }
    else { const o = opts.map((x) => x.trim()).filter(Boolean); if (o.length < 2 || correct >= o.length) { toast('Servono almeno 2 opzioni e una risposta corretta'); return; } onAdd({ id, skill, kind: 'mc', prompt: prompt.trim(), options: o.map((x, i) => ({ t: x, score: i === correct ? 100 : 0 })) }); }
    setPrompt(''); setRubric(''); setOpts(['', '', '']); setAnswer(''); setCorrect(0);
  }
  return (
    <Sheet visible={visible} title="Nuova domanda" onClose={onClose}>
      <Seg options={['Aperta', 'Scelta', 'Numero']} value={kind} onChange={setKind} />
      <Body small muted style={{ marginTop: 8, marginBottom: 4 }}>Competenza a cui conta</Body>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>{skills.map((s) => <Pill key={s.id} label={s.label} on={skill === s.id} onPress={() => setSkill(s.id)} />)}</Row>
      <Input multiline style={{ minHeight: 80, marginTop: 8 }} placeholder="Domanda o compito" value={prompt} onChangeText={setPrompt} />
      {kind === 'Aperta' && <Input placeholder="Cosa cerchi in una buona risposta (solo per te)" value={rubric} onChangeText={setRubric} />}
      {kind === 'Numero' && <Input keyboardType="numeric" placeholder="Risposta esatta" value={answer} onChangeText={setAnswer} />}
      {kind === 'Scelta' && opts.map((o, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <Pressable onPress={() => setCorrect(i)} style={{ paddingTop: 14 }}><Icon name={correct === i ? 'checksquare' : 'circle'} size={20} color={correct === i ? t.positive : t.muted} /></Pressable>
          <Input flex={1} placeholder={`Opzione ${i + 1}${correct === i ? ' (corretta)' : ''}`} value={o} onChangeText={(v) => setOpts(opts.map((x, j) => (j === i ? v : x)))} />
        </Row>
      ))}
      <Btn title="Aggiungi" onPress={add} />
    </Sheet>
  );
}
