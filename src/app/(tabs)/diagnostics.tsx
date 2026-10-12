import { useState } from 'react';
import { View } from 'react-native';

import { BackgroundCard, InfoCard, NotificationsCard, useDiagnostics } from '@/components/diagnostics/SystemCards';
import { LogCard } from '@/components/diagnostics/LogCard';
import { OutflowCard } from '@/components/diagnostics/OutflowCard';
import { Body, Btn, Card, H, Page, Pill, Row } from '@/components/ui';
import { exportDiagnostics } from '@/lib/diagnostics';
import { logOutflow } from '@/lib/privacyGateApp';
import { toast } from '@/store/toast';

/** Come mai microfono o notifiche non vanno? Qui lo si vede senza cavo: stato del telefono, permessi, notifiche programmate, log. */
function Crash(): never { throw new Error('Errore di prova provocato dalla pagina Diagnostica'); }

export default function Diagnostics() {
  const { info, reload } = useDiagnostics();
  const [tab, setTab] = useState<'stato' | 'log' | 'privacy'>('stato');
  const [taps, setTaps] = useState(0);
  const [crash, setCrash] = useState(false);
  const dev = taps >= 5;
  if (crash) return <Crash />;
  return (
    <Page id="diagnostics" title="Diagnostica" back>
      <Body small muted style={{ marginBottom: 10 }}>Serve a capire cosa non va sul telefono senza collegare un cavo. Niente di quello che vedi qui parte da solo: l&apos;esportazione crea un file di testo senza dati personali che decidi tu a chi mandare.</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={6}>
        <Pill label="Stato" icon="gear" on={tab === 'stato'} onPress={() => setTab('stato')} />
        <Pill label="Log" icon="file" on={tab === 'log'} onPress={() => setTab('log')} />
        <Pill label="Privacy" icon="shield" on={tab === 'privacy'} onPress={() => setTab('privacy')} />
      </Row>
      {tab === 'stato' && (
        <>
          <InfoCard info={info} onVersionTap={() => setTaps((x) => x + 1)} />
          <NotificationsCard />
          <BackgroundCard dev={dev} />
        </>
      )}
      {tab === 'log' && <LogCard />}
      {tab === 'privacy' && <OutflowCard />}
      <Card>
        <H>Esporta</H>
        <Body small muted style={{ marginBottom: 8 }}>File di testo con versione, stato di notifiche e permessi e gli ultimi eventi del log. Non contiene titoli di impegni, messaggi, nomi, email, IBAN, carte o telefoni.</Body>
        <View style={{ gap: 8 }}>
          <Btn small icon="send" title="Esporta diagnostica" onPress={() => void exportDiagnostics().then((r) => toast(r.message))} />
          <Btn small ghost icon="repeat" title="Aggiorna lo stato" onPress={reload} />
          {dev ? <Btn small ghost title="Prova il registro di uscita (sviluppo)" onPress={() => {
            // passa dal privacy gate vero con le tue scelte attuali: registra solo metadati, nessun contenuto
            logOutflow('ai_memory', 'router_ai', { count: 3 });
            logOutflow('fin_accounts', 'router_ai', { count: 40 });
            logOutflow('plan_agenda', 'chat:prova', { mode: 'dettagli', count: 6 });
            logOutflow('card_phone', 'chat:prova', { count: 1 });
            logOutflow('net_jobs', 'employer', { explicit: true, count: 2 });
            toast('Righe di prova aggiunte al registro (scheda Privacy)');
          }} /> : null}
          {dev ? <Btn small ghost danger title="Provoca un errore (sviluppo)" onPress={() => setCrash(true)} /> : null}
        </View>
      </Card>
    </Page>
  );
}
