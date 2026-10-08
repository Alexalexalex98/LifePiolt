import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { logError } from '@/lib/errorLog';

/** Schermata mostrata al posto della pagina di errore con il codice: l'app non si blocca. */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => { logError(error, 'ErrorBoundary'); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: '#07090d', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#f4f6f8', fontSize: 22, fontWeight: '800' }}>Qualcosa non ha funzionato</Text>
      <Text style={{ color: '#8e98a8', fontSize: 15, marginTop: 8, lineHeight: 22 }}>Succede, e i tuoi dati sono al sicuro. Puoi riprovare oppure tornare alla Home.</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Pressable onPress={retry} style={{ backgroundColor: '#8fa4ff', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20 }}><Text style={{ color: '#07090d', fontWeight: '800' }}>Riprova</Text></Pressable>
        <Pressable onPress={() => { retry(); router.replace('/'); }} style={{ borderColor: '#29313d', borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20 }}><Text style={{ color: '#f4f6f8', fontWeight: '700' }}>Vai alla Home</Text></Pressable>
      </View>
      <ScrollView style={{ maxHeight: 120, marginTop: 24 }}><Text selectable style={{ color: '#5a6472', fontSize: 11 }}>Dettaglio per il supporto: {String(error?.message ?? error).slice(0, 300)}</Text></ScrollView>
    </View>
  );
}
