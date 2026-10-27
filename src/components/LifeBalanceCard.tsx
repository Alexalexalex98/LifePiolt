import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';
import { InfoTip } from '@/components/InfoTip';
import { Body, Card, H, Metric, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { computeDashboard } from '@/lib/analyticsData';
import { type BalanceCat, type BalanceLevel } from '@/lib/lifeBalance';

const WORD: Record<BalanceLevel, string> = { ok: 'In equilibrio', attenzione: 'Da curare', carenza: 'Carenza' };
const WEIGHT = (w: number) => (w >= 1.25 ? tl('molto') : w >= 1 ? tl('normale') : tl('un po\' meno'));

/** Il corpo di «La tua vita in un dato»: punteggio, dove sei carente, dove va bene. Con una «i» su ogni voce che spiega cos'è e come si calcola. */
export function LifeBalanceBody() {
  const t = useTheme();
  const b = computeDashboard().balance;
  const [open, setOpen] = useState<BalanceCat | null>(null);
  const col = (l: BalanceLevel) => (l === 'ok' ? '#5fd39a' : l === 'attenzione' ? '#ffb020' : t.danger);
  const Rw = ({ c }: { c: BalanceCat }) => (
    <View style={{ paddingVertical: 8 }}>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={`${tl(c.label)}: ${c.score}`} onPress={() => setOpen(c)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Body bold>{tl(c.label)}</Body>
        </Pressable>
        <InfoTip title={tl(c.label)} body={[
          tl(c.about), `${tl('Come si calcola')}: ${tl(c.how)}`, `${tl('Valore di riferimento')}: ${tl(c.ref)}`,
          `${tl('Peso sul punteggio')}: ${WEIGHT(c.weight)}.`, c.score < 75 ? tl(c.why) : tl('Tutti i dati di questa categoria sono nei valori consigliati.'),
        ]} />
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri {0}', tl(c.label))} onPress={() => setOpen(c)} style={{ minWidth: 38, alignItems: 'flex-end' }}>
          <Body bold style={{ color: col(c.level) }}>{c.score}</Body>
        </Pressable>
      </Row>
      <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri {0}', tl(c.label))} onPress={() => setOpen(c)}><Progress value={c.score} color={col(c.level)} /></Pressable>
    </View>
  );
  return (
    <View>
      <Row>
        <View style={{ flex: 1 }}>
          {b.score != null ? <Text style={{ color: col(b.level), fontWeight: '800' }}>{tl(WORD[b.level])}</Text> : null}
        </View>
        <InfoTip title={tl('Come si calcola il punteggio')} body={[
          tl('Il punteggio (0-100) mette insieme tutti i dati che hai già nell\'app: sono la media delle categorie qui sotto, e ognuna pesa in modo diverso.'),
          ...b.cats.map((c) => `• ${tl(c.label)}: ${c.score} (${tl('peso')} ${WEIGHT(c.weight)})`),
          tl('80-100 = in equilibrio · 60-79 = buono, con margini · sotto 60 = serve attenzione. Le categorie senza dati non contano finché non li inserisci.'),
        ]} />
      </Row>
      <Body style={{ marginTop: 6 }}>{tl(b.headline)}</Body>
      {b.weakest.length ? <Body bold style={{ marginTop: 12 }}>{tl('Dove sei carente')}</Body> : null}
      {b.weakest.map((c) => <Rw key={c.id} c={c} />)}
      {b.cats.length > b.weakest.length ? <Body bold style={{ marginTop: 12 }}>{tl('Dove va bene')}</Body> : null}
      {b.cats.filter((c) => c.score >= 75).map((c) => <Rw key={c.id} c={c} />)}
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
    </View>
  );
}

/** «La tua vita in un dato»: un solo punteggio, scomposto in categorie con dove sei carente, i dettagli e come migliorare. */
export function LifeBalanceCard() {
  const t = useTheme();
  const b = computeDashboard().balance;
  const col = b.level === 'ok' ? '#5fd39a' : b.level === 'attenzione' ? '#ffb020' : t.danger;
  return (
    <Card accent={b.score != null ? col : undefined}>
      <Row><H>La tua vita in un dato</H><Metric big color={b.score != null ? col : undefined}>{b.score ?? '—'}</Metric></Row>
      <LifeBalanceBody />
    </Card>
  );
}
