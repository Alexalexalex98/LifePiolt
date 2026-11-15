import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { t } from '@/i18n/core';
import { toast } from '@/store/toast';

/**
 * Protegge una schermata con contenuti riservati (LifeClub): su Android lo schermo non si può catturare né registrare; su iPhone
 * la cattura del sistema esce nera dove il sistema lo permette, e se qualcuno scatta uno screenshot viene avvisato che il contenuto è riservato.
 * La filigrana con il nome di chi guarda resta comunque sopra foto e video. Sul web non fa niente.
 */
export function useProtectedContent(key: string): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    try { sub = ScreenCapture.addScreenshotListener(() => toast(t('Questo contenuto è riservato agli iscritti: non si può ripubblicare. Porta il nome di chi lo guarda.'))); } catch { /* non disponibile */ }
    return () => { sub?.remove(); void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, [key]);
}
