import { I18nManager, Platform } from 'react-native';

import { getActive } from '@/i18n/core';
import { infoOf } from '@/i18n/languages';

/** true se il layout è da destra a sinistra: su nativo conta I18nManager (cambia dopo il riavvio), sul web la lingua attiva. */
export const isRtlLayout = (): boolean => (Platform.OS === 'web' ? infoOf(getActive()).rtl : I18nManager.isRTL);
/** Allineamento del testo "a fine riga" (valori numerici a destra in LTR, a sinistra in RTL). Da chiamare al render. */
export const endAlign = (): 'left' | 'right' => (isRtlLayout() ? 'left' : 'right');
