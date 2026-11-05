import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { DayField } from '@/components/work/DayField';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { IMPACTS, LEVELS, NEGOTIATION_STEPS, QUESTIONS, adKeywords, answeredRatio, buildCv, coverLetter, gapsOf, objProgress, okrStatus, quarterLabel, quarterOf, resultLine, reviewSummary, salaryRange, skillGap, strengthsOf, suggestFromTasks, suggestSkills, addDays, type Objective, type Result } from '@/lib/careerWork';
import { computeFit } from '@/lib/hiring';
import { go } from '@/lib/nav';
import { useCaps } from '@/lib/teamPeople';
import { pullHr } from '@/lib/teamHr';
import { today } from '@/lib/teamWork';
import { POSITIONS } from '@/lib/workRoles';
import { useApp } from '@/store/app';
import { hrOf, useHr } from '@/store/hr';
import { newId, useCareer } from '@/store/careerWork';
import { profileOf, useJobs } from '@/store/jobs';
import { useLife } from '@/store/life';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

type Tab = 'obiettivi' | 'competenze' | 'risultati' | 'feedback' | 'cv' | 'colloquio' | 'offerte';
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATE_COLOR = { avanti: '#22c55e', 'in linea': '#22c55e', indietro: '#f59e0b', finito: '#22c55e' } as const;
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

/** Carriera e crescita: obiettivi, competenze e corsi, risultati, feedback, curriculum, colloqui, offerte coerenti. Tutto sul tuo telefono. */
export function Career() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const [tab, setTab] = useState<Tab>('obiettivi');
  const th = useTheme();
  if (!team) return <NoWorkspace what="fai crescere la tua carriera" />;
  return (
    <View style={{ gap: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{([['obiettivi', 'Obiettivi'], ['competenze', 'Competenze'], ['risultati', 'Risultati'], ['feedback', 'Feedback'], ['cv', 'Curriculum'], ['colloquio', 'Colloquio'], ['offerte', 'Offerte']] as [Tab, string][]).map(([k, l]) => <Pill key={k} label={tl(l)} on={tab === k} onPress={() => setTab(k)} />)}</ScrollView>
      {tab === 'obiettivi' ? <Objectives /> : null}
      {tab === 'competenze' ? <Skills team={team.id} /> : null}
      {tab === 'risultati' ? <Results /> : null}
      {tab === 'feedback' ? <Feedbacks team={team.id} /> : null}
      {tab === 'cv' ? <Cv /> : null}
      {tab === 'colloquio' ? <Interview /> : null}
      {tab === 'offerte' ? <Offers /> : null}
      <Text style={{ color: th.muted, fontSize: 12 }}>{tl('La tua carriera resta sul tuo telefono: non la vedono il team né il responsabile, a meno che tu non la condivida.')}</Text>
    </View>
  );
}

const Bar = ({ p, color }: { p: number; color?: string }) => { const th = useTheme(); return <View style={{ height: 8, borderRadius: 4, backgroundColor: th.chip, overflow: 'hidden' }}><View style={{ width: `${Math.max(2, Math.min(100, p))}%`, height: 8, backgroundColor: color ?? th.accent }} /></View>; };

/* ---------- obiettivi ---------- */
function Objectives() {
  const { objectives, set } = useCareer();
  const t0 = today(); const q = quarterOf(t0);
  const [add, setAdd] = useState(false);
  const [title, setTitle] = useState(''); const [krs, setKrs] = useState([{ t: '', target: '' }, { t: '', target: '' }]);
  const mine = objectives.filter((o) => o.quarter === q); const old = objectives.filter((o) => o.quarter !== q);
  const save = () => {
    const rows = krs.filter((k) => k.t.trim() && num(k.target) > 0);
    if (!title.trim() || !rows.length) { toast('Scrivi l\'obiettivo e almeno un risultato misurabile'); return; }
    const o: Objective = { id: newId(), title: title.trim(), quarter: q, krs: rows.map((k) => ({ id: newId(), t: k.t.trim(), target: num(k.target), current: 0 })) };
    set({ objectives: [...objectives, o] }); setTitle(''); setKrs([{ t: '', target: '' }, { t: '', target: '' }]); setAdd(false);
  };
  const bump = (o: Objective, kid: string, d: number) => set({ objectives: objectives.map((x) => (x.id !== o.id ? x : { ...x, krs: x.krs.map((k) => (k.id === kid ? { ...k, current: Math.max(0, Math.round((k.current + d) * 100) / 100) } : k)) })) });
  const card = (o: Objective) => { const st = okrStatus(o, t0); const p = objProgress(o); return (
    <View key={o.id} style={{ marginTop: 14 }}>
      <Row><Body bold style={{ flex: 1 }}>{o.title}</Body><Pill label={`${p}%`} color={STATE_COLOR[st.state]} /></Row>
      <View style={{ marginVertical: 6 }}><Bar p={p} color={STATE_COLOR[st.state]} /></View>
      <Body small muted>{tl(st.text)}</Body>
      {o.krs.map((k) => (
        <Row key={k.id} style={{ marginTop: 8 }}>
          <View style={{ flex: 1 }}><Body small>{k.t}</Body><Body small muted>{`${k.current} / ${k.target}`}</Body></View>
          <Btn small ghost title="−" onPress={() => bump(o, k.id, -Math.max(1, Math.round(k.target / 10)))} /><Btn small title="+" onPress={() => bump(o, k.id, Math.max(1, Math.round(k.target / 10)))} />
        </Row>
      ))}
      <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><Btn small ghost danger title="Elimina" onPress={() => set({ objectives: objectives.filter((x) => x.id !== o.id) })} /></View>
    </View>
  ); };
  return (
    <Card>
      <Row><H>{`${tl('Obiettivi')} · ${quarterLabel(q)}`}</H><Btn small icon="plus" title="Nuovo" onPress={() => setAdd(true)} /></Row>
      {mine.length === 0 ? <Empty text="Scegli 1-3 obiettivi per questo trimestre, ognuno con risultati che si possono contare." /> : mine.map(card)}
      {old.length ? <><Body small bold muted style={{ marginTop: 16 }}>{tl('TRIMESTRI PASSATI').toUpperCase()}</Body>{old.map((o) => <Row key={o.id} style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{`${quarterLabel(o.quarter)} · ${o.title}`}</Body><Body small bold>{`${objProgress(o)}%`}</Body></Row>)}</> : null}
      <Sheet visible={add} title="Nuovo obiettivo" onClose={() => setAdd(false)}>
        <Input placeholder="Obiettivo (es. Far crescere i clienti)" value={title} onChangeText={setTitle} />
        <Body small bold muted style={{ marginBottom: 6 }}>{tl('RISULTATI DA RAGGIUNGERE').toUpperCase()}</Body>
        {krs.map((k, i) => <Row key={i}><Input flex={3} placeholder="Es. Nuovi clienti" value={k.t} onChangeText={(x) => setKrs(krs.map((y, j) => (j === i ? { ...y, t: x } : y)))} /><Input flex={1} placeholder="Quanti" keyboardType="numeric" value={k.target} onChangeText={(x) => setKrs(krs.map((y, j) => (j === i ? { ...y, target: x } : y)))} /></Row>)}
        <Btn small ghost icon="plus" title="Un altro risultato" onPress={() => setKrs([...krs, { t: '', target: '' }])} />
        <View style={{ height: 8 }} /><Btn icon="check" title="Salva" onPress={save} />
      </Sheet>
    </Card>
  );
}

/* ---------- competenze e corsi ---------- */
function Skills({ team }: { team: string }) {
  const { skills, courses, set } = useCareer();
  const { position } = useCaps(team);
  const area = POSITIONS.find((p) => p.id === position)?.area ?? 'supporto';
  const [name, setName] = useState(''); const [addSk, setAddSk] = useState(false);
  const [ct, setCt] = useState(''); const [cd, setCd] = useState(''); const [cs, setCs] = useState<string | undefined>(undefined); const [addC, setAddC] = useState(false);
  const gaps = gapsOf(skills); const strong = strengthsOf(skills);
  const addSkill = (n: string) => { if (!n.trim()) return; set({ skills: [...skills, { id: newId(), name: n.trim(), level: 2, target: 4 }] }); setName(''); };
  const upd = (id: string, p: Partial<{ level: number; target: number }>) => set({ skills: skills.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const nextStatus = { 'da fare': 'in corso', 'in corso': 'finito', finito: 'da fare' } as const;
  const saveCourse = () => {
    if (!ct.trim()) { toast('Scrivi il nome del corso'); return; }
    set({ courses: [...courses, { id: newId(), title: ct.trim(), status: 'da fare', due: cd || undefined, skill: cs }] });
    if (cd) useLife.getState().addEvent(cd, { time: '09:00', title: `Corso: ${ct.trim()}`.slice(0, 190), dur: 60 });
    setCt(''); setCd(''); setCs(undefined); setAddC(false);
  };
  return (
    <>
      <Card>
        <Row><H>La tua mappa delle competenze</H><Btn small icon="plus" title="Aggiungi" onPress={() => setAddSk(true)} /></Row>
        {skills.length === 0 ? <Empty text="Aggiungi le tue competenze: segna a che punto sei e dove vuoi arrivare." /> : null}
        {[...skills].sort((a, b) => b.level - a.level).map((s) => (
          <View key={s.id} style={{ marginTop: 12 }}>
            <Row><Body bold style={{ flex: 1 }}>{s.name}</Body><Body small muted>{`${tl(LEVELS[s.level]!)} → ${tl(LEVELS[s.target]!)}`}</Body></Row>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>{[0, 1, 2, 3, 4, 5].map((n) => <Pill key={n} label={String(n)} on={s.level === n} onPress={() => upd(s.id, { level: n, target: Math.max(s.target, n) })} />)}</View>
            <Row style={{ marginTop: 4 }}><Body small muted style={{ flex: 1 }}>{tl('Dove vuoi arrivare')}</Body><Btn small ghost title="−" onPress={() => upd(s.id, { target: Math.max(s.level, s.target - 1) })} /><Btn small ghost title="+" onPress={() => upd(s.id, { target: Math.min(5, s.target + 1) })} /><Btn small ghost danger icon="trash" title="" onPress={() => set({ skills: skills.filter((x) => x.id !== s.id) })} /></Row>
          </View>
        ))}
        {strong.length ? <Body small style={{ marginTop: 12 }}>{tl('I tuoi punti di forza: {0}.', strong.map((s) => s.name).join(', '))}</Body> : null}
        {gaps.length ? <Body small style={{ marginTop: 6 }}>{tl('Da far crescere per primo: {0}.', gaps.slice(0, 3).map((s) => `${s.name} (+${skillGap(s)})`).join(', '))}</Body> : null}
      </Card>
      <Card>
        <Row><H>Corsi</H><Btn small icon="plus" title="Aggiungi" onPress={() => setAddC(true)} /></Row>
        {courses.length === 0 ? <Empty text="Un corso alla volta: scegli quello che colma la tua lacuna più grande." /> : courses.map((c) => (
          <Row key={c.id} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}><Body bold>{c.title}</Body><Body small muted>{[c.skill, c.due ? day(c.due) : ''].filter(Boolean).join(' · ')}</Body></View>
            <Pill label={tl(c.status)} on={c.status === 'finito'} onPress={() => set({ courses: courses.map((x) => (x.id === c.id ? { ...x, status: nextStatus[x.status] } : x)) })} />
            <Btn small ghost danger icon="trash" title="" onPress={() => set({ courses: courses.filter((x) => x.id !== c.id) })} />
          </Row>
        ))}
      </Card>
      <Sheet visible={addSk} title="Nuova competenza" onClose={() => setAddSk(false)}>
        <Input placeholder="Es. Excel avanzato" value={name} onChangeText={setName} />
        <Btn icon="check" title="Aggiungi" onPress={() => { addSkill(name); setAddSk(false); }} />
        <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('IDEE PER IL TUO RUOLO').toUpperCase()}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{suggestSkills(area, skills).map((n) => <Pill key={n} label={n} onPress={() => addSkill(n)} />)}</View>
      </Sheet>
      <Sheet visible={addC} title="Nuovo corso" onClose={() => setAddC(false)}>
        <Input placeholder="Nome del corso" value={ct} onChangeText={setCt} />
        <DayField value={cd} onChange={setCd} placeholder="Quando (facoltativo)" />
        {skills.length ? <><Body small bold muted style={{ marginVertical: 6 }}>{tl('PER QUALE COMPETENZA').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{skills.map((s) => <Pill key={s.id} label={s.name} on={cs === s.name} onPress={() => setCs(cs === s.name ? undefined : s.name)} />)}</View></> : null}
        <Btn icon="check" title="Salva" onPress={saveCourse} />
      </Sheet>
    </>
  );
}

/* ---------- risultati ---------- */
function Results() {
  const { results, set } = useCareer();
  const tasks = useLife((s) => s.tasks);
  const t0 = today();
  const [text, setText] = useState(''); const [metric, setMetric] = useState(''); const [impact, setImpact] = useState<Result['impact']>();
  const sug = useMemo(() => suggestFromTasks(tasks.filter((x) => x.done).map((x) => ({ t: x.t, doneAt: x.doneAt, team: x.team })), results, t0), [tasks, results, t0]);
  const add = (r: Omit<Result, 'id'>) => set({ results: [{ id: newId(), ...r }, ...results] });
  const sorted = [...results].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <>
      <Card>
        <H>Il diario dei risultati</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Scrivi cosa hai ottenuto appena succede: a un colloquio o per un aumento ti ricorderai tutto.')}</Body>
        <Input placeholder="Cosa hai ottenuto (es. Chiuso il contratto Bianchi)" value={text} onChangeText={setText} />
        <Input placeholder="Un numero, se c'è (es. +20% di fatturato)" value={metric} onChangeText={setMetric} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{IMPACTS.map((i) => <Pill key={i} label={tl(i!)} on={impact === i} onPress={() => setImpact(impact === i ? undefined : i)} />)}</View>
        <Btn icon="check" title="Aggiungi al diario" onPress={() => { if (!text.trim()) { toast('Scrivi cosa hai ottenuto'); return; } add({ day: t0, text: text.trim(), metric: metric.trim() || undefined, impact }); setText(''); setMetric(''); setImpact(undefined); toast('Aggiunto: bravo!'); }} />
      </Card>
      {sug.length ? (
        <Card>
          <H>Task finiti da ricordare</H>
          <Body small muted style={{ marginTop: 4 }}>{tl('Hai chiuso questi task di lavoro. Vuoi segnarli tra i risultati?')}</Body>
          {sug.map((s) => <Row key={s.t + s.day} style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>{`${s.t} · ${day(s.day)}`}</Body><Btn small icon="plus" title="Segna" onPress={() => add({ day: s.day, text: `Ho completato: ${s.t}` })} /></Row>)}
        </Card>
      ) : null}
      <Card>
        <Row><H>I tuoi risultati</H><Btn small ghost title="Per colloquio o aumento" onPress={() => { void Share.share({ message: reviewSummary(results, useCareer.getState().feedback, addDays(t0, -180), t0) }); }} /></Row>
        {sorted.length === 0 ? <Empty text="Ancora vuoto. Il primo risultato è il più importante." /> : sorted.map((r) => (
          <Row key={r.id} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}><Body>{resultLine(r)}</Body><Body small muted>{`${day(r.day)}${r.impact ? ` · ${tl(r.impact)}` : ''}`}</Body></View>
            <Btn small ghost danger icon="trash" title="" onPress={() => set({ results: results.filter((x) => x.id !== r.id) })} />
          </Row>
        ))}
      </Card>
    </>
  );
}

/* ---------- feedback ---------- */
function Feedbacks({ team }: { team: string }) {
  const { feedback, set } = useCareer();
  const me = usePeople((s) => s.me);
  const reviews = useHr((s) => hrOf(team, s.data).reviews).filter((r) => r.person === me && r.status === 'shared');
  const [from, setFrom] = useState(''); const [text, setText] = useState(''); const [kind, setKind] = useState<'positivo' | 'crescita'>('positivo');
  useEffect(() => { void pullHr(team); }, [team]);
  return (
    <>
      {reviews.length ? (
        <Card>
          <H>Valutazioni condivise con te</H>
          {reviews.map((r) => <View key={r.id} style={{ marginTop: 10 }}><Body bold>{r.period}{r.rating != null ? ` · ${r.rating}/5` : ''}</Body>{r.feedback ? <Body small>{r.feedback}</Body> : null}</View>)}
        </Card>
      ) : null}
      <Card>
        <H>Feedback ricevuti</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Scrivi qui le cose belle e i consigli che ti danno: sono preziosi per crescere e per i colloqui.')}</Body>
        <Input placeholder="Da chi (es. Giulia)" value={from} onChangeText={setFrom} />
        <Input placeholder="Cosa ti ha detto" value={text} onChangeText={setText} maxLines={4} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}><Pill label={tl('Una cosa bella')} on={kind === 'positivo'} onPress={() => setKind('positivo')} /><Pill label={tl('Un consiglio')} on={kind === 'crescita'} onPress={() => setKind('crescita')} /></View>
        <Btn icon="check" title="Salva" onPress={() => { if (!text.trim()) { toast('Scrivi il feedback'); return; } set({ feedback: [{ id: newId(), day: today(), from: from.trim() || tl('Un collega'), text: text.trim(), kind }, ...feedback] }); setText(''); setFrom(''); }} />
        {feedback.length === 0 ? <View style={{ marginTop: 10 }}><Empty text="Ancora nessun feedback salvato." /></View> : [...feedback].sort((a, b) => b.day.localeCompare(a.day)).map((f) => (
          <Row key={f.id} style={{ marginTop: 10 }}>
            <View style={{ flex: 1 }}><Body small bold>{`${f.from} · ${day(f.day)}`}</Body><Body small>{f.text}</Body></View>
            <Pill label={tl(f.kind === 'positivo' ? 'bello' : 'consiglio')} color={f.kind === 'positivo' ? '#22c55e' : '#f59e0b'} />
            <Btn small ghost danger icon="trash" title="" onPress={() => set({ feedback: feedback.filter((x) => x.id !== f.id) })} />
          </Row>
        ))}
      </Card>
    </>
  );
}

/* ---------- curriculum ---------- */
function Cv() {
  const c = useCareer();
  const name = useApp((s) => s.account.name);
  const [ad, setAd] = useState(''); const [company, setCompany] = useState(''); const [role, setRole] = useState(''); const [show, setShow] = useState<'cv' | 'lettera' | null>(null);
  const k = ad.trim() ? adKeywords(ad, c.skills) : null;
  const cv = buildCv({ name, headline: c.headline, contact: c.contact, summary: c.summary, experience: c.experience, skills: c.skills, results: c.results, courses: c.courses }, ad || undefined);
  const letter = coverLetter({ name, company, role, matched: k?.matched ?? c.skills.filter((s) => s.level >= 3).slice(0, 3), results: [...c.results].sort((a, b) => b.day.localeCompare(a.day)) });
  return (
    <Card>
      <H>Il tuo curriculum</H>
      <Body small muted style={{ marginTop: 4 }}>{tl('Si aggiorna da solo con le tue competenze, i risultati e i corsi finiti. Scrivi solo le parti tue.')}</Body>
      <Input placeholder="Il tuo ruolo (es. Responsabile vendite)" value={c.headline} onChangeText={(x) => c.set({ headline: x })} />
      <Input placeholder="Contatti (telefono, email)" value={c.contact} onChangeText={(x) => c.set({ contact: x })} />
      <Input placeholder="Profilo in due righe" value={c.summary} onChangeText={(x) => c.set({ summary: x })} maxLines={4} />
      <Input placeholder="Esperienze (azienda, ruolo, anni)" value={c.experience} onChangeText={(x) => c.set({ experience: x })} maxLines={6} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('ADATTALO A UN ANNUNCIO').toUpperCase()}</Body>
      <Input placeholder="Incolla qui l'annuncio" value={ad} onChangeText={setAd} maxLines={6} />
      {k ? <Body small style={{ marginBottom: 6 }}>{k.matched.length ? tl('Le tue competenze che coincidono: {0}.', k.matched.map((s) => s.name).join(', ')) : tl('Nessuna competenza coincide ancora: aggiungine nella scheda Competenze.')}{k.missing.length ? ` ${tl('Parole dell\'annuncio da usare: {0}.', k.missing.join(', '))}` : ''}</Body> : null}
      <Row><Btn small icon="file" title="Vedi il curriculum" onPress={() => setShow('cv')} /><Btn small ghost title="Lettera di presentazione" onPress={() => setShow('lettera')} /></Row>
      <Sheet visible={show != null} title={show === 'cv' ? 'Curriculum' : 'Lettera di presentazione'} onClose={() => setShow(null)}>
        {show === 'lettera' ? <><Input placeholder="Azienda" value={company} onChangeText={setCompany} /><Input placeholder="Ruolo" value={role} onChangeText={setRole} /></> : null}
        <View style={{ backgroundColor: 'rgba(128,128,128,0.12)', borderRadius: 14, padding: 12, marginVertical: 8 }}><Body small>{show === 'cv' ? cv : letter}</Body></View>
        <Btn icon="send" title="Condividi" onPress={() => { void Share.share({ message: show === 'cv' ? cv : letter }); }} />
      </Sheet>
    </Card>
  );
}

/* ---------- colloquio e stipendio ---------- */
function Interview() {
  const { answers, results, set } = useCareer();
  const [kind, setKind] = useState<'colloquio' | 'stipendio'>('colloquio');
  const [cur, setCur] = useState(''); const [target, setTarget] = useState(''); const [offer, setOffer] = useState('');
  const qs = QUESTIONS.filter((q) => q.kind === kind);
  const sal = num(target) > 0 ? salaryRange({ target: num(target), current: num(cur) > 0 ? num(cur) : undefined, offer: num(offer) > 0 ? num(offer) : undefined }) : null;
  const top = [...results].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 3);
  return (
    <>
      <Card>
        <H>Preparati</H>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Pill label={tl('Colloquio')} on={kind === 'colloquio'} onPress={() => setKind('colloquio')} /><Pill label={tl('Trattativa di stipendio')} on={kind === 'stipendio'} onPress={() => setKind('stipendio')} /></View>
        <Body small muted style={{ marginTop: 8 }}>{tl('Preparate: {0}%. Scrivi le risposte con parole tue, così a voce vengono naturali.', answeredRatio(qs, answers))}</Body>
        {top.length ? <Body small style={{ marginTop: 6 }}>{tl('Esempi veri dal tuo diario: {0}.', top.map((r) => r.text).join(' · '))}</Body> : null}
      </Card>
      {qs.map((q) => (
        <Card key={q.id}>
          <Body bold>{tl(q.q)}</Body><Body small muted style={{ marginTop: 2 }}>{tl(q.tip)}</Body>
          <Input placeholder="La tua risposta" value={answers[q.id] ?? ''} onChangeText={(x) => set({ answers: { ...answers, [q.id]: x } })} maxLines={5} />
        </Card>
      ))}
      {kind === 'stipendio' ? (
        <Card>
          <H>Calcola la tua richiesta</H>
          <Input placeholder="Quanto prendi adesso (facoltativo)" keyboardType="numeric" value={cur} onChangeText={setCur} />
          <Input placeholder="Quanto vuoi ottenere" keyboardType="numeric" value={target} onChangeText={setTarget} />
          <Input placeholder="Offerta ricevuta (facoltativo)" keyboardType="numeric" value={offer} onChangeText={setOffer} />
          {sal ? sal.lines.map((l, i) => <Body key={i} small style={{ marginTop: 4 }}>{`• ${l}`}</Body>) : null}
          <Body small bold muted style={{ marginTop: 12, marginBottom: 4 }}>{tl('I PASSI').toUpperCase()}</Body>
          {NEGOTIATION_STEPS.map((s, i) => <Body key={i} small style={{ marginBottom: 3 }}>{`${i + 1}. ${tl(s)}`}</Body>)}
        </Card>
      ) : null}
    </>
  );
}

/* ---------- offerte coerenti ---------- */
function Offers() {
  const me = useApp((s) => s.account.name);
  const jobs = useJobs((s) => s.jobs); const apps = useJobs((s) => s.applications); const practice = useJobs((s) => s.practice);
  const profile = useMemo(() => profileOf(me), [me, apps, practice]); // eslint-disable-line react-hooks/exhaustive-deps
  const scores = useMemo(() => Object.fromEntries(Object.entries(profile.skills).map(([k, v]) => [k, v.score])), [profile]);
  const mine = useCareer((s) => s.skills);
  const rows = useMemo(() => jobs.filter((j) => j.owner !== me && j.status === 'open' && !apps.some((a) => a.jobId === j.id && a.candidate === me)).map((j) => ({ j, fit: computeFit(j.reqs, scores, null, j.trustWeight) })).sort((a, b) => b.fit.overall - a.fit.overall).slice(0, 6), [jobs, apps, me, scores]);
  const has = Object.keys(scores).length > 0;
  return (
    <Card>
      <H>Offerte adatte a te</H>
      <Body small muted style={{ marginTop: 4 }}>{tl('Le offerte aperte in LifeNetwork, ordinate per quanto le tue competenze verificate coincidono.')}</Body>
      {!has ? <Empty text="Per vedere le offerte adatte fai un test in LifeNetwork → Lavoro: le tue competenze verificate compaiono qui." /> : rows.length === 0 ? <Empty text="Nessuna offerta aperta per ora." /> : rows.map(({ j, fit }) => (
        <View key={j.id} style={{ marginTop: 12 }}>
          <Row><View style={{ flex: 1 }}><Body bold>{j.title}</Body><Body small muted>{`${j.company} · ${j.location} · ${j.pay}`}</Body></View><Pill label={`${fit.overall}%`} color={fit.overall >= 70 ? '#22c55e' : fit.overall >= 40 ? '#f59e0b' : undefined} /></Row>
          {fit.unmet.length ? <Body small muted>{tl('Da migliorare: {0}', fit.unmet.map((u) => u.skill).join(', '))}</Body> : <Body small>{tl('Hai tutte le competenze richieste.')}</Body>}
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><Btn small ghost title="Apri l'offerta" onPress={() => go('jobDetail', { id: j.id })} /></View>
        </View>
      ))}
      {mine.length ? <Body small muted style={{ marginTop: 12 }}>{tl('Le tue {0} competenze della mappa non cambiano questo punteggio: contano quelle verificate con i test.', mine.length)}</Body> : null}
    </Card>
  );
}
