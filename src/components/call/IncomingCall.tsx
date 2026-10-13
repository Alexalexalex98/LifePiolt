import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { t as tl, translateText } from '@/i18n/core';
import { answerIncoming, declineIncoming } from '@/lib/callActions';
import { Icon } from '@/lib/icons';
import { useIncomingCall } from '@/store/incomingCall';

/** «Chiamata in arrivo» a tutto schermo, come in una chat: Rifiuta (rosso) e Rispondi (verde). */
export function IncomingCallHost() {
  const cur = useIncomingCall((s) => s.current);
  if (!cur) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={declineIncoming} statusBarTranslucent>
      <LinearGradient colors={['#1b2440', '#0b0e14']} style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 120, paddingBottom: 90 }}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' }}>{cur.video ? tl('Videochiamata in arrivo') : tl('Chiamata in arrivo')}</Text>
          <UserAvatar name={cur.from} size={120} />
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{cur.from}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{tl('LifePilot')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 70 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable onPress={declineIncoming} accessibilityRole="button" accessibilityLabel={translateText('Rifiuta')} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5484d', alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={30} color="#fff" stroke={2.2} /></Pressable>
            <Text style={{ color: '#fff', fontSize: 13 }}>{tl('Rifiuta')}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable onPress={answerIncoming} accessibilityRole="button" accessibilityLabel={translateText('Rispondi')} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2fb35a', alignItems: 'center', justifyContent: 'center' }}><Icon name={cur.video ? 'video' : 'phone'} size={30} color="#fff" stroke={2.2} /></Pressable>
            <Text style={{ color: '#fff', fontSize: 13 }}>{tl('Rispondi')}</Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}
