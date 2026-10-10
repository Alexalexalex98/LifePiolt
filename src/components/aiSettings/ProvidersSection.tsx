import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Row, Switch } from '@/components/ui';
import { getClient } from '@/lib/aiRouter/runtime';
import { KIND_NAME } from '@/lib/aiRouter/labels';
import { PROVIDERS } from '@/lib/aiRouter/registry';
import { TASK_KINDS } from '@/lib/aiRouter/types';
import { useAiRouter } from '@/store/aiRouter';
import { toast } from '@/store/toast';

export function PrivacyCard() {
  const prefs = useAiRouter((s) => s.prefs);
  const setPrefs = useAiRouter((s) => s.setPrefs);
  const Line = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={{ paddingVertical: 10 }}>
      <Row><Body style={{ flex: 1 }} bold>{label}</Body><Switch value={value} onValueChange={onChange} accessibilityLabel={label} /></Row>
      <Body small muted>{hint}</Body>
    </View>
  );
  return (
    <Card>
      <H>Privacy verso i fornitori</H>
      <Line label="Nascondi dati personali nel testo" hint="Prima di ogni invio sostituisco numeri di carta, IBAN, email, telefoni e indirizzi con un segnaposto. È un controllo automatico: non è infallibile." value={prefs.redact} onChange={(v) => setPrefs({ redact: v })} />
      <Line label="Solo fornitori che elaborano in UE" hint="Escludo i fornitori che non possono elaborare in Europa. Le regioni sono dichiarate dai fornitori e da verificare." value={prefs.euOnly} onChange={(v) => setPrefs({ euOnly: v })} />
      <Line label="Non inviare immagini" hint="Niente foto a servizi esterni: le richieste che le richiedono restano senza risposta." value={prefs.noImages} onChange={(v) => setPrefs({ noImages: v })} />
      <Line label="Non inviare contatti" hint="Nomi, numeri e email della rubrica non escono mai dal telefono." value={prefs.noContacts} onChange={(v) => setPrefs({ noContacts: v })} />
      <Body small muted style={{ marginTop: 6 }}>Carte e IBAN, conti e movimenti, dati clinici, documenti fiscali e d'identità e posizione non escono mai, qualunque sia la scelta. Cosa mandare all'assistente lo decidi in «Cosa condivido».</Body>
    </Card>
  );
}

export function ProvidersSection() {
  const prefs = useAiRouter((s) => s.prefs);
  const consents = useAiRouter((s) => s.consents);
  const toggleBlocked = useAiRouter((s) => s.toggleBlocked);
  const revoke = useAiRouter((s) => s.revokeConsent);
  const connected = getClient().isConfigured();
  return (
    <>
      <Card>
        <H>Stato dei fornitori</H>
        <Body small muted>Le AI si collegano tramite il nostro server: nell'app non c'è nessuna chiave. Finché il server non c'è, tutti i fornitori risultano «Non collegato».</Body>
      </Card>
      {PROVIDERS.map((p) => {
        const blocked = prefs.blockedProviders.includes(p.id);
        const saved = !!consents[p.id]?.always;
        const kinds = TASK_KINDS.filter((k) => !!p.caps[k]).map((k) => KIND_NAME[k]);
        return (
          <Card key={p.id}>
            <Row>
              <Body bold style={{ flex: 1 }}>{p.name}</Body>
              <Pill label={connected ? 'Collegato' : 'Non collegato'} off />
            </Row>
            <Body small muted style={{ marginTop: 4 }}>{kinds.join(', ')}</Body>
            {p.note ? <Body small muted>{p.note}</Body> : null}
            <Body small muted style={{ marginTop: 4 }}>{`Elabora in: ${p.regions.join(', ')} (dichiarato, da verificare). Uso dei dati per addestrare: ${p.trainsOnData}.`}</Body>
            <View style={{ marginTop: 8 }}>
              <Row><Body style={{ flex: 1 }}>Non usare questo fornitore</Body><Switch value={blocked} onValueChange={() => toggleBlocked(p.id)} accessibilityLabel={`Non usare ${p.short}`} /></Row>
            </View>
            <Row style={{ marginTop: 8 }}>
              <Body small muted style={{ flex: 1 }}>{saved ? 'Consenso salvato: non ti chiedo conferma per i dati non sensibili.' : 'Nessun consenso: te lo chiederò prima del primo invio.'}</Body>
              {saved ? <Btn small ghost title="Revoca" onPress={() => { revoke(p.id); toast('Consenso revocato'); }} /> : null}
            </Row>
          </Card>
        );
      })}
    </>
  );
}
