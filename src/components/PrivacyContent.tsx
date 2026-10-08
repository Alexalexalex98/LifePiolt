import { Linking, Platform, View } from 'react-native';

import { Body, Btn, Card, H } from '@/components/ui';
import { toast } from '@/store/toast';

const PERMS: { name: string; why: string }[] = [
  { name: 'Salute (Apple Salute)', why: 'Legge passi, sonno, battito, HRV, allenamenti e peso per mostrarteli in LifeHealth. Non scrive nulla in Salute. I dati restano sul telefono.' },
  { name: 'Calendario', why: 'Mostra i tuoi impegni nel piano e permette di aggiungerne di nuovi al calendario del telefono quando lo scegli tu.' },
  { name: 'Posizione', why: 'Usata solo quando scegli di condividere la tua posizione in una chat. Il meteo usa la città che imposti, non la posizione.' },
  { name: 'Notifiche', why: 'Promemoria e briefing del mattino e della sera, generati sul telefono. Nessuna notifica arriva da un server.' },
  { name: 'Foto e fotocamera', why: 'Per scattare o scegliere foto e video da inviare nelle chat e per allegare documenti.' },
  { name: 'Microfono', why: 'Per registrare i messaggi vocali nelle chat.' },
  { name: 'Contatti', why: 'Solo quando scegli di condividere un contatto in una chat. La rubrica non viene letta in altri momenti.' },
];

function openSystemSettings() {
  if (Platform.OS === 'web') { toast('Apri le impostazioni del telefono per cambiare i permessi'); return; }
  Linking.openSettings().catch(() => toast('Non riesco ad aprire le impostazioni di sistema'));
}

const P = ({ children }: { children: string }) => <Body small muted style={{ marginTop: 6, lineHeight: 20 }}>{children}</Body>;

/** Testo dell'informativa, usato sia dalla pagina Privacy sia dall'onboarding. */
export function PrivacyContent({ showPermissions = true }: { showPermissions?: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H>Cosa resta sul tuo telefono</H>
        <P>Oggi tutto. Task, obiettivi, note, file, calendario, dati di salute, movimenti e budget, messaggi, profilo e impostazioni sono salvati solo su questo dispositivo. LifePilot non ha un account online e non carica i tuoi dati su un server per conto suo.</P>
      </Card>
      <Card>
        <H>Cosa verrebbe inviato a un server</H>
        <P>Solo se l'app è collegata a un server (cosa che avviene solo in versioni configurate in questo modo) e solo per le funzioni indicate qui sotto.</P>
        <P>Le domande che fai all'assistente AI vengono inviate al server per ottenere la risposta. Il contesto personale (ad esempio le tue attività) viene aggiunto solo se il permesso "AI Memory" è attivo nelle Impostazioni.</P>
        <P>I dati di salute e quelli finanziari vengono inclusi nel contesto solo se attivi i permessi "Dati salute" e "Dati finanziari" nelle Impostazioni. Puoi disattivarli in qualsiasi momento.</P>
        <P>Se è configurato un indirizzo per la segnalazione degli errori, in caso di problema viene inviato in forma anonima solo il messaggio tecnico, la versione dell'app e la piattaforma. Nessun dato personale.</P>
      </Card>
      {showPermissions && (
        <Card>
          <H>Permessi richiesti dall'app</H>
          <P>LifePilot chiede un permesso solo quando usi la funzione che ne ha bisogno. Puoi cambiarli quando vuoi dalle impostazioni del telefono.</P>
          {PERMS.map((p) => (
            <View key={p.name} style={{ marginTop: 12 }}>
              <Body bold>{p.name}</Body>
              <Body small muted style={{ marginTop: 2, lineHeight: 20 }}>{p.why}</Body>
            </View>
          ))}
          <Btn small ghost style={{ marginTop: 14 }} title="Apri le impostazioni di sistema" onPress={openSystemSettings} />
        </Card>
      )}
      <Card>
        <H>I tuoi diritti</H>
        <P>Esportare: da Impostazioni, in "Backup e ripristino", puoi salvare tutti i tuoi dati in un file che puoi conservare o portare su un altro telefono. Dalla stessa schermata puoi anche esportare il riepilogo dei dati.</P>
        <P>Cancellare: da Impostazioni, "Elimina tutti i miei dati" svuota ogni dato salvato sul telefono e riporta l'app alla schermata iniziale. Disinstallare l'app ha lo stesso effetto.</P>
        <P>Poiché i dati non sono su un server nostro, non c'è nulla da chiedere a noi: ogni dato lo controlli direttamente tu.</P>
      </Card>
    </View>
  );
}
