import { Alert, Platform, type AlertButton } from 'react-native';

import { translateText } from '@/i18n/core';

/** Alert.alert che traduce titolo, messaggio ed etichette dei bottoni. Sul web (dove Alert non fa nulla) usa window.alert/confirm. */
export function alertT(title: string, message?: string, buttons?: AlertButton[]) {
  const ti = translateText(title);
  const me = message ? translateText(message) : undefined;
  const bt = buttons?.map((b) => (b.text ? { ...b, text: translateText(b.text) } : b));
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const text = me ? `${ti}\n\n${me}` : ti;
    if (!bt || bt.length <= 1) { window.alert(text); bt?.[0]?.onPress?.(); return; }
    const cancel = bt.find((b) => b.style === 'cancel');
    const actions = bt.filter((b) => b !== cancel);
    if (actions.length === 1) { if (window.confirm(text)) actions[0].onPress?.(); else cancel?.onPress?.(); return; }
    // più azioni: sul web non c'è un menu nativo, eseguo la prima dopo conferma
    if (window.confirm(`${text}\n\n${actions[0].text ?? ''}?`)) actions[0].onPress?.(); else cancel?.onPress?.();
    return;
  }
  Alert.alert(ti, me, bt);
}
