import { View } from 'react-native';

import { Body, Btn, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import type { ExplainRow } from '@/lib/explain';

/** «Da dove arriva questo numero?»: la formula e i movimenti dell'estratto che lo compongono. */
export function ExplainSheet({ visible, title, formula, rows, total, action, onClose }: { visible: boolean; title: string; formula?: string; rows: ExplainRow[]; total?: number; action?: { label: string; onPress: () => void }; onClose: () => void }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {formula ? <Body small muted style={{ marginBottom: 8 }}>{formula}</Body> : null}
      {action ? <Btn style={{ marginBottom: 10 }} title={action.label} onPress={action.onPress} /> : null}
      {rows.length ? (
        <View>
          {rows.slice(0, 80).map((r, i) => (
            <Item key={i} last={i === Math.min(rows.length, 80) - 1}>
              <Row>
                <View style={{ flex: 1 }}><Body small muted>{r.date}</Body><Body numberOfLines={2}>{r.label}</Body></View>
                <Body bold color={r.amount > 0 ? t.positive : t.text}>{r.amount > 0 ? '+' : ''}{formatMoney(r.amount, { decimals: 2 })}</Body>
              </Row>
            </Item>
          ))}
          {rows.length > 80 ? <Body small muted style={{ marginTop: 6 }}>… e altri {rows.length - 80} movimenti.</Body> : null}
          {total !== undefined ? <Row style={{ marginTop: 10 }}><Body bold>Totale</Body><Body bold>{formatMoney(total, { decimals: 2 })}</Body></Row> : null}
        </View>
      ) : <Body small muted>Nessun movimento da mostrare.</Body>}
    </Sheet>
  );
}
