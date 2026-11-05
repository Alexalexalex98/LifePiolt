import { useMemo } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { freeStarts, rangeOf } from '@/lib/conflicts';
import { sendMessage } from '@/lib/teamComms';
import { usePeople } from '@/store/people';
import { pushWorkEvent } from '@/lib/teamWork';
import { useConflicts } from '@/store/conflicts';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { useState } from 'react';

/** Sposta un tuo impegno a un altro orario libero dello stesso giorno (se è un impegno di lavoro condiviso, lo aggiorna anche per gli altri). */
export function MoveEvent({ day, idx, onClose, onDone }: { day: string; idx: number; onClose: () => void; onDone?: () => void }) {
  const ev = useLife((s) => s.events[day]?.[idx]);
  const list = useLife((s) => s.events[day]) ?? [];
  const starts = useMemo(() => (ev ? freeStarts(list.filter((_, i) => i !== idx).filter((e) => /^\d{1,2}:\d{2}$/.test(e.time) && (e.dur ?? 60) < 1440).map(rangeOf), ev.dur ?? 60) : []), [list, idx, ev]);
  if (!ev) return null;
  const move = (time: string) => { useLife.getState().patchEvent(day, idx, { time }); if (ev.team && ev.wid) void pushWorkEvent(day, { ...ev, time }); toast(tl('«{0}» spostato alle {1}', ev.title, time)); onDone?.(); onClose(); };
  return (
    <Sheet visible title={tl('Sposta «{0}»', ev.title)} onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Ora è alle {0}. Scegli un altro orario libero di questo giorno.', ev.time)}</Body>
      {starts.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{starts.slice(0, 16).map((s) => <Pill key={s} label={s} onPress={() => move(s)} />)}</View> : <Body small muted>{tl('Non c\'è un orario libero in questo giorno: spostalo dal Plan a un altro giorno.')}</Body>}
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
