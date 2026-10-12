import { View } from 'react-native';

import { Badge, UserAvatar } from '@/components/network';
import { Body, Card, H, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { canSeeParticipants, summarizeParticipants } from '@/lib/booking';
import { fmtDateTime } from '@/lib/when';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { t as tl } from '@/i18n/core';

/** Partecipanti di un seminario e chi ha pagato: lo vede SOLO chi lo ha creato. */
export function ParticipantsCard({ seminarId, host }: { seminarId: number; host: string }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const list = useNet((s) => s.participants?.[`seminar:${seminarId}`]) ?? [];
  if (!canSeeParticipants(me, host)) return null;
  const sum = summarizeParticipants(list);
  return (
    <Card>
      <H>Partecipanti</H>
      <Body small muted>{list.length ? tl('{0} iscritti · {1} hanno pagato · totale incassato {2} LP', sum.count, sum.paidCount, sum.totalPaid) : 'Ancora nessun iscritto.'}</Body>
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
      <Body small muted style={{ marginTop: 8 }}>Questo elenco lo vedi solo tu. I LifePoints restano bloccati fino alla fine del seminario.</Body>
    </Card>
  );
}
