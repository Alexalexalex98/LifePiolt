import { SyncActivity, SyncCategories, SyncServer, SyncStatusCard } from '@/components/sync';
import { Body, Page } from '@/components/ui';

export default function SyncSettings() {
  return (
    <Page id="syncSettings" title="Sincronizzazione" back>
      <Body small muted style={{ marginBottom: 10 }}>Tieni allineati i tuoi dispositivi senza perdere il controllo: decidi tu cosa sincronizzare, categoria per categoria. I dati critici non escono mai dal telefono.</Body>
      <SyncStatusCard />
      <SyncCategories />
      <SyncActivity />
      <SyncServer />
    </Page>
  );
}
