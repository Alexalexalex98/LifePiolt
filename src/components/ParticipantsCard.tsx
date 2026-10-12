import { View } from 'react-native';

import { Badge, UserAvatar } from '@/components/network';
import { Body, Card, H, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { canSeeParticipants, summarizeParticipants } from '@/lib/booking';
import { fmtDateTime } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { t as tl } from '@/i18n/core';

export type PartKind = 'seminar' | 'service' | 'idea';
const COPY: Record<PartKind, { title: string; empty: string; note: string }> = {
  seminar: { title: 'Partecipanti', empty: 'Ancora nessun iscritto.', note: 'Questo elenco lo vedi solo tu. I LifePoints restano bloccati fino alla fine del seminario.' },
  service: { title: 'Prenotazioni', empty: 'Ancora nessuna prenotazione.', note: 'Questo elenco lo vedi solo tu. I LifePoints restano bloccati fino alla fine di ogni sessione.' },
  idea: { title: 'Chi ha contribuito', empty: 'Ancora nessun contributo.', note: 'Questo elenco lo vedi solo tu. I LifePoints restano bloccati finché non si raggiunge l\'obiettivo; se non lo raggiungi vengono rimborsati.' },
};

/** Chi ha pagato e quanto, per un seminario, un servizio o un\'idea: lo vede SOLO chi li ha creati. */
export function ParticipantsCard({ kind, refId, host }: { kind: PartKind; refId: string | number; host: string }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const list = useNet((s) => s.participants?.[`${kind}:${refId}`]) ?? [];
  if (!canSeeParticipants(me, host)) return null;
  const sum = summarizeParticipants(list);
  const c = COPY[kind];
  return (
    <Card>
      <H>{c.title}</H>
      <Body small muted>{list.length ? (kind === 'idea' ? tl('{0} persone · totale {1} LP', sum.count, sum.totalPaid) : tl('{0} iscritti · {1} hanno pagato · totale incassato {2} LP', sum.count, sum.paidCount, sum.totalPaid)) : c.empty}</Body>
      <View style={{ marginTop: 8 }}>
        {list.map((p, i) => (
          <Item key={p.name + i} last={i === list.length - 1}>
            <Row gap={10}>
              <UserAvatar name={p.name} size={32} />
              <View style={{ flex: 1 }}><Body bold>{p.name}</Body><Body small muted>{fmtDateTime(p.paidAt)}</Body></View>
              <Badge label={p.paid > 0 ? tl('Pagato {0} LP', p.paid) : 'Gratuito'} color={p.paid > 0 ? t.positive : t.muted} />
            </Row>
          </Item>
        ))}
      </View>
      <Body small muted style={{ marginTop: 8 }}>{c.note}</Body>
    </Card>
  );
}
