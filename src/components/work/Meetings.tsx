import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { useCallTranscription } from '@/components/call/useTheiaNotes';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { buildNotes } from '@/lib/callNotes';
import { startCall } from '@/lib/callActions';
import { actionsOf, type Line, type Meeting } from '@/lib/meetings';
import { createMeeting, finishMeeting, loadLines, pullMeetings, removeMeeting, sendLine, setRec, watchMeeting } from '@/lib/teamMeetings';
import { listMembers, myUserId, type Member } from '@/lib/teams';
import { today } from '@/lib/teamWork';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { useMeetings } from '@/store/meetings';
import { toast } from '@/store/toast';
import { useWorkspace } from '@/store/workspace';

const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const startMs = (m: Meeting) => new Date(`${m.day}T${m.time}:00`).getTime();

/** Nomi e id delle persone del workspace. */
function useMembers(team: string) {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void myUserId().then(setMe); void listMembers(team).then((r) => { if (r.ok) setMembers(r.data); }); }, [team]);
  const nameOf = useCallback((id: string) => members.find((m) => m.user_id === id)?.name || tl('Collega'), [members]);
  return { members, me, nameOf };
}

/* ---------- elenco delle riunioni (di un workspace, o di un solo progetto) ---------- */
export function MeetingsList({ team, project, title = 'Riunioni' }: { team: string; project?: string; title?: string }) {
  const items = useMeetings((s) => s.items);
  const [newOpen, setNewOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void pullMeetings(team); }, [team]);
  const list = useMemo(() => items.filter((m) => m.team_id === team && (!project || m.project === project) && !m.deleted).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time)), [items, team, project]);
  const t0 = today();
  const up = list.filter((m) => m.status !== 'ended' && m.day >= t0 || m.status === 'live');
  const past = list.filter((m) => !up.includes(m)).reverse().slice(0, 8);
  const row = (m: Meeting) => (
    <Pressable key={m.id} onPress={() => setOpen(m.id)} accessibilityRole="button" style={{ paddingVertical: 8 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body bold>{m.title}</Body>
          <Body small muted>{`${label(m.day)} · ${m.time} · ${m.dur} min${m.recurrence !== 'none' ? ` · ${m.recurrence === 'weekly' ? tl('ogni settimana') : tl('ogni mese')}` : ''}`}</Body>
        </View>
        {m.status === 'live' ? <LiveDot n={m.rec_users.length} /> : m.status === 'ended' ? <Pill label={tl('Finita')} /> : null}
      </Row>
    </Pressable>
  );
  return (
    <Card>
      <Row><H>{title}</H><Btn small icon="plus" title="Nuova" onPress={() => setNewOpen(true)} /></Row>
      {up.length === 0 && past.length === 0 ? <Empty text="Nessuna riunione. Creane una: invita le persone e Theia scrive gli appunti." /> : null}
      {up.map(row)}
      {past.length ? <Body small bold muted style={{ marginTop: 10 }}>{tl('PASSATE').toUpperCase()}</Body> : null}
      {past.map(row)}
      <NewMeeting team={team} project={project} open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => setOpen(id)} />
      {open ? <MeetingRoom id={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

function LiveDot({ n }: { n: number }) {
  const reduce = useReduceMotion(); const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (reduce) return; const l = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.3, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })])); l.start(); return () => l.stop(); }, [reduce, a]);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff5a64', opacity: a }} /><Text style={{ color: '#ff5a64', fontWeight: '800', fontSize: 12 }}>{n ? tl('In corso · {0} trascrivono', n) : tl('In corso')}</Text></View>;
}

/* ---------- nuova riunione ---------- */
function NewMeeting({ team, project, open, onClose, onCreated }: { team: string; project?: string; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { members, me } = useMembers(team);
  const [title, setTitle] = useState(''); const [day, setDay] = useState(today()); const [time, setTime] = useState('10:00'); const [dur, setDur] = useState(60);
  const [agenda, setAgenda] = useState(''); const [rec, setRec2] = useState<Meeting['recurrence']>('none'); const [sel, setSel] = useState<string[] | null>(null);
  const others = members.filter((m) => m.user_id !== me);
  const chosen = sel ?? others.map((m) => m.user_id); // di default invita tutte le persone del progetto
  async function save() {
    if (!title.trim()) { toast('Scrivi il titolo'); return; }
    if (!okDay(day) || !/^\d{1,2}:\d{2}$/.test(time.trim())) { toast('Controlla giorno e ora'); return; }
    const r = await createMeeting({ team, project: project ?? null, title, day, time: time.trim().padStart(5, '0'), dur, agenda, attendees: chosen, recurrence: rec });
    if (!r.ok) { toast(r.message); return; }
    toast(chosen.length ? 'Riunione creata: le persone invitate la vedono nel Plan' : 'Riunione creata');
    setTitle(''); setAgenda(''); setSel(null); onClose(); onCreated(r.data.id);
  }
  return (
    <Sheet visible={open} title="Nuova riunione" onClose={onClose}>
      <Input placeholder="Titolo (es. Avvio progetto)" value={title} onChangeText={setTitle} />
      <Row><Input flex={1} placeholder="Giorno (2026-11-20)" value={day} onChangeText={setDay} /><Input flex={1} placeholder="Ora (10:00)" value={time} onChangeText={setTime} /></Row>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{[30, 45, 60, 90].map((d) => <Pill key={d} label={`${d} min`} on={dur === d} onPress={() => setDur(d)} />)}</View>
      <Input placeholder="Ordine del giorno (facoltativo)" value={agenda} onChangeText={setAgenda} maxLines={6} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('RIPETI').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{([['none', 'Una volta'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={rec === k} onPress={() => setRec2(k)} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('INVITATI').toUpperCase()}</Body>
      {others.length ? <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{others.map((m) => <Pill key={m.user_id} label={m.name || tl('Collega')} on={chosen.includes(m.user_id)} onPress={() => setSel(chosen.includes(m.user_id) ? chosen.filter((x) => x !== m.user_id) : [...chosen, m.user_id])} />)}</View> : <Body small muted style={{ marginBottom: 8 }}>{tl('Non ci sono altre persone nel workspace: invitale dalla scheda Team.')}</Body>}
      <Btn icon="check" title="Crea riunione" onPress={() => { void save(); }} />
    </Sheet>
  );
}

/* ---------- la riunione: durante e dopo ---------- */
export function MeetingRoom({ id, onClose }: { id: string; onClose: () => void }) {
  const th = useTheme();
  const m = useMeetings((s) => s.items.find((x) => x.id === id));
  const lines = useMeetings((s) => s.lines[id]) ?? [];
  const myName = useApp((s) => s.account.name);
  const lang = useApp((s) => s.language);
  const { members, me, nameOf } = useMembers(m?.team_id ?? '');
  const [who, setWho] = useState(false);
  const [busy, setBusy] = useState(false);
  const iRec = !!me && !!m?.rec_users.includes(me);
  useEffect(() => { void loadLines(id); let off: () => void = () => undefined; let dead = false; void watchMeeting(id).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off(); }; }, [id]);

  // la MIA voce, sul MIO telefono: ogni frase finita va al server e arriva agli altri
  useCallTranscription({ enabled: iRec && m?.status === 'live', speaker: myName, lang, startedAt: m ? startMs(m) : Date.now(), onLine: (l) => { void sendLine(id, l.at, l.text); } });

  if (!m) return <Sheet visible title="Riunione" onClose={onClose}><Empty text="Riunione non trovata." /></Sheet>;
  const myRole = members.find((x) => x.user_id === me)?.role;
  const isOwner = !!me && (me === m.created_by || (!!myRole && myRole !== 'member'));
  const people = [m.created_by, ...m.attendees];
  const live = buildNotes(lines.map((l) => ({ at: l.at, speaker: nameOf(l.speaker), text: l.text })));

  const startRec = () => alertT('Theia trascrive', 'Theia scrive gli appunti della riunione. Trascrive solo la tua voce, sul tuo telefono: non viene salvato nessun audio. Tutti vedono che la trascrizione è attiva e chi la usa. Puoi smettere quando vuoi.', [
    { text: 'Non ora', style: 'cancel' }, { text: 'Attiva', onPress: () => { void setRec(id, true).then((r) => { if (!r.ok) toast(r.message); }); } },
  ]);
  const stopRec = () => { void setRec(id, false).then((r) => { if (!r.ok) toast(r.message); }); };
  const openCall = () => {
    const names = people.filter((u) => u !== me).map(nameOf);
    const chat = useChat.getState().createGroup(m.title, names, myName, tl('Riunione di lavoro'));
    startCall(chat, myName, false);
  };
  const end = () => alertT('Terminare la riunione?', 'Theia prepara appunti e verbale e li salva per tutti.', [{ text: 'Annulla', style: 'cancel' }, { text: 'Termina', onPress: () => { setBusy(true); void finishMeeting(m, lines).then((r) => { setBusy(false); toast(r.ok ? 'Appunti e verbale pronti' : r.message); }); } }]);
  const del = () => alertT('Eliminare la riunione?', m.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void removeMeeting(id).then((r) => { toast(r.ok ? 'Riunione eliminata' : r.message); if (r.ok) onClose(); }); } }]);

  return (
    <Sheet visible title={m.title} onClose={onClose}>
      <Body small muted>{`${label(m.day)} · ${m.time} · ${m.dur} min`}</Body>
      <Body small muted style={{ marginTop: 2 }}>{tl('Con {0}', people.map(nameOf).join(', '))}</Body>

      {m.status !== 'ended' ? (
        <>
          <RecButton on={m.rec_users.length > 0} n={m.rec_users.length} onPress={() => setWho(true)} />
          <Row style={{ marginTop: 10 }}>
            <Btn icon="mic" title={iRec ? 'Smetti di trascrivere la mia voce' : 'Trascrivi con Theia'} ghost={iRec} onPress={iRec ? stopRec : startRec} />
          </Row>
          <Btn style={{ marginTop: 8 }} ghost icon="phone" title="Apri la chiamata" onPress={openCall} />
          {m.agenda ? <><Body small bold muted style={{ marginTop: 14, marginBottom: 4 }}>{tl('ORDINE DEL GIORNO').toUpperCase()}</Body><Body>{m.agenda}</Body></> : null}
          {m.status === 'live' ? <LivePanel lines={lines} nameOf={nameOf} notes={live} /> : <Body small muted style={{ marginTop: 14 }}>{tl('Quando qualcuno attiva la trascrizione la riunione risulta in corso per tutti e Theia scrive gli appunti.')}</Body>}
          {isOwner ? <Row style={{ marginTop: 14 }}><Btn small danger ghost title="Elimina" onPress={del} /><Btn small icon="check" disabled={busy} title={busy ? 'Un momento…' : 'Termina e crea i verbali'} onPress={end} /></Row> : null}
        </>
      ) : <Result m={m} nameOf={nameOf} meId={me} members={members} />}

      <Sheet visible={who} title="Chi trascrive" onClose={() => setWho(false)}>
        {m.rec_users.length ? m.rec_users.map((u) => <Body key={u} style={{ paddingVertical: 6 }}>{u === me ? tl('{0} (tu)', nameOf(u)) : nameOf(u)}</Body>) : <Empty text="Nessuno sta trascrivendo adesso." />}
        <Body small muted style={{ marginTop: 10, color: th.muted }}>{tl('Ognuno trascrive solo la propria voce, sul proprio telefono. Non viene salvato nessun audio.')}</Body>
      </Sheet>
    </Sheet>
  );
}

function RecButton({ on, n, onPress }: { on: boolean; n: number; onPress: () => void }) {
  const reduce = useReduceMotion(); const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!on || reduce) return; const l = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.3, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })])); l.start(); return () => l.stop(); }, [on, reduce, a]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={on ? tl('Theia sta trascrivendo. Tocca per vedere chi') : tl('Nessuno sta trascrivendo')} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: on ? 'rgba(120,20,30,0.92)' : 'rgba(128,128,128,0.15)', borderWidth: 1, borderColor: on ? '#ff5a64' : 'rgba(128,128,128,0.3)' }}>
      <Animated.View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? '#ff5a64' : '#8e98a8', opacity: on ? a : 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: on ? '#fff' : undefined, fontWeight: '800', fontSize: 14 }}>{on ? tl('Theia sta trascrivendo') : tl('Trascrizione spenta')}</Text>
        <Text style={{ color: on ? 'rgba(255,255,255,0.85)' : '#8e98a8', fontSize: 12 }}>{on ? tl('{0} persone la usano · tocca per vedere chi', n) : tl('Chiunque può accenderla')}</Text>
      </View>
    </Pressable>
  );
}

function LivePanel({ lines, nameOf, notes }: { lines: Line[]; nameOf: (u: string) => string; notes: ReturnType<typeof buildNotes> }) {
  const last = [...lines].sort((a, b) => a.at - b.at).slice(-6);
  const grp = (head: string, rows: string[]) => (rows.length ? <View style={{ marginTop: 8 }}><Body small bold muted>{tl(head).toUpperCase()}</Body>{rows.map((r, i) => <Body key={i} small style={{ marginTop: 2 }}>{`• ${r}`}</Body>)}</View> : null);
  return (
    <View style={{ marginTop: 14 }}>
      <Body small bold muted>{tl('IN DIRETTA').toUpperCase()}</Body>
      {last.length ? last.map((l, i) => <Body key={(l.id ?? i) + ''} small style={{ marginTop: 4 }}>{`${nameOf(l.speaker)}: ${l.text}`}</Body>) : <Body small muted style={{ marginTop: 4 }}>{tl('Parla: le frasi compaiono qui appena finite.')}</Body>}
      {grp('Decisioni', notes.decisions.map((d) => d.text))}{grp('Da fare', notes.actions.map((a) => `${a.text} · ${a.owner}`))}{grp('Domande aperte', notes.questions.map((q) => q.text))}
    </View>
  );
}

/* ---------- dopo la riunione ---------- */
function Result({ m, nameOf, meId, members }: { m: Meeting; nameOf: (u: string) => string; meId: string | null; members: Member[] }) {
  const myName = useApp((s) => s.account.name);
  const [done, setDone] = useState(false);
  const acts = useMemo(() => actionsOf(m.notes, myName, new Date()), [m.notes, myName]);
  void members; void meId;
  function createAll() {
    const ws = useWorkspace.getState();
    // verbale: pagina condivisa dentro il progetto
    const page = ws.addPage(m.project ?? null, 'page', `${tl('Verbale')} · ${m.title}`, m.team_id);
    const body = (m.minutes ?? '').split('\n');
    ws.patchBlock(page, useWorkspace.getState().pages.find((p) => p.id === page)!.blocks[0]!.id, { text: body[0] ?? '' });
    body.slice(1).forEach((l) => ws.addBlock(page, 'p', l));
    // cose da fare: nel database condiviso «Cose da fare» del workspace
    if (acts.length) {
      let db = useWorkspace.getState().pages.find((p) => p.teamId === m.team_id && p.kind === 'db' && p.title === tl('Cose da fare'));
      let dbId = db?.id;
      if (!dbId) { dbId = ws.addPage(null, 'db', tl('Cose da fare'), m.team_id); ws.addCol(dbId, tl('Responsabile'), 'text'); ws.addCol(dbId, tl('Scadenza'), 'date'); db = useWorkspace.getState().pages.find((p) => p.id === dbId)!; }
      const cols = useWorkspace.getState().pages.find((p) => p.id === dbId)!.cols ?? [];
      const owner = cols.find((c) => c.name === tl('Responsabile'))?.id; const due = cols.find((c) => c.name === tl('Scadenza'))?.id;
      for (const a of acts) {
        const rid = ws.addRow(dbId);
        ws.patchRow(dbId, rid, cols[0]!.id, a.text);
        if (owner) ws.patchRow(dbId, rid, owner, a.owner);
        if (due && a.due) ws.patchRow(dbId, rid, due, a.due);
      }
      // le mie nel mio Plan con l'etichetta Lavoro
      for (const a of acts.filter((x) => x.mine)) useLife.getState().addTask({ t: a.text, team: m.team_id, ...(a.due ? { due: a.due } : {}) });
    }
    setDone(true); toast(tl('Fatto: verbale nel progetto, cose da fare nel database e le tue nel Plan'));
  }
  return (
    <View style={{ marginTop: 12 }}>
      <Body small bold muted>{tl('APPUNTI DI THEIA').toUpperCase()}</Body>
      {m.notes && (m.notes.decisions.length + m.notes.actions.length + m.notes.questions.length) ? (
        <>
          {m.notes.decisions.map((d, i) => <Body key={'d' + i} small style={{ marginTop: 4 }}>{`${tl('Decisione')}: ${d.text}`}</Body>)}
          {acts.map((a, i) => <Body key={'a' + i} small style={{ marginTop: 4 }}>{`${tl('Da fare')}: ${a.text} · ${a.owner}${a.due ? ` · ${label(a.due)}` : ''}`}</Body>)}
          {m.notes.questions.map((q, i) => <Body key={'q' + i} small style={{ marginTop: 4 }}>{`${tl('Domanda aperta')}: ${q.text}`}</Body>)}
        </>
      ) : <Body small muted style={{ marginTop: 4 }}>{tl('Nessuna decisione o cosa da fare riconosciute: se non ha trascritto nessuno non ci sono appunti.')}</Body>}
      <Btn style={{ marginTop: 12 }} icon="check" disabled={done} title={done ? 'Creato' : 'Crea tutto: verbale, cose da fare, Plan'} onPress={createAll} />
      <Body small muted style={{ marginTop: 8 }}>{tl('Presenti: {0}', [m.created_by, ...m.attendees].map(nameOf).join(', '))}</Body>
    </View>
  );
}
