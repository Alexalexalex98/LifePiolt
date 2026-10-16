import { View } from 'react-native';

import { Body, Btn, Card, H, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { diffDays } from '@/lib/bills/dates';
import { upcoming } from '@/lib/bills/plan';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFin } from '@/store/finance';
import { dueText, fmtDayShort, money, usePlan } from './shared';

/** Panoramica: prossime scadenze (max 3) e punto d'ingresso "Carica una bolletta o fattura". */
export function UpcomingBillsCard({ onOpen }: { onOpen: () => void }) {
  const th = useTheme();
  const invoices = useFin((s) => s.invoices);
  const { today, plan } = usePlan();
  const items = upcoming(invoices.filter((i) => i.state === 'open'), today, 45).slice(0, 3);
  return (
    <Card accent={plan.totalOverdue > 0 ? th.danger : undefined}>
      <Row>
        <View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>{t('Prossime scadenze')}</H></View>
        <Btn small ghost icon="plus" title="Carica bolletta" onPress={onOpen} />
      </Row>
      {items.length === 0 ? (
        <Body small muted style={{ marginTop: 6 }}>Carica una bolletta o una fattura: la leggo sul telefono, ti preparo il piano di pagamento e ti avviso prima della scadenza, così eviti i solleciti.</Body>
      ) : (
        <View style={{ marginTop: 6 }}>
          {items.map((it, i) => {
            const d = diffDays(today, it.dueDate);
            return (
              <Item key={`${it.key}-${i}`} last={i === items.length - 1} onPress={() => go('billDetail', { id: it.invoiceId })}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={1}>{it.issuer}</Body>
                    <Row gap={5} style={{ justifyContent: 'flex-start' }}>
                      {d < 0 ? <Icon name="alert" size={12} color={th.danger} stroke={2.2} /> : null}
                      <Body small color={d < 0 ? th.danger : th.muted}>{fmtDayShort(it.dueDate)} · {dueText(d)}</Body>
                    </Row>
                  </View>
                  <Body bold>{money(it.amount, it.currency)}</Body>
                </Row>
              </Item>
            );
          })}
        </View>
      )}
    </Card>
  );
}
