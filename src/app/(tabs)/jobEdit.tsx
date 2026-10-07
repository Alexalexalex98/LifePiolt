import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LibrarySheet, PracticalEditor, QuestionSheet, Stepper, emptyPractical } from '@/components/jobBuilder';
import { Body, Btn, Card, Input, Page, Pill, Row, Seg, Toggle, IL } from '@/components/ui';
import { bank, customSkill, isCustomSkill, skills, skillLabel, type Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { fmtLimit, pickQuestions } from '@/lib/hiring';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useJobs, type JobKind, type Practical } from '@/store/jobs';
import { toast } from '@/store/toast';

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
  const [editQ, setEditQ] = useState<Question | undefined>();
  const [libSheet, setLibSheet] = useState(false);
  const [practical, setPractical] = useState<Practical | null>(existing?.practical ?? null);
  const [newSkill, setNewSkill] = useState('');
  const lib = useJobs((s) => s.library).filter((x) => x.owner === me).length;

  const picked = Object.keys(sel);
  const nQ = (existing ? existing.questionIds.length + custom.length : picked.length * per + custom.length) + (practical ? 1 : 0);
  const customIds = [...new Set([...picked, ...custom.map((q) => q.skill)].filter(isCustomSkill))];

  function addQ(q: Question) {
    setCustom((c) => (c.some((x) => x.id === q.id) ? c.map((x) => (x.id === q.id ? q : x)) : [...c, q]));
    setSel((x) => (x[q.skill] ? x : { ...x, [q.skill]: { weight: 3, min: 60 } }));
    setQSheet(false);
  }

  function publish() {
    if (!title.trim() || !company.trim()) { toast('Scrivi il ruolo e il nome dell’azienda'); return; }
    if (!picked.length) { toast('Scegli almeno una competenza da verificare'); return; }
    if (!existing && !picked.some((k) => !isCustomSkill(k)) && !custom.length) { toast('Scrivi almeno una domanda per le competenze personalizzate'); return; }
    if (practical) {
      if (!practical.title.trim()) { toast('Dai un titolo alla prova pratica'); return; }
      if (!practical.instructions.trim() && !practical.files.length) { toast('Scrivi le istruzioni o carica un file per la prova pratica'); return; }
      if (!picked.includes(practical.skill) || (isCustomSkill(practical.skill) && !skillLabel(practical.skill).trim())) { toast('Scegli la competenza valutata dalla prova pratica'); return; }
    }
    if (picked.some((k) => isCustomSkill(k) && !skillLabel(k).trim())) { toast('Una competenza personalizzata non ha nome'); return; }
    const reqs = picked.map((skill) => ({ skill, ...sel[skill] }));
    const base = { owner: me, company: company.trim(), title: title.trim(), description: desc.trim(), location: loc.trim(), kind, pay: pay.trim(), reqs, custom, practical: practical ? { ...practical, title: practical.title.trim(), instructions: practical.instructions.trim(), deliverables: practical.deliverables.trim() } : undefined, timeLimitMin: limit, blind, trustWeight: Number(tw) / 100 };
    if (existing) { useJobs.getState().updateJob(existing.id, { ...base }); toast('Offerta aggiornata'); go('jobDetail', { id: existing.id }); return; }
    const questionIds = pickQuestions(bank, picked.filter((k) => !isCustomSkill(k)), per, Date.now() % 100000).map((q) => q.id);
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
      {[...skills.map((x) => ({ id: x.id, label: x.label, desc: x.desc })), ...customIds.map((id) => ({ id, label: skillLabel(id) || 'Personalizzata', desc: 'Competenza personalizzata' }))].map((s) => {
        const on = !!sel[s.id];
        return (
          <Card key={s.id} style={{ marginVertical: 4 }}>
            <Pressable onPress={() => setSel((x) => { const n = { ...x }; if (on) delete n[s.id]; else n[s.id] = { weight: 3, min: 60 }; return n; })} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
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
      <Row style={{ marginTop: 4 }} gap={8}>
        <Input flex={1} style={{ marginBottom: 0 }} placeholder="Altra competenza tua (es. Excel avanzato)" value={newSkill} onChangeText={setNewSkill} />
        <Btn small ghost icon="plus" title="Aggiungi" onPress={() => { const n = newSkill.trim(); if (!n) { toast('Scrivi il nome della competenza'); return; } setSel((x) => ({ ...x, [customSkill(n)]: { weight: 3, min: 60 } })); setNewSkill(''); }} />
      </Row>
      {!existing && <Row style={{ marginTop: 6 }}><Body small>Domande per competenza</Body><Stepper value={per} min={2} max={5} onChange={setPer} /></Row>}

      <Body bold style={{ marginTop: 12, marginBottom: 6 }}>Le tue domande</Body>
      <Body small muted style={{ marginBottom: 6 }}>Scrivi le prove che vuoi: scelta multipla, calcoli con tolleranza e unità, risposta aperta, consegna di file, con testo di contesto, immagini e tabelle con grafico. Peso e tempo per ogni domanda.</Body>
      {custom.map((q) => (
        <Card key={q.id} style={{ marginVertical: 3 }}>
          <Body small muted>{skillLabel(q.skill)} · {q.kind === 'mc' ? 'Scelta' : q.kind === 'number' ? 'Numero' : q.kind === 'file' ? 'Consegna file' : 'Aperta'}{q.chart ? ' · grafico' : ''}{q.img ? ' · immagine' : ''}{q.ctx ? ' · testo' : ''} · {q.w ?? 1} {(q.w ?? 1) === 1 ? 'punto' : 'punti'}{q.limitSec ? ` · ${q.limitSec >= 60 ? `${q.limitSec / 60} min` : `${q.limitSec} s`}` : ''}</Body>
          <Body small numberOfLines={2} style={{ marginTop: 2 }}>{q.prompt}</Body>
          <Row style={{ marginTop: 6, justifyContent: 'flex-end' }} gap={14}>
            <Pressable onPress={() => { setEditQ(q); setQSheet(true); }}><Text style={{ color: t.accent }}>Modifica</Text></Pressable>
            <Pressable onPress={() => setCustom(custom.filter((x) => x.id !== q.id))}><Text style={{ color: t.danger }}>Rimuovi</Text></Pressable>
          </Row>
        </Card>
      ))}
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        <Btn small ghost icon="plus" title="Aggiungi domanda" onPress={() => { setEditQ(undefined); setQSheet(true); }} />
        {lib > 0 && <Btn small ghost icon="archive" title={`Le mie domande (${lib})`} onPress={() => setLibSheet(true)} />}
      </Row>

      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Prova pratica con file</Body>
      <Toggle label="Includi una prova pratica" hint="Carichi i file del test (PDF, Excel, Word, immagini). Il candidato li scarica: da quel momento parte il tempo e deve consegnare i file richiesti." value={!!practical} onChange={(v) => setPractical(v ? emptyPractical(picked[0] ?? 'problem') : null)} />
      {practical && <PracticalEditor value={practical} onChange={setPractical} picked={picked} />}

      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Regole</Body>
      <Card>
        <Row><Body small>Tempo massimo del test a domande</Body><Stepper value={limit} min={5} max={240} step={5} suffix=" min" onChange={setLimit} /></Row>
        <Toggle label="Candidature alla cieca" hint="Vedi competenze e affidabilità, non nome né foto, finché non scegli di invitare. Riduce i pregiudizi." value={blind} onChange={setBlind} />
        <Body small muted style={{ marginTop: 6, marginBottom: 6 }}>Peso dell’affidabilità nel punteggio finale</Body>
        <Seg options={['0', '10', '20', '30']} value={tw} onChange={setTw} />
        <Body small muted style={{ marginTop: 6 }}>{tw}% affidabilità · {100 - Number(tw)}% competenze</Body>
      </Card>

      <Card>
        <Body bold>Riepilogo</Body>
        <Body small muted style={{ marginTop: 4 }}>{nQ} domande{practical ? ' (compresa la prova pratica)' : ''} · test {limit} min{practical ? ` · prova pratica ${fmtLimit(practical.limitMin)}` : ''} · {picked.map(skillLabel).join(', ') || 'nessuna competenza'}</Body>
        <Body small muted style={{ marginTop: 4 }}>I punteggi aiutano a ordinare i candidati: la decisione resta tua. Non chiedere né usare età, foto, nazionalità o altri dati personali per scartare candidati.</Body>
      </Card>
      <Btn title={existing ? 'Salva modifiche' : 'Pubblica offerta'} onPress={publish} />
      <QuestionSheet visible={qSheet} initial={editQ} defaultSkill={picked.find((k) => !isCustomSkill(k)) ?? picked[0] ?? 'problem'} extraSkills={customIds} onClose={() => setQSheet(false)} onAdd={addQ} />
      <LibrarySheet visible={libSheet} owner={me} onClose={() => setLibSheet(false)} onUse={addQ} />
    </Page>
  );
}
