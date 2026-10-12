import { useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';

import { Badge, LpTag } from '@/components/network';
import { Body, Btn, Card, H, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { STATE_LABEL, invoiceFromEnrollment, invoiceFromOrder, invoiceText, type Invoice } from '@/lib/invoice';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { fmtDateTime } from '@/lib/when';
import { t as tl } from '@/i18n/core';

/** Fattura dell'acquisto: numero, venditore, importo e stato (bloccato fino alla fine dell'evento, poi accreditato). */
export default function InvoicePage() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const enrollments = useNet((s) => s.enrollments);
  const orders = useNet((s) => s.orders) ?? [];
  const [kind, ref] = id.split(':');
  const now = Date.now();
  let inv: Invoice | null = null;
  if (kind === 'enr') { const e = enrollments.find((x) => x.id === ref); if (e) inv = invoiceFromEnrollment(e, me, now); }
  if (kind === 'ord') { const o = orders.find((x) => x.id === ref); if (o) inv = invoiceFromOrder(o, me); }
  if (!inv) return <Page id="invoice" back title="Fattura"><Card><Body muted>Fattura non trovata.</Body></Card></Page>;
  const color = inv.state === 'bloccato' ? t.warn : inv.state === 'rimborsato' ? t.muted : t.positive;
  const lp = (n: number, bold = true) => <Row gap={2}><Body bold={bold}>{n}</Body><LpTag size={13} /></Row>;
  return (
    <Page id="invoice" back title="Fattura dell'acquisto">
      <Card>
        <Row><View style={{ flex: 1 }}><H>{inv.number}</H><Body small muted>{fmtDate(new Date(inv.issuedAt), { day: 'numeric', month: 'long', year: 'numeric' })}</Body></View><Badge label={STATE_LABEL[inv.state]} color={color} /></Row>
        <View style={{ marginTop: 10 }}>
          <Item><Row><Body muted>Acquirente</Body><Body bold>{inv.buyer}</Body></Row></Item>
          <Item last><Row><Body muted>Venditore</Body><Body bold>{inv.seller}</Body></Row></Item>
        </View>
      </Card>
      <Card>
        {inv.lines.map((l, i) => <Item key={i}><Row><Body style={{ flex: 1 }}>{l.qty > 1 ? `${l.qty} × ` : ''}{l.label}</Body>{lp(l.amount, false)}</Row></Item>)}
        {inv.discount > 0 && <Item><Row><Body muted style={{ flex: 1 }}>Sconto da contributo</Body><Row gap={2}><Body color={t.positive} bold>-{inv.discount}</Body><LpTag size={13} /></Row></Row></Item>}
        <Item last><Row><Body bold style={{ flex: 1 }}>Totale pagato</Body>{lp(inv.paid)}</Row></Item>
      </Card>
      {inv.state === 'bloccato' && inv.unlockAt && (
        <Card accent={t.warn}><Body bold>Bloccato</Body><Body small muted style={{ marginTop: 4 }}>{tl('I LifePoints vengono accreditati a {0} alla fine dell\'evento: {1}.', inv.seller, fmtDateTime(inv.unlockAt))}</Body></Card>
      )}
      <Card>
        <H>Condizioni</H>
        {inv.terms.map((x, i) => <Body key={i} small muted style={{ marginTop: i ? 4 : 0 }}>{x}</Body>)}
      </Card>
      <Btn icon="share" title="Condividi la fattura" onPress={async () => { try { await Share.share({ message: invoiceText(inv!) }); } catch { toast('Non riesco a condividere la fattura'); } }} />
      <Btn ghost style={{ marginTop: 8 }} icon="coin" title="I tuoi LifePoints" onPress={() => go('lifepointsPage')} />
    </Page>
  );
}
