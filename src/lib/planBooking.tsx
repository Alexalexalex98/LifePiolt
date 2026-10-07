import { useState } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

import { Body, Btn, Item, Row, Select, Sheet } from '@/components/ui';
import { timeToMinutes } from '@/lib/format';
import { fmtDay, nextDays, timeOptions, tsOf } from '@/lib/when';
import { useLife, type CalEvent } from '@/store/life';

/**
 * Inserimento nel Plan con controllo dei conflitti, riusabile da seminari, servizi, chat e assistente.
 * - findConflicts(day, time, durationMin): impegni del Plan che si sovrappongono (durata assunta 60 min se manca).
 * - addToPlanWithCheck(req, onDone, onCancel): se c'e' conflitto apre ConflictSheet (montato una sola volta in NetSheetHost);
 *   onDone viene chiamato solo quando l'utente ha deciso di procedere e l'evento e' stato inserito.
 * - removeFromPlan(ref): toglie l'evento creato in precedenza e restituisce quanto serve per l'undo.
 */
export const DEFAULT_DUR = 60;

export type PlanRequest = { day: string; time: string; durationMin: number; title: string; ref?: string; verb?: string };
export type PlanConflict = { idx: number; ev: CalEvent; day: string };

const span = (time: string, dur?: number) => { const s = timeToMinutes(time); return [s, s + (dur || DEFAULT_DUR)] as const; };

export function findConflicts(day: string, time: string, durationMin: number = DEFAULT_DUR, ignoreRef?: string): PlanConflict[] {
  const [s, e] = span(time, durationMin);
  return (useLife.getState().events[day] || [])
    .map((ev, idx) => ({ ev, idx, day }))
    .filter(({ ev }) => !(ignoreRef && ev.ref === ignoreRef))
    .filter(({ ev }) => { const [es, ee] = span(ev.time, ev.dur); return s < ee && es < e; });
}

/** Inserisce senza controlli (usare dopo findConflicts o dopo la scelta dell'utente). */
export function placeInPlan(req: PlanRequest) {
  useLife.getState().addEvent(req.day, { time: req.time, title: req.title, dur: req.durationMin || DEFAULT_DUR, ...(req.ref ? { ref: req.ref } : {}) });
}

export type PlanRemoval = { day: string; idx: number; ev: CalEvent };
export function removeFromPlan(ref: string): PlanRemoval | null {
  const st = useLife.getState();
  for (const day of Object.keys(st.events)) {
    const idx = st.events[day].findIndex((e) => e.ref === ref);
    if (idx >= 0) { const ev = st.delEvent(day, idx); if (ev) return { day, idx, ev }; }
  }
  return null;
}
export const restoreToPlan = (r: PlanRemoval | null) => { if (r) useLife.getState().restoreEvent(r.day, r.idx, r.ev); };

function moveEvent(c: PlanConflict, newDay: string, newTime: string) {
  const st = useLife.getState();
  const idx = (st.events[c.day] || []).findIndex((e) => e.time === c.ev.time && e.title === c.ev.title && e.ref === c.ev.ref);
  if (idx < 0) return;
  const ev = st.delEvent(c.day, idx);
  if (ev) st.addEvent(newDay, { ...ev, time: newTime });
}

/** Orari liberi (ogni 30 min) in un giorno per un impegno di durata dur, tenendo conto anche della richiesta in sospeso. */
export function freeStartTimes(day: string, dur: number, moving: PlanConflict, pending: PlanRequest): string[] {
  return timeOptions(6, 22).filter((t) => {
    const [s, e] = span(t, dur);
    const others = (useLife.getState().events[day] || []).filter((ev) => !(day === moving.day && ev.time === moving.ev.time && ev.title === moving.ev.title && ev.ref === moving.ev.ref));
    if (others.some((ev) => { const [es, ee] = span(ev.time, ev.dur); return s < ee && es < e; })) return false;
    if (day === pending.day) { const [ps, pe] = span(pending.time, pending.durationMin); if (s < pe && ps < e) return false; }
    return true;
  });
}

type Pending = { req: PlanRequest; onDone?: () => void; onCancel?: () => void } | null;
export const usePlanConflict = create<{ pending: Pending; step: 'choose' | 'move'; set: (p: Pending, step?: 'choose' | 'move') => void }>((set) => ({
  pending: null, step: 'choose', set: (pending, step = 'choose') => set({ pending, step }),
}));

export function addToPlanWithCheck(req: PlanRequest, onDone?: () => void, onCancel?: () => void) {
  if (!findConflicts(req.day, req.time, req.durationMin, req.ref).length) { placeInPlan(req); onDone?.(); return; }
  usePlanConflict.getState().set({ req, onDone, onCancel });
}

/** Foglio "Cosa vuoi fare?" in caso di sovrapposizione. Montato una sola volta (NetSheetHost). */
export function ConflictSheet() {
  const { pending, step, set } = usePlanConflict();
  if (!pending) return <Sheet visible={false} title="" onClose={() => {}}><View /></Sheet>;
  const { req } = pending;
  const conflicts = findConflicts(req.day, req.time, req.durationMin, req.ref);
  const cancel = () => { const cb = pending.onCancel; set(null); cb?.(); };
  const proceed = () => { const p = pending; set(null); placeInPlan(p.req); p.onDone?.(); };
  const c = conflicts[0];
  if (!c) return <Sheet visible={false} title="" onClose={() => {}}><View /></Sheet>; // conflitto sparito nel frattempo
  const verb = req.verb || 'Iscriviti';
  return (
    <Sheet visible title={step === 'choose' ? 'Hai già un impegno' : 'Sposta ' + c.ev.title} onClose={cancel}>
      {step === 'choose' ? (
        <>
          <Body>Per quel giorno hai già <Body bold>{c.ev.title}</Body> alle <Body bold>{c.ev.time}</Body>{conflicts.length > 1 ? ` (e altri ${conflicts.length - 1} impegni che si sovrappongono)` : ''}. Cosa vuoi fare?</Body>
          <Body small muted style={{ marginTop: 8, marginBottom: 14 }}>Nuovo: {req.title} · {fmtDay(tsOf(req.day, req.time))}, {req.time} ({req.durationMin} min). Un impegno senza durata nel Plan viene considerato di {DEFAULT_DUR} minuti.</Body>
          <Btn style={{ marginBottom: 8 }} title={`${verb} comunque (tieni entrambi)`} onPress={proceed} />
          <Btn ghost style={{ marginBottom: 8 }} title="Sposta l'impegno esistente" onPress={() => set(pending, 'move')} />
          <Btn ghost title="Annulla" onPress={cancel} />
        </>
      ) : (
        <MoveView conflict={c} req={req} onBack={() => set(pending, 'choose')} onMoved={(day, time) => { moveEvent(c, day, time); const left = findConflicts(req.day, req.time, req.durationMin, req.ref); if (left.length) set({ ...pending }, 'choose'); else proceed(); }} />
      )}
    </Sheet>
  );
}

function MoveView({ conflict, req, onBack, onMoved }: { conflict: PlanConflict; req: PlanRequest; onBack: () => void; onMoved: (day: string, time: string) => void }) {
  const days = nextDays(14);
  const [dayKeyV, setDayKeyV] = useState(days[0].key);
  const dur = conflict.ev.dur || DEFAULT_DUR;
  const free = freeStartTimes(dayKeyV, dur, conflict, req);
  const [time, setTime] = useState<string | null>(null);
  const chosen = time && free.includes(time) ? time : free[0];
  const label = days.find((d) => d.key === dayKeyV)?.label ?? days[0].label;
  return (
    <>
      <Body small muted style={{ marginBottom: 10 }}>Scegli quando spostare "{conflict.ev.title}" ({dur} min). Vengono proposti solo orari liberi.</Body>
      <Select title="Nuovo giorno" value={label} options={days.map((d) => d.label)} onChange={(l) => { setDayKeyV(days.find((d) => d.label === l)!.key); setTime(null); }} />
      {free.length ? <Select title="Nuovo orario" value={chosen} options={free} onChange={setTime} /> : <Body small color="#ffb84f" style={{ marginBottom: 10 }}>Nessun orario libero in questo giorno: scegline un altro.</Body>}
      <Row style={{ marginTop: 8 }}>
        <Btn ghost style={{ flex: 1 }} title="Indietro" onPress={onBack} />
        <Btn style={{ flex: 1 }} disabled={!free.length} title="Sposta e prosegui" onPress={() => onMoved(dayKeyV, chosen)} />
      </Row>
    </>
  );
}

void Item;
