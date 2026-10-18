import { Body, Card, H, Pill, Row } from '@/components/ui';
import { useAiRouter } from '@/store/aiRouter';

/** Consenso a mandare foto e file al servizio AI: si cambia o si toglie quando si vuole. */
export function FileConsentCard() {
  const c = useAiRouter((s) => s.fileConsent);
  const set = useAiRouter((s) => s.setFileConsent);
  return (
    <Card>
      <H>Foto e file inviati all'AI</H>
      <Body small muted style={{ marginTop: 4 }}>Per leggere foto, documenti e bollette Theia deve mandarli al servizio AI (Google Gemini), tramite il server di LifePilot. Se non lo permetti, Theia non può capire file, foto e documenti: restano solo sul telefono.</Body>
      <Body bold style={{ marginTop: 10 }}>Foto dei piatti</Body>
      <Row gap={8} style={{ marginTop: 6 }}>
        <Pill label="Chiedi ogni volta" on={c.food === 'ask'} onPress={() => set({ food: 'ask' })} />
        <Pill label="Consenti sempre" on={c.food === 'always' || (c.food as unknown) === true} onPress={() => set({ food: 'always' })} />
        <Pill label="Non consentire" on={c.food === 'never'} onPress={() => set({ food: 'never' })} />
      </Row>
      <Body bold style={{ marginTop: 12 }}>File e foto in chat, bollette e screenshot</Body>
      <Row gap={8} style={{ marginTop: 6 }}>
        <Pill label="Chiedi ogni volta" on={c.files === 'ask'} onPress={() => set({ files: 'ask' })} />
        <Pill label="Consenti sempre" on={c.files === 'always'} onPress={() => set({ files: 'always' })} />
        <Pill label="Non consentire" on={c.files === 'never'} onPress={() => set({ files: 'never' })} />
      </Row>
    </Card>
  );
}
