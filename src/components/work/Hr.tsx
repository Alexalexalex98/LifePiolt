import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { CONTRACT_LABEL, CRITERIA, CSTAGES, balance, candidateScore, declineText, goalsProgress, nextCStage, offerText, periodNow, pipelineCounts, profileAlerts, rankCandidates, tenure, trainingAlerts, upcomingInterviews, type CStage } from '@/lib/hr';
import { KINDS } from '@/lib/docClassify';
import { addTraining, createCandidate, createReview, deleteCandidate, deleteReview, deleteTraining, pullHr, saveProfile, startProcess, updateCandidate, updateReview } from '@/lib/teamHr';
import { downloadDoc, listDocs } from '@/lib/teamDocs';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { decideAbsence } from '@/lib/teamWork';
import { today } from '@/lib/teamWork';
import { hrOf, useHr, type HrCandidate, type HrReview } from '@/store/hr';
import { useDocs } from '@/store/docs';
import { usePeople } from '@/store/people';
import { useApp } from '@/store/app';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

type Tab = 'mia' | 'team' | 'persone' | 'candidati' | 'valutazioni' | 'formazione' | 'assenze';
const NONE: never[] = [];
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const chips = <T,>(label: string, items: { k: T; l: string }[], val: T, set: (v: T) => void) => (<><Body small bold muted style={{ marginBottom: 6 }}>{tl(label).toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{items.map((i) => <Pill key={String(i.k)} label={i.l} on={val === i.k} onPress={() => set(i.k)} />)}</View></>);

/** Persone e HR: la mia scheda, le schede di tutti (contratto, ferie, buste paga), candidati con valutazione e colloqui, obiettivi e valutazioni, formazione e certificati, assenze. */
export function Hr() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const people = usePeople((s) => (team ? s.people[team.id] : undefined)) ?? NONE;
  const me = usePeople((s) => s.me);
  const d = useHr((s) => hrOf(team?.id, s.data));
  const hr = caps.has('hr.docs');
  const reports = people.filter((p) => p.reports_to === me);
  const [tab, setTab] = useState<Tab>('mia');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (!team) return; void loadPeople(team.id); void pullHr(team.id); if (hr) void listDocs(team.id); }, [team?.id, hr]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="gestisci le persone, i candidati e le valutazioni" />;
  const nameOf = (id: string) => (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega'));
  const tabs: [Tab, string][] = [['mia', 'La mia scheda'], ...(reports.length && !hr ? [['team', 'Il mio team'] as [Tab, string]] : []), ...(hr ? [['persone', 'Persone'], ['candidati', 'Candidati'], ['valutazioni', 'Valutazioni'], ['formazione', 'Formazione'], ['assenze', 'Assenze']] as [Tab, string][] : [])];
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{tabs.map(([k, l]) => <Pill key={k} label={tl(l)} on={tab === k} onPress={() => setTab(k)} />)}</ScrollView>
      {tab === 'mia' ? <Mine team={team.id} me={me} nameOf={nameOf} /> : null}
      {tab === 'team' ? <Card><H>Il mio team</H>{reports.map((p) => <Row key={p.user_id} style={{ marginTop: 8 }}><Body style={{ flex: 1 }}>{p.name || tl('Collega')}</Body><Btn small icon="plus" title="Valutazione" onPress={() => { void createReview(team.id, p.user_id, periodNow(today())).then((r) => { if (r.ok) { setOpen(r.data); setTab('valutazioni'); } else toast(r.message); }); }} /></Row>)}</Card> : null}
      {tab === 'persone' ? <PeopleList team={team.id} people={people} nameOf={nameOf} /> : null}
      {tab === 'candidati' ? <Candidates team={team.id} /> : null}
      {tab === 'valutazioni' || tab === 'team' ? <Reviews team={team.id} nameOf={nameOf} me={me} hr={hr} open={open} setOpen={setOpen} /> : null}
      {tab === 'formazione' ? <TrainingAll team={team.id} nameOf={nameOf} /> : null}
      {tab === 'assenze' ? <Absences team={team.id} people={people} nameOf={nameOf} /> : null}
      {d.profiles.length === 0 && hr && tab === 'persone' ? null : null}
    </View>
  );
}

/* ---------- la mia scheda ---------- */
function Mine({ team, me, nameOf }: { team: string; me: string | null; nameOf: (id: string) => string }) {
  const d = useHr((s) => hrOf(team, s.data));
  const docs = useDocs((s) => s.docs[team]) ?? NONE;
  const myName = useApp((s) => s.account.name);
  const t0 = today(); const y = Number(t0.slice(0, 4));
  const p = d.mine;
  const mineAbs = d.absences.filter((a) => a.user_id === me);
  const b = balance(p, mineAbs, y);
  const shared = d.reviews.filter((r) => r.person === me && r.status === 'shared');
  const myTr = d.training.filter((x) => x.person === me);
  const pay = docs.filter((x) => x.kind === 'payslip' && x.person === me);
  const [rv, setRv] = useState<string | null>(null);
  void myName; void nameOf;
  return (
    <>
      <Card>
        <H>Il mio contratto</H>
        {p ? (
          <>
            <Body small style={{ marginTop: 6 }}>{`${tl(CONTRACT_LABEL[p.contract])}${p.hired_on ? ` · ${tl('dal')} ${day(p.hired_on)} (${tl(tenure(p.hired_on, t0))})` : ''}`}</Body>
            {p.contract_end ? <Body small muted>{`${tl('Fino al')} ${day(p.contract_end)}`}</Body> : null}
            {p.weekly_hours ? <Body small muted>{`${p.weekly_hours} ${tl('ore a settimana')}`}</Body> : null}
          </>
        ) : <Body small muted style={{ marginTop: 6 }}>{tl('HR non ha ancora compilato la tua scheda.')}</Body>}
        <Row style={{ marginTop: 10 }}><Body small style={{ flex: 1 }}>{tl('Ferie {0}', y)}</Body><Body bold>{b.total == null ? `${b.taken} ${tl('prese')}` : `${b.left} ${tl('residue')} / ${b.total}`}</Body></Row>
        {b.pending ? <Body small muted>{tl('{0} giorni richiesti, in attesa', b.pending)}</Body> : null}
        {b.sick || b.leave ? <Body small muted>{tl('Malattia: {0} giorni · permessi: {1}', b.sick, b.leave)}</Body> : null}
        <Body small muted style={{ marginTop: 6 }}>{tl('Le ferie si chiedono dalla scheda Piano.')}</Body>
      </Card>
      <Card>
        <H>Le mie buste paga</H>
        {pay.length === 0 ? <Empty text="Nessuna busta paga caricata." /> : pay.map((x) => <Row key={x.id} style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>{x.title}</Body><ChipBtn icon="file" title="Apri" onPress={() => { void openDoc(x); }} /></Row>)}
      </Card>
      {shared.length ? <Card><H>Le mie valutazioni</H>{shared.map((r) => <Row key={r.id} style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>{`${r.period} · ${goalsProgress(r.goals)}% ${tl('obiettivi')}${r.rating ? ` · ${r.rating}/5` : ''}`}</Body><ChipBtn icon="chevron-right" title="Apri" onPress={() => setRv(r.id)} /></Row>)}</Card> : null}
      {myTr.length ? <Card><H>La mia formazione</H>{myTr.map((x) => <Body key={x.id} small style={{ marginTop: 6 }}>{`${x.title}${x.expires_on ? ` · ${tl('scade')} ${day(x.expires_on)}` : ''}`}</Body>)}</Card> : null}
      {rv && d.reviews.find((r) => r.id === rv) ? <ReviewSheet r={d.reviews.find((r) => r.id === rv)!} canEdit={false} nameOf={nameOf} onClose={() => setRv(null)} /> : null}
    </>
  );
}
async function openDoc(x: Parameters<typeof downloadDoc>[0]) {
  const r = await downloadDoc(x); if (!r.ok) { toast(r.message); return; }
  try { const { File, Paths } = await import('expo-file-system'); const S = await import('expo-sharing'); const f = new File(Paths.cache, `hr-${Date.now().toString(36)}-${x.file_name.replace(/[^\w.\-]+/g, '_')}`); f.create({ overwrite: true }); f.write(r.data); if (await S.isAvailableAsync()) await S.shareAsync(f.uri, { mimeType: x.mime ?? undefined }); } catch { toast('Non riesco ad aprire il file su questo dispositivo.'); }
}

/* ---------- persone (HR) ---------- */
function PeopleList({ team, people, nameOf }: { team: string; people: { user_id: string; name: string; position: string | null }[]; nameOf: (id: string) => string }) {
  const d = useHr((s) => hrOf(team, s.data));
  const [open, setOpen] = useState<string | null>(null);
  const t0 = today(); const y = Number(t0.slice(0, 4));
  return (
    <Card>
      <H>Persone</H>
      {people.map((p) => { const pr = d.profiles.find((x) => x.user_id === p.user_id) ?? null; const b = balance(pr, d.absences.filter((a) => a.user_id === p.user_id), y); const al = profileAlerts(pr, t0);
        return (
          <Row key={p.user_id} style={{ marginTop: 10 }}>
            <View style={{ flex: 1 }}><Body bold>{p.name || tl('Collega')}</Body><Body small muted>{[pr ? tl(CONTRACT_LABEL[pr.contract]) : tl('scheda da compilare'), pr?.hired_on ? tl(tenure(pr.hired_on, t0)) : '', b.left != null ? tl('{0} giorni di ferie residui', b.left) : ''].filter(Boolean).join(' · ')}</Body>{al.map((a) => <Body key={a.kind} small bold color="#e0a030">{`${day(a.day)} · ${tl(a.text)}`}</Body>)}</View>
            <ChipBtn icon="chevron-right" title="Apri" onPress={() => setOpen(p.user_id)} />
          </Row>
        ); })}
      {open ? <PersonSheet team={team} user={open} name={nameOf(open)} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}
function PersonSheet({ team, user, name, onClose }: { team: string; user: string; name: string; onClose: () => void }) {
  const d = useHr((s) => hrOf(team, s.data)); const docs = useDocs((s) => s.docs[team]) ?? NONE;
  const pr = d.profiles.find((x) => x.user_id === user);
  const [f, setF] = useState({ hired_on: pr?.hired_on ?? '', contract: (pr?.contract ?? 'indeterminato') as keyof typeof CONTRACT_LABEL, contract_end: pr?.contract_end ?? '', weekly_hours: pr?.weekly_hours != null ? String(pr.weekly_hours) : '', vacation_days: pr?.vacation_days != null ? String(pr.vacation_days) : '', phone: pr?.phone ?? '', emergency: pr?.emergency ?? '', hr_notes: pr?.hr_notes ?? '' });
  const [tr, setTr] = useState({ title: '', expires: '' });
  const y = Number(today().slice(0, 4)); const b = balance(pr ?? null, d.absences.filter((a) => a.user_id === user), y);
  const mydocs = docs.filter((x) => x.person === user || (x.kind === 'cv' && false));
  const trs = d.training.filter((x) => x.person === user); const revs = d.reviews.filter((r) => r.person === user);
  const save = () => {
    for (const k of ['hired_on', 'contract_end'] as const) if (f[k] && !okDay(f[k])) { toast('Scrivi le date come 2026-12-31'); return; }
    void saveProfile(team, user, { hired_on: f.hired_on || null, contract: f.contract, contract_end: f.contract_end || null, weekly_hours: f.weekly_hours ? parseFloat(f.weekly_hours.replace(',', '.')) : null, vacation_days: f.vacation_days ? parseInt(f.vacation_days, 10) : null, phone: f.phone, emergency: f.emergency, hr_notes: f.hr_notes }).then((r) => toast(r.ok ? 'Scheda salvata' : r.message));
  };
  return (
    <Sheet visible title={name} onClose={onClose}>
      <Body small muted>{`${tl('Ferie {0}', y)}: ${b.total == null ? `${b.taken} ${tl('prese')}` : tl('{0} residue su {1}', b.left ?? 0, b.total)}${b.pending ? ` · ${tl('{0} in attesa', b.pending)}` : ''} · ${tl('malattia')} ${b.sick} ${tl('giorni')}`}</Body>
      <Body small bold muted style={{ marginTop: 12, marginBottom: 6 }}>{tl('CONTRATTO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{(Object.keys(CONTRACT_LABEL) as (keyof typeof CONTRACT_LABEL)[]).map((k) => <Pill key={k} label={tl(CONTRACT_LABEL[k])} on={f.contract === k} onPress={() => setF({ ...f, contract: k })} />)}</View>
      <Row><Input flex={1} placeholder="Assunto il (2024-03-01)" value={f.hired_on} onChangeText={(v) => setF({ ...f, hired_on: v })} /><Input flex={1} placeholder="Scade il (2027-03-01)" value={f.contract_end} onChangeText={(v) => setF({ ...f, contract_end: v })} /></Row>
      <Row><Input flex={1} placeholder="Ore a settimana" value={f.weekly_hours} onChangeText={(v) => setF({ ...f, weekly_hours: v })} keyboardType="decimal-pad" /><Input flex={1} placeholder="Giorni di ferie all'anno" value={f.vacation_days} onChangeText={(v) => setF({ ...f, vacation_days: v })} keyboardType="number-pad" /></Row>
      <Input placeholder="Telefono" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} /><Input placeholder="Contatto di emergenza" value={f.emergency} onChangeText={(v) => setF({ ...f, emergency: v })} />
      <Input placeholder="Note riservate a HR (la persona non le vede)" value={f.hr_notes} onChangeText={(v) => setF({ ...f, hr_notes: v })} maxLines={4} />
      <Btn icon="check" title="Salva la scheda" onPress={save} />
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('DOCUMENTI DELLA PERSONA').toUpperCase()}</Body>
      {mydocs.length ? mydocs.map((x) => <Row key={x.id} style={{ marginBottom: 4 }}><Body small style={{ flex: 1 }}>{`${tl(KINDS[x.kind].label)} · ${x.title}`}</Body><ChipBtn icon="file" title="Apri" onPress={() => { void openDoc(x); }} /></Row>) : <Body small muted>{tl('Nessuna busta paga o contratto. Caricali dalla scheda Documenti scegliendo la persona.')}</Body>}
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('FORMAZIONE E CERTIFICATI').toUpperCase()}</Body>
      {trs.map((x) => <Row key={x.id} style={{ marginBottom: 4 }}><Body small style={{ flex: 1 }}>{`${x.title}${x.expires_on ? ` · ${tl('scade')} ${day(x.expires_on)}` : ''}`}</Body><ChipBtn icon="trash" tone="danger" title="" onPress={() => { void deleteTraining(x); }} /></Row>)}
      <Row><Input flex={1} style={{ marginBottom: 0 }} placeholder="Corso o certificato" value={tr.title} onChangeText={(v) => setTr({ ...tr, title: v })} /><Input flex={1} style={{ marginBottom: 0 }} placeholder="Scade (2027-01-31)" value={tr.expires} onChangeText={(v) => setTr({ ...tr, expires: v })} /></Row>
      <Btn small ghost icon="plus" style={{ marginTop: 6 }} title="Aggiungi" onPress={() => { if (!tr.title.trim()) { toast('Scrivi il corso'); return; } if (tr.expires && !okDay(tr.expires)) { toast('Scrivi la data come 2027-01-31'); return; } void addTraining(team, user, { title: tr.title.trim(), kind: tr.expires ? 'certificato' : 'corso', done_on: null, expires_on: tr.expires || null }).then((r) => { if (r.ok) setTr({ title: '', expires: '' }); else toast(r.message); }); }} />
      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('VALUTAZIONI').toUpperCase()}</Body>
      {revs.map((r) => <Body key={r.id} small style={{ marginBottom: 2 }}>{`${r.period} · ${goalsProgress(r.goals)}% ${tl('obiettivi')} · ${tl(r.status === 'shared' ? 'condivisa' : 'bozza')}`}</Body>)}
      <Btn small ghost icon="plus" title="Nuova valutazione" onPress={() => { void createReview(team, user, periodNow(today())).then((r) => toast(r.ok ? 'Creata: la trovi nella scheda Valutazioni' : r.message)); }} />
      <Row style={{ marginTop: 14 }}>
        <Btn small ghost title="Avvia l'inserimento" onPress={() => { void startProcess(team, 'onboarding', name).then((r) => toast(r.ok ? 'Progetto di inserimento creato nei Task' : r.message)); }} />
        <Btn small ghost danger title="Avvia l'uscita" onPress={() => alertT('Avviare l\'uscita?', `${name}: creo il progetto con tutti i passaggi (consegne, accessi, ultima busta paga, certificato di lavoro).`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Avvia', onPress: () => { void startProcess(team, 'uscita', name).then((r) => toast(r.ok ? 'Progetto di uscita creato nei Task' : r.message)); } }])} />
      </Row>
    </Sheet>
  );
}

/* ---------- candidati ---------- */
function Candidates({ team }: { team: string }) {
  const th = useTheme(); const d = useHr((s) => hrOf(team, s.data)); const docs = useDocs((s) => s.docs[team]) ?? NONE;
  const [open, setOpen] = useState<string | null>(null); const [neu, setNeu] = useState(false); const [role, setRole] = useState<string | null>(null);
  const roles = [...new Set(d.candidates.map((c) => c.role).filter(Boolean))];
  const ranked = rankCandidates(d.candidates, role ?? undefined); const counts = pipelineCounts(d.candidates);
  const upcoming = upcomingInterviews(d.candidates, Date.now());
  const linked = new Set(d.candidates.map((c) => c.cv_doc).filter(Boolean));
  const cvs = docs.filter((x) => x.kind === 'cv' && !linked.has(x.id));
  return (
    <>
      <Card>
        <Row><H>Candidati</H><Btn small icon="plus" title="Nuovo" onPress={() => setNeu(true)} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{CSTAGES.map((s) => `${tl(s.label)} ${counts[s.id]}`).join(' · ')}</Body>
        {upcoming.length ? <Body small bold style={{ marginTop: 8 }}>{tl('Prossimo colloquio: {0} · {1}', upcoming[0]!.name, new Date(upcoming[0]!.interview_at!).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</Body> : null}
        {roles.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}><Pill label={tl('Tutti')} on={!role} onPress={() => setRole(null)} />{roles.map((r) => <Pill key={r} label={r} on={role === r} onPress={() => setRole(r)} />)}</View> : null}
      </Card>
      <Card>
        <H>In gara, dal migliore</H>
        {ranked.length === 0 ? <Empty text="Nessun candidato in gara. Aggiungine uno o importa un CV." /> : ranked.map((c, i) => { const sc = candidateScore(c.scores); return (
          <Row key={c.id} style={{ marginTop: 8 }}>
            <Text style={{ width: 22, color: th.muted, fontWeight: '800' }}>{String(i + 1)}</Text>
            <View style={{ flex: 1 }}><Body bold>{c.name}</Body><Body small muted>{`${c.role || tl('senza ruolo')} · ${tl(CSTAGES.find((s) => s.id === c.stage)!.label)}${sc != null ? ` · ${sc}/5` : ` · ${tl('da valutare')}`}`}</Body></View>
            <ChipBtn icon="chevron-right" title="Apri" onPress={() => setOpen(c.id)} />
          </Row>
        ); })}
        {d.candidates.filter((c) => c.stage === 'hired' || c.stage === 'rejected').length ? <Body small muted style={{ marginTop: 10 }}>{tl('Chiusi: {0} assunti, {1} non scelti', counts.hired, counts.rejected)}</Body> : null}
      </Card>
      {cvs.length ? (
        <Card>
          <H>Curriculum caricati</H>
          <Body small muted style={{ marginTop: 4 }}>Letti da Theia nella scheda Documenti: aggiungili ai candidati con un tocco.</Body>
          {cvs.map((x) => <Row key={x.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{x.title}</Body><Body small muted>{[x.fields.ruolo, x.fields.esperienza, x.fields.email].filter(Boolean).join(' · ')}</Body></View><ChipBtn icon="plus" title="Candidato" onPress={() => { void createCandidate({ team, name: [x.fields.nome, x.fields.cognome].filter(Boolean).join(' ') || x.title, email: x.fields.email, phone: x.fields.telefono, role: x.fields.ruolo, source: 'CV caricato', cv_doc: x.id }).then((r) => toast(r.ok ? 'Aggiunto ai candidati' : r.message)); }} /></Row>)}
        </Card>
      ) : null}
      {neu ? <NewCandidate team={team} onClose={() => setNeu(false)} /> : null}
      {open && d.candidates.find((c) => c.id === open) ? <CandidateSheet c={d.candidates.find((c) => c.id === open)!} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
function NewCandidate({ team, onClose }: { team: string; onClose: () => void }) {
  const [f, setF] = useState({ name: '', role: '', email: '', phone: '', source: '' });
  return (
    <Sheet visible title="Nuovo candidato" onClose={onClose}>
      <Input placeholder="Nome e cognome" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} /><Input placeholder="Ruolo per cui si candida" value={f.role} onChangeText={(v) => setF({ ...f, role: v })} />
      <Row><Input flex={1} placeholder="Telefono" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" /><Input flex={1} placeholder="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" /></Row>
      <Input placeholder="Da dove arriva (annuncio, passaparola…)" value={f.source} onChangeText={(v) => setF({ ...f, source: v })} />
      <Btn icon="check" title="Aggiungi" onPress={() => { if (!f.name.trim()) { toast('Scrivi il nome'); return; } void createCandidate({ team, ...f }).then((r) => { if (r.ok) onClose(); else toast(r.message); }); }} />
    </Sheet>
  );
}
function CandidateSheet({ c, onClose }: { c: HrCandidate; onClose: () => void }) {
  const myName = useApp((s) => s.account.name) || tl('Il team HR');
  const [notes, setNotes] = useState(c.notes); const [when, setWhen] = useState(c.interview_at ? c.interview_at.slice(0, 16).replace('T', ' ') : '');
  const patch = (p: Parameters<typeof updateCandidate>[1]) => { void updateCandidate(c, p).then((r) => { if (!r.ok) toast(r.message); }); };
  const sc = candidateScore(c.scores); const nx = nextCStage(c.stage);
  return (
    <Sheet visible title={c.name} onClose={onClose}>
      <Body small muted>{[c.role, c.email, c.phone].filter(Boolean).join(' · ')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>{CSTAGES.map((s) => <Pill key={s.id} label={tl(s.label)} on={c.stage === s.id} onPress={() => patch({ stage: s.id as CStage })} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{`${tl('VALUTAZIONE').toUpperCase()}${sc != null ? ` · ${sc}/5` : ''}`}</Body>
      {CRITERIA.map((k) => <Row key={k} style={{ marginBottom: 6 }}><Body small style={{ width: 110 }}>{tl(k)}</Body><View style={{ flexDirection: 'row', gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <Pill key={n} label={String(n)} on={c.scores[k] === n} onPress={() => patch({ scores: { ...c.scores, [k]: c.scores[k] === n ? 0 : n } })} />)}</View></Row>)}
      <Input placeholder="Colloquio (2026-11-20 10:00)" value={when} onChangeText={setWhen} onBlur={() => { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(when.trim()); if (when.trim() && !m) { toast('Scrivi data e ora come 2026-11-20 10:00'); return; } if (m && `${m[1]}T${m[2]}` !== (c.interview_at ?? '').slice(0, 16)) patch({ interview_at: new Date(`${m[1]}T${m[2]}:00`).toISOString() }); }} />
      <Input placeholder="Note sul colloquio" value={notes} onChangeText={setNotes} maxLines={5} onBlur={() => { if (notes !== c.notes) patch({ notes }); }} />
      <Row>{nx ? <Btn small icon="arrow-right" title={`${tl('Avanti')}: ${tl(CSTAGES.find((s) => s.id === nx)!.label)}`} onPress={() => patch({ stage: nx })} /> : null}</Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Btn small ghost title="Testo di offerta" onPress={() => { void Share.share({ message: offerText(c.name, c.role, '', myName) }); }} />
        <Btn small ghost title="Testo di non scelto" onPress={() => { void Share.share({ message: declineText(c.name, c.role, myName) }); }} />
        <Btn small ghost danger title="Elimina" onPress={() => alertT('Eliminare il candidato?', c.name, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteCandidate(c).then((r) => { if (r.ok) onClose(); else toast(r.message); }); } }])} />
      </View>
    </Sheet>
  );
}

/* ---------- valutazioni ---------- */
function Reviews({ team, nameOf, me, hr, open, setOpen }: { team: string; nameOf: (id: string) => string; me: string | null; hr: boolean; open: string | null; setOpen: (id: string | null) => void }) {
  const d = useHr((s) => hrOf(team, s.data));
  const list = d.reviews.filter((r) => hr || r.by === me);
  const cur = open ? d.reviews.find((r) => r.id === open) : undefined;
  return (
    <Card>
      <H>Valutazioni e obiettivi</H>
      {list.length === 0 ? <Empty text="Nessuna valutazione. Creane una dalla scheda di una persona." /> : list.map((r) => <Row key={r.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{nameOf(r.person)}</Body><Body small muted>{`${r.period} · ${goalsProgress(r.goals)}% ${tl('obiettivi')}${r.rating ? ` · ${r.rating}/5` : ''} · ${tl(r.status === 'shared' ? 'condivisa' : 'bozza')}`}</Body></View><ChipBtn icon="chevron-right" title="Apri" onPress={() => setOpen(r.id)} /></Row>)}
      {cur ? <ReviewSheet r={cur} canEdit={hr || cur.by === me} nameOf={nameOf} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}
function ReviewSheet({ r, canEdit, nameOf, onClose }: { r: HrReview; canEdit: boolean; nameOf: (id: string) => string; onClose: () => void }) {
  const [g, setG] = useState(''); const [fb, setFb] = useState(r.feedback);
  const patch = (p: Parameters<typeof updateReview>[1]) => { void updateReview(r, p).then((x) => { if (!x.ok) toast(x.message); }); };
  return (
    <Sheet visible title={`${nameOf(r.person)} · ${r.period}`} onClose={onClose}>
      <Body small bold muted style={{ marginBottom: 6 }}>{`${tl('OBIETTIVI').toUpperCase()} · ${goalsProgress(r.goals)}%`}</Body>
      {r.goals.map((x, i) => <Row key={i} style={{ marginBottom: 4 }}><Body small style={{ flex: 1, textDecorationLine: x.done ? 'line-through' : 'none' }}>{x.t}</Body>{canEdit ? <><ChipBtn icon="check" title={x.done ? 'Riapri' : 'Fatto'} onPress={() => patch({ goals: r.goals.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} /><ChipBtn icon="trash" tone="danger" title="" onPress={() => patch({ goals: r.goals.filter((_, j) => j !== i) })} /></> : null}</Row>)}
      {canEdit ? <Row><Input flex={1} style={{ marginBottom: 0 }} placeholder="Nuovo obiettivo" value={g} onChangeText={setG} /><Btn small icon="plus" title="" label="Aggiungi" onPress={() => { if (!g.trim()) return; patch({ goals: [...r.goals, { t: g.trim(), done: false }] }); setG(''); }} /></Row> : null}
      {chips('Valutazione complessiva', [1, 2, 3, 4, 5].map((n) => ({ k: n as number | null, l: String(n) })), r.rating as number | null, (v) => canEdit && patch({ rating: v }))}
      {canEdit ? <Input placeholder="Commento" value={fb} onChangeText={setFb} maxLines={6} onBlur={() => { if (fb !== r.feedback) patch({ feedback: fb }); }} /> : r.feedback ? <Body style={{ marginTop: 6 }}>{r.feedback}</Body> : null}
      {canEdit ? <Btn style={{ marginTop: 8 }} icon="send" title={r.status === 'shared' ? 'Condivisa con la persona: ritira' : 'Condividi con la persona'} ghost={r.status === 'shared'} onPress={() => patch({ status: r.status === 'shared' ? 'draft' : 'shared' })} /> : null}
      {canEdit ? <Btn style={{ marginTop: 8 }} ghost danger title="Elimina" onPress={() => { void deleteReview(r).then((x) => { if (x.ok) onClose(); else toast(x.message); }); }} /> : null}
    </Sheet>
  );
}

/* ---------- formazione e assenze ---------- */
function TrainingAll({ team, nameOf }: { team: string; nameOf: (id: string) => string }) {
  const d = useHr((s) => hrOf(team, s.data)); const al = trainingAlerts(d.training, today());
  return (
    <Card>
      <H>Formazione e certificati</H>
      {al.length ? <><Body small bold muted style={{ marginTop: 6 }}>{tl('DA RINNOVARE').toUpperCase()}</Body>{al.map(({ t, state }) => <Body key={t.id} small color={state === 'scaduto' ? '#ff5a64' : '#e0a030'} style={{ marginTop: 2 }}>{`${nameOf((d.training.find((x) => x.id === t.id) as { person: string }).person)} · ${t.title} · ${tl(state)} ${day(t.expires_on!)}`}</Body>)}</> : <Body small muted style={{ marginTop: 6 }}>{tl('Nessun certificato in scadenza nei prossimi 60 giorni.')}</Body>}
      <Body small muted style={{ marginTop: 10 }}>{tl('{0} corsi e certificati registrati. Si aggiungono dalla scheda di ogni persona.', d.training.length)}</Body>
    </Card>
  );
}
function Absences({ team, people, nameOf }: { team: string; people: { user_id: string; name: string }[]; nameOf: (id: string) => string }) {
  const d = useHr((s) => hrOf(team, s.data)); const y = Number(today().slice(0, 4));
  const pend = d.absences.filter((a) => a.status === 'requested' && a.to_day >= today());
  const rows = useMemo(() => people.map((p) => ({ p, b: balance(d.profiles.find((x) => x.user_id === p.user_id) ?? null, d.absences.filter((a) => a.user_id === p.user_id), y) })), [people, d, y]);
  return (
    <>
      {pend.length ? <Card><H>Richieste da decidere</H>{pend.map((a) => <Row key={a.id} style={{ marginTop: 8 }}><View style={{ flex: 1 }}><Body bold>{nameOf(a.user_id)}</Body><Body small muted>{`${tl(a.kind)} · ${day(a.from_day)} – ${day(a.to_day)}`}</Body></View><ChipBtn icon="check" title="Approva" onPress={() => { void decideAbsence(a.id, true).then((r) => { toast(r.ok ? 'Approvata' : r.message); void pullHr(team); }); }} /><ChipBtn icon="x" tone="danger" title="Rifiuta" onPress={() => { void decideAbsence(a.id, false).then((r) => { toast(r.ok ? 'Rifiutata' : r.message); void pullHr(team); }); }} /></Row>)}</Card> : null}
      <Card>
        <H>{`Ferie e assenze ${y}`}</H>
        {rows.map(({ p, b }) => <Row key={p.user_id} style={{ marginTop: 8 }}><Body small style={{ flex: 1 }}>{p.name || tl('Collega')}</Body><Body small>{`${tl('ferie')} ${b.taken}${b.total != null ? `/${b.total}` : ''} · ${tl('malattia')} ${b.sick}`}</Body></Row>)}
      </Card>
    </>
  );
}
