import { DevSettings, I18nManager, Platform } from 'react-native';

import { loadCatalogs } from './catalogs';
import { setActive } from './core';
import { infoOf, type LangCode } from './languages';

/** Attiva la lingua: cataloghi, direzione di scrittura (arabo da destra a sinistra), lingua del documento sul web. Ritorna true se serve riaprire l'app. */
export function applyLanguage(code: LangCode): boolean {
  loadCatalogs();
  setActive(code);
  const info = infoOf(code);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') { document.documentElement.lang = info.code; document.documentElement.dir = info.rtl ? 'rtl' : 'ltr'; }
    return false;
  }
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== info.rtl) {
      I18nManager.forceRTL(info.rtl);
      // in sviluppo (Expo Go) ricarico da solo; nell'app installata serve riaprirla
      if (__DEV__) { try { DevSettings.reload(); } catch { /* ignore */ } }
      return true;
    }
  } catch { /* ignore */ }
  return false;
}
