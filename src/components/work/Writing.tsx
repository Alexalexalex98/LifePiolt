import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { sharePdf } from '@/lib/exportFile';
import { saveReportPage } from '@/lib/reportPage';
import { loadBrand, saveBrand } from '@/lib/teamBrand';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { pullTasks } from '@/lib/teamTasks';
import { writeAi, type WriteOp } from '@/lib/teamReports';
import { today } from '@/lib/teamWork';
import { DOC_TYPES, TONE_LABEL, changeTone, docHtml as brandDoc, docType, proofread, slidesFromProject, slidesFromText, slidesHtml, type Slide, type Tone } from '@/lib/writing';
import { progress } from '@/lib/workTasks';
import { brandOf, useBrand } from '@/store/brand';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWTasks } from '@/store/tasks';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';
import { useApp } from '@/store/app';

const COLORS = ['#0F766E', '#2F55D4', '#6D3FD1', '#B4530A', '#C02F2F', '#334155'];
const GROUPS = ['Comunicazione', 'Documenti', 'Moduli'] as const;

/** Scrittura di lavoro: modelli di documenti, correzione, tono, traduzione e riassunto, presentazioni, PDF con intestazione e logo dell'azienda. */
export function Writing() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const { caps } = useCaps(team?.id);
  const brand = brandOf(team?.id, useBrand((s) => s.brand));
  const [doc, setDoc] = useState<string | null>(null);
  const [pres, setPres] = useState(false);
  const [bOpen, setBOpen] = useState(false);
  useEffect(() => { if (team) { void loadBrand(team.id); void loadPeople(team.id); void pullTasks(team.id); } }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="scrivi lettere, offerte e presentazioni con il logo dell'azienda" />;
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      {GROUPS.map((g) => (
        <Card key={g}>
          <H>{tl(g)}</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{DOC_TYPES.filter((d) => d.group === g).map((d) => <Pill key={d.id} label={tl(d.name)} onPress={() => setDoc(d.id)} />)}</View>
        </Card>
      ))}
      <Card>
        <H>Presentazioni</H>
        <Body small muted style={{ marginTop: 4 }}>Da un testo o da un progetto: ogni titolo diventa una diapositiva. Esce in PDF con il logo.</Body>
        <Btn style={{ marginTop: 10 }} icon="chart" title="Crea una presentazione" onPress={() => setPres(true)} />
      </Card>
      <Card>
        <Row><View style={{ flex: 1 }}><H>Dati e logo dell'azienda</H><Body small muted>{brand.company ? `${brand.company}${brand.logo ? ' · logo caricato' : ''}` : tl('Compaiono in alto su tutti i PDF: report, lettere, offerte, presentazioni.')}</Body></View><Btn small ghost icon="edit" title={caps.has('announce') ? 'Modifica' : 'Vedi'} onPress={() => setBOpen(true)} /></Row>
      </Card>
      {doc ? <Editor team={team.id} typeId={doc} onClose={() => setDoc(null)} /> : null}
      <Presentation team={team.id} open={pres} onClose={() => setPres(false)} />
      {bOpen ? <BrandSheet team={team.id} canEdit={caps.has('announce')} onClose={() => setBOpen(false)} /> : null}
    </View>
  );
}

/* ---------- scrivere un documento ---------- */
function Editor({ team, typeId, onClose }: { team: string; typeId: string; onClose: () => void }) {
  const th = useTheme();
  const t0 = today(); const dt = docType(typeId)!;
  const myName = useApp((s) => s.account.name) || tl('Il mittente');
  const teamName = useTeams((s) => s.teams.find((x) => x.id === team)?.name) ?? '';
  const brand = brandOf(team, useBrand((s) => s.brand));
  const [f, setF] = useState<Record<string, string>>({}); const [tone, setTone] = useState<Tone>('formale');
  const [edited, setEdited] = useState<string | null>(null); const [fixes, setFixes] = useState<string[] | null>(null); const [busy, setBusy] = useState(false);
  const built = useMemo(() => dt.build(f, { tone, today: t0, from: myName }), [f, tone, t0, myName, dt]);
  const text = edited ?? built;
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setEdited(null); };
  const ai = (op: WriteOp) => { setBusy(true); void writeAi(op, text).then((r) => { setBusy(false); if (r.ok) setEdited(r.text); else toast(r.text); }); };
  const b = { company: brand.company || teamName, address: brand.address, email: brand.email, phone: brand.phone, vat: brand.vat, footer: brand.footer, color: brand.color, logo: brand.logo };
  return (
    <Sheet visible title={tl(dt.name)} onClose={onClose}>
      {dt.fields.map((x) => <Input key={x.k} placeholder={tl(x.label)} value={f[x.k] ?? ''} onChangeText={(v) => set(x.k, v)} maxLines={x.long ? 6 : undefined} />)}
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('TONO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>{(Object.keys(TONE_LABEL) as Tone[]).map((k) => <Pill key={k} label={tl(TONE_LABEL[k])} on={tone === k} onPress={() => { setTone(k); if (edited) setEdited(changeTone(edited, k)); }} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('TESTO').toUpperCase()}</Body>
      <Input value={text} onChangeText={setEdited} maxLines={14} />
      {fixes ? <Text style={{ color: th.muted, fontSize: 12, marginBottom: 8 }}>{fixes.length ? `${tl('Corretto')}: ${fixes.join('; ')}.` : tl('Non ho trovato errori.')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small ghost icon="check" title="Correggi" onPress={() => { const r = proofread(text); setEdited(r.text); setFixes(r.fixes); }} />
        <Btn small ghost icon="sparkle" disabled={busy} title="Migliora con Theia" onPress={() => ai('polish')} />
        <Btn small ghost disabled={busy} title="Riassumi" onPress={() => ai('summary')} />
        <Btn small ghost disabled={busy} title="In inglese" onPress={() => ai('translate-en')} />
        <Btn small ghost disabled={busy} title="In tedesco" onPress={() => ai('translate-de')} />
        <Btn small ghost disabled={busy} title="In francese" onPress={() => ai('translate-fr')} />
      </View>
      <Row style={{ marginTop: 12 }}>
        <Btn icon="file" title="PDF con logo" onPress={() => { void sharePdf(brandDoc(text, b), `${dt.name}.pdf`); }} />
        <Btn ghost icon="send" title="Condividi" onPress={() => { void Share.share({ message: text }); }} />
      </Row>
      <Btn style={{ marginTop: 8 }} ghost icon="note" title="Salva nel workspace" onPress={() => { void saveReportPage(team, `${dt.name} · ${f.oggetto || f.titolo || f.a || t0}`, text).then(() => toast('Salvato nel workspace')); }} />
    </Sheet>
  );
}

/* ---------- presentazioni ---------- */
function Presentation({ team, open, onClose }: { team: string; open: boolean; onClose: () => void }) {
  const pages = useWorkspace((s) => s.pages);
  const tasks = useWTasks((s) => s.tasks[team]) ?? [];
  const brand = brandOf(team, useBrand((s) => s.brand));
  const teamName = useTeams((s) => s.teams.find((x) => x.id === team)?.name) ?? '';
  const [src, setSrc] = useState<'text' | 'project'>('project'); const [txt, setTxt] = useState(''); const [pid, setPid] = useState<string | null>(null); const [slides, setSlides] = useState<Slide[] | null>(null);
  const projects = pages.filter((p) => p.teamId === team && p.parent === null && p.kind === 'page');
  const make = () => {
    if (src === 'text') { const s = slidesFromText(txt); if (!s.length) { toast('Scrivi qualcosa: ogni titolo diventa una diapositiva'); return; } setSlides(s); return; }
    const p = projects.find((x) => x.id === pid); if (!p) { toast('Scegli un progetto'); return; }
    const ts = tasks.filter((x) => x.project === p.id && !x.parent); const t0 = today();
    const meta = useWTasks.getState().projects[team]?.find((x) => x.id === p.id);
    setSlides(slidesFromProject({ title: p.title || tl('Progetto'), goal: meta?.goal ?? '', progress: progress(ts), due: meta?.due ?? null, done: ts.filter((x) => x.status === 'done').map((x) => x.title), late: ts.filter((x) => x.status !== 'done' && x.due && x.due < t0).map((x) => x.title), next: ts.filter((x) => x.status !== 'done').sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).map((x) => x.title) }));
  };
  const b = { company: brand.company || teamName, address: brand.address, email: brand.email, phone: brand.phone, vat: brand.vat, footer: brand.footer, color: brand.color, logo: brand.logo };
  return (
    <Sheet visible={open} title="Presentazione" onClose={() => { setSlides(null); onClose(); }}>
      {!slides ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}><Pill label={tl('Da un progetto')} on={src === 'project'} onPress={() => setSrc('project')} /><Pill label={tl('Da un testo')} on={src === 'text'} onPress={() => setSrc('text')} /></View>
          {src === 'project' ? (projects.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{projects.map((p) => <Pill key={p.id} label={p.title || tl('Progetto')} on={pid === p.id} onPress={() => setPid(p.id)} />)}</View> : <Empty text="Non ci sono progetti. Crea un progetto nel workspace." />) : <Input placeholder={'Incolla il testo. Ogni titolo (# Titolo, oppure una riga che finisce con «:») apre una diapositiva.'} value={txt} onChangeText={setTxt} maxLines={12} />}
          <Btn icon="check" title="Crea le diapositive" onPress={make} />
        </>
      ) : (
        <>
          {slides.map((s, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Input value={s.title} onChangeText={(v) => setSlides(slides.map((x, j) => (j === i ? { ...x, title: v } : x)))} style={{ fontWeight: '800', marginBottom: 4 }} />
              <Input value={s.bullets.join('\n')} onChangeText={(v) => setSlides(slides.map((x, j) => (j === i ? { ...x, bullets: v.split('\n').filter((l) => l.trim()) } : x)))} maxLines={6} />
            </View>
          ))}
          <Btn icon="file" title={`PDF · ${slides.length} ${tl('diapositive')}`} onPress={() => { void sharePdf(slidesHtml(slides, b, slides[0]?.title ?? 'Presentazione'), 'Presentazione.pdf'); }} />
          <Btn style={{ marginTop: 8 }} ghost title="Rifai" onPress={() => setSlides(null)} />
        </>
      )}
    </Sheet>
  );
}

/* ---------- dati e logo ---------- */
function BrandSheet({ team, canEdit, onClose }: { team: string; canEdit: boolean; onClose: () => void }) {
  const brand = brandOf(team, useBrand((s) => s.brand));
  const [f, setF] = useState({ company: brand.company, address: brand.address, email: brand.email, phone: brand.phone, vat: brand.vat, footer: brand.footer, color: brand.color });
  const [logo, setLogo] = useState<{ uri: string; name: string } | null>(null); const [busy, setBusy] = useState(false);
  const pick = async () => { const r = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true }); if (!r.canceled && r.assets[0]) setLogo({ uri: r.assets[0].uri, name: r.assets[0].name }); };
  const save = () => { setBusy(true); void saveBrand(team, f, logo ?? undefined).then((r) => { setBusy(false); toast(r.ok ? 'Dati salvati: li usano tutti i PDF' : r.message); if (r.ok) onClose(); }); };
  const inp = (k: keyof typeof f, ph: string) => <Input placeholder={ph} value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} editable={canEdit} />;
  return (
    <Sheet visible title="Dati e logo dell'azienda" onClose={onClose}>
      {inp('company', 'Nome dell\'azienda')}{inp('address', 'Indirizzo')}
      <Row><Input flex={1} placeholder="Telefono" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} editable={canEdit} /><Input flex={1} placeholder="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} editable={canEdit} autoCapitalize="none" /></Row>
      {inp('vat', 'Partita IVA o numero IDI')}{inp('footer', 'Piè di pagina (es. Rossi Srl · Sede legale…)')}
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('COLORE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>{COLORS.map((c) => <View key={c} style={{ borderRadius: 18, borderWidth: 3, borderColor: f.color === c ? '#fff' : 'transparent' }}><Btn small title="" label={c} style={{ backgroundColor: c, width: 32, height: 32, minWidth: 32, paddingHorizontal: 0 }} onPress={() => canEdit && setF({ ...f, color: c })} /></View>)}</View>
      {canEdit ? <Btn ghost icon="image" title={logo ? `Logo: ${logo.name}` : brand.logo ? 'Cambia il logo' : 'Carica il logo'} onPress={() => { void pick(); }} /> : null}
      {canEdit ? <Btn style={{ marginTop: 10 }} icon="check" disabled={busy} title={busy ? 'Un momento…' : 'Salva'} onPress={save} /> : <Body small muted>{tl('Li modificano amministratori e responsabili.')}</Body>}
    </Sheet>
  );
}
