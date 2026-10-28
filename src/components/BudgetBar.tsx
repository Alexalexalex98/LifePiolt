import { View } from 'react-native';
import { Text } from '@/components/T';
import { Body, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { t as tl } from '@/i18n/core';
import { spendByCategory, useFin } from '@/store/finance';

/** In cima al Budget: quanto hai già speso del budget del mese, a colpo d'occhio. */
export function BudgetBar() {
  const t = useTheme();
  const f = useFin();
  const cur = f.months[0];
  const planned = Object.entries(f.budget.alloc).filter(([k]) => k !== 'Fondo emergenza').reduce((s, [, v]) => s + (v || 0), 0);
  if (!cur || planned <= 0) return null;
  const spent = Object.entries(spendByCategory([cur], f.categories)).filter(([k]) => k !== 'Fondo emergenza').reduce((s, [, v]) => s + v, 0);
  const r = spent / planned;
  const col = r > 1 ? t.danger : r > 0.85 ? t.warn : t.positive;
  const left = planned - spent;
  return (
    <Card>
      <Row><Body small bold muted>{tl('SPESO DEL BUDGET')}</Body><Text style={{ color: col, fontWeight: '800', fontSize: 15 }}>{Math.round(r * 100)}%</Text></Row>
      <View style={{ height: 14, borderRadius: 7, backgroundColor: t.item, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, r * 100)}%`, height: 14, borderRadius: 7, backgroundColor: col }} />
      </View>
      <Row style={{ marginTop: 8 }}>
        <Body small muted>{tl('Speso')} {formatMoney(Math.round(spent))}</Body>
        <Body small muted>{tl('Budget')} {formatMoney(Math.round(planned))}</Body>
      </Row>
      <Body small bold color={left < 0 ? t.danger : t.text} style={{ marginTop: 4 }}>{left < 0 ? `${tl('Hai superato il budget di')} ${formatMoney(Math.round(-left))}` : `${tl('Ti restano')} ${formatMoney(Math.round(left))}`}</Body>
    </Card>
  );
}
