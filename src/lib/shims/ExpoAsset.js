/**
 * Sostituto di expo-asset/build/ExpoAsset.js: la versione originale lancia un errore («Cannot find native module 'ExpoAsset'»)
 * quando l'app in esecuzione (Expo Go o una build vecchia) non contiene quel modulo nativo, e l'errore compare come schermata rossa
 * appena qualcosa carica expo-asset. Qui il modulo e' opzionale: se c'e' si usa, altrimenti si restituisce l'indirizzo cosi' com'e'.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

const AssetModule = requireOptionalNativeModule('ExpoAsset');

export async function downloadAsync(url, md5Hash, type) {
  if (AssetModule && typeof AssetModule.downloadAsync === 'function') return AssetModule.downloadAsync(url, md5Hash, type);
  return url;
}
