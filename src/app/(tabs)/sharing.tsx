import { SharingView } from '@/components/SharingView';
import { Body, Page } from '@/components/ui';

export default function Sharing() {
  return (
    <Page id="sharing" title="Cosa condivido" back>
      <Body small muted style={{ marginBottom: 10 }}>Qui vedi, in ogni momento, quali informazioni sono condivise e quali no, e puoi cambiarle quando vuoi.</Body>
      <SharingView />
    </Page>
  );
}
