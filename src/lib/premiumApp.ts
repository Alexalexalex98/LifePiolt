/**
 * Funzioni del Premium di LifePilot (modulo PURO). Sono diverse dal LifePass, che serve solo per entrare nei centri.
 * Per ora, in fase di sviluppo, tutto è sbloccato al massimo: quando il Premium avrà un abbonamento vero basterà
 * cambiare `ALL_UNLOCKED` e collegare lo stato dell'abbonamento.
 */
export const ALL_UNLOCKED = true;
export type PremiumFeature = 'meal-photo' | 'exercise-check';
export const PREMIUM_FEATURES: Record<PremiumFeature, string> = {
  'meal-photo': 'Analisi del piatto da una foto',
  'exercise-check': 'Controllo dell\'esecuzione dal video',
};
export const hasPremiumFeature = (_f: PremiumFeature, subscribed = false): boolean => ALL_UNLOCKED || subscribed;
