import { useMemo } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { type Range } from '@/lib/conflicts';
import { moveTargets } from '@/lib/slots';
import { myUserId } from '@/lib/teams';
import { proposeReschedule } from '@/lib/teamNotify';
import { useMeetings } from '@/store/meetings';
import { sendMessage } from '@/lib/teamComms';
import { usePeople } from '@/store/people';
import { pushWorkEvent } from '@/lib/teamWork';
import { useConflicts } from '@/store/conflicts';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { useState } from 'react';

/** Applica lo spostamento di un tuo impegno. Se è condiviso con altre persone le avvisa: devono accettare il nuovo orario. */
export async function applyMove(day: string, idx: number, time: string): Promise<void> {
  const ev = useLife.getState().events[day]?.[idx]; if (!ev) return;
  useLife.getState().patchEvent(day, idx, { time });
  if (!(ev.team && ev.wid)) return;
  const me = await myUserId();
  const m = useMeetings.getState().items.find((x) => x.event_id === ev.wid);
  if (ev.by && ev.by !== me) { void pushWorkEvent(day, { ...ev, time }); return; }
  if (m) {
    useMeetings.getState().set({ items: useMeetings.getState().items.map((x) => (x.id === m.id ? { ...x, time } : x)) });
    const r = await proposeReschedule('meeting', m.id, day, time);
    toast(!r.ok ? r.message : r.data ? 'Ho avvisato gli invitati: devono accettare il nuovo orario' : 'Spostata');
  } else if (ev.with?.length) {
    const r = await proposeReschedule('event', ev.wid, day, time);
    toast(!r.ok ? r.message : r.data ? 'Ho avvisato gli invitati: devono accettare il nuovo orario' : 'Spostato');
  } else void pushWorkEvent(day, { ...ev, time });
}

/** Sposta un tuo impegno a un altro orario libero dello stesso giorno. Con `onPick` non lo sposta subito: restituisce solo l'orario scelto (serve a «sposta e riorganizza»). `avoid` = intervalli da non toccare (la nuova riunione). */
export function MoveEvent({ day, idx, onClose, onDone, onPick, avoid }: { day: string; idx: number; onClose: () => void; onDone?: () => void; onPick?: (time: string) => void; avoid?: Range[] }) {
  const ev = useLife((s) => s.events[day]?.[idx]);
  const list = useLife((s) => s.events[day]) ?? [];
  const starts = useMemo(() => (ev ? moveTargets(list, idx, avoid ?? [], ev.dur ?? 60) : []), [list, idx, ev, avoid]);
  if (!ev) return null;
  const move = (time: string) => {
    if (onPick) { onPick(time); onClose(); return; }
    void applyMove(day, idx, time); toast(tl('«{0}» spostato alle {1}', ev.title, time)); onDone?.(); onClose();
  };
  return (
    <Sheet visible title={tl('Sposta «{0}»', ev.title)} onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Ora è alle {0}. Scegli un altro orario libero di questo giorno.', ev.time)}</Body>
      {ev.with?.length ? <Body small muted style={{ marginBottom: 8 }}>{tl('Chi partecipa riceve una notifica e deve accettare il nuovo orario.')}</Body> : null}
      {starts.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{starts.map((s) => <Pill key={s} label={s} onPress={() => move(s)} />)}</View> : <Body small muted>{tl('Non c\'è un orario libero in questo giorno: spostalo dal Plan a un altro giorno.')}</Body>}
    </Sheet>
  );
}

/** Le riunioni degli altri che si scontrano con un tuo impegno: scegli quale spostare. Compare nel Plan e nel Workspace. */
export function ConflictCard({ team }: { team?: string }) {
  const all = useConflicts((s) => s.clashes);
  const people = usePeople((s) => (team ? s.people[team] : undefined)) ?? [];
  const list = all.filter((c) => !team || c.team === team);
  const [move, setMove] = useState<{ day: string; idx: number } | null>(null);
  if (!list.length) return null;
  const who = (id?: string) => people.find((p) => p.user_id === id)?.name || tl('L\'organizzatore');
  return (
    <Card>
      <H>Due impegni nello stesso momento</H>
      {list.map((c) => (
        <View key={c.id} style={{ marginTop: 10 }}>
          <Body bold>{tl('«{0}» ({1}) si sovrappone a «{2}» ({3})', c.title, c.time, c.otherTitle, c.otherTime)}</Body>
          <Body small muted>{tl('{0} ti ha invitato: uno dei due va spostato.', who(c.by))}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <Btn small icon="clock" title={tl('Sposto «{0}»', c.otherTitle.slice(0, 18))} onPress={() => setMove({ day: c.otherDay, idx: c.otherIdx })} />
            <Btn small ghost title="Chiedo di spostare la riunione" onPress={() => { void sendMessage(c.team, 'general', `@${who(c.by).split(' ')[0]} ${tl('non riesco alle {0} del {1} per «{2}»: possiamo spostare «{3}»?', c.time, c.day, c.otherTitle, c.title)}`, { mentions: c.by ? [c.by] : [] }).then((r) => toast(r.ok ? 'Messaggio inviato nel canale Generale' : r.message)); }} />
            <Btn small ghost title="Ignora" onPress={() => useConflicts.getState().set({ ignored: [...useConflicts.getState().ignored, c.id], clashes: useConflicts.getState().clashes.filter((x) => x.id !== c.id) })} />
          </View>
        </View>
      ))}
      {move ? <MoveEvent day={move.day} idx={move.idx} onClose={() => setMove(null)} onDone={() => useConflicts.getState().set({ clashes: useConflicts.getState().clashes.filter((x) => !(x.otherDay === move.day && x.otherIdx === move.idx)) })} /> : null}
    </Card>
  );
}
