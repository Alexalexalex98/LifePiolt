import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Item, Metric, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import { readable } from '@/lib/a11y';
import { diffDays } from '@/lib/bills/dates';
import { nextDueDate, sortInvoices, statusOf, summarize, upcoming } from '@/lib/bills/plan';
import { KIND_LABEL, STATUS_LABEL, type BillStatus } from '@/lib/bills/types';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFin } from '@/store/finance';
import { AddBillSheet } from './AddBillSheet';
import { PlanCard } from './PlanCard';
import { ReminderPrefsSheet } from './ReminderPrefsSheet';
import { StatusPill, dueText, fmtDay, money, usePlan, useStatusTone } from './shared';

const FILTERS: ('Tutte' | BillStatus)[] = ['Tutte', 'da_pagare', 'in_scadenza', 'scaduta', 'rateizzata', 'contestata', 'pagata'];

/** Barra delle scadenze dei prossimi 30 giorni: ogni tacca e' una bolletta (scadute a sinistra). */
function UpcomingBar({ today, items }: { today: string; items: ReturnType<typeof upcoming> }) {
  const th = useTheme();
  const tone = useStatusTone();
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <View accessible accessibilityLabel={t('Prossime scadenze: {0}', items.length)} style={{ height: 30, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: th.item }} />
        {items.map((it, ix) => {
          const d = diffDays(today, it.dueDate);
          const pct = Math.max(0, Math.min(100, (Math.max(0, d) / 30) * 100));
          const c = tone(d < 0 ? 'scaduta' : d <= 7 ? 'in_scadenza' : 'da_pagare').fg;
          return <View key={`${it.key}-${ix}`} style={{ position: 'absolute', start: `${Math.min(pct, 97)}%`, top: 5, width: 12, height: 20, borderRadius: 6, backgroundColor: readable(c, th.card), borderWidth: 2, borderColor: th.card }} />;
        })}
      </View>
      <Row style={{ marginTop: 2 }}>
        <Body small muted>{t('Oggi')}</Body>
        <Body small muted>{t('+30 giorni')}</Body>
      </Row>
    </View>
  );
}

/** Sezione "Da pagare" della scheda Bollette: totale, barra, filtri, lista, piano e impostazioni. */
export function BillsSection() {
  const th = useTheme();
  const invoices = useFin((s) => s.invoices);
  const prefs = useFin((s) => s.billPrefs);
  const { today, plan } = usePlan();
  const [filter, setFilter] = useState<'Tutte' | BillStatus>('Tutte');
  const [add, setAdd] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [settings, setSettings] = useState(false);

  const counts = useMemo(() => summarize(invoices, today, prefs.soonDays), [invoices, today, prefs.soonDays]);
  const list = useMemo(() => sortInvoices(invoices).filter((i) => filter === 'Tutte' || statusOf(i, today, prefs.soonDays) === filter), [invoices, filter, today, prefs.soonDays]);
  const near = useMemo(() => upcoming(invoices.filter((i) => i.state === 'open'), today, 30), [invoices, today]);
  const open = invoices.filter((i) => i.state === 'open').length;

  return (
    <>
      <Card>
        <Row>
          <View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>{t('Da pagare')}</H></View>
          <Btn small ghost icon="settings" title="Promemoria" onPress={() => setSettings(true)} />
        </Row>
        <Body small muted style={{ marginTop: 2 }}>{t('Carica bollette e fatture: le leggo sul telefono, le inserisci tu con un controllo e ti avviso prima delle scadenze.')}</Body>
        <View style={{ marginTop: 12 }}>
          <Body small muted>{t('Da pagare nei prossimi 30 giorni')}</Body>
          <Metric>{money(plan.totalNext30)}</Metric>
          {plan.totalOverdue > 0 && (
            <Row gap={6} style={{ justifyContent: 'flex-start', marginTop: 4 }}>
              <Icon name="alert" size={15} color={th.danger} stroke={2.2} />
              <Body small bold color={th.danger}>{t('Già scadute: {0}', money(plan.totalOverdue))}</Body>
            </Row>
          )}
        </View>
        <UpcomingBar today={today} items={near} />
        <Btn style={{ marginTop: 14 }} icon="plus" title="Aggiungi bolletta o fattura" onPress={() => setAdd(true)} />
      </Card>

      {invoices.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {FILTERS.map((f) => {
              const n = f === 'Tutte' ? invoices.length : counts[f];
              if (f !== 'Tutte' && f !== filter && n === 0) return null;
              return <Pill key={f} label={`${f === 'Tutte' ? t('Tutte') : t(STATUS_LABEL[f])} · ${n}`} on={filter === f} onPress={() => setFilter(f)} />;
            })}
          </View>
          {list.length === 0 ? <Empty text="Nessuna bolletta con questo stato." /> : list.map((inv, i) => {
            const st = statusOf(inv, today, prefs.soonDays);
            const nd = nextDueDate(inv) ?? inv.dueDate;
            const dd = nd ? diffDays(today, nd) : null;
            return (
              <Item key={`${inv.id}-${i}`} last={i === list.length - 1} onPress={() => go('billDetail', { id: inv.id })}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Body bold numberOfLines={2}>{inv.issuer}</Body>
                    <Body small muted>
                      {t(KIND_LABEL[inv.kind])}
                      {inv.state === 'paid' ? ` · ${t('pagata il {0}', fmtDay(inv.paidAt))}` : nd ? ` · ${t('scadenza {0}', fmtDay(nd))}` : ` · ${t('senza scadenza')}`}
                    </Body>
                    {inv.state === 'open' && dd != null ? <Text style={{ color: dd < 0 ? th.danger : th.muted, fontSize: 12, fontWeight: dd < 0 ? '700' : '400' }}>{dueText(dd)}{inv.estimated ? ` · ${t('stimata')}` : ''}</Text> : null}
                    <StatusPill status={st} />
                  </View>
                  <Body bold>{money(inv.amount, inv.currency)}</Body>
                </Row>
              </Item>
            );
          })}
        </Card>
      )}

      {open > 0 && (
        <Card>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold>{t('Piano di pagamento')}</Body>
              <Body small muted>{t('Quando pagare ogni voce, tenendo conto di saldo ed entrate.')}</Body>
            </View>
            <Btn small ghost title={showPlan ? 'Nascondi' : 'Mostra'} onPress={() => setShowPlan((v) => !v)} />
          </Row>
          {plan.warnings.length > 0 && !showPlan && (
            <Row gap={6} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <Icon name="alert" size={15} color={th.danger} stroke={2.2} />
              <Body small color={th.danger} style={{ flex: 1 }}>{t('Liquidità insufficiente il {0}: mancano {1}', fmtDay(plan.warnings[0].date), money(plan.warnings[0].missing))}</Body>
            </Row>
          )}
        </Card>
      )}
      {showPlan && open > 0 && <PlanCard plan={plan} />}
      {invoices.length === 0 && (
        <Card>
          <Empty text="Nessuna bolletta da pagare. Aggiungine una e preparo il piano e i promemoria." />
        </Card>
      )}

      <AddBillSheet visible={add} onClose={() => setAdd(false)} />
      <ReminderPrefsSheet visible={settings} onClose={() => setSettings(false)} />
    </>
  );
}
