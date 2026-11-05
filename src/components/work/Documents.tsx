import { NoWorkspace } from '@/components/work/NoWorkspace';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useMembers } from '@/components/work/Meetings';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { FIELD_LABELS, KINDS, SECTIONS, type DocKind, type DocResult } from '@/lib/docClassify';
import { go } from '@/lib/nav';
import { deleteDoc, downloadDoc, listDocs, readAndAnalyze, readWithAi, saveDoc, updateDoc, type Picked } from '@/lib/teamDocs';
import { useDocs, type TeamDoc } from '@/store/docs';
import { useTeams } from '@/store/teams';
import { useCaps } from '@/lib/teamPeople';
import { canHandle, type Cap } from '@/lib/workRoles';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

const money = (n: number | null, c: string | null) => (n == null ? '' : `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c ?? ''}`.trim());
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const ALL_KINDS = Object.keys(KINDS) as DocKind[];
const ACCESS_TEXT: Record<string, string> = { team: 'Lo vedono tutte le persone del workspace.', admin: 'Lo vedono solo gli amministratori.', hr: 'Lo vedono HR e gli amministratori.', fin: 'Lo vedono amministrazione e gli amministratori.', legal: 'Lo vede l\'ufficio legale e gli amministratori.', person: 'Lo vedono HR, gli amministratori e la persona interessata.' };

/** Documenti intelligenti: ogni file caricato viene letto da Theia, riconosciuto e messo nell'elenco giusto (Candidati, Pagamenti, Buste paga...). */
export function Documents() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const all = useDocs((s) => (team ? s.docs[team.id] : undefined)) ?? [];
  const { caps, role } = useCaps(team?.id);
  const [review, setReview] = useState<{ file: Picked; result: DocResult; text: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<TeamDoc | null>(null);
  useEffect(() => { if (team) void listDocs(team.id); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace />;

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0]; const file: Picked = { uri: a.uri, name: a.name, mime: a.mimeType ?? undefined, size: a.size ?? undefined };
    setBusy(true);
    try { const { result, text } = await readAndAnalyze(file); setReview({ file, result, text }); } finally { setBusy(false); }
  }
  const groups = SECTIONS.map((s) => ({ s, list: all.filter((d) => KINDS[d.kind].section === s) })).filter((g) => g.list.length);
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      <Card>
        <H>Carica un documento</H>
        <Body small muted style={{ marginTop: 4 }}>Theia lo legge, capisce che cos'è (curriculum, fattura, busta paga, contratto…) e lo mette nell'elenco giusto con i dati già compilati. Tu controlli e confermi.</Body>
        <Btn style={{ marginTop: 10 }} icon="plus" disabled={busy} title={busy ? 'Theia legge…' : 'Scegli il file'} onPress={() => { void pick(); }} />
      </Card>
      {groups.length === 0 ? <Card><Empty text="Nessun documento. Carica il primo: per esempio un curriculum o una fattura." /></Card> : groups.map((g) => (
        <Card key={g.s}>
          <Row><H>{tl(g.s)}</H><Body small muted>{String(g.list.length)}</Body></Row>
          {g.list.map((d) => <DocRow key={d.id} d={d} onOpen={() => setOpen(d)} />)}
        </Card>
      ))}
      {review ? <Review team={team.id} role={role} caps={caps} init={review} onClose={() => setReview(null)} /> : null}
      <DocSheet d={open} role={role} caps={caps} onClose={() => setOpen(null)} />
    </View>
  );
}

function DocRow({ d, onOpen }: { d: TeamDoc; onOpen: () => void }) {
  const late = d.due && d.status === 'new' && d.due < new Date().toISOString().slice(0, 10);
  const sub = [d.fields.ruolo, d.fields.esperienza, d.fields.periodo, d.amount != null ? money(d.amount, d.currency) : '', d.due ? `${tl('scade')} ${day(d.due)}` : ''].filter(Boolean).join(' · ');
  return (
    <View style={{ paddingVertical: 8 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body bold numberOfLines={2}>{d.title}</Body>
          {sub ? <Body small muted>{sub}</Body> : null}
          {late ? <Body small bold color="#ff5a64">{tl('Scaduto')}</Body> : null}
          {d.status === 'paid' ? <Body small muted>{tl('Pagato')}</Body> : null}
        </View>
        <ChipBtn icon="chevron-right" title="Apri" onPress={onOpen} />
      </Row>
    </View>
  );
}

/* ---------- controllo prima di salvare ---------- */
function Review({ team, role, caps, init, onClose }: { team: string; role: 'owner' | 'admin' | 'member' | undefined; caps: Set<Cap>; init: { file: Picked; result: DocResult; text: string | null }; onClose: () => void }) {
  const { members, me, nameOf } = useMembers(team);
  const [res, setRes] = useState<DocResult>(init.result);
  const [fields, setFields] = useState<Record<string, string>>(init.result.fields);
  const [title, setTitle] = useState(init.result.title);
  const [due, setDue] = useState(init.result.due ?? '');
  const [amount, setAmount] = useState(init.result.amount != null ? String(init.result.amount) : '');
  const [person, setPerson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = res.kind; const info = KINDS[kind];
  const blocked = !canHandle(info.access, role, caps);
  const needsPerson = info.access === 'person';
  const confidence = res.confidence >= 0.75 ? tl('Sono sicura') : res.confidence >= 0.5 ? tl('Credo') : tl('Non sono sicura');
  const kinds = ALL_KINDS.filter((k) => canHandle(KINDS[k].access, role, caps));
  useEffect(() => { if (needsPerson && !person) { const n = (fields.persona ?? '').toLowerCase(); const m = n ? members.find((x) => n.includes((x.name || '').toLowerCase().split(' ')[0] ?? '###')) : undefined; if (m) setPerson(m.user_id); } }, [members]); // eslint-disable-line react-hooks/exhaustive-deps

  const retype = (k: DocKind) => setRes({ ...res, kind: k });
  const withAi = () => { setBusy(true); void readWithAi(init.file).then((r) => { setBusy(false); if (!r) { toast('Non sono riuscita a leggerlo: compila a mano.'); return; } setRes(r.result); setFields(r.result.fields); setTitle(r.result.title); setDue(r.result.due ?? ''); setAmount(r.result.amount != null ? String(r.result.amount) : ''); }); };
  function save() {
    if (blocked) { toast('Questo documento è riservato alla funzione che lo gestisce.'); return; }
    if (needsPerson && !person) { toast('Scegli a quale persona si riferisce'); return; }
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast('Scrivi la scadenza come 2026-12-31'); return; }
    const amt = amount.trim() ? parseFloat(amount.replace(',', '.')) : null;
    setBusy(true);
    void saveDoc({ team, file: init.file, kind, title, fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())), access: info.access, person: needsPerson ? person : null, due: due || null, amount: amt != null && Number.isFinite(amt) ? amt : null, currency: res.currency ?? null }).then((r) => {
      setBusy(false);
      if (!r.ok) { toast(r.message); return; }
      toast(`${tl('Salvato in')} «${tl(info.section)}»${due ? ` ${tl('e la scadenza è nel Plan')}` : ''}`); onClose();
    });
  }
  const keys = Object.keys(fields).length ? Object.keys(fields) : [];
  return (
    <Sheet visible title="Controlla il documento" onClose={onClose}>
      <Body small muted>{init.file.name}</Body>
      <Body bold style={{ marginTop: 6 }}>{`${confidence}: ${tl(info.label)}${res.tipo ? ` (${res.tipo})` : ''}${res.country ? ` · ${res.country === 'CH' ? tl('Svizzera') : tl('Italia')}` : ''}`}</Body>
      {init.text === null || res.kind === 'other' ? <Btn style={{ marginTop: 8 }} ghost icon="sparkle" disabled={busy} title={busy ? 'Theia legge…' : 'Fai leggere il documento a Theia'} onPress={withAi} /> : null}
      <Body small bold muted style={{ marginTop: 12, marginBottom: 6 }}>{tl('TIPO').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{kinds.map((k) => <Pill key={k} label={tl(KINDS[k].label)} on={k === kind} onPress={() => retype(k)} />)}</View>
      <Body small muted style={{ marginTop: 8 }}>{`${tl('Va in')}: ${tl(info.section)}. ${tl(ACCESS_TEXT[info.access]!)}`}</Body>
      {blocked ? <Body small bold color="#ff5a64" style={{ marginTop: 6 }}>{tl('Questo tipo di documento è riservato: lo carica chi ha quella funzione (per esempio HR o amministrazione).')}</Body> : null}
      <Input style={{ marginTop: 10 }} placeholder="Titolo" value={title} onChangeText={setTitle} />
      {keys.map((k) => <Input key={k} placeholder={tl(FIELD_LABELS[k] ?? k)} value={fields[k] ?? ''} onChangeText={(v) => setFields({ ...fields, [k]: v })} />)}
      {kind === 'cv' && !fields.nome ? <Input placeholder="Nome" value={fields.nome ?? ''} onChangeText={(v) => setFields({ ...fields, nome: v })} /> : null}
      {['invoice', 'bill', 'quote', 'receipt', 'payslip', 'tax'].includes(kind) ? <Input placeholder={`Importo${res.currency ? ` (${res.currency})` : ''}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /> : null}
      {['invoice', 'bill', 'contract', 'quote', 'tax', 'registry', 'certificate'].includes(kind) ? <Input placeholder="Scadenza (2026-12-31)" value={due} onChangeText={setDue} /> : null}
      {needsPerson ? (
        <>
          <Body small bold muted style={{ marginTop: 4, marginBottom: 6 }}>{tl('PERSONA').toUpperCase()}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{members.map((m) => <Pill key={m.user_id} label={m.user_id === me ? `${nameOf(m.user_id)} (${tl('tu')})` : nameOf(m.user_id)} on={person === m.user_id} onPress={() => setPerson(m.user_id)} />)}</View>
        </>
      ) : null}
      <Btn style={{ marginTop: 8 }} icon="check" disabled={busy || blocked} title={busy ? 'Un momento…' : 'Conferma e salva'} onPress={save} />
    </Sheet>
  );
}

/* ---------- scheda di un documento salvato ---------- */
function DocSheet({ d, role, caps, onClose }: { d: TeamDoc | null; role: 'owner' | 'admin' | 'member' | undefined; caps: Set<Cap>; onClose: () => void }) {
  const { me, nameOf } = useMembers(d?.team_id ?? '');
  const cur = useDocs((s) => (d ? s.docs[d.team_id]?.find((x) => x.id === d.id) : undefined)) ?? d;
  const open = useCallback(async () => {
    if (!cur) return;
    const r = await downloadDoc(cur); if (!r.ok) { toast(r.message); return; }
    try {
      const { File, Paths } = await import('expo-file-system'); const Sharing = await import('expo-sharing');
      const f = new File(Paths.cache, `doc-${Date.now().toString(36)}-${cur.file_name.replace(/[^\w.\-]+/g, '_')}`);
      f.create({ overwrite: true }); f.write(r.data);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: cur.mime ?? undefined, dialogTitle: cur.file_name });
    } catch { toast('Non riesco ad aprire il file su questo dispositivo.'); }
  }, [cur]);
  if (!cur) return null;
  const canEdit = canHandle(cur.access, role, caps) || (cur.access === 'team' && cur.created_by === me);
  const isMoney = cur.kind === 'invoice' || cur.kind === 'bill';
  return (
    <Sheet visible title={cur.title} onClose={onClose}>
      <Body small muted>{`${tl(KINDS[cur.kind].label)} · ${tl(KINDS[cur.kind].section)}`}</Body>
      {cur.person ? <Body small muted>{tl('Persona: {0}', nameOf(cur.person))}</Body> : null}
      {Object.entries(cur.fields).map(([k, v]) => <Row key={k} style={{ marginTop: 6 }}><Body small muted>{tl(FIELD_LABELS[k] ?? k)}</Body><Body small bold style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Body></Row>)}
      {cur.amount != null ? <Row style={{ marginTop: 6 }}><Body small muted>{tl('Importo')}</Body><Body small bold>{money(cur.amount, cur.currency)}</Body></Row> : null}
      {cur.due ? <Row style={{ marginTop: 6 }}><Body small muted>{tl('Scadenza')}</Body><Body small bold>{day(cur.due)}</Body></Row> : null}
      <Btn style={{ marginTop: 12 }} icon="file" title="Apri il file" onPress={() => { void open(); }} />
      {canEdit && isMoney ? <Btn style={{ marginTop: 8 }} ghost icon="check" title={cur.status === 'paid' ? 'Segna da pagare' : 'Segna come pagato'} onPress={() => { void updateDoc(cur, { status: cur.status === 'paid' ? 'new' : 'paid' }).then((r) => toast(r.ok ? (cur.status === 'paid' ? 'Da pagare' : 'Segnato come pagato') : r.message)); }} /> : null}
      {canEdit ? <Btn style={{ marginTop: 8 }} ghost danger icon="trash" title="Elimina" onPress={() => alertT('Eliminare il documento?', cur.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteDoc(cur).then((r) => { toast(r.ok ? 'Documento eliminato' : r.message); if (r.ok) onClose(); }); } }])} /> : null}
    </Sheet>
  );
}
