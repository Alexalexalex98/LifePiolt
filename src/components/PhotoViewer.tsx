import { Image } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';

import { Icon } from '@/lib/icons';
import { t as tl } from '@/i18n/core';

/** Foto a schermo intero: tocca ovunque o la X per chiudere. */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
        <View style={{ position: 'absolute', top: 54, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={22} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}
