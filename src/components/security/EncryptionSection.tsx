import { useState } from 'react';
import { View } from 'react-native';

import { useStorageInfo } from '@/components/security/hooks';
import { Body, Btn, Card, H, Pill, Row } from '@/components/ui';
import { rotateDbKey } from '@/db/backend';
import { alertT } from '@/lib/alert';
import { toast } from '@/store/toast';

/** Stato della cifratura a riposo e cambio chiave. */
export function EncryptionSection() {
  const info = useStorageInfo();
  const [busy, setBusy] = useState(false);
  const enc = info.encryption;
  const label = enc === 'sqlcipher' ? 'Database cifrato (SQLCipher, AES-256)' : enc === 'value' ? 'Cifratura per sezione (AES-256-GCM)' : 'Non cifrato';

  function rotate() {
    alertT('Cambiare la chiave di cifratura?', 'LifePilot ricifra tutto il database con una nuova chiave casuale custodita nel Keychain/Keystore del telefono. Può richiedere qualche secondo.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Cambia chiave', onPress: async () => {
        setBusy(true);
        try { const ok = await rotateDbKey(); toast(ok ? 'Chiave cambiata' : 'Non disponibile su questa versione'); } catch { toast('Cambio chiave non riuscito: i dati sono intatti'); }
        setBusy(false);
      } },
    ]);
  }

  return (
    <Card>
      <H>Cifratura dei dati</H>
      <Row><Body style={{ flex: 1 }}>{label}</Body><Pill label={enc === 'none' ? 'Spenta' : 'Attiva'} on={enc !== 'none'} /></Row>
      <Body small muted style={{ marginTop: 8 }}>{info.encryptionNote || (enc === 'sqlcipher' ? 'La chiave è casuale (32 byte), custodita nel Keychain/Keystore e non lascia il telefono.' : '')}</Body>
      {enc === 'none' && info.mode === 'asyncstorage' ? <Body small muted style={{ marginTop: 8 }}>La cifratura richiede l'app installata (build) su un telefono; sul web i dati restano nel browser.</Body> : null}
      {enc === 'sqlcipher' ? <View style={{ marginTop: 10 }}><Btn small ghost disabled={busy} title="Cambia la chiave di cifratura" onPress={rotate} /></View> : null}
    </Card>
  );
}
