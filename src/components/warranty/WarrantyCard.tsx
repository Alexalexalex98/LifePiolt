import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { openDocument } from '@/lib/openDoc';
import { durationLabel, nextExpiry, productExpiry, progress, purchaseTitle, remaining, statusOf, type Purchase, type Status } from '@/lib/warranty';

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const money = (n: number, c: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
export const STATUS_LABEL: Record<Status, string> = { attiva: 'Attiva', 'in scadenza': 'In scadenza', scaduta: 'Scaduta' };

/** Una scheda per acquisto: il nome di tutti i prodotti e, per ognuno, i dati e il conto alla rovescia dalla data di acquisto alla scadenza. */
export function WarrantyCard({ p, today, onEdit, onDelete }: { p: Purchase; today: string; onEdit: () => void; onDelete: () => void }) {
  const th = useTheme();
  const color = (s: Status) => (s === 'attiva' ? '#22c55e' : s === 'in scadenza' ? '#f59e0b' : th.danger);
  const worst = statusOf(nextExpiry(p, today), today);
  return (
    <Card accent={color(worst)}>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${color(worst)}22`, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={20} color={color(worst)} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{purchaseTitle(p)}</Text>
          <Body small muted>{[p.store, `${tl('acquistato il')} ${fmt(p.date)}`, p.total != null ? money(p.total, p.currency) : ''].filter(Boolean).join(' · ')}</Body>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: `${color(worst)}22` }}><Text style={{ color: color(worst), fontWeight: '800', fontSize: 12 }}>{tl(STATUS_LABEL[worst])}</Text></View>
      </Row>
      {p.products.map((x) => {
        const ex = productExpiry(p, x); const st = statusOf(ex, today); const rem = remaining(today, ex); const pr = Math.round(progress(p.date, ex, today) * 100);
        return (
          <View key={x.id} style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: th.border }}>
            {p.products.length > 1 ? <Text style={{ color: th.text, fontSize: 15, fontWeight: '800' }}>{x.name}</Text> : null}
            {[[x.brand, x.model].filter(Boolean).join(' · '), x.serial ? `${tl('N. di serie')}: ${x.serial}` : '', x.price != null ? `${tl('Prezzo')}: ${money(x.price, p.currency)}` : ''].filter(Boolean).map((l, i) => <Body key={i} small muted>{l}</Body>)}
            <Row style={{ marginTop: 6 }}><Body small style={{ flex: 1 }}>{`${tl('Garanzia di')} ${durationLabel(x.months)}${x.assumed ? ` (${tl('da controllare')})` : ''}`}</Body><Body small bold>{`${tl('scade il')} ${fmt(ex)}`}</Body></Row>
            <Text style={{ color: color(st), fontSize: 20, fontWeight: '800', marginTop: 6 }} accessibilityLiveRegion="polite">{tl(rem.label)}</Text>
            <View style={{ marginTop: 8 }}><Progress value={pr} color={color(st)} /></View>
            <Row style={{ marginTop: 4 }}><Body small muted style={{ flex: 1 }}>{`${tl('Acquisto')} ${fmt(p.date)}`}</Body><Body small muted>{`${pr}%`}</Body></Row>
          </View>
        );
      })}
      <Row style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {p.pdf ? <Btn small icon="file" title="Fattura (PDF)" onPress={() => { void openDocument({ uri: p.pdf, name: `${purchaseTitle(p)}.pdf`, mime: 'application/pdf' }); }} /> : null}
        <Btn small ghost icon="edit" title="Modifica" onPress={onEdit} />
        <Btn small ghost danger icon="trash" title="" onPress={onDelete} />
      </Row>
    </Card>
  );
}
