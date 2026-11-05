import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Row } from '@/components/ui';
import { NewMeeting, type MeetingSeed } from '@/components/work/Meetings';
import { t as tl } from '@/i18n/core';
import { answerReschedule, markNotif, pullNotifs } from '@/lib/teamNotify';
import { useTeamNotifs, type TeamNotif } from '@/store/notifications';
import { toast } from '@/store/toast';

type Snap = { title?: string; dur?: number; agenda?: string; attendees?: string[]; project?: string | null; declined_by?: string };

/** Le notifiche di lavoro: chi ha spostato un impegno, chi non può, le riunioni annullate con «Riorganizza». Compare nel Plan e nel Workspace. */
export function TeamInbox({ team }: { team?: string }) {
  const all = useTeamNotifs((s) => s.items);
  const list = all.filter((n) => (!team || n.team_id === team) && !n.done);
  const [seed, setSeed] = useState<{ team: string; seed: MeetingSeed } | null>(null);
  useEffect(() => { void pullNotifs(); }, []);
  if (!list.length && !seed) return null;
  const answer = (n: TeamNotif, ok: boolean) => { void answerReschedule(String(n.data.reschedule), ok).then((r) => toast(!r.ok ? r.message : ok ? 'Accettato: l\'organizzatore è stato avvisato' : r.data === 'cancelled' ? 'Hai detto che non puoi: l\'incontro è stato annullato' : 'Hai detto che non puoi: l\'organizzatore è stato avvisato')); };
  const reorganize = (n: TeamNotif) => {
    const sn = (n.data.snapshot ?? {}) as Snap;
    setSeed({ team: n.team_id, seed: { title: sn.title, dur: sn.dur, agenda: sn.agenda, attendees: sn.attendees, project: sn.project ?? null } });
    void markNotif(n.id, { read: true, done: true });
  };
  return (
    <>
      {list.length ? (
        <Card>
          <H>Novità dal lavoro</H>
          {list.map((n) => (
            <View key={n.id} style={{ marginTop: 10 }}>
              <Body bold>{n.title}</Body>
              <Body small muted>{n.body}</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {n.kind === 'reschedule_ask' ? (
                  <><Btn small icon="check" title="Accetto" onPress={() => answer(n, true)} /><Btn small ghost title="Non posso" onPress={() => answer(n, false)} /></>
                ) : n.kind === 'cancelled' ? (
                  <><Btn small icon="clock" title="Riorganizza" onPress={() => reorganize(n)} /><Btn small ghost title="Ok" onPress={() => void markNotif(n.id, { read: true, done: true })} /></>
                ) : n.kind === 'reschedule_declined' ? (
                  <><Btn small ghost title="Vado avanti senza" onPress={() => void markNotif(n.id, { read: true, done: true })} /><Btn small icon="clock" title="Riorganizza" onPress={() => reorganize(n)} /></>
                ) : <Btn small ghost title="Ok" onPress={() => void markNotif(n.id, { read: true, done: true })} />}
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {seed ? <NewMeeting key={seed.seed.title} team={seed.team} open seed={seed.seed} onClose={() => setSeed(null)} onCreated={() => setSeed(null)} /> : null}
    </>
  );
}
