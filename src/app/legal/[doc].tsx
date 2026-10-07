import { useLocalSearchParams } from 'expo-router';

import { Body, Screen } from '@/components/ui';

// BOZZA: i testi legali vanno scritti/verificati prima della pubblicazione sugli store.
const docs: Record<string, { title: string; body: string }> = {
  privacy: {
    title: 'Informativa privacy',
    body:
      'BOZZA. LifePilot salva i tuoi dati (note, task, salute, finanze) solo su questo dispositivo. ' +
      'Se usi l\'assistente AI, i messaggi che invii vengono trasmessi al nostro server per generare la risposta. ' +
      'Puoi esportare o cancellare tutti i dati dalle Impostazioni. Prima della pubblicazione questo testo va sostituito con la privacy policy completa e pubblicata su un URL pubblico.',
  },
  terms: {
    title: 'Termini di servizio',
    body: 'BOZZA. Da completare prima della pubblicazione.',
  },
  help: {
    title: 'Centro assistenza',
    body: 'BOZZA. Per assistenza scrivi al contatto di supporto indicato nella scheda dello store.',
  },
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = docs[doc] ?? docs.help;
  return (
    <Screen title={d.title} back>
      <Body>{d.body}</Body>
    </Screen>
  );
}
