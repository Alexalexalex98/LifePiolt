import { useState } from 'react';

import { LocalCapabilities } from '@/components/aiSettings/LocalCapabilities';
import { PrivacyCard, ProvidersSection } from '@/components/aiSettings/ProvidersSection';
import { SendLog } from '@/components/aiSettings/SendLog';
import { Simulator } from '@/components/aiSettings/Simulator';
import { ModeCard, TaskChoices } from '@/components/aiSettings/TaskChoices';
import { UsageSection } from '@/components/aiSettings/UsageSection';
import { Body, Page, TabRow } from '@/components/ui';
import { ensureTranslate } from '@/lib/aiRouter/runtime';

const TABS = ['Scelte', 'Limiti', 'Fornitori', 'Prova', 'Cronologia'];

export default function AiSettings() {
  ensureTranslate();
  const [tab, setTab] = useState('Scelte');
  return (
    <Page id="aiSettings" title="Intelligenza di Theia" back>
      <Body small muted style={{ marginBottom: 10 }}>Theia fa da sola tutto ciò che si può fare sul telefono e delega a un'altra AI solo ciò che serve davvero, scegliendo la migliore per ogni compito. Le AI si collegheranno col server: oggi nessuna è collegata.</Body>
      <TabRow options={TABS} value={tab} onChange={setTab} />
      {tab === 'Scelte' && (<><ModeCard /><LocalCapabilities /><TaskChoices /></>)}
      {tab === 'Limiti' && <UsageSection />}
      {tab === 'Fornitori' && (<><PrivacyCard /><ProvidersSection /></>)}
      {tab === 'Prova' && <Simulator />}
      {tab === 'Cronologia' && <SendLog />}
    </Page>
  );
}
