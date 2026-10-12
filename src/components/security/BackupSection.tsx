import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Row, Sheet } from '@/components/ui';
import { MIN_PASSWORD } from '@/db/crypto';
import { exportBackup, openEncryptedBackup, pickBackup, restoreBackup, STORE_LABELS, type BackupPreview } from '@/lib/backup';
import { fmtDate } from '@/i18n/format';
import { toast } from '@/store/toast';
import { t as tr } from '@/i18n/core';

type Step = null | { kind: 'export' } | { kind: 'password'; text: string } | { kind: 'preview'; text: string; preview: BackupPreview; step: 1 | 2 } | { kind: 'error'; error: string };

/** Backup cifrato con password (.lpbackup, AES-256-GCM + scrypt) e importazione con anteprima. La password non viene mai salvata. */
export function BackupSection() {
  const [step, setStep] = useState<Step>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const close = () => { setStep(null); setPw(''); setPw2(''); setErr(''); };

  async function doExport() {
    if (pw.length < MIN_PASSWORD) { setErr(tr('Almeno 8 caratteri')); return; }
    if (pw !== pw2) { setErr('Le due password non coincidono'); return; }
    setBusy(true); setErr('');
    const r = await exportBackup({ password: pw });
    setBusy(false);
    toast(r.message);
    if (r.ok) close();
  }

  async function doPick() {
    const r = await pickBackup();
    if (r.ok) { setStep({ kind: 'preview', text: r.text, preview: r.preview, step: 1 }); return; }
    if (r.needsPassword && r.text) { setPw(''); setStep({ kind: 'password', text: r.text }); return; }
    if (!r.canceled) setStep({ kind: 'error', error: r.error });
  }

  async function doDecrypt(text: string) {
    setBusy(true); setErr('');
    const r = await openEncryptedBackup(text, pw);
    setBusy(false);
    if (r.ok) { setPw(''); setStep({ kind: 'preview', text: r.text, preview: r.preview, step: 1 }); } else setErr(r.error);
  }

  async function doRestore(text: string) {
    setBusy(true);
    const r = await restoreBackup(text);
    setBusy(false);
    close();
    toast(r.message);
  }

  return (
    <Card>
      <H>Backup cifrato</H>
      <Body small muted style={{ marginBottom: 10 }}>Salva tutti i dati in un file protetto da password (.lpbackup). Senza la password nessuno può leggerlo, nemmeno noi: non viene salvata da nessuna parte, quindi non perderla.</Body>
      <View style={{ gap: 8 }}>
        <Btn small ghost icon="lock" title="Esporta backup cifrato" onPress={() => { setPw(''); setPw2(''); setStep({ kind: 'export' }); }} />
        <Btn small ghost title="Importa backup (anche cifrato)" onPress={() => void doPick()} />
      </View>

      <Sheet visible={step?.kind === 'export'} title="Backup cifrato" onClose={close}>
        <Body small muted style={{ marginBottom: 10 }}>Scegli una password di almeno {MIN_PASSWORD} caratteri. La cifratura usa AES-256-GCM con chiave derivata da scrypt; la derivazione richiede qualche secondo.</Body>
        <Input placeholder="Password" secureTextEntry value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="Ripeti la password" secureTextEntry value={pw2} onChangeText={setPw2} autoCapitalize="none" autoCorrect={false} />
        {err ? <Body small bold>{err}</Body> : null}
        <Row style={{ marginTop: 14 }}>
          <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={close} />
          <Btn style={{ flex: 1 }} disabled={busy} title={busy ? 'Cifratura…' : 'Esporta'} onPress={() => void doExport()} />
        </Row>
      </Sheet>

      <Sheet visible={step?.kind === 'password'} title="Backup cifrato" onClose={close}>
        <Body small muted style={{ marginBottom: 10 }}>Inserisci la password usata quando hai creato il backup.</Body>
        <Input placeholder="Password" secureTextEntry value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} />
        {err ? <Body small bold>{err}</Body> : null}
        <Row style={{ marginTop: 14 }}>
          <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={close} />
          <Btn style={{ flex: 1 }} disabled={busy || !pw} title={busy ? 'Decifratura…' : 'Apri'} onPress={() => step?.kind === 'password' && void doDecrypt(step.text)} />
        </Row>
      </Sheet>

      <Sheet visible={step?.kind === 'error'} title="Backup non valido" onClose={close}>
        <Body small muted>{step?.kind === 'error' ? step.error : ''}</Body>
        <Btn ghost style={{ marginTop: 14 }} title="Chiudi" onPress={close} />
      </Sheet>

      <Sheet visible={step?.kind === 'preview'} title={step?.kind === 'preview' && step.step === 2 ? 'Ultima conferma' : 'Importa backup'} onClose={close}>
        {step?.kind === 'preview' && step.step === 1 ? (
          <>
            <Body small muted>Backup del {step.preview.createdAt ? fmtDate(step.preview.createdAt, { dateStyle: 'short', timeStyle: 'short' }) : 'data sconosciuta'}{step.preview.appVersion ? ` (LifePilot ${step.preview.appVersion})` : ''}. {step.preview.storeCount} categorie, {step.preview.sizeKB} KB.</Body>
            <View style={{ marginVertical: 10 }}>
              {Object.entries(step.preview.items).map(([k, n]) => <Row key={k}><Body small>{STORE_LABELS[k] ?? k}</Body><Body small muted>{n > 0 ? `${n} voci` : 'impostazioni'}</Body></Row>)}
            </View>
            {step.preview.repaired.length ? <Body small bold style={{ marginBottom: 8 }}>Alcuni campi non validi verranno scartati ({step.preview.repaired.map((k) => STORE_LABELS[k] ?? k).join(', ')}).</Body> : null}
            <Body small muted>Importando, i dati attuali di questo telefono verranno sostituiti da quelli del backup.</Body>
            <Row style={{ marginTop: 14 }}>
              <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={close} />
              <Btn danger style={{ flex: 1 }} title="Continua" onPress={() => setStep({ ...step, step: 2 })} />
            </Row>
          </>
        ) : null}
        {step?.kind === 'preview' && step.step === 2 ? (
          <>
            <Body small muted>Sei sicuro? I dati attuali verranno sovrascritti. Se qualcosa va storto restano quelli di prima.</Body>
            <Row style={{ marginTop: 14 }}>
              <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={close} />
              <Btn danger style={{ flex: 1 }} disabled={busy} title="Sovrascrivi" onPress={() => void doRestore(step.text)} />
            </Row>
          </>
        ) : null}
      </Sheet>
    </Card>
  );
}
