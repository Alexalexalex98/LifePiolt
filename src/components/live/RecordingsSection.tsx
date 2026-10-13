import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Card, H, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { ACCESS_LABEL, canWatch, lockedReason, recordingsOnProfile, type LiveRecording } from '@/lib/recordings';
import { clockLabel } from '@/lib/liveRoom';
import { useApp } from '@/store/app';
import { tierOf, useClub } from '@/store/club';
import { useLive } from '@/store/live';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { fmtDateTime } from '@/lib/when';
import { t as tl } from '@/i18n/core';

/** Ha pagato per questo seminario o servizio? (iscrizioni di chi guarda o elenco di chi organizza) */
export function useRecordingCtx(rec: LiveRecording) {
  const me = useApp((s) => s.account.name);
  const paid = useNet((s) => !!(s.participants?.[rec.key] ?? []).some((p) => p.name === me && p.paid > 0) || (s.enrollments ?? []).some((e) => `${e.kind}:${e.ref}` === rec.key && e.status !== 'declined' && (e.paid ?? e.price) > 0));
  const member = useClub((s) => (rec.clubId ? tierOf({ memberships: s.memberships }, rec.clubId, me) !== 'none' : false));
  return { viewer: me, paid, clubMember: member };
}

function Row1({ rec, last }: { rec: LiveRecording; last: boolean }) {
  const t = useTheme();
  const ctx = useRecordingCtx(rec);
  const ok = canWatch(rec, ctx);
  const why = lockedReason(rec);
  return (
    <Item last={last} onPress={() => (ok ? go('recordingPlayer', { id: rec.id }) : toast(why ?? 'Non disponibile'))}>
      <Row gap={12}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={ok ? 'play' : 'lock'} size={18} color={ok ? t.accent : t.muted} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{rec.title}</Text>
          <Body small muted>{`${clockLabel(rec.durationMs)} · ${fmtDateTime(rec.startedAt)}`}</Body>
          <Body small muted>{ok ? (ctx.viewer === rec.host ? tl('Visibile a: {0}', tl(ACCESS_LABEL[rec.access])) : tl('Puoi rivederla')) : tl(why ?? '')}</Body>
        </View>
      </Row>
    </Item>
  );
}

/** «Registrazioni» sul profilo di chi ha tenuto corsi e webinar: le rivede chi ha pagato (se chi li ha tenuti lo consente). */
export function RecordingsSection({ host }: { host: string }) {
  const me = useApp((s) => s.account.name);
  const all = useLive((s) => s.recordings) ?? [];
  const list = recordingsOnProfile(all, host, me);
  if (!list.length) return null;
  return (
    <Card>
      <H>Registrazioni</H>
      <Body small muted style={{ marginBottom: 6 }}>{host === me ? 'Le dirette che hai registrato: scegli chi può rivederle.' : 'Dirette registrate da questa persona: le rivede chi ha pagato.'}</Body>
      {list.map((r, i) => <Row1 key={r.id} rec={r} last={i === list.length - 1} />)}
    </Card>
  );
}

/** Registrazioni salvate in un LifeClub: le vedono chi lo gestisce, gli iscritti e chi ha pagato. */
export function ClubRecordings({ clubId }: { clubId: string }) {
  const all = useLive((s) => s.recordings) ?? [];
  const list = all.filter((r) => r.clubId === clubId && r.access === 'club').sort((a, b) => b.startedAt - a.startedAt);
  if (!list.length) return null;
  return (
    <Card>
      <H>Dirette registrate</H>
      {list.map((r, i) => <Row1 key={r.id} rec={r} last={i === list.length - 1} />)}
    </Card>
  );
}
