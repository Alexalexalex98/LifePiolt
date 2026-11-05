import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { useCallTranscription } from '@/components/call/useTheiaNotes';
import { MeetingCall } from '@/components/work/MeetingCall';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { buildNotes } from '@/lib/callNotes';
import { actionsOf, type Line, type Meeting } from '@/lib/meetings';
import { addMyActions, createMeeting, finishMeeting, joinMeeting, leaveMeeting, loadLines, meetingLabel, pullMeetings, removeMeeting, saveToWorkspace, sendLine, watchMeeting } from '@/lib/teamMeetings';
import { listMembers, myUserId, type Member } from '@/lib/teams';
import { busyRanges, teamBusy, today, type Busy } from '@/lib/teamWork';
import { fromMin, type Range } from '@/lib/conflicts';
import { buildSlots, type Slot } from '@/lib/slots';
import { MoveEvent, applyMove } from '@/components/work/Conflicts';
import { DayField } from '@/components/work/DayField';
import { useLife } from '@/store/life';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/app';
import { useMeetings } from '@/store/meetings';
import { toast } from '@/store/toast';

const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const toMin = (t: string) => { const [h, m] = t.split(':'); return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0); };
const startMs = (m: Meeting) => new Date(`${m.day}T${m.time}:00`).getTime();

/** Nomi e id delle persone del workspace. */
export function useMembers(team: string) {
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
type Ghost = { title: string; time: string; wid?: string; to: string | null };
export type MeetingSeed = { title?: string; dur?: number; agenda?: string; attendees?: string[]; project?: string | null };

/** Il foglio parte vuoto: titolo, poi il giorno (si apre il Plan), poi l'orario. Le ore occupate non si possono scegliere; se serve proprio un'ora dove hai un impegno, lo sposti e lo riorganizzi. */
export function NewMeeting({ team, project, open, onClose, onCreated, seed }: { team: string; project?: string; open: boolean; onClose: () => void; onCreated: (id: string) => void; seed?: MeetingSeed }) {
  const th = useTheme();
  const { members, me, nameOf } = useMembers(team);
  const [title, setTitle] = useState(seed?.title ?? ''); const [day, setDay] = useState(''); const [time, setTime] = useState(''); const [dur, setDur] = useState(seed?.dur ?? 60);
  const [agenda, setAgenda] = useState(seed?.agenda ?? ''); const [rec, setRec2] = useState<Meeting['recurrence']>('none'); const [sel, setSel] = useState<string[] | null>(seed?.attendees ?? null);
  const [others, setOthers] = useState<Busy[]>([]); const [saving, setSaving] = useState(false);
  const [pickTime, setPickTime] = useState(false); const [ghosts, setGhosts] = useState<Ghost[]>([]); const [moving, setMoving] = useState<number | null>(null);
  const others2 = members.filter((m) => m.user_id !== me);
  const chosen = (sel ?? others2.map((m) => m.user_id)).filter((id) => id !== me); // di default invita tutte le persone del progetto
  const valid = okDay(day) && /^\d{2}:\d{2}$/.test(time);
  const mine = useLife((s) => (day ? s.events[day] : undefined)) ?? [];
  useEffect(() => { if (open && okDay(day)) void teamBusy(team, day, day).then((r) => { if (r.ok) setOthers(r.data); }); }, [open, day, team]);
  const slots = useMemo(() => (okDay(day) ? buildSlots(mine, chosen.map((id) => ({ id, ranges: busyRanges(others, id, day) })), dur) : []), [day, mine, chosen.join(','), others, dur]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = slots.find((x) => x.time === time);
  useEffect(() => { if (time && (!cur || cur.state === 'busy')) { setTime(''); setGhosts([]); } }, [cur, time]);
  const slot: Range = valid ? [toMin(time), toMin(time) + dur] : [0, 0];
  const pending = ghosts.filter((g) => !g.to);
  const reset = () => { setTitle(seed?.title ?? ''); setAgenda(seed?.agenda ?? ''); setSel(seed?.attendees ?? null); setDay(''); setTime(''); setGhosts([]); };
  const pick = (sl: Slot) => {
    if (sl.state === 'busy') return;
    setTime(sl.time);
    setGhosts(sl.mine.map((i) => ({ title: mine[i]!.title, time: mine[i]!.time, wid: mine[i]!.wid, to: null })));
    setPickTime(false);
  };
  const idxOf = (g: Ghost) => (useLife.getState().events[day] ?? []).findIndex((e) => e.time === g.time && e.title === g.title && e.wid === g.wid);
  const create = async () => {
    setSaving(true);
    for (const g of ghosts) { const i = idxOf(g); if (i >= 0 && g.to) await applyMove(day, i, g.to); } // prima lo spostamento: gli invitati dell'altro impegno vengono avvisati
    const r = await createMeeting({ team, project: project ?? seed?.project ?? null, title, day, time, dur, agenda, attendees: chosen, recurrence: rec });
    setSaving(false);
    if (!r.ok) { toast(r.message); return; }
    toast(chosen.length ? 'Riunione creata: le persone invitate la vedono nel Plan' : 'Riunione creata');
    reset(); onClose(); onCreated(r.data.id);
  };
  const save = () => {
    if (!title.trim()) { toast('Scrivi il titolo'); return; }
    if (!okDay(day)) { toast('Scegli il giorno'); return; }
    if (!valid) { toast('Scegli l\'orario'); return; }
    if (pending.length) { toast('Riorganizza prima l\'impegno che hai in quell\'ora'); return; }
    void create();
  };
  const stateLabel = (sl: Slot) => (sl.state === 'busy' ? (sl.who.length ? tl('Occupato: {0}', sl.who.map(nameOf).join(', ')) : tl('Tutto il giorno impegnato')) : sl.state === 'mine' ? tl('Hai: {0}', sl.mine.map((i) => mine[i]!.title).join(', ')) : tl('Libero'));
  return (
    <Sheet visible={open} title="Nuova riunione" onClose={onClose}>
      <Input placeholder="Titolo (es. Avvio progetto)" value={title} onChangeText={setTitle} />
      <DayField value={day} onChange={(d) => { setDay(d); setTime(''); setGhosts([]); setPickTime(true); }} />
      <Btn ghost icon="clock" disabled={!okDay(day)} title={valid ? `${time} – ${fromMin(slot[1])} · ${dur} min` : okDay(day) ? 'Scegli l\'orario' : 'Prima scegli il giorno'} onPress={() => setPickTime(true)} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 8 }}>{[30, 45, 60, 90].map((d) => <Pill key={d} label={`${d} min`} on={dur === d} onPress={() => { setDur(d); setTime(''); setGhosts([]); }} />)}</View>

      {ghosts.length ? (
        <View style={{ backgroundColor: th.chip, borderRadius: 14, padding: 10, marginBottom: 10, gap: 8 }}>
          <Body small bold muted>{tl('IMPEGNO DA RIORGANIZZARE').toUpperCase()}</Body>
          {ghosts.map((g, i) => (
            <View key={g.time + g.title} style={{ opacity: g.to ? 1 : 0.7 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Body bold style={{ textDecorationLine: g.to ? 'none' : 'line-through' }}>{g.title}</Body>
                  <Body small muted>{g.to ? tl('Era alle {0}: lo sposto alle {1}', g.time, g.to) : tl('Alle {0}: resta lì finché non lo riorganizzi', g.time)}</Body>
                </View>
                <Btn small ghost={!!g.to} icon="clock" title={g.to ? 'Cambia' : 'Riorganizza'} onPress={() => setMoving(i)} />
              </Row>
            </View>
          ))}
          <Body small muted>{tl('Se l\'impegno ha altre persone, ricevono una notifica e decidono se accettare il nuovo orario.')}</Body>
        </View>
      ) : null}

      <Input placeholder="Ordine del giorno (facoltativo)" value={agenda} onChangeText={setAgenda} maxLines={6} />
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('RIPETI').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{([['none', 'Una volta'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={rec === k} onPress={() => setRec2(k)} />)}</View>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('INVITATI').toUpperCase()}</Body>
      {others2.length ? <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{others2.map((m) => <Pill key={m.user_id} label={m.name || tl('Collega')} on={chosen.includes(m.user_id)} onPress={() => setSel(chosen.includes(m.user_id) ? chosen.filter((x) => x !== m.user_id) : [...chosen, m.user_id])} />)}</View> : <Body small muted style={{ marginBottom: 8 }}>{tl('Non ci sono altre persone nel workspace: invitale dalla scheda Team.')}</Body>}
      <Btn icon="check" disabled={saving} title="Crea riunione" onPress={save} />

      <Sheet visible={pickTime} title="Scegli l'orario" onClose={() => setPickTime(false)}>
        <Body small muted style={{ marginBottom: 8 }}>{okDay(day) ? `${label(day)} · ${dur} min` : ''}</Body>
        {slots.length ? slots.map((sl) => {
          const busy = sl.state === 'busy'; const on = sl.time === time;
          return (
            <Pressable key={sl.time} disabled={busy} onPress={() => pick(sl)} accessibilityRole="button" accessibilityState={{ disabled: busy, selected: on }} accessibilityLabel={`${sl.time}. ${stateLabel(sl)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, marginBottom: 6, borderRadius: 12, backgroundColor: on ? th.accent : busy ? 'rgba(128,128,128,0.12)' : th.chip, opacity: busy ? 0.55 : 1, borderWidth: sl.state === 'mine' ? 1 : 0, borderColor: '#f59e0b' }}>
              <Text style={{ fontWeight: '800', width: 52, color: on ? '#fff' : th.text }}>{sl.time}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: on ? '#fff' : sl.state === 'mine' ? '#f59e0b' : th.muted, fontWeight: sl.state === 'mine' ? '700' : '500' }} numberOfLines={1}>{stateLabel(sl)}</Text>
            </Pressable>
          );
        }) : <Empty text="Nessun orario in questo giorno." />}
        <Body small muted style={{ marginTop: 6 }}>{tl('Gli orari occupati non si possono scegliere. Dove hai un tuo impegno puoi scegliere lo stesso: lo sposti e lo riorganizzi.')}</Body>
      </Sheet>
      {moving != null && ghosts[moving] && idxOf(ghosts[moving]!) >= 0 ? <MoveEvent day={day} idx={idxOf(ghosts[moving]!)} avoid={[slot]} onPick={(to) => setGhosts(ghosts.map((g, i) => (i === moving ? { ...g, to } : g)))} onClose={() => setMoving(null)} /> : null}
    </Sheet>
  );
}

/* ---------- la riunione: durante e dopo ---------- */
export function MeetingRoom({ id, onClose }: { id: string; onClose: () => void }) {
  const m = useMeetings((s) => s.items.find((x) => x.id === id));
  const lines = useMeetings((s) => s.lines[id]) ?? [];
  const myName = useApp((s) => s.account.name);
  const lang = useApp((s) => s.language);
  const { members, me, nameOf } = useMembers(m?.team_id ?? '');
  const [who, setWho] = useState(false);
  const [call, setCall] = useState(false);
  const [busy, setBusy] = useState(false);
  const inside = !!me && !!m?.rec_users.includes(me);
  useEffect(() => { void loadLines(id); let off: () => void = () => undefined; let dead = false; void watchMeeting(id).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off(); }; }, [id]);

  // la registrazione parte da sola per chi è dentro: la MIA voce, sul MIO telefono, finisce nella trascrizione di tutti
  useCallTranscription({ enabled: inside && m?.status === 'live', speaker: myName, lang, startedAt: m ? startMs(m) : Date.now(), onLine: (l) => { void sendLine(id, l.at, l.text); } });

  if (!m) return <Sheet visible title="Riunione" onClose={onClose}><Empty text="Riunione non trovata." /></Sheet>;
  const myRole = members.find((x) => x.user_id === me)?.role;
  const isOwner = !!me && (me === m.created_by || (!!myRole && myRole !== 'member'));
  const people = [m.created_by, ...m.attendees];
  const live = buildNotes(lines.map((l) => ({ at: l.at, speaker: nameOf(l.speaker), text: l.text })));

  const enter = () => alertT('Riunione registrata', 'Entrando, la riunione viene registrata e trascritta da Theia per scrivere appunti e verbale, come previsto dalle regole d\'uso. Non viene salvato nessun audio: si tiene solo il testo. Puoi uscire quando vuoi.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Entra', onPress: () => { void joinMeeting(id).then((r) => { if (!r.ok) { toast(r.message); return; } setCall(true); }); } },
  ]);
  const leave = () => { setCall(false); setBusy(true); void leaveMeeting(id).then((r) => { setBusy(false); if (!r.ok) { toast(r.message); return; } toast(r.data?.status === 'ended' ? 'Eri l\'ultimo: riunione chiusa, verbale e cose da fare salvati nel progetto' : 'Sei uscito dalla riunione'); }); };
  const endAll = () => alertT('Chiudere la riunione per tutti?', 'Theia prepara appunti e verbale e li salva nel progetto.', [{ text: 'Annulla', style: 'cancel' }, { text: 'Chiudi', onPress: () => { setBusy(true); void finishMeeting(m, lines).then((r) => { setBusy(false); if (r.ok) { const full = useMeetings.getState().items.find((x) => x.id === id); if (full) saveToWorkspace(full); toast('Riunione chiusa: verbale e cose da fare salvati'); } else toast(r.message); }); } }]);
  const del = () => alertT('Eliminare la riunione?', m.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void removeMeeting(id).then((r) => { toast(r.ok ? 'Riunione eliminata' : r.message); if (r.ok) onClose(); }); } }]);

  return (
    <Sheet visible title={m.title} onClose={onClose}>
      <Body small muted>{`${label(m.day)} · ${m.time} · ${m.dur} min`}</Body>
      <Body small muted style={{ marginTop: 2 }}>{tl('Con {0}', people.map(nameOf).join(', '))}</Body>

      {m.status !== 'ended' ? (
        <>
          <RecButton on={m.status === 'live'} n={m.rec_users.length} onPress={() => setWho(true)} />
          {inside ? (
            <Row style={{ marginTop: 10 }}><Btn icon="phone" title="Torna alla chiamata" onPress={() => setCall(true)} /><Btn ghost danger title={busy ? 'Un momento…' : 'Esci'} disabled={busy} onPress={leave} /></Row>
          ) : <Btn style={{ marginTop: 10 }} icon="phone" title={m.status === 'live' ? 'Entra nella riunione' : 'Avvia la riunione'} onPress={enter} />}
          {m.agenda ? <><Body small bold muted style={{ marginTop: 14, marginBottom: 4 }}>{tl('ORDINE DEL GIORNO').toUpperCase()}</Body><Body>{m.agenda}</Body></> : null}
          {m.status === 'live' ? <LivePanel lines={lines} nameOf={nameOf} notes={live} /> : <Body small muted style={{ marginTop: 14 }}>{tl('Chi entra avvia la riunione: la chiamata, la registrazione e gli appunti di Theia partono da soli. Quando esce l\'ultimo la riunione si chiude e il verbale finisce nel progetto.')}</Body>}
          {isOwner ? <Row style={{ marginTop: 14 }}><Btn small danger ghost title="Elimina" onPress={del} />{m.status === 'live' ? <Btn small ghost title="Chiudi per tutti" disabled={busy} onPress={endAll} /> : null}</Row> : null}
        </>
      ) : <Result m={m} nameOf={nameOf} />}

      <Sheet visible={who} title="In riunione" onClose={() => setWho(false)}>
        {m.rec_users.length ? m.rec_users.map((u) => <Body key={u} style={{ paddingVertical: 6 }}>{u === me ? tl('{0} (tu)', nameOf(u)) : nameOf(u)}</Body>) : <Empty text="Nessuno è dentro adesso." />}
        <Body small muted style={{ marginTop: 10 }}>{tl('La riunione è registrata e trascritta da Theia. Ogni telefono trascrive la voce di chi lo usa. Non viene salvato nessun audio.')}</Body>
      </Sheet>
      {call && inside ? <MeetingCall id={id} title={m.title} name={myName} onHide={() => setCall(false)} onLeave={leave} /> : null}
    </Sheet>
  );
}

function RecButton({ on, n, onPress }: { on: boolean; n: number; onPress: () => void }) {
  const reduce = useReduceMotion(); const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!on || reduce) return; const l = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.3, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })])); l.start(); return () => l.stop(); }, [on, reduce, a]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={on ? tl('Riunione registrata e trascritta. Tocca per vedere chi è dentro') : tl('Riunione non ancora iniziata')} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: on ? 'rgba(120,20,30,0.92)' : 'rgba(128,128,128,0.15)', borderWidth: 1, borderColor: on ? '#ff5a64' : 'rgba(128,128,128,0.3)' }}>
      <Animated.View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? '#ff5a64' : '#8e98a8', opacity: on ? a : 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: on ? '#fff' : undefined, fontWeight: '800', fontSize: 14 }}>{on ? tl('Registrata e trascritta da Theia') : tl('Non ancora iniziata')}</Text>
        <Text style={{ color: on ? 'rgba(255,255,255,0.85)' : '#8e98a8', fontSize: 12 }}>{on ? tl('{0} in riunione · tocca per vedere chi', n) : tl('Parte da sola quando entra qualcuno')}</Text>
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
function Result({ m, nameOf }: { m: Meeting; nameOf: (u: string) => string }) {
  const myName = useApp((s) => s.account.name);
  const [done, setDone] = useState(false);
  const acts = useMemo(() => actionsOf(m.notes, myName, new Date()), [m.notes, myName]);
  const mine = acts.filter((a) => a.mine).length;
  return (
    <View style={{ marginTop: 12 }}>
      <Body small muted>{tl('Riunione finita. Il verbale e le cose da fare sono già nel progetto, nella pagina «{0}».', meetingLabel(m.project ?? undefined))}</Body>
      <Body small bold muted style={{ marginTop: 12 }}>{tl('APPUNTI DI THEIA').toUpperCase()}</Body>
      {m.notes && (m.notes.decisions.length + m.notes.actions.length + m.notes.questions.length) ? (
        <>
          {m.notes.decisions.map((d, i) => <Body key={'d' + i} small style={{ marginTop: 4 }}>{`${tl('Decisione')}: ${d.text}`}</Body>)}
          {acts.map((a, i) => <Body key={'a' + i} small style={{ marginTop: 4 }}>{`${tl('Da fare')}: ${a.text} · ${a.owner}${a.due ? ` · ${label(a.due)}` : ''}`}</Body>)}
          {m.notes.questions.map((q, i) => <Body key={'q' + i} small style={{ marginTop: 4 }}>{`${tl('Domanda aperta')}: ${q.text}`}</Body>)}
        </>
      ) : <Body small muted style={{ marginTop: 4 }}>{tl('Nessuna decisione o cosa da fare riconosciute in questa riunione.')}</Body>}
      {mine ? <Btn style={{ marginTop: 12 }} icon="check" disabled={done} title={done ? 'Aggiunte al tuo Plan' : tl('Aggiungi le mie {0} cose da fare al Plan', mine)} onPress={() => { const n = addMyActions(m, myName); setDone(true); toast(tl('{0} cose da fare aggiunte al tuo Plan', n)); }} /> : null}
      <Body small muted style={{ marginTop: 8 }}>{tl('Presenti: {0}', [m.created_by, ...m.attendees].map(nameOf).join(', '))}</Body>
    </View>
  );
}
