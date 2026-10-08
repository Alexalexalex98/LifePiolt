import { PrivacyContent } from '@/components/PrivacyContent';
import { Body, Page } from '@/components/ui';

export default function Privacy() {
  return (
    <Page id="privacy" title="Privacy e permessi" back>
      <Body small muted style={{ marginBottom: 10 }}>Questa pagina descrive cosa fa davvero LifePilot con i tuoi dati.</Body>
      <PrivacyContent />
    </Page>
  );
}
