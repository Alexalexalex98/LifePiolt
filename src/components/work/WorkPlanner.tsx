import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { go } from '@/lib/nav';
import { listMembers, myUserId, type Member } from '@/lib/teams';
import { busyRanges, decideAbsence, listAbsences, loadHours, pushWorkEvent, removeWorkEvent, requestAbsence, teamBusy, today, type Busy } from '@/lib/teamWork';
import { DEFAULT_SCHEDULE, addDays, commonFree, evRange, fitsInHours, formatSpans, fromMin, nextFree, parseSpans, type Schedule } from '@/lib/workHours';
import { WORK_COLOR_ID, isWork, newEventId } from '@/lib/workPlan';
import { useLife, type CalEvent } from '@/store/life';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { scheduleOf, useWork, type Absence } from '@/store/work';
import { saveMyHours } from '@/lib/teamWork';

const DAYS: [number, string][] = [[1, 'Lunedì'], [2, 'Martedì'], [3, 'Mercoledì'], [4, 'Giovedì'], [5, 'Venerdì'], [6, 'Sabato'], [0, 'Domenica']];
const KINDS: Absence['kind'][] = ['ferie', 'permesso', 'malattia', 'altro'];
const KIND_LABEL: Record<Absence['kind'], string> = { ferie: 'Ferie', permesso: 'Permesso', malattia: 'Malattia', altro: 'Altro' };
const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + 'T12:00:00').getTime());
const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Pianificazione del lavoro: orario, impegni condivisi con le persone del workspace, ferie e permessi. Tutto compare anche nel Plan con l'etichetta «Lavoro». */
export function WorkPlanner() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  if (!team) return (
    <Card>
      <H>Nessun workspace di lavoro</H>
      <Body small muted style={{ marginTop: 4 }}>Crea un workspace o entra con un codice di invito: poi qui trovi orario, riunioni e ferie di tutta la squadra.</Body>
      <Btn style={{ marginTop: 10 }} icon="plus" title="Crea o entra in un workspace" onPress={() => go('teams')} />
    </Card>
  );
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}
        </View>
      ) : null}
      <Body small muted>{tl('Quello che pianifichi qui compare anche nel tuo Plan con l\'etichetta «Lavoro». Le tue cose private qui non si vedono mai.')}</Body>
      <Agenda team={team.id} role={team.role} />
      <Hours team={team.id} />
      <Absences team={team.id} role={team.role} />
      <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Gli orari e gli impegni condivisi stanno sul server: li vedono solo le persone invitate e gli amministratori.')}</Text>
    </View>
  );
}

/* ---------- impegni di lavoro ---------- */
function Agenda({ team, role }: { team: string; role: Member['role'] }) {
  const events = useLife((s) => s.events);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void myUserId().then(setMe); void listMembers(team).then((r) => { if (r.ok) setNames(Object.fromEntries(r.data.map((m) => [m.user_id, m.name || tl('Collega')]))); }); }, [team]);
  const list = useMemo(() => {
    const t0 = today(); const out: { day: string; e: CalEvent; i: number }[] = [];
    for (const [day, arr] of Object.entries(events)) if (day >= t0 && day <= addDays(t0, 30)) arr.forEach((e, i) => { if (e.team === team) out.push({ day, e, i }); });
    return out.sort((a, b) => (a.day + a.e.time).localeCompare(b.day + b.e.time));
  }, [events, team]);
  const del = (day: string, e: CalEvent, i: number) => alertT('Eliminare l\'impegno?', e.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { if (e.wid) void removeWorkEvent(e.wid); useLife.getState().delEvent(day, i); toast('Impegno eliminato'); } }]);
  return (
    <Card>
      <Row><H>Impegni di lavoro</H><Btn small icon="plus" title="Nuovo" onPress={() => setOpen(true)} /></Row>
      {list.length === 0 ? <Empty text="Nessun impegno di lavoro nei prossimi 30 giorni." /> : list.map(({ day, e, i }) => (
        <View key={day + e.time + (e.wid ?? i)} style={{ paddingVertical: 8 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold>{e.title}</Body>
              <Body small muted>{`${label(day)} · ${e.time} · ${e.dur ?? 60} min`}</Body>
              {e.with?.length ? <Body small muted>{tl('Con {0}', e.with.map((u) => names[u] ?? tl('Collega')).join(', '))}</Body> : null}
            </View>
            {(!e.by || e.by === me || role !== 'member') ? <ChipBtn icon="trash" tone="danger" title="Elimina" onPress={() => del(day, e, i)} /> : null}
          </Row>
        </View>
      ))}
      <NewEvent team={team} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function NewEvent({ team, open, onClose }: { team: string; open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(today());
  const [time, setTime] = useState('10:00');
  const [dur, setDur] = useState(60);
  const [members, setMembers] = useState<Member[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const sched = scheduleOf(team, useWork((s) => s.schedules));
  useEffect(() => { if (!open) return; void myUserId().then(setMe); void listMembers(team).then((r) => { if (r.ok) setMembers(r.data); }); }, [open, team]);
  const others = members.filter((m) => m.user_id !== me);
  const myBusy = useCallback((d: string) => (useLife.getState().events[d] ?? []).filter((e) => isWork(e) && e.team === team).map(evRange), [team]);

  async function find() {
    if (!okDay(day)) { toast('Scrivi il giorno come 2026-11-20'); return; }
    const hours = await loadHours(team); const b = await teamBusy(team, day, day);
    if (!hours.ok || !b.ok) { toast(hours.ok ? (b as { message: string }).message : hours.message); return; }
    const ids = [...(me ? [me] : []), ...sel];
    const people = ids.map((id) => ({ schedule: hours.data[id] ?? DEFAULT_SCHEDULE, busy: busyRanges(b.data as Busy[], id, day) }));
    const free = commonFree(people, day, dur);
    setSlots(free.length ? free.map(([a]) => fromMin(a)) : []);
  }
  function save(at: { day: string; time: string }) {
    const wid = newEventId();
    const ev: CalEvent = { time: at.time, title: title.trim(), dur, color: WORK_COLOR_ID, team, wid, ...(sel.length ? { with: sel } : {}), ...(me ? { by: me } : {}) };
    useLife.getState().addEvent(at.day, ev);
    void pushWorkEvent(at.day, ev).then((r) => { if (!r.ok) toast(r.message); });
    setTitle(''); setSel([]); setSlots(null); onClose();
    toast(sel.length ? 'Impegno creato e inviato alle persone invitate' : 'Impegno di lavoro creato');
  }
  function submit() {
    if (!title.trim()) { toast('Scrivi il titolo'); return; }
    if (!okDay(day) || !/^\d{1,2}:\d{2}$/.test(time.trim())) { toast('Controlla giorno e ora'); return; }
    const t = time.trim().padStart(5, '0');
    if (fitsInHours(sched, day, t, dur)) { save({ day, time: t }); return; }
    const alt = nextFree(sched, day, 0, dur, myBusy);
    alertT('Fuori dal tuo orario di lavoro', alt ? tl('Il primo posto libero è {0} alle {1}. Vuoi metterlo lì?', label(alt.day), alt.time) : tl('Non trovo posto nel tuo orario. Lo metto comunque?'), [
      { text: 'Annulla', style: 'cancel' },
      ...(alt ? [{ text: tl('Sì, mettilo lì'), onPress: () => save(alt) }] : []),
      { text: tl('Lascia così'), onPress: () => save({ day, time: t }) },
    ]);
  }
  return (
    <Sheet visible={open} title="Nuovo impegno di lavoro" onClose={onClose}>
      <Input placeholder="Che cosa?" value={title} onChangeText={setTitle} />
      <Row><Input flex={1} placeholder="Giorno (2026-11-20)" value={day} onChangeText={setDay} /><Input flex={1} placeholder="Ora (10:00)" value={time} onChangeText={setTime} /></Row>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{[30, 45, 60, 90, 120].map((d) => <Pill key={d} label={`${d} min`} on={dur === d} onPress={() => setDur(d)} />)}</View>
      {others.length ? (
        <>
          <Body small bold muted style={{ marginBottom: 6 }}>{tl('INVITA').toUpperCase()}</Body>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{others.map((m) => <Pill key={m.user_id} label={m.name || tl('Collega')} on={sel.includes(m.user_id)} onPress={() => setSel(sel.includes(m.user_id) ? sel.filter((x) => x !== m.user_id) : [...sel, m.user_id])} />)}</View>
        </>
      ) : <Body small muted style={{ marginBottom: 8 }}>{tl('Nessun collega nel workspace: invitane uno dalla scheda Team e poi potrai convocarlo qui.')}</Body>}
      <Btn ghost icon="clock" title="Trova un orario libero per tutti" onPress={() => { void find(); }} />
      {slots ? (slots.length ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{slots.slice(0, 8).map((s) => <Pill key={s} label={s} on={time === s} onPress={() => setTime(s)} />)}</View>
      ) : <Body small muted style={{ marginTop: 8 }}>{tl('Nessun orario libero in comune quel giorno: prova un altro giorno.')}</Body>) : null}
      <Btn style={{ marginTop: 12 }} icon="check" title="Crea impegno" onPress={submit} />
    </Sheet>
  );
}

/* ---------- orario ---------- */
function Hours({ team }: { team: string }) {
  const saved = scheduleOf(team, useWork((s) => s.schedules));
  const [txt, setTxt] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);
  useEffect(() => { void loadHours(team); }, [team]);
  useEffect(() => { setTxt(Object.fromEntries(DAYS.map(([d]) => [d, formatSpans(saved[String(d)])]))); setDirty(false); }, [saved, team]);
  function save() {
    const out: Schedule = {};
    for (const [d, name] of DAYS) { const p = parseSpans(txt[d] ?? ''); if (!p) { toast(tl('{0}: scrivi come 09:00-12:30, 14:00-18:00', tl(name))); return; } out[String(d)] = p; }
    void saveMyHours(team, out).then((r) => toast(r.ok ? 'Orario di lavoro salvato' : r.message));
  }
  return (
    <Card>
      <H>Il tuo orario di lavoro</H>
      <Body small muted style={{ marginTop: 4, marginBottom: 8 }}>Theia mette i tuoi impegni di lavoro solo dentro queste fasce. Lascia vuoto un giorno libero.</Body>
      {DAYS.map(([d, name]) => (
        <Row key={d} style={{ marginBottom: 6 }}>
          <Body style={{ width: 92 }}>{tl(name)}</Body>
          <Input flex={1} style={{ marginBottom: 0 }} placeholder="Libero" value={txt[d] ?? ''} onChangeText={(v) => { setTxt({ ...txt, [d]: v }); setDirty(true); }} />
        </Row>
      ))}
      <Row style={{ marginTop: 6 }}>
        <Btn small ghost title="Copia il lunedì su lun–ven" onPress={() => { const m = txt[1] ?? ''; setTxt({ ...txt, 2: m, 3: m, 4: m, 5: m }); setDirty(true); }} />
        <Btn small disabled={!dirty} title="Salva" onPress={save} />
      </Row>
    </Card>
  );
}

/* ---------- ferie e permessi ---------- */
function Absences({ team, role }: { team: string; role: Member['role'] }) {
  const [list, setList] = useState<Absence[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Absence['kind']>('ferie');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [note, setNote] = useState('');
  const admin = role !== 'member';
  const reload = useCallback(() => { void listAbsences(team).then((r) => { if (r.ok) setList(r.data.filter((a) => a.to_day >= today())); }); }, [team]);
  useEffect(() => { reload(); void listMembers(team).then((r) => { if (r.ok) setNames(Object.fromEntries(r.data.map((m) => [m.user_id, m.name || tl('Collega')]))); }); }, [team, reload]);
  const st = (a: Absence) => (a.status === 'approved' ? tl('Approvata') : a.status === 'rejected' ? tl('Rifiutata') : tl('In attesa'));
  return (
    <Card>
      <Row><H>Ferie e permessi</H><Btn small icon="plus" title="Richiedi" onPress={() => setOpen(true)} /></Row>
      {list.length === 0 ? <Empty text="Nessuna assenza in programma." /> : list.map((a) => (
        <View key={a.id} style={{ paddingVertical: 8 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold>{`${names[a.user_id] ?? tl('Collega')} · ${tl(KIND_LABEL[a.kind])}`}</Body>
              <Body small muted>{`${label(a.from_day)} – ${label(a.to_day)} · ${st(a)}`}</Body>
            </View>
            {admin && a.status === 'requested' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ChipBtn icon="check" title="Approva" onPress={() => { void decideAbsence(a.id, true).then((r) => { toast(r.ok ? 'Approvata' : r.message); reload(); }); }} />
                <ChipBtn icon="close" tone="danger" title="Rifiuta" onPress={() => { void decideAbsence(a.id, false).then((r) => { toast(r.ok ? 'Rifiutata' : r.message); reload(); }); }} />
              </View>
            ) : null}
          </Row>
        </View>
      ))}
      <Sheet visible={open} title="Richiedi un'assenza" onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{KINDS.map((k) => <Pill key={k} label={tl(KIND_LABEL[k])} on={kind === k} onPress={() => setKind(k)} />)}</View>
        <Row><Input flex={1} placeholder="Dal (2026-12-24)" value={from} onChangeText={setFrom} /><Input flex={1} placeholder="Al (2026-12-31)" value={to} onChangeText={setTo} /></Row>
        <Input placeholder="Nota (facoltativa)" value={note} onChangeText={setNote} />
        <Btn icon="check" title="Invia la richiesta" onPress={() => {
          if (!okDay(from) || !okDay(to) || to < from) { toast('Controlla le date (il «Al» non può venire prima del «Dal»)'); return; }
          void requestAbsence(team, { kind, from_day: from, to_day: to, ...(note.trim() ? { note: note.trim() } : {}) }).then((r) => { toast(r.ok ? 'Richiesta inviata: la decide un amministratore' : r.message); if (r.ok) { setOpen(false); setNote(''); reload(); } });
        }} />
      </Sheet>
    </Card>
  );
}
