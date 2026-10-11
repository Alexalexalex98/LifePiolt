import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, IL, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { DOC_LABEL, DOC_SIDES, REJECT_REASONS, STATUS_LABEL, UNLOCKS, ACTION_LABEL, missingSides, type DocType } from '@/lib/profile/identity';
import { identityStatusOf } from '@/lib/profile/actions';
import { pickImage } from '@/lib/profile/pickImage';
import { useApp } from '@/store/app';
import { useIdentity } from '@/store/identity';
import { toast } from '@/store/toast';

type Shots = { front?: string; back?: string; selfie?: string };
const SIDE_LABEL = { front: 'Fronte', back: 'Retro' } as const;

/** Elimina dal telefono la copia temporanea scattata/scelta (best effort). */
function wipe(uri?: string) { if (!uri) return; try { new File(uri).delete(); } catch { /* file non nostro o già rimosso */ } }

/**
 * Verifica dell'identità con documento. Foto e selfie esistono SOLO in questa schermata (memoria temporanea): all'invio o alla
 * chiusura vengono scartate e la copia temporanea è cancellata. Non si caricano da nessuna parte finché non esiste il server
 * con il fornitore di verifica (KYC): oggi si crea solo la richiesta "in attesa".
 */
export default function IdentityVerify() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const rec = useIdentity((s) => s.identity);
  const status = identityStatusOf(me, me);
  const [doc, setDoc] = useState<DocType>('id_card');
  const [shots, setShots] = useState<Shots>({});
  const [selfieOn, setSelfieOn] = useState(false);
  const live = useRef<Shots>({});
  live.current = shots;
  useEffect(() => () => { Object.values(live.current).forEach(wipe); }, []);

  const take = async (slot: keyof Shots, source: 'camera' | 'gallery') => {
    const r = await pickImage(source, { quality: 0.6 });
    if (r.error) { toast(r.error); return; }
    if (r.uri) setShots((s) => { wipe(s[slot]); return { ...s, [slot]: r.uri as string }; });
  };
  const got = { front: !!shots.front, back: !!shots.back };
  const missing = missingSides(doc, got);
  const submit = () => {
    if (missing.length) { toast(`Manca: ${missing.map((m) => SIDE_LABEL[m].toLowerCase()).join(' e ')} del documento`); return; }
    if (selfieOn && !shots.selfie) { toast('Scatta il selfie oppure togli la verifica con selfie'); return; }
    if (!useIdentity.getState().submitIdentity(doc, got, selfieOn, demo)) { toast('Controlla le foto del documento'); return; }
    Object.values(shots).forEach(wipe);
    setShots({});
    toast('Richiesta inviata: le foto sono state cancellate dal telefono');
  };

  const SideBox = ({ slot, label }: { slot: keyof Shots; label: string }) => (
    <Card>
      <Row>
        <View style={{ width: 84, height: 56, borderRadius: 10, backgroundColor: t.chip, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={shots[slot] ? `${label}: foto acquisita` : `${label}: nessuna foto`}>
          {shots[slot] ? <Image source={{ uri: shots[slot] }} style={{ width: 84, height: 56 }} contentFit="cover" /> : <Icon name="camera" size={22} color={t.muted} />}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Body bold>{label}</Body>
          <Row gap={8} style={{ justifyContent: 'flex-start' }}>
            <Btn small ghost icon="camera" title="Fotocamera" onPress={() => void take(slot, 'camera')} />
            <Btn small ghost icon="image" title="Galleria" onPress={() => void take(slot, 'gallery')} />
          </Row>
        </View>
        {shots[slot] ? <Btn small ghost danger icon="trash" title="" label="Rimuovi" onPress={() => { wipe(shots[slot]); setShots((s) => ({ ...s, [slot]: undefined })); }} /> : null}
      </Row>
    </Card>
  );

  return (
    <Page id="identityVerify" back title="Verifica identità">
      <Card>
        <IL icon={status === 'verified' ? 'check' : status === 'pending' ? 'clock' : 'lock'} bold>{STATUS_LABEL[status]}</IL>
        {status === 'verified' && <Body small muted style={{ marginTop: 6 }}>Il tuo account è collegato a una persona reale{rec.doc ? ` (${DOC_LABEL[rec.doc]})` : ''}. Su LifeNetwork vedi il badge accanto al nome.</Body>}
        {status === 'pending' && <Body small muted style={{ marginTop: 6 }}>Documento inviato{rec.submittedAt ? ` il ${new Date(rec.submittedAt).toLocaleDateString()}` : ''}. Il controllo lo fa un fornitore di verifica identità: appena risponde, qui cambia lo stato. Intanto LifeNetwork è aperto in modalità leggera.</Body>}
        {status === 'rejected' && <Body small style={{ marginTop: 6 }} color={t.danger}>Motivo: {rec.reason ?? REJECT_REASONS[0]}. Puoi inviare di nuovo il documento.</Body>}
        {status === 'none' && <Body small muted style={{ marginTop: 6 }}>Su LifeNetwork ogni account è collegato a una persona reale. Serve un documento per pubblicare, vendere, offrire servizi e votare. Piano, task, salute, finanze e chat funzionano senza.</Body>}
      </Card>

      {demo && status === 'pending' && (
        <Card style={{ borderColor: t.warn, borderWidth: 1 }}>
          <IL icon="info" bold color={t.warn}>Anteprima: simula la risposta del fornitore</IL>
          <Body small muted style={{ marginTop: 4 }}>Solo in modalità demo, per provare i flussi. Con il server collegato la risposta arriva dal fornitore di verifica.</Body>
          <Row style={{ marginTop: 10 }} gap={8}>
            <Btn small style={{ flex: 1 }} title="Conferma (Anteprima)" onPress={() => { useIdentity.getState().resolveIdentity(true); toast('Identità verificata (Anteprima)'); }} />
            <Btn small ghost style={{ flex: 1 }} title="Respingi (Anteprima)" onPress={() => useIdentity.getState().resolveIdentity(false, REJECT_REASONS[0])} />
          </Row>
        </Card>
      )}

      {(status === 'none' || status === 'rejected') && (
        <>
          <H style={{ marginTop: 14 }}>Documento</H>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 8 }} gap={8}>
            {(Object.keys(DOC_LABEL) as DocType[]).map((d) => <Pill key={d} label={DOC_LABEL[d]} on={doc === d} onPress={() => { setDoc(d); }} />)}
          </Row>
          {DOC_SIDES[doc].map((s) => <SideBox key={s} slot={s} label={SIDE_LABEL[s]} />)}
          <Item last>
            <Row><View style={{ flex: 1 }}><Body bold>Selfie (facoltativo)</Body><Body small muted>Aiuta il fornitore a confrontare il volto con il documento.</Body></View><Btn small ghost title={selfieOn ? 'Togli' : 'Aggiungi'} onPress={() => { if (selfieOn) wipe(shots.selfie); setSelfieOn(!selfieOn); if (selfieOn) setShots((s) => ({ ...s, selfie: undefined })); }} /></Row>
          </Item>
          {selfieOn && <SideBox slot="selfie" label="Selfie" />}
          <Btn style={{ marginTop: 12 }} icon="send" title="Invia per la verifica" disabled={!!missing.length} onPress={submit} />
        </>
      )}

      <Card style={{ marginTop: 14 }}>
        <IL icon="lock" bold>Come trattiamo il documento</IL>
        <Body small muted style={{ marginTop: 6 }}>Le foto e il selfie restano solo in memoria temporanea mentre questa schermata è aperta e vengono cancellati dal telefono all’invio o alla chiusura. Oggi non vengono caricati da nessuna parte: l’invio vero al fornitore di verifica (con le garanzie GDPR e nLPD) parte quando il server sarà collegato. Nell’app resta solo lo stato della richiesta.</Body>
      </Card>
      <Card>
        <IL icon="check" bold>Cosa sblocca</IL>
        <Body small muted style={{ marginTop: 6 }}>In attesa: {UNLOCKS.pending.filter((a) => a !== 'chat').map((a) => ACTION_LABEL[a].toLowerCase()).join(', ')}.</Body>
        <Body small muted style={{ marginTop: 4 }}>Verificato: in più {UNLOCKS.verified.filter((a) => !UNLOCKS.pending.includes(a)).map((a) => ACTION_LABEL[a].toLowerCase()).join(', ')}.</Body>
      </Card>
      <Btn ghost style={{ marginTop: 6 }} title="Torna al profilo" onPress={() => go('userProfile')} />
    </Page>
  );
}
