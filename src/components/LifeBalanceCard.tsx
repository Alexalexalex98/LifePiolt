import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';
import { Body, Card, H, Metric, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { computeDashboard } from '@/lib/analyticsData';
import { buildBalance, type BalanceCat, type BalanceLevel } from '@/lib/lifeBalance';

const WORD: Record<BalanceLevel, string> = { ok: 'In equilibrio', attenzione: 'Da curare', carenza: 'Carenza' };

/** «La tua vita in un dato»: un solo punteggio, scomposto in categorie con dove sei carente, i dettagli e come migliorare. */
export function LifeBalanceCard() {
  const t = useTheme();
  const b = buildBalance(computeDashboard().list);
  const [open, setOpen] = useState<BalanceCat | null>(null);
  const col = (l: BalanceLevel) => (l === 'ok' ? '#5fd39a' : l === 'attenzione' ? '#ffb020' : t.danger);
  const Row2 = ({ c }: { c: BalanceCat }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${tl(c.label)}: ${c.score}`} onPress={() => setOpen(c)} style={{ paddingVertical: 8 }}>
      <Row><Body bold>{tl(c.label)}</Body><Body bold style={{ color: col(c.level) }}>{c.score}</Body></Row>
      <Progress value={c.score} color={col(c.level)} />
    </Pressable>
  );
  return (
    <Card accent={b.score != null ? col(b.level) : undefined}>
      <Row><H>La tua vita in un dato</H><Metric big color={b.score != null ? col(b.level) : undefined}>{b.score ?? '—'}</Metric></Row>
      {b.score != null ? <Text style={{ color: col(b.level), fontWeight: '800', marginTop: 2 }}>{tl(WORD[b.level])}</Text> : null}
      <Body style={{ marginTop: 6 }}>{tl(b.headline)}</Body>
      {b.weakest.length ? <Body bold style={{ marginTop: 12 }}>{tl('Dove sei carente')}</Body> : null}
      {b.weakest.map((c) => <Row2 key={c.id} c={c} />)}
      {b.cats.length > b.weakest.length ? <Body bold style={{ marginTop: 12 }}>{tl('Dove va bene')}</Body> : null}
      {b.cats.filter((c) => c.score >= 75).map((c) => <Row2 key={c.id} c={c} />)}
      {b.missing.length ? <Body small muted style={{ marginTop: 10 }}>{tl('Mancano i dati per: {0}. Collega Apple Health o registra qualcosa per vederli qui.', b.missing.map((m) => tl(m)).join(', '))}</Body> : null}
      <Body small muted style={{ marginTop: 8 }}>{tl('Il punteggio mette insieme i dati che hai già nell\'app. Sono indicazioni generali, non un parere medico.')}</Body>
      <Sheet visible={!!open} title={open ? tl(open.label) : ''} onClose={() => setOpen(null)}>
        {open ? (
          <View>
            <Row><Metric big color={col(open.level)}>{open.score}</Metric><Text style={{ color: col(open.level), fontWeight: '800' }}>{tl(WORD[open.level])}</Text></Row>
            <Body muted style={{ marginTop: 4 }}>{tl(open.about)}</Body>
            <Body style={{ marginTop: 10 }}>{tl(open.why)}</Body>
            <Body bold style={{ marginTop: 14 }}>{tl('I dati')}</Body>
            {open.lines.map((l, i) => (
              <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                <Row><Body>{tl(l.label)}</Body><Body bold style={{ color: col(l.level) }}>{l.value}</Body></Row>
                {l.goal ? <Body small muted>{tl('Obiettivo: {0}', l.goal)}</Body> : null}
                {l.trend ? <Body small muted>{tl(l.trend)}</Body> : null}
              </View>
            ))}
            <Body bold style={{ marginTop: 14 }}>{tl('Come migliorare')}</Body>
            {open.tips.map((tip, i) => <Body key={i} style={{ marginTop: 6 }}>{'• '}{tl(tip)}</Body>)}
          </View>
        ) : null}
      </Sheet>
    </Card>
  );
}
