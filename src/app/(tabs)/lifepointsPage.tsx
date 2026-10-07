import { Pressable, View } from 'react-native';

import { Flame } from '@/components/charts';
import { LpTag, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, Item, Metric, Page, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { donationStreak, isWithinDays } from '@/lib/network';
import { useNet } from '@/store/network';

export default function LifePointsPage() {
  const t = useTheme();
  const net = useNet();
  const tab = net.prefs.lpTab;
  const streak = donationStreak();
  const weekSpends = net.ledger.filter((l) => l.type === 'spend' && isWithinDays(l.date, 7));
  const weekDon = net.dailyHistory.filter((d) => isWithinDays(d.date, 7));
  const Amount = ({ n, sign, color }: { n: number; sign?: string; color?: string }) => <Row gap={2}><Body bold color={color}>{sign}{formatCHF(n)}</Body><LpTag size={13} /></Row>;
  return (
    <Page id="lifepointsPage" title="LifePoints" back>
      <Card style={{ alignItems: 'center' }}>
        <Body small muted>Il tuo saldo</Body>
        <Row gap={6}><Metric big>{formatCHF(net.lifePoints)}</Metric><LpTag size={28} /></Row>
        <Btn style={{ marginTop: 12, alignSelf: 'stretch' }} title="+ Carica LifePoints" onPress={() => openSheet('topup')} />
      </Card>
      <Card style={{ alignItems: 'center' }}>
        <Body small muted style={{ marginBottom: 10 }}>Streak LifePoint giornaliero</Body>
        <Flame streak={streak} size={56} />
        <Body bold style={{ fontSize: 21, marginTop: 8 }}>{streak} giorni</Body>
      </Card>
      <Card>
        <H>Il tuo riepilogo settimanale</H>
        <Item><Row><Body>LP spesi questa settimana</Body><Amount n={weekSpends.reduce((s, l) => s + l.amount, 0)} /></Row></Item>
        <Item><Row><Body>LifePoint giornaliero donato</Body><Body bold>{weekDon.length}/7 giorni</Body></Row></Item>
        <Item last><Row><Body>Acquisti effettuati</Body><Body bold>{weekSpends.length}</Body></Row></Item>
      </Card>
      <Seg options={['Acquisti', 'Ricariche', 'LifePoint giornaliero']} value={tab} onChange={(v) => net.setPref('lpTab', v)} />
      {tab === 'Acquisti' && (() => {
        const rows = net.ledger.filter((l) => l.type === 'spend');
        return <Card>{rows.length ? rows.map((l, i) => <Item key={i} last={i === rows.length - 1}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}</Body></View><Amount n={l.amount} sign="-" color={t.danger} /></Row></Item>) : <Empty text="Ancora nessun acquisto: quando prenoti un servizio o sostieni un'idea, lo trovi qui." />}</Card>;
      })()}
      {tab === 'Ricariche' && (() => {
        const rows = net.ledger.filter((l) => l.type === 'topup');
        return <Card>{rows.length ? rows.map((l, i) => <Item key={i} last={i === rows.length - 1}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}</Body></View><Amount n={l.amount} sign="+" color={t.positive} /></Row></Item>) : <Empty text={'Ancora nessuna ricarica: tocca "Carica LifePoints" qui sopra per iniziare.'} />}</Card>;
      })()}
      {tab === 'LifePoint giornaliero' && (
        <Card>{net.dailyHistory.length ? net.dailyHistory.map((d, i) => (
          <Item key={i} last={i === net.dailyHistory.length - 1}><Row><Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => go('userProfile', { name: d.to })}><UserAvatar name={d.to} size={26} /><Body>{d.to}</Body></Pressable><Body small muted>{d.date}</Body></Row></Item>
        )) : <Empty text="Non hai ancora donato il LifePoint di oggi: c'è sempre qualcuno che ha reso migliore la tua giornata." />}</Card>
      )}
    </Page>
  );
}
