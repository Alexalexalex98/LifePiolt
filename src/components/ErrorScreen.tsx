import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { logError } from '@/lib/errorLog';

/** Schermata mostrata al posto della pagina di errore con il codice: l'app non si blocca. Segue il tema. */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  const t = useTheme();
  useEffect(() => { logError(error, 'ErrorBoundary'); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>Qualcosa non ha funzionato</Text>
      <Text style={{ color: t.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>Succede, e i tuoi dati sono al sicuro. Puoi riprovare oppure tornare alla Home.</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: t.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, minHeight: 44, opacity: pressed ? 0.6 : 1 })}><Text style={{ color: t.onAccent, fontWeight: '800' }}>Riprova</Text></Pressable>
        <Pressable onPress={() => { retry(); router.replace('/'); }} accessibilityRole="button" style={({ pressed }) => ({ borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, minHeight: 44, opacity: pressed ? 0.6 : 1 })}><Text style={{ color: t.text, fontWeight: '700' }}>Vai alla Home</Text></Pressable>
      </View>
      <ScrollView style={{ maxHeight: 120, marginTop: 24 }}><Text selectable style={{ color: t.muted, fontSize: 11 }}>Dettaglio per il supporto: {String(error?.message ?? error).slice(0, 300)}</Text></ScrollView>
    </View>
  );
}
