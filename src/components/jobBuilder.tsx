import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { DataChart } from '@/components/DataChart';
import { FileList, QuestionView } from '@/components/jobFiles';
import { Body, Btn, Card, Input, Pill, Row, Seg, Sheet, Toggle, XBtn } from '@/components/ui';
import { customSkill, isCustomSkill, skillLabel, skills, type ChartSpec, type ChartType, type FileRef, type Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { uid } from '@/lib/format';
import { fmtLimit } from '@/lib/hiring';
import { parseTable, tableToText } from '@/lib/dataTable';
import { Icon } from '@/lib/icons';
import { pickFiles, pickImages, readText } from '@/lib/jobFiles';
import { useApp } from '@/store/app';
import { useJobs, type Practical } from '@/store/jobs';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

export function Stepper({ value, onChange, min, max, step = 1, suffix = '' }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const t = useTheme();
  const b = (label: string, d: number, a11y: string) => <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} hitSlop={6} accessibilityRole="button" accessibilityLabel={translateText(a11y)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 18 }}>{label}</Text></Pressable>;
  return <Row gap={8} style={{ justifyContent: 'flex-end' }}>{b('−', -step, 'Diminuisci')}<Text style={{ color: t.text, minWidth: 44, textAlign: 'center', fontWeight: '700' }}>{value}{suffix}</Text>{b('+', step, 'Aumenta')}</Row>;
}

/** Aggiunta di file (document picker) con elenco e rimozione. */
export function FilesField({ files, onChange, title = 'Aggiungi file', hint }: { files: FileRef[]; onChange: (f: FileRef[]) => void; title?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <FileList files={files} onRemove={(i) => onChange(files.filter((_, j) => j !== i))} label="Tocca per aprire" />
      <Btn small ghost icon="paperclip" style={{ marginTop: 8, alignSelf: 'flex-start' }} title={title} onPress={async () => { try { const f = await pickFiles(true); if (f.length) onChange([...files, ...f]); } catch { toast('Impossibile scegliere il file'); } }} />
      {hint ? <Body small muted style={{ marginTop: 4 }}>{hint}</Body> : null}
    </View>
  );
}

/** Scelta della competenza: dalla banca oppure libera ("Excel avanzato"). */
export function SkillPicker({ value, onChange, options = skills.map((s) => s.id), extra = [] }: { value: string; onChange: (v: string) => void; options?: string[]; extra?: string[] }) {
  const custom = isCustomSkill(value);
  const known = [...new Set([...options, ...extra])];
  return (
    <View>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>
        {known.map((id) => <Pill key={id} label={skillLabel(id)} on={value === id} onPress={() => onChange(id)} />)}
        <Pill label="Personalizzata" icon="edit" on={custom && !known.includes(value)} onPress={() => onChange(customSkill(''))} />
      </Row>
      {custom && !known.includes(value) && <Input style={{ marginTop: 8 }} placeholder="Nome della competenza (es. Excel avanzato)" value={skillLabel(value) === 'Personalizzata' ? '' : skillLabel(value)} onChangeText={(v) => onChange(customSkill(v))} />}
    </View>
  );
}

/** Durata in minuti o ore. */
export function DurationField({ minutes, onChange, min = 5, max = 4320 }: { minutes: number; onChange: (m: number) => void; min?: number; max?: number }) {
  const [unit, setUnit] = useState(minutes >= 60 && minutes % 60 === 0 ? 'Ore' : 'Minuti');
  const [txt, setTxt] = useState(String(unit === 'Ore' ? minutes / 60 : minutes));
  const apply = (s: string, u = unit) => {
    setTxt(s);
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) onChange(Math.min(max, Math.max(min, Math.round(n * (u === 'Ore' ? 60 : 1)))));
  };
  return (
    <View>
      <Input keyboardType="numeric" placeholder="Durata" value={txt} onChangeText={(s) => apply(s)} style={{ marginBottom: 8 }} />
      <Seg options={['Minuti', 'Ore']} value={unit} onChange={(u) => { setUnit(u); setTxt(String(u === 'Ore' ? Math.round((minutes / 60) * 100) / 100 : minutes)); }} />
      <Body small muted style={{ marginTop: 4 }}>Tempo massimo: {fmtLimit(minutes)}</Body>
    </View>
  );
}

/* ---------- prova pratica ---------- */
export const emptyPractical = (skill: string): Practical => ({ title: '', instructions: '', deliverables: '', files: [], limitMin: 120, skill, weight: 3 });

export function PracticalEditor({ value, onChange, picked }: { value: Practical; onChange: (p: Practical) => void; picked: string[] }) {
  const t = useTheme();
  const set = <K extends keyof Practical>(k: K, v: Practical[K]) => onChange({ ...value, [k]: v });
  return (
    <Card>
      <Input placeholder="Titolo della prova (es. Analisi vendite Q3)" value={value.title} onChangeText={(v) => set('title', v)} />
      <Input multiline style={{ minHeight: 100 }} placeholder="Istruzioni: cosa deve fare il candidato, come lavorare, criteri" value={value.instructions} onChangeText={(v) => set('instructions', v)} />
      <Body small bold style={{ marginTop: 4 }}>File del test</Body>
      <FilesField files={value.files} onChange={(f) => set('files', f)} title="Carica file del test" hint="PDF, Excel, Word, immagini, ZIP. Il candidato li scarica dal pulsante “Scarica il test”: in quel momento parte il tempo." />
      <Input multiline style={{ minHeight: 70, marginTop: 8 }} placeholder="Cosa va consegnato (es. un file Excel con i calcoli e una pagina di sintesi in PDF)" value={value.deliverables} onChangeText={(v) => set('deliverables', v)} />
      <Body small bold style={{ marginBottom: 6 }}>Tempo massimo dal download</Body>
      <DurationField minutes={value.limitMin} onChange={(m) => set('limitMin', m)} />
      <Body small bold style={{ marginTop: 12, marginBottom: 6 }}>Competenza che valuta</Body>
      {picked.length ? <SkillPicker value={value.skill} onChange={(v) => set('skill', v)} options={picked} /> : <Body small color={t.danger}>Scegli prima almeno una competenza da verificare.</Body>}
      <Row style={{ marginTop: 10 }}><Body small>Peso nel punteggio (1-5)</Body><Stepper value={value.weight} min={1} max={5} onChange={(v) => set('weight', v)} /></Row>
    </Card>
  );
}

/* ---------- domande ---------- */
const KINDS = ['Scelta', 'Numero', 'Aperta', 'File'] as const;
const CHARTS: [string, ChartType][] = [['Barre', 'bar'], ['Linee', 'line'], ['Torta', 'pie']];
const TIMES: [string, number | undefined][] = [['Nessuno', undefined], ['30 s', 30], ['1 min', 60], ['2 min', 120], ['5 min', 300], ['10 min', 600]];
const SAMPLE = ';Gennaio;Febbraio;Marzo\nNord;120;135;150\nSud;90;80;110';

type Draft = {
  kind: string; prompt: string; skill: string; rubric: string; opts: string[]; correct: number; answer: string; unit: string; tolMode: string; tol: string;
  ctx: string; useCtx: boolean; img?: FileRef; useChart: boolean; chartType: ChartType; chartTitle: string; chartUnit: string; table: string; w: number; limitSec?: number; save: boolean;
};
const blank = (skill: string): Draft => ({ kind: 'Scelta', prompt: '', skill, rubric: '', opts: ['', '', ''], correct: 0, answer: '', unit: '', tolMode: '%', tol: '1', ctx: '', useCtx: false, useChart: false, chartType: 'bar', chartTitle: '', chartUnit: '', table: '', w: 1, save: false });

function toDraft(q: Question, skill: string): Draft {
  const d = blank(q.skill || skill);
  const kind = q.kind === 'number' ? 'Numero' : q.kind === 'open' ? 'Aperta' : q.kind === 'file' ? 'File' : 'Scelta';
  return {
    ...d, kind, prompt: q.prompt, rubric: q.rubric ?? '', ctx: q.ctx ?? '', useCtx: !!q.ctx, img: q.img, w: q.w ?? 1, limitSec: q.limitSec,
    opts: q.options ? [...q.options.map((o) => o.t), ...(q.options.length < 3 ? Array(3 - q.options.length).fill('') : [])] : d.opts,
    correct: q.options ? Math.max(0, q.options.findIndex((o) => o.score === 100)) : 0,
    answer: q.answer != null ? String(q.answer).replace('.', ',') : '', unit: q.unit ?? '',
    tolMode: q.tolAbs != null ? 'assoluta' : '%', tol: q.tolAbs != null ? String(q.tolAbs) : String(Math.round((q.tol ?? 0.01) * 10000) / 100),
    useChart: !!q.chart, chartType: q.chart?.type ?? 'bar', chartTitle: q.chart?.title ?? '', chartUnit: q.chart?.unit ?? '', table: q.chart ? tableToText(q.chart) : '',
  };
}

export function QuestionSheet({ visible, onClose, onAdd, initial, defaultSkill, extraSkills }: { visible: boolean; onClose: () => void; onAdd: (q: Question) => void; initial?: Question; defaultSkill: string; extraSkills: string[] }) {
  const t = useTheme();
  const owner = useApp((a) => a.account.name);
  const [d, setD] = useState<Draft>(() => blank(defaultSkill));
  const [preview, setPreview] = useState(false);
  useEffect(() => { if (visible) { setD(initial ? toDraft(initial, defaultSkill) : blank(defaultSkill)); setPreview(false); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible, initial]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const parsed = useMemo(() => (d.useChart && d.table.trim() ? parseTable(d.table) : null), [d.useChart, d.table]);
  const chart: ChartSpec | undefined = parsed?.ok ? { type: d.chartType, title: d.chartTitle.trim() || undefined, unit: d.chartUnit.trim() || undefined, ...parsed.table } : undefined;

  function build(): Question | null {
    if (!d.prompt.trim()) { toast('Scrivi la domanda'); return null; }
    if (isCustomSkill(d.skill) && !skillLabel(d.skill).trim()) { toast('Scrivi il nome della competenza'); return null; }
    if (d.useChart && !chart) { toast(parsed && !parsed.ok ? parsed.error : 'Inserisci i dati del grafico'); return null; }
    const base: Question = {
      id: initial?.id ?? 'c-' + uid(), skill: d.skill, kind: 'open', prompt: d.prompt.trim(), w: d.w, limitSec: d.limitSec,
      ctx: d.useCtx && d.ctx.trim() ? d.ctx.trim() : undefined, img: d.img, chart: d.useChart ? chart : undefined,
    };
    if (d.kind === 'Aperta') return { ...base, kind: 'open', rubric: d.rubric.trim() || undefined };
    if (d.kind === 'File') return { ...base, kind: 'file', rubric: d.rubric.trim() || undefined };
    if (d.kind === 'Numero') {
      const n = Number(d.answer.replace(',', '.')), tv = Number(d.tol.replace(',', '.'));
      if (!Number.isFinite(n)) { toast('Scrivi la risposta esatta (numero)'); return null; }
      if (!Number.isFinite(tv) || tv < 0) { toast('La tolleranza deve essere un numero'); return null; }
      return { ...base, kind: 'number', answer: n, unit: d.unit.trim() || undefined, ...(d.tolMode === '%' ? { tol: tv / 100 } : { tolAbs: tv }) };
    }
    const o = d.opts.map((x) => x.trim());
    const filled = o.map((x, i) => ({ x, i })).filter((e) => e.x);
    if (filled.length < 2 || !o[d.correct]) { toast('Servono almeno 2 opzioni e una risposta corretta'); return null; }
    return { ...base, kind: 'mc', options: filled.map((e) => ({ t: e.x, score: e.i === d.correct ? 100 : 0 })) };
  }
  function submit() {
    const q = build();
    if (!q) return;
    if (d.save) useJobs.getState().saveQuestion(owner, q);
    onAdd(q);
  }

  return (
    <Sheet visible={visible} title={initial ? 'Modifica domanda' : 'Nuova domanda'} onClose={onClose}>
      <Seg options={[...KINDS]} value={d.kind} onChange={(v) => set('kind', v)} />
      <Body small muted style={{ marginTop: 6 }}>{d.kind === 'Scelta' ? 'Una risposta giusta, corretta in automatico.' : d.kind === 'Numero' ? 'Risposta numerica (anche matematica), con tolleranza e unità di misura. Corretta in automatico.' : d.kind === 'Aperta' ? 'Risposta scritta, la valuti tu da 0 a 100.' : 'Il candidato carica uno o più file (Excel, PDF, immagini...), li valuti tu da 0 a 100.'}</Body>

      <Body small bold style={{ marginTop: 12, marginBottom: 6 }}>Competenza a cui conta</Body>
      <SkillPicker value={d.skill} onChange={(v) => set('skill', v)} extra={extraSkills} />

      <Input multiline style={{ minHeight: 80, marginTop: 10 }} placeholder={d.kind === 'Numero' ? 'Domanda (le formule si scrivono in chiaro, es. 40 x 75 x 0,9)' : 'Domanda o compito'} value={d.prompt} onChangeText={(v) => set('prompt', v)} />

      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 6 }} gap={6}>
        <Pill label="Testo di contesto" icon="note" on={d.useCtx} onPress={() => set('useCtx', !d.useCtx)} />
        <Pill label="Immagine" icon="image" on={!!d.img} onPress={async () => { if (d.img) { set('img', undefined); return; } try { const f = await pickImages(false); if (f[0]) set('img', f[0]); } catch { toast('Impossibile scegliere l’immagine'); } }} />
        <Pill label="Dati e grafico" icon="chart" on={d.useChart} onPress={() => set('useChart', !d.useChart)} />
      </Row>
      {d.useCtx && <Input multiline style={{ minHeight: 110 }} placeholder="Brano, caso, email del cliente, regole... da leggere prima di rispondere" value={d.ctx} onChangeText={(v) => set('ctx', v)} />}
      {d.img && <Row style={{ marginBottom: 6 }}><Body small style={{ flex: 1 }} numberOfLines={1}>Immagine: {d.img.name}</Body><XBtn onPress={() => set('img', undefined)} /></Row>}

      {d.useChart && (
        <Card style={{ marginVertical: 6 }}>
          <Body small bold style={{ marginBottom: 6 }}>Tipo di grafico</Body>
          <Seg options={CHARTS.map((c) => c[0])} value={CHARTS.find((c) => c[1] === d.chartType)![0]} onChange={(v) => set('chartType', CHARTS.find((c) => c[0] === v)![1])} />
          <Input style={{ marginTop: 8 }} placeholder="Titolo del grafico (facoltativo)" value={d.chartTitle} onChangeText={(v) => set('chartTitle', v)} />
          <Input placeholder="Unità dei valori (es. CHF, kg, %)" value={d.chartUnit} onChangeText={(v) => set('chartUnit', v)} />
          <Body small bold style={{ marginBottom: 4 }}>Tabella dei dati</Body>
          <Body small muted style={{ marginBottom: 6 }}>Una riga per etichetta, una colonna per serie, separate da punto e virgola, virgola o tabulazione. Prima riga: nomi delle serie. Puoi incollare da Excel o Fogli.</Body>
          <Input multiline style={{ minHeight: 120, fontFamily: undefined }} autoCapitalize="none" autoCorrect={false} placeholder={SAMPLE} value={d.table} onChangeText={(v) => set('table', v)} />
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            <Btn small ghost title="Esempio" onPress={() => set('table', SAMPLE)} />
            <Btn small ghost icon="file" title="Importa CSV" onPress={async () => { try { const f = (await pickFiles(false))[0]; if (f) set('table', await readText(f)); } catch { toast('Impossibile leggere il file'); } }} />
          </Row>
          {parsed && !parsed.ok && <Body small color={t.danger} style={{ marginTop: 6 }}>{parsed.error}</Body>}
          {chart && <View style={{ marginTop: 10 }}><DataChart spec={chart} /></View>}
        </Card>
      )}

      {d.kind === 'Scelta' && d.opts.map((o, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <Pressable onPress={() => set('correct', i)} style={{ paddingTop: 14 }} accessibilityRole="button" accessibilityLabel={translateText(`Opzione ${i + 1} corretta`)}><Icon name={d.correct === i ? 'checksquare' : 'circle'} size={20} color={d.correct === i ? t.positive : t.muted} /></Pressable>
          <Input flex={1} placeholder={`Opzione ${i + 1}${d.correct === i ? ' (corretta)' : ''}`} value={o} onChangeText={(v) => set('opts', d.opts.map((x, j) => (j === i ? v : x)))} />
        </Row>
      ))}
      {d.kind === 'Scelta' && d.opts.length < 6 && <Btn small ghost icon="plus" style={{ alignSelf: 'flex-start', marginBottom: 6 }} title="Aggiungi opzione" onPress={() => set('opts', [...d.opts, ''])} />}

      {d.kind === 'Numero' && (
        <View>
          <Row gap={8}><Input flex={1} style={{ minWidth: 0 }} keyboardType="numeric" placeholder="Risposta esatta" value={d.answer} onChangeText={(v) => set('answer', v)} /><Input flex={1} style={{ minWidth: 0 }} placeholder="Unità (es. CHF)" autoCapitalize="none" value={d.unit} onChangeText={(v) => set('unit', v)} /></Row>
          <Body small bold style={{ marginBottom: 6 }}>Tolleranza accettata</Body>
          <Seg options={['%', 'assoluta']} value={d.tolMode} onChange={(v) => set('tolMode', v)} />
          <Input style={{ marginTop: 8, marginBottom: 0 }} keyboardType="numeric" placeholder={d.tolMode === '%' ? 'Tolleranza in % (es. 1)' : 'Tolleranza assoluta (es. 0,5)'} value={d.tol} onChangeText={(v) => set('tol', v)} />
          <Body small muted style={{ marginTop: 4, marginBottom: 8 }}>{d.tolMode === '%' ? `Accettata una risposta entro ±${d.tol || 0}% del valore esatto.` : `Accettata una risposta entro ±${d.tol || 0}${d.unit ? ' ' + d.unit : ''} dal valore esatto.`}</Body>
        </View>
      )}
      {(d.kind === 'Aperta' || d.kind === 'File') && <Input placeholder="Cosa cerchi in una buona risposta (solo per te)" value={d.rubric} onChangeText={(v) => set('rubric', v)} />}

      <Row style={{ marginTop: 4 }}><Body small>Punti / peso (1-10)</Body><Stepper value={d.w} min={1} max={10} onChange={(v) => set('w', v)} /></Row>
      <Body small muted style={{ marginBottom: 6 }}>Una domanda da 3 punti conta il triplo di una da 1 nel punteggio della competenza.</Body>
      <Body small bold style={{ marginTop: 6, marginBottom: 6 }}>Tempo per questa domanda</Body>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={6}>{TIMES.map(([l, v]) => <Pill key={l} label={l} on={d.limitSec === v} onPress={() => set('limitSec', v)} />)}</Row>
      <Toggle label="Salva nella mia libreria" hint="Potrai riusarla nelle prossime offerte." value={d.save} onChange={(v) => set('save', v)} />

      <Btn small ghost icon="eye" style={{ alignSelf: 'flex-start', marginBottom: 8 }} title={preview ? 'Nascondi anteprima' : 'Anteprima per il candidato'} onPress={() => setPreview(!preview)} />
      {preview && (() => { const q = build(); return q ? <Card><QuestionView q={q} /></Card> : null; })()}
      <Btn title={initial ? 'Salva domanda' : 'Aggiungi'} onPress={submit} />
    </Sheet>
  );
}


/** Le domande scritte per offerte precedenti. */
export function LibrarySheet({ visible, onClose, onUse, owner }: { visible: boolean; onClose: () => void; onUse: (q: Question) => void; owner: string }) {
  const t = useTheme();
  const lib = useJobs((s) => s.library).filter((x) => x.owner === owner);
  const kindLabel = (q: Question) => (q.kind === 'mc' ? 'Scelta' : q.kind === 'number' ? 'Numero' : q.kind === 'file' ? 'File' : 'Aperta') + (q.chart ? ' · grafico' : '');
  return (
    <Sheet visible={visible} title="Le mie domande" onClose={onClose}>
      {lib.length === 0 ? <Body muted>Nessuna domanda salvata. Quando ne crei una, attiva “Salva nella mia libreria”.</Body> : lib.map((x) => (
        <Card key={x.id} style={{ marginVertical: 4 }}>
          <Body small muted>{skillLabel(x.q.skill)} · {kindLabel(x.q)}</Body>
          <Body style={{ marginTop: 2 }} numberOfLines={3}>{x.q.prompt}</Body>
          <Row style={{ marginTop: 8, justifyContent: 'flex-end' }} gap={8}>
            <Btn small ghost danger title="Elimina" onPress={() => useJobs.getState().removeSaved(x.id)} />
            <Btn small title="Usa" onPress={() => { onUse({ ...x.q, id: 'c-' + uid() }); onClose(); }} />
          </Row>
        </Card>
      ))}
      <View style={{ height: 4, backgroundColor: t.sheet }} />
    </Sheet>
  );
}
