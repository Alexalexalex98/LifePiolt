import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn } from '@/components/ui';

/** Lettore di QR con la fotocamera (solo app installata: sul web si incolla il codice). Chiama onCode una volta sola. */
export function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const [perm, ask] = useCameraPermissions();
  const done = useRef(false);
  if (Platform.OS === 'web') return <Body small muted>La fotocamera è disponibile solo nell'app installata: incolla qui sotto il codice del pagamento.</Body>;
  if (!perm) return null;
  if (!perm.granted) {
    return (
      <View style={{ gap: 10 }}>
        <Body small muted>Per leggere il QR serve il permesso alla fotocamera.</Body>
        <Btn title="Consenti la fotocamera" onPress={() => { void ask(); }} />
        <Btn ghost title="Chiudi" onPress={onClose} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ height: 280, borderRadius: 18, overflow: 'hidden' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(r) => { if (done.current) return; done.current = true; onCode(r.data); }}
        />
      </View>
      <Btn ghost title="Chiudi" onPress={onClose} />
    </View>
  );
}
