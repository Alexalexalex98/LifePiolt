import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Card, H, Item, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { readable } from '@/lib/a11y';
import type { PlanItem, PlanResult } from '@/lib/bills/plan';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { Note, adviceText, dueText, fmtDay, fmtWeekday, money, useStatusTone } from './shared';

/** Piano di pagamento: ordinato per scadenza, con "paga entro", liquidita' prevista e suggerimenti. Non decide e non paga nulla. */
export function PlanList({ plan, filterId, compact }: { plan: PlanResult; filterId?: string; compact?: boolean }) {
  const th = useTheme();
  const tone = useStatusTone();
  const items = plan.items.filter((x) => !filterId || x.invoiceId === filterId);
  if (!items.length) return <Body small muted>{t('Nessuna scadenza da pianificare.')}</Body>;
  const warn = (it: PlanItem) => it.shortfall != null;
  return (
    <View>
      {!filterId && plan.warnings.map((w) => {
        const lead = plan.items.filter((x) => w.keys.includes(x.key));
        const pen = lead.some((x) => x.hasPenalty);
        return (
          <View key={w.date} style={{ backgroundColor: th.dangerBg, borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <Row gap={8} style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
              <Icon name="alert" size={18} color={th.danger} stroke={2.1} />
              <View style={{ flex: 1 }}>
                <Body bold color={th.danger}>{t('Liquidità insufficiente il {0}: mancano {1}', fmtDay(w.date), money(w.missing))}</Body>
                <Body small color={th.text} style={{ marginTop: 2 }}>
                  {pen ? t('Dai la priorità alle voci con penali o interessi e sposta le altre.') : t('Puoi spostare qualche voce senza penali o chiedere una rateizzazione.')}
                </Body>
                {w.postpone.length > 0 && (
                  <Body small color={th.text} style={{ marginTop: 4 }}>
                    {t('Si potrebbero spostare: {0}.', w.postpone.map((k) => lead.find((x) => x.key === k)?.issuer ?? '').filter(Boolean).join(', '))}
                  </Body>
                )}
                <Body small muted style={{ marginTop: 4 }}>{t('Sono solo suggerimenti: decidi tu.')}</Body>
              </View>
            </Row>
          </View>
        );
      })}
      {items.map((it, i) => {
        const st = tone(it.status === 'scaduta' ? 'scaduta' : it.status === 'in_scadenza' ? 'in_scadenza' : 'da_pagare');
        return (
          <Item key={it.key} last={i === items.length - 1} onPress={filterId ? undefined : () => go('billDetail', { id: it.invoiceId })}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Body bold numberOfLines={2}>{it.issuer}{it.installment ? ` · ${t('rata {0}/{1}', it.installment.n, it.installment.of)}` : ''}</Body>
                <Row gap={6} style={{ justifyContent: 'flex-start', marginTop: 2 }}>
                  <Icon name="calendar" size={13} color={readable(st.fg, th.card)} stroke={2} />
                  <Text style={{ color: th.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>{it.status === 'scaduta' ? t('Paga subito') : t('Paga entro {0}', fmtWeekday(it.payBy))}</Text>
                </Row>
                <Body small muted>{t('Scadenza {0}', fmtDay(it.dueDate))} · {dueText(it.daysToDue)}</Body>
                {it.lateCost != null && it.lateCost > 0 && (
                  <Body small color={it.lateCostIsPotential ? th.muted : th.danger}>
                    {it.lateCostIsPotential ? t('Ritardo: penale stimata {0}', money(it.lateCost, it.currency)) : t('Costo del ritardo stimato: {0}', money(it.lateCost, it.currency))}
                  </Body>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Body bold>{money(it.amount, it.currency)}</Body>
                {!compact && it.balanceAfter != null && !it.foreign && (
                  <Body small color={warn(it) ? th.danger : th.muted}>{t('Resta {0}', money(it.balanceAfter))}</Body>
                )}
              </View>
            </Row>
            {it.foreign && <Note>{t('Valuta diversa dal saldo: non conteggiata nella liquidità.')}</Note>}
            {!compact && it.advice.map((a, k) => <Note key={k} icon={a.code === 'overdue_now' ? 'alert' : 'info'} tone={a.code === 'overdue_now' ? 'danger' : a.code === 'tight' ? 'warn' : 'muted'}>{adviceText(a)}</Note>)}
          </Item>
        );
      })}
    </View>
  );
}

export function PlanCard({ plan }: { plan: PlanResult }) {
  const th = useTheme();
  return (
    <Card>
      <H>{t('Piano di pagamento')}</H>
      <Body small muted style={{ marginBottom: 10 }}>
        {t('Ordinato per scadenza. «Paga entro» lascia i giorni lavorativi del bonifico (weekend e festività esclusi) e tiene conto del saldo, delle entrate e delle spese fisse stimate.')}
      </Body>
      {plan.minBalance && plan.minBalance.value < 0 ? (
        <Body small color={th.danger} style={{ marginBottom: 8 }}>{t('Saldo minimo previsto: {0} il {1}', money(plan.minBalance.value), fmtDay(plan.minBalance.date))}</Body>
      ) : null}
      <PlanList plan={plan} />
    </Card>
  );
}
