import { useState } from 'react';

import { useToday } from '@/components/casa/shared';
import { FinTabs } from '@/components/FinTabs';
import { ContractTab } from '@/components/payroll/ContractTab';
import { MonthTab } from '@/components/payroll/MonthTab';
import { SlipsTab } from '@/components/payroll/SlipsTab';
import { Body, Page, Pill, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';

type Tab = 'month' | 'slips' | 'contract';

/** Ore e stipendio: carichi il contratto, scrivi o fotografi le ore di ogni giorno (o le prendi dai turni), le confermi e vedi lordo e netto giorno per giorno e del mese.
 *  Le buste paga e l'estratto conto affinano la stima di mese in mese. Ferie e ore in più sempre sotto controllo. */
export default function Payroll() {
  const today = useToday();
  const [tab, setTab] = useState<Tab>('month');
  return (
    <Page id="payroll" title="Ore e stipendio" back>
      <FinTabs current="payroll" />
      <Row style={{ justifyContent: 'flex-start' }} gap={6}>
        <Pill label={tl('Mese')} on={tab === 'month'} onPress={() => setTab('month')} />
        <Pill label={tl('Buste paga')} on={tab === 'slips'} onPress={() => setTab('slips')} />
        <Pill label={tl('Contratto')} on={tab === 'contract'} onPress={() => setTab('contract')} />
      </Row>
      {tab === 'month' ? <MonthTab today={today} onContract={() => setTab('contract')} /> : tab === 'slips' ? <SlipsTab today={today} /> : <ContractTab />}
      <Body small muted>{tl('I dati restano sul tuo telefono. Le foto vanno all\'AI solo con il tuo permesso. Le stime non sono una consulenza: contano le buste paga.')}</Body>
    </Page>
  );
}
