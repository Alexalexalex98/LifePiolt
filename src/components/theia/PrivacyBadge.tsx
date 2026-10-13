import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, H, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useAiRouter } from '@/store/aiRouter';

/** Piccolo indicatore di dove lavora Theia: "Solo sul telefono" oppure "AI esterna attiva". Si tocca per capire cosa significa. */
export function PrivacyBadge({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  const phoneOnly = useAiRouter((s) => s.prefs.phoneOnly);
  const label = phoneOnly ? 'Sul telefono · a basso impatto' : 'AI esterna attiva';
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Spiega cosa significa" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.chip, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <Icon name={phoneOnly ? 'lock' : 'link'} size={12} color={phoneOnly ? t.positive : t.warn} stroke={2.2} />
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      {onPress ? <Icon name="info" size={12} color={t.muted} stroke={2} /> : null}
    </Pressable>
  );
}

const Point = ({ icon, title, text }: { icon: 'lock' | 'check' | 'info' | 'link' | 'bell'; title: string; text: string }) => {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={t.accent} stroke={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 19, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
};

/** Finestra che spiega perché Theia lavora sul telefono (o con AI esterna) e cosa cambia. */
export function PrivacySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const phoneOnly = useAiRouter((s) => s.prefs.phoneOnly);
  return (
    <Sheet visible={visible} title={phoneOnly ? 'Sul telefono · a basso impatto' : 'AI esterna attiva'} onClose={onClose}>
      {phoneOnly ? (
        <>
          <Body muted>Theia sta lavorando solo con quello che c'è sul tuo telefono. Ecco cosa vuol dire.</Body>
          <Point icon="lock" title="Niente esce dal telefono" text="Agenda, task, salute, finanze e messaggi non vengono inviati a nessun servizio esterno: i tuoi dati restano tuoi." />
          <Point icon="check" title="Basso impatto" text="Theia capisce i comandi con regole veloci sul dispositivo. Consuma pochissima batteria e nessun traffico dati, e funziona anche senza rete." />
          <Point icon="info" title="Cosa cambia" text="Eseguo bene comandi come «aggiungi un task», «sposta l'impegno», «analizza le mie finanze» o «cosa devo fare adesso?». Per conversazioni libere e domande molto aperte le risposte sono più semplici." />
          <Point icon="link" title="Puoi cambiarlo" text="Nelle impostazioni di Theia puoi attivare un'AI esterna per risposte più ricche. Prima di inviare qualcosa ti dico sempre cosa parte e puoi tornare a «solo telefono» quando vuoi." />
        </>
      ) : (
        <>
          <Body muted>Per le domande più aperte Theia può usare un servizio di intelligenza artificiale esterno.</Body>
          <Point icon="link" title="Cosa viene inviato" text="Solo il testo del messaggio e il minimo contesto che serve a rispondere. Nelle impostazioni di Theia vedi il registro di ciò che è stato inviato." />
          <Point icon="lock" title="Tu decidi" text="Puoi tornare a «solo telefono» in qualsiasi momento: da quel momento nulla esce più dal dispositivo." />
        </>
      )}
      <H style={{ marginTop: 6 }}>{' '}</H>
      <Btn title="Impostazioni di Theia" ghost onPress={() => { onClose(); go('aiSettings'); }} />
    </Sheet>
  );
}
