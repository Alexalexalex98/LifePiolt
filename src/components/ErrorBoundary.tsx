import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { reportText, exportDiagnostics } from '@/lib/diagnostics';
import { logError } from '@/lib/errorLog';
import { errToString, log } from '@/lib/log';
import { translateText } from '@/i18n/core';

/**
 * Schermata "Qualcosa è andato storto": sostituisce la pagina di errore con il codice. L'app non si blocca.
 *  - Riprova: ricarica la schermata;  Esporta diagnostica: file di testo redatto (nessun dato personale);
 *  - Segnala: copia negli appunti un rapporto breve e redatto da incollare nel messaggio al supporto.
 * Usata come `ErrorBoundary` di expo-router (vedi ErrorScreen.tsx) per la radice e per le pagine.
 */
export function AppErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const t = useTheme();
  const [note, setNote] = useState('');
  useEffect(() => {
    logError(error, 'ErrorBoundary');
    log.error('app', 'Schermata di errore mostrata', errToString(error));
  }, [error]);

  const btn = (filled: boolean) => ({ pressed }: { pressed: boolean }) => ({
    backgroundColor: filled ? t.accent : 'transparent', borderColor: filled ? t.accent : t.inputBorder, borderWidth: 1, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18, minHeight: 44, opacity: pressed ? 0.6 : 1,
  });

  async function doExport() {
    const r = await exportDiagnostics();
    setNote(r.message);
  }
  async function doReport() {
    try {
      const text = `${String(error?.message ?? error).slice(0, 300)}\n\n${(await reportText()).split('\n').slice(0, 120).join('\n')}`;
      await Clipboard.setStringAsync(text);
      setNote(translateText('Rapporto copiato: incollalo nel messaggio al supporto. Non contiene dati personali.'));
    } catch { setNote(translateText('Non sono riuscito a copiare il rapporto.')); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 24 }} testID="error-boundary">
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>Qualcosa è andato storto</Text>
      <Text style={{ color: t.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>Succede, e i tuoi dati sono al sicuro. Puoi riprovare, esportare la diagnostica per capire cosa è successo oppure segnalare il problema.</Text>
      <View style={{ gap: 10, marginTop: 20 }}>
        <Pressable onPress={retry} accessibilityRole="button" style={btn(true)}><Text style={{ color: t.onAccent, fontWeight: '800', textAlign: 'center' }}>Riprova</Text></Pressable>
        <Pressable onPress={() => { retry(); try { router.replace('/'); } catch { /* ignore */ } }} accessibilityRole="button" style={btn(false)}><Text style={{ color: t.text, fontWeight: '700', textAlign: 'center' }}>Vai alla Home</Text></Pressable>
        <Pressable onPress={() => void doExport()} accessibilityRole="button" style={btn(false)}><Text style={{ color: t.text, fontWeight: '700', textAlign: 'center' }}>Esporta diagnostica</Text></Pressable>
        <Pressable onPress={() => void doReport()} accessibilityRole="button" style={btn(false)}><Text style={{ color: t.text, fontWeight: '700', textAlign: 'center' }}>Segnala il problema</Text></Pressable>
      </View>
      {note ? <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 13, marginTop: 12 }}>{note}</Text> : null}
      <ScrollView style={{ maxHeight: 110, marginTop: 20 }}><Text selectable style={{ color: t.muted, fontSize: 11 }}>Dettaglio per il supporto: {String(error?.message ?? error).slice(0, 300)}</Text></ScrollView>
    </View>
  );
}
