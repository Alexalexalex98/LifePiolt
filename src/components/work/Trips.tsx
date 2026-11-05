import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DayField } from '@/components/work/DayField';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { closeTrip, createTrip, decideTrip, deleteTrip, pullTrips, requestTrip, tripToExpenses, tripToPlan, updateTrip } from '@/lib/teamTrips';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { today } from '@/lib/teamWork';
import { SEG_LABEL, STATUS_LABEL, ZONES, checkSegments, convert, defaultDocs, diffLabel, docsProgress, expenseDrafts, itinerary, nightsOf, planClashes, segTimes, tripCost, zoneOf, type Seg, type SegKind, type Trip } from '@/lib/tripWork';
import { useLife } from '@/store/life';
import { usePeople } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useTrips } from '@/store/trips';
import { useWork } from '@/store/work';

const STATUS_COLOR: Record<Trip['status'], string> = { draft: '#8e98a8', requested: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', done: '#8e98a8' };
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const homeZone = (): string => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return ZONES.some((x) => x.id === z) ? z : 'Europe/Rome'; } catch { return 'Europe/Rome'; } };
const NONE: Trip[] = [];

/** Trasferte: viaggio di lavoro con tratte e fusi orari, documenti, costi e approvazione. Non prenota e non paga: le prenotazioni le segni tu. */
export function Trips() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const me = usePeople((s) => s.me);
  const { caps } = useCaps(team?.id);
  const all = useTrips((s) => (team ? s.items[team.id] : undefined)) ?? NONE;
  const [open, setOpen] = useState<string | null>(null); const [add, setAdd] = useState(false);
  const [home, setHome] = useState(homeZone());
  useEffect(() => { if (!team) return; void loadPeople(team.id); void pullTrips(team.id); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace what="organizza le trasferte e chiedi l'approvazione" />;
  const mine = all.filter((x) => x.user_id === me); const toApprove = caps.has('absence.approve') ? all.filter((x) => x.status === 'requested' && x.user_id !== me) : [];
  const nameOf = (id: string) => usePeople.getState().people[team.id]?.find((p) => p.user_id === id)?.name || tl('Un collega');
  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}
      {toApprove.length ? (
        <Card accent="#f59e0b">
          <H>Da approvare</H>
          {toApprove.map((x) => <TripRow key={x.id} trip={x} who={nameOf(x.user_id)} onPress={() => setOpen(x.id)} />)}
        </Card>
      ) : null}
      <Card>
        <Row><H>Le mie trasferte</H><Btn small icon="plus" title="Nuova" onPress={() => setAdd(true)} /></Row>
        {mine.length === 0 ? <Empty text="Nessuna trasferta. Creane una: segni voli, treni e hotel, i documenti e i costi, e chiedi l'approvazione." /> : mine.map((x) => <TripRow key={x.id} trip={x} onPress={() => setOpen(x.id)} />)}
      </Card>
      <Card>
        <Body small bold muted>{tl('IL TUO FUSO ORARIO').toUpperCase()}</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 6 }}>{ZONES.map((z) => <Pill key={z.id} label={tl(z.label)} on={home === z.id} onPress={() => setHome(z.id)} />)}</ScrollView>
        <Body small muted style={{ marginTop: 6 }}>{tl('Gli orari delle tratte li vedi anche nell\'ora di casa.')}</Body>
      </Card>
      <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Qui segni il viaggio: non prenoto e non pago niente al posto tuo. L\'approvazione la decide chi ha il permesso, e il server lo controlla.')}</Text>
      <NewTrip team={team.id} open={add} onClose={() => setAdd(false)} onCreated={(id) => setOpen(id)} />
      {open ? <TripView id={open} team={team.id} home={home} me={me} canApprove={caps.has('absence.approve')} nameOf={nameOf} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

function TripRow({ trip, who, onPress }: { trip: Trip; who?: string; onPress: () => void }) {
  return (
    <Row style={{ marginTop: 10 }}>
      <View style={{ flex: 1 }}>
        <Body bold onPress={onPress}>{trip.title}</Body>
        <Body small muted>{`${who ? `${who} · ` : ''}${trip.dest ? `${trip.dest} · ` : ''}${day(trip.from_day)} → ${day(trip.to_day)}`}</Body>
      </View>
      <Pill label={tl(STATUS_LABEL[trip.status])} color={STATUS_COLOR[trip.status]} />
      <Btn small ghost title="Apri" onPress={onPress} />
    </Row>
  );
}

function NewTrip({ team, open, onClose, onCreated }: { team: string; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ title: '', dest: '', from: '', to: '', purpose: '', budget: '' }); const [intl, setIntl] = useState(false); const [cur, setCur] = useState<'CHF' | 'EUR'>('CHF'); const [busy, setBusy] = useState(false);
  const save = () => {
    if (!f.title.trim() || !f.from) { toast('Scrivi il titolo e scegli le date'); return; }
    const to = f.to || f.from; if (to < f.from) { toast('Il ritorno è prima della partenza'); return; }
    setBusy(true);
    void createTrip({ team, title: f.title, dest: f.dest, from_day: f.from, to_day: to, purpose: f.purpose, budget: num(f.budget) >= 0 ? num(f.budget) : null, currency: cur, international: intl }).then((r) => { setBusy(false); if (!r.ok) { toast(r.message); return; } setF({ title: '', dest: '', from: '', to: '', purpose: '', budget: '' }); onClose(); onCreated(r.data); });
  };
  return (
    <Sheet visible={open} title="Nuova trasferta" onClose={onClose}>
      <Input placeholder="Titolo (es. Fiera di Zurigo)" value={f.title} onChangeText={(x) => setF({ ...f, title: x })} />
      <Input placeholder="Destinazione" value={f.dest} onChangeText={(x) => setF({ ...f, dest: x })} />
      <DayField value={f.from} onChange={(d) => setF({ ...f, from: d, to: f.to && f.to >= d ? f.to : d })} placeholder="Partenza" />
      <DayField value={f.to} onChange={(d) => setF({ ...f, to: d })} placeholder="Ritorno" />
      <Input placeholder="Motivo (facoltativo)" value={f.purpose} onChangeText={(x) => setF({ ...f, purpose: x })} maxLines={3} />
      <Row><Input flex={2} placeholder="Budget (facoltativo)" keyboardType="numeric" value={f.budget} onChangeText={(x) => setF({ ...f, budget: x })} /><Pill label="CHF" on={cur === 'CHF'} onPress={() => setCur('CHF')} /><Pill label="EUR" on={cur === 'EUR'} onPress={() => setCur('EUR')} /></Row>
      <Toggle label={tl('Viaggio all\'estero')} value={intl} onChange={setIntl} hint={tl('Aggiunge passaporto, assicurazione e visto all\'elenco dei documenti.')} />
      <Btn icon="check" disabled={busy} title="Crea la trasferta" onPress={save} />
    </Sheet>
  );
}

function TripView({ id, team, home, me, canApprove, nameOf, onClose }: { id: string; team: string; home: string; me: string | null; canApprove: boolean; nameOf: (u: string) => string; onClose: () => void }) {
  const th = useTheme();
  const tr = useTrips((s) => s.items[team]?.find((x) => x.id === id));
  const events = useLife((s) => s.events);
  const [seg, setSeg] = useState(false); const [note, setNote] = useState(''); const [newDoc, setNewDoc] = useState(''); const [busy, setBusy] = useState(false);
  const warn = useMemo(() => (tr ? checkSegments(tr) : []), [tr]);
  const clashes = useMemo(() => (tr ? planClashes(tr, events, new Set(tr.segments.map((s) => `trip-${s.id}`))) : []), [tr, events]);
  if (!tr) return null;
  const mineTrip = tr.user_id === me; const editable = mineTrip && tr.status !== 'done';
  const cost = tripCost(tr); const days = itinerary(tr); const drafts = expenseDrafts(tr);
  const act = (p: Promise<{ ok: boolean; message?: string }>, ok: string) => { setBusy(true); void p.then((r) => { setBusy(false); toast(r.ok ? ok : (r as { message: string }).message); }); };
  const rmSeg = (s: Seg) => { void updateTrip(tr, { segments: tr.segments.filter((x) => x.id !== s.id) }); };
  const toggleDoc = (i: number) => { void updateTrip(tr, { docs: tr.docs.map((d, k) => (k === i ? { ...d, done: !d.done } : d)) }); };
  return (
    <Sheet visible title={tr.title} onClose={onClose}>
      <Row><Pill label={tl(STATUS_LABEL[tr.status])} color={STATUS_COLOR[tr.status]} /><Body small muted style={{ flex: 1 }}>{`${tr.dest ? `${tr.dest} · ` : ''}${day(tr.from_day)} → ${day(tr.to_day)} · ${tl('{0} notti', nightsOf(tr))}`}</Body></Row>
      {!mineTrip ? <Body small muted style={{ marginTop: 4 }}>{tl('Di {0}', nameOf(tr.user_id))}</Body> : null}
      {tr.purpose ? <Body style={{ marginTop: 6 }}>{tr.purpose}</Body> : null}
      {tr.status === 'rejected' && tr.decision_note ? <Body small style={{ marginTop: 6, color: '#ef4444' }}>{tr.decision_note}</Body> : null}

      {tr.status === 'requested' && canApprove && !mineTrip ? (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: th.chip }}>
          <Body bold>{tl('Approvi questa trasferta?')}</Body>
          <Input placeholder="Un commento (facoltativo)" value={note} onChangeText={setNote} />
          <Row><Btn icon="check" disabled={busy} title="Approva" onPress={() => act(decideTrip(tr, true, note), 'Approvata: la persona è stata avvisata')} /><Btn ghost danger disabled={busy} title="Non approvo" onPress={() => act(decideTrip(tr, false, note), 'Rifiutata: la persona è stata avvisata')} /></Row>
        </View>
      ) : null}

      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('ITINERARIO').toUpperCase()}</Body>
      {days.map((d) => (
        <View key={d.day} style={{ marginBottom: 10 }}>
          <Body bold>{day(d.day)}</Body>
          {d.items.length === 0 ? <Body small muted>{tl('Niente segnato.')}</Body> : d.items.map((s) => { const tm = segTimes(s, home); const far = convert(s.day, s.time, home, s.tz).diffMin; return (
            <Row key={s.id} style={{ marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Body small bold>{`${tm.start}${tm.end ? ` → ${tm.end}` : ''} · ${tl(SEG_LABEL[s.kind])}: ${s.title}`}</Body>
                <Body small muted>{[s.place, tm.home ? tl('da te sono le {0}', tm.home) : '', far !== 0 ? `${tl(zoneOf(s.tz).label)} ${diffLabel(far)}` : '', s.cost ? `${s.cost} ${tr.currency}` : '', s.ref ? `${tl('Rif.')} ${s.ref}` : ''].filter(Boolean).join(' · ')}</Body>
              </View>
              {editable ? <Btn small ghost danger icon="trash" title="" onPress={() => rmSeg(s)} /> : null}
            </Row>
          ); })}
        </View>
      ))}
      {editable ? <Btn small ghost icon="plus" title="Aggiungi volo, treno, hotel, riunione" onPress={() => setSeg(true)} /> : null}
      {warn.map((w, i) => <Body key={i} small style={{ marginTop: 6, color: '#f59e0b' }}>{w}</Body>)}
      {clashes.length ? <Body small style={{ marginTop: 6 }}>{tl('Nei giorni del viaggio hai già in Plan: {0}. Spostali o seguili a distanza.', clashes.slice(0, 4).map((c) => `${day(c.day)} ${c.time} ${c.title}`).join('; '))}</Body> : null}

      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{tl('COSTI').toUpperCase()}</Body>
      <Body>{`${cost.total} ${tr.currency}${tr.budget != null ? ` ${tl('su')} ${tr.budget}` : ''}`}</Body>
      {tr.budget != null ? <Body small style={{ color: cost.over ? '#ef4444' : '#22c55e' }}>{cost.over ? tl('Sopra il budget di {0} {1}', Math.abs(cost.left ?? 0), tr.currency) : tl('Restano {0} {1}', cost.left ?? 0, tr.currency)}</Body> : null}

      <Body small bold muted style={{ marginTop: 14, marginBottom: 6 }}>{`${tl('DOCUMENTI').toUpperCase()} · ${docsProgress(tr.docs)}%`}</Body>
      {tr.docs.map((d, i) => <Row key={i} style={{ marginBottom: 4 }}><Pill label={d.done ? '✓' : '○'} on={d.done} onPress={mineTrip ? () => toggleDoc(i) : undefined} /><Body small style={{ flex: 1, textDecorationLine: d.done ? 'line-through' : 'none' }}>{d.t}</Body></Row>)}
      {editable ? (
        <>
          <Row><Input flex={1} placeholder="Un altro documento o cosa da portare" value={newDoc} onChangeText={setNewDoc} /><Btn small icon="plus" title="" onPress={() => { if (newDoc.trim()) { void updateTrip(tr, { docs: [...tr.docs, { t: newDoc.trim(), done: false }] }); setNewDoc(''); } }} /></Row>
          <View style={{ alignSelf: 'flex-start' }}><Btn small ghost title="Rifai l'elenco in base alle tratte" onPress={() => { void updateTrip(tr, { docs: defaultDocs(tr.international, tr.segments.some((s) => s.kind === 'hotel'), tr.segments.some((s) => s.kind === 'flight')) }); }} /></View>
        </>
      ) : null}

      {mineTrip ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {(tr.status === 'draft' || tr.status === 'rejected') ? <Btn icon="send" disabled={busy} title={tr.status === 'rejected' ? 'Chiedi di nuovo l\'approvazione' : 'Chiedi l\'approvazione'} onPress={() => act(requestTrip(tr), 'Richiesta inviata a chi approva')} /> : null}
          {tr.status === 'requested' ? <Body small muted>{tl('In attesa che chi approva risponda: ti avviso appena decide.')}</Body> : null}
          {tr.status === 'approved' ? (
            <>
              <Btn icon="calendar" title="Metti viaggio e promemoria nel Plan" onPress={() => { const n = tripToPlan(tr, home, today()); toast(n ? tl('{0} voci aggiunte al Plan', n) : 'Il Plan è già aggiornato'); }} />
              {drafts.length ? <Btn ghost title={tl('Crea {0} note spese dai costi', drafts.length)} disabled={busy} onPress={() => act(tripToExpenses(tr), 'Note spese create: le trovi in Soldi')} /> : null}
              <Btn ghost title="Sono tornato: chiudi la trasferta" disabled={busy} onPress={() => act(closeTrip(tr), 'Trasferta conclusa')} />
            </>
          ) : null}
          {(tr.status === 'draft' || tr.status === 'rejected') ? <Btn small ghost danger title="Elimina la trasferta" onPress={() => alertT('Eliminare la trasferta?', tr.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteTrip(tr).then((r) => { if (r.ok) onClose(); else toast(r.message); }); } }])} /> : null}
          {tr.status === 'approved' ? <Body small muted>{tl('Se cambi destinazione, date o budget serve una nuova approvazione.')}</Body> : null}
        </View>
      ) : null}
      {seg ? <AddSeg trip={tr} home={home} onClose={() => setSeg(false)} /> : null}
    </Sheet>
  );
}

function AddSeg({ trip, home, onClose }: { trip: Trip; home: string; onClose: () => void }) {
  const [kind, setKind] = useState<SegKind>('flight'); const [title, setTitle] = useState(''); const [d, setD] = useState(trip.from_day); const [time, setTime] = useState('');
  const [tz, setTz] = useState(home); const [ed, setEd] = useState(''); const [et, setEt] = useState(''); const [etz, setEtz] = useState(''); const [cost, setCost] = useState(''); const [place, setPlace] = useState(''); const [ref, setRef] = useState('');
  const ends = kind === 'flight' || kind === 'train' || kind === 'car';
  const ok = (s: string) => /^\d{1,2}:\d{2}$/.test(s);
  const save = () => {
    if (!title.trim() || !ok(time)) { toast('Scrivi il nome e l\'ora (es. 07:10)'); return; }
    if (ends && (ed || et) && !(ed && ok(et))) { toast('Per l\'arrivo servono giorno e ora'); return; }
    const s: Seg = { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, title: title.trim(), day: d, time: time.padStart(5, '0'), tz, ...(ends && ed && ok(et) ? { endDay: ed, endTime: et.padStart(5, '0'), endTz: etz || tz } : {}), ...(place.trim() ? { place: place.trim() } : {}), ...(ref.trim() ? { ref: ref.trim() } : {}), ...(num(cost) > 0 ? { cost: num(cost) } : {}) };
    void updateTrip(trip, { segments: [...trip.segments, s] }).then((r) => { if (r.ok) onClose(); else toast(r.message); });
  };
  const zones = (v: string, set: (z: string) => void) => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>{ZONES.map((z) => <Pill key={z.id} label={tl(z.label)} on={v === z.id} onPress={() => set(z.id)} />)}</ScrollView>;
  return (
    <Sheet visible title="Nuova tratta" onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{(Object.keys(SEG_LABEL) as SegKind[]).map((k) => <Pill key={k} label={tl(SEG_LABEL[k])} on={kind === k} onPress={() => setKind(k)} />)}</View>
      <Input placeholder={kind === 'hotel' ? 'Nome dell\'hotel' : kind === 'meeting' ? 'Con chi / dove' : 'Es. Milano → Zurigo'} value={title} onChangeText={setTitle} />
      <DayField value={d} onChange={setD} placeholder="Giorno" />
      <Input placeholder={kind === 'hotel' ? 'Ora di arrivo (es. 15:00)' : 'Ora di partenza (es. 07:10)'} value={time} onChangeText={setTime} />
      <Body small bold muted style={{ marginBottom: 4 }}>{tl('FUSO ORARIO DELLA PARTENZA').toUpperCase()}</Body>
      {zones(tz, setTz)}
      {ends ? (
        <>
          <Body small bold muted style={{ marginBottom: 4 }}>{tl('ARRIVO (FACOLTATIVO)').toUpperCase()}</Body>
          <DayField value={ed} onChange={setEd} placeholder="Giorno di arrivo" />
          <Input placeholder="Ora di arrivo (es. 10:40)" value={et} onChangeText={setEt} />
          {zones(etz || tz, setEtz)}
        </>
      ) : null}
      <Input placeholder="Luogo o indirizzo (facoltativo)" value={place} onChangeText={setPlace} />
      <Input placeholder="Codice di prenotazione (facoltativo)" value={ref} onChangeText={setRef} />
      <Input placeholder={`Costo in ${trip.currency} (facoltativo)`} keyboardType="numeric" value={cost} onChangeText={setCost} />
      <Btn icon="check" title="Aggiungi" onPress={save} />
    </Sheet>
  );
}
