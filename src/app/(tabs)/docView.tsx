import { useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';

import { DocView } from '@/components/doc/DocView';
import { Btn, Page } from '@/components/ui';

/** Visualizzatore di documenti: PDF e immagini si leggono qui, senza uscire dall'app. */
export default function DocViewPage() {
  const p = useLocalSearchParams<{ uri?: string; name?: string }>();
  const uri = String(p.uri ?? ''), name = String(p.name ?? 'Documento');
  return (
    <Page id="docView" back title={name} scroll={false}>
      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0b0e14' }}>{uri ? <DocView uri={uri} name={name} /> : null}</View>
      <Btn small ghost style={{ marginTop: 10 }} icon="share" title="Condividi con altre app" onPress={() => Share.share({ message: name, url: uri })} />
    </Page>
  );
}
