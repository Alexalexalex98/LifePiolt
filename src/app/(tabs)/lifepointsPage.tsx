import { Pressable, View } from 'react-native';

import { Flame } from '@/components/charts';
import { LpTag, UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Card, Empty, H, Item, Metric, Page, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { donationStreak, isWithinDays } from '@/lib/network';
import { escrowState, unlockAt } from '@/lib/booking';
import { settleEscrow } from '@/lib/escrow';
import { fmtDateTime } from '@/lib/when';
import { useNet } from '@/store/network';
import { useEffect } from 'react';
import { t as tl } from '@/i18n/core';
import { lpReceived } from '@/lib/network';
import { receiveLP, reverseLP, settleIncoming } from '@/lib/lpIncomingActions';
import { toast } from '@/store/toast';
import { useApp } from '@/store/app';

export default function LifePointsPage() {
  const t = useTheme();
  const net = useNet();
  const tab = net.prefs.lpTab;
  const streak = donationStreak();
  useEffect(() => { settleEscrow(); settleIncoming(); }, []);
  const me = useApp((a) => a.account.name);
  const demo = useApp((a) => a.demo);
  const inc = net.incoming ?? [];
  const arriving = lpReceived(me).blocked; // bloccati in arrivo: contano già sul profilo e sul conto
  const lastPaid = inc.find((i) => i.status !== 'reversed' && i.source !== 'giornaliero');
  const now = Date.now();
  const held = net.enrollments.filter((e) => e.held && escrowState(e, now) === 'bloccato');
  const heldRefs = new Set(held.map((e) => `enr:${e.id}`));
  const heldTotal = held.reduce((a, e) => a + (e.paid ?? 0), 0);
  const weekSpends = net.ledger.filter((l) => l.type === 'spend' && isWithinDays(l.date, 7));
  const weekDon = net.dailyHistory.filter((d) => isWithinDays(d.date, 7));
  const Amount = ({ n, sign, color }: { n: number; sign?: string; color?: string }) => <Row gap={2}><Body bold color={color}>{sign}{formatCHF(n)}</Body><LpTag size={13} /></Row>;
  return (
    <Page id="lifepointsPage" title="LifePoints" back>
      <Card style={{ alignItems: 'center' }}>
        <Body small muted>Il tuo saldo</Body>
        <Row gap={6}><Metric big>{formatCHF(net.lifePoints)}</Metric><LpTag size={28} /></Row>
        {arriving > 0 ? <Body small muted style={{ marginTop: 4 }}>{tl('+ {0} LP in arrivo (bloccati fino alla fine) · totale {1} LP', formatCHF(arriving), formatCHF(net.lifePoints + arriving))}</Body> : null}
        <Btn style={{ marginTop: 12, alignSelf: 'stretch' }} ghost title="Come ottenere LifePoints" onPress={() => openSheet('topup')} />
        <Btn style={{ marginTop: 8, alignSelf: 'stretch' }} icon="send" title="Pagamenti: invia e ricevi" onPress={() => go('payments')} />
        <Btn style={{ marginTop: 8, alignSelf: 'stretch' }} ghost icon="coin" title="Ritira LifePoints" onPress={() => go('withdraw')} />
        <Btn style={{ marginTop: 8, alignSelf: 'stretch' }} ghost icon="file" title="Rendiconto per la dichiarazione" onPress={() => go('lpStatement')} />
      </Card>
      {demo ? (
        <Card>
          <H>Prova (demo): LifePoints in arrivo</H>
          <Body small muted style={{ marginBottom: 8 }}>Simulo cosa succede quando qualcuno ti dona o ti paga: arrivano sul conto e sul profilo; se sono bloccati contano già come «in arrivo»; se non vengono accreditati vengono tolti.</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            <Btn small ghost title="Mi donano il LifePoint di oggi" onPress={() => { receiveLP({ from: 'Marta S.', label: 'LifePoint giornaliero', amount: 1, source: 'giornaliero' }); toast('Ricevuto 1 LP: controlla saldo e profilo'); }} />
            <Btn small ghost title="Mi pagano un servizio (40 LP)" onPress={() => { receiveLP({ from: 'Paolo D.', label: 'Allenamento alla corsa', amount: 40, source: 'iscrizioni' }); toast('Ricevuti 40 LP'); }} />
            <Btn small ghost title="Pagamento bloccato (40 LP)" onPress={() => { receiveLP({ from: 'Chiara V.', label: 'Allenamento alla corsa', amount: 40, source: 'iscrizioni', releaseAt: Date.now() + 60000 }); toast('40 LP in arrivo: bloccati per 1 minuto'); }} />
            <Btn small ghost danger title="Annulla l’ultimo pagamento" disabled={!lastPaid} onPress={() => { if (lastPaid && reverseLP(lastPaid.id)) toast('Pagamento annullato: LP tolti'); }} />
          </Row>
        </Card>
      ) : null}
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
      {held.length > 0 && (
        <Card accent={t.warn}>
          <Row><H>Bloccati</H><Amount n={heldTotal} /></Row>
          <Body small muted style={{ marginBottom: 6 }}>Pagati ma non ancora accreditati: li riceve chi organizza alla fine dell'evento.</Body>
          {held.map((e, i) => (
            <Item key={e.id} last={i === held.length - 1} onPress={() => go('invoice', { id: `enr:${e.id}` })}>
              <Row>
                <View style={{ flex: 1 }}><Body>{e.kind === 'seminar' ? `Seminario: ${e.title}` : `Sessione: ${e.title}`}</Body><Body small muted>{`Sblocco: ${fmtDateTime(unlockAt(e))}`}</Body></View>
                <Amount n={e.paid ?? 0} />
              </Row>
            </Item>
          ))}
        </Card>
      )}
      <Seg options={['Acquisti', 'Guadagnati', 'LifePoint giornaliero']} value={tab} onChange={(v) => net.setPref('lpTab', v)} />
      {tab === 'Acquisti' && (() => {
        const rows = net.ledger.filter((l) => l.type === 'spend' && !(l.ref && heldRefs.has(l.ref)));
        return <Card>{rows.length ? rows.map((l, i) => <Item key={i} last={i === rows.length - 1} onPress={l.ref ? () => go('invoice', { id: l.ref! }) : undefined}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}{l.ref ? ' · Fattura' : ''}</Body></View><Amount n={l.amount} sign="-" color={t.danger} /></Row></Item>) : <Empty text="Ancora nessun acquisto: quando prenoti un servizio o sostieni un'idea, lo trovi qui." />}</Card>;
      })()}
      {tab === 'Guadagnati' && (() => {
        const rows = net.ledger.filter((l) => l.type === 'topup');
        return <Card>{rows.length ? rows.map((l, i) => <Item key={i} last={i === rows.length - 1}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}</Body></View><Amount n={l.amount} sign="+" color={t.positive} /></Row></Item>) : <Empty text={'Ancora nessun LifePoint guadagnato.'} />}</Card>;
      })()}
      {tab === 'LifePoint giornaliero' && (
        <Card>{net.dailyHistory.length ? net.dailyHistory.map((d, i) => (
          <Item key={i} last={i === net.dailyHistory.length - 1}><Row><Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => go('userProfile', { name: d.to })}><UserAvatar name={d.to} size={26} /><Body>{d.to}</Body></Pressable><Body small muted>{d.date}</Body></Row></Item>
        )) : <Empty text="Non hai ancora donato il LifePoint di oggi: c'è sempre qualcuno che ha reso migliore la tua giornata." />}</Card>
      )}
    </Page>
  );
}
