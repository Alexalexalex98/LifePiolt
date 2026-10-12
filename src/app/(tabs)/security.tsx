import { View } from 'react-native';

import { BackupSection } from '@/components/security/BackupSection';
import { EncryptionSection } from '@/components/security/EncryptionSection';
import { LockSection } from '@/components/security/LockSection';
import { SpaceSection } from '@/components/security/SpaceSection';
import { StorageSection } from '@/components/security/StorageSection';
import { Body, Btn, Card, H, Page } from '@/components/ui';
import { go } from '@/lib/nav';

export default function Security() {
  return (
    <Page id="security" title="Sicurezza e archivio" back>
      <Body small muted style={{ marginBottom: 6 }}>I tuoi dati restano su questo telefono. Qui controlli blocco, cifratura, spazio e backup.</Body>
      <LockSection />
      <EncryptionSection />
      <StorageSection />
      <SpaceSection />
      <BackupSection />
      <Card>
        <H>Elimina tutti i dati</H>
        <Body small muted style={{ marginBottom: 10 }}>Cancella dal telefono l'archivio, la chiave di cifratura e gli allegati. Non si può annullare: prima salva un backup.</Body>
        <View><Btn small ghost danger title="Vai a «Elimina tutti i miei dati»" onPress={() => go('settings')} /></View>
      </Card>
    </Page>
  );
}
