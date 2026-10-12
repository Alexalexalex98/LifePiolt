import { useState } from 'react';
import { View } from 'react-native';

import { LpTag } from '@/components/network';
import { Body, Btn, Card, H, Input, Page, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { WITHDRAW_FEE_PCT, withdrawFee } from '@/lib/lpStatement';
import { myWithdrawInfo, withdrawLp } from '@/lib/lpActions';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

const lp = (n: number) => <Row gap={2}><Body bold>{n}</Body><LpTag size={13} /></Row>;

/** Ritiro dei LifePoints in denaro: commissione del 5% solo qui, spiegata prima. Gli utenti normali devono prima raggiungere gli obiettivi. */
export default function Withdraw() {
  const t = useTheme();
  useNet((s) => s.lpMoves);
  useNet((s) => s.receivedDaily);
  const balance = useNet((s) => s.lifePoints);
  const info = myWithdrawInfo();
  const [amt, setAmt] = useState('');
  const a = Math.floor(parseFloat(amt.replace(',', '.')) || 0);
  const { fee, net } = withdrawFee(a);
  const pct = Math.min(100, Math.round((info.donors / info.required) * 100));
  return (
    <Page id="withdraw" back title="Ritira LifePoints">
      <Card>
        <H>Prima di ritirare</H>
        <Body small>Quando trasformi i LifePoints in denaro viene trattenuto il {WITHDRAW_FEE_PCT}%. Lo trovi nel rendiconto di fine anno.</Body>
        <Body small bold style={{ marginTop: 6 }}>Usarli negli acquisti nell'app non costa nulla: nessuna commissione.</Body>
      </Card>

      <Card>
        <Row><Body muted>Il tuo saldo</Body>{lp(balance)}</Row>
        <Row style={{ marginTop: 6 }}><Body muted>Ritirabili adesso</Body>{lp(info.withdrawable)}</Row>
        {info.locked > 0 && <Row style={{ marginTop: 6 }}><Body muted>In attesa di sblocco</Body>{lp(info.locked)}</Row>}
      </Card>

      {!info.dailyUnlocked && (
        <Card>
          <H>Sblocca i LifePoints Giornalieri</H>
          <Body small muted>I LifePoints Giornalieri ricevuti si possono ritirare quando sono stati donati da almeno {info.required} persone diverse.</Body>
          <View style={{ marginTop: 8 }}><Progress value={pct} /></View>
          <Body small muted style={{ marginTop: 4 }}>{tl('{0} di {1} persone', info.donors, info.required)}</Body>
          <Body small muted style={{ marginTop: 6 }}>Quello che incassi con servizi, webinar, seminari, LifeClub e store resta sempre ritirabile.</Body>
        </Card>
      )}

      {info.withdrawable > 0 ? (
        <Card>
          <Input keyboardType="number-pad" placeholder="Quanti LifePoints ritirare" value={amt} onChangeText={setAmt} />
          {a > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Row><Body muted>Commissione {WITHDRAW_FEE_PCT}%</Body>{lp(fee)}</Row>
              <Row style={{ marginTop: 4 }}><Body bold>Ti accreditiamo</Body>{lp(net)}</Row>
            </View>
          )}
          <Btn title="Ritira" onPress={() => { const r = withdrawLp(a); toast(r.message); if (r.ok) setAmt(''); }} />
          <Body small muted style={{ marginTop: 8 }}>Per ora è una simulazione: nessun accredito reale.</Body>
        </Card>
      ) : (
        <Card><Body small color={t.muted}>Non hai LifePoints ritirabili in questo momento.</Body></Card>
      )}
      <Btn ghost icon="file" title="Rendiconto LifePoints" onPress={() => go('lpStatement')} />
    </Page>
  );
}
