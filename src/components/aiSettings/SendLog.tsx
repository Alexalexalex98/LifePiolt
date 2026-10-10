import { View } from 'react-native';

import { Body, Btn, Card, Empty, H, Item, Row } from '@/components/ui';
import { confirmDelete } from '@/lib/confirm';
import { KIND_NAME } from '@/lib/aiRouter/labels';
import { providerName } from '@/lib/aiRouter/registry';
import { useAiRouter } from '@/store/aiRouter';
import { tx } from '@/lib/aiRouter/tx';

const kb = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

/** Cronologia "Cosa è stato inviato": solo tipo, fornitore, data e dimensione. Mai il contenuto. */
export function SendLog() {
  const log = useAiRouter((s) => s.sendLog);
  const { removeLog, restoreLog, clearLog, restoreAllLog } = useAiRouter.getState();
  return (
    <Card>
      <H>Cosa è stato inviato</H>
      <Body small muted style={{ marginBottom: 6 }}>Un registro locale di ogni invio a un fornitore: tipo, fornitore, data e dimensione. Non contiene mai il testo né i dati inviati.</Body>
      {log.length === 0 ? <Empty text="Finora non è uscito nulla dal telefono." /> : log.map((e, i) => (
        <Item key={e.id} last={i === log.length - 1}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold>{`${tx(KIND_NAME[e.kind])} · ${providerName(e.provider)}`}</Body>
              <Body small muted>{`${new Date(e.ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${kb(e.bytes)} · ${e.parts.join(', ')}${e.redacted ? ` · ${e.redacted} dati nascosti` : ''}`}</Body>
            </View>
            <Btn small ghost icon="trash" title="" label="Elimina voce" onPress={() => confirmDelete('questa voce della cronologia', () => removeLog(e.id), () => restoreLog(e))} />
          </Row>
        </Item>
      ))}
      {log.length > 0 ? <Btn small ghost danger style={{ marginTop: 10 }} title="Elimina tutta la cronologia" onPress={() => { const prev = log; confirmDelete('tutta la cronologia degli invii', () => clearLog(), () => restoreAllLog(prev)); }} /> : null}
    </Card>
  );
}
