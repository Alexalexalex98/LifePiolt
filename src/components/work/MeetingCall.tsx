import { useEffect, useState } from 'react';
import { Modal, PermissionsAndroid, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Text } from '@/components/T';
import { Btn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';

/** Indirizzo della stanza sul servizio gratuito Jitsi Meet (meet.jit.si): nessun account per entrare, nessun costo. La stanza si chiama come l'id della riunione (casuale, lo vedono solo gli invitati). */
export const callUrl = (meetingId: string, name: string): string =>
  `https://meet.jit.si/lp-${meetingId}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.disableDeepLinking=true&config.startWithVideoMuted=true&config.disableInviteFunctions=true&userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}`;

/** La chiamata dentro l'app. Chi esce (anche chiudendo) lascia la riunione; quando esce l'ultimo la riunione si chiude da sola. */
export function MeetingCall({ id, title, name, onLeave, onHide }: { id: string; title: string; name: string; onLeave: () => void; onHide: () => void }) {
  const th = useTheme(); const ins = useSafeAreaInsets();
  const [ready, setReady] = useState(Platform.OS !== 'android');
  useEffect(() => { if (Platform.OS === 'android') void PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]).finally(() => setReady(true)); }, []);
  useEffect(() => { if (Platform.OS === 'web') { window.open(callUrl(id, name), '_blank'); onHide(); } }, [id, name]); // eslint-disable-line react-hooks/exhaustive-deps
  if (Platform.OS === 'web') return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onHide} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: ins.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: 'rgba(120,20,30,0.95)' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff5a64' }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{title}</Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5 }}>{tl('Riunione registrata e trascritta da Theia')}</Text>
          </View>
          <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel={tl('Nascondi la chiamata')} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{tl('Nascondi')}</Text></Pressable>
          <Btn small danger title="Esci" onPress={onLeave} />
        </View>
        {ready ? (
          <WebView
            source={{ uri: callUrl(id, name) }}
            style={{ flex: 1, backgroundColor: th.bg }}
            javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant" setSupportMultipleWindows={false}
            originWhitelist={['https://*']} onShouldStartLoadWithRequest={(r) => /^https:\/\/([a-z0-9-]+\.)*(jit\.si|8x8\.vc)\b/i.test(r.url) || r.url === 'about:blank'}
          />
        ) : null}
      </View>
    </Modal>
  );
}
