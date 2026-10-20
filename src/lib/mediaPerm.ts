import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Permesso per scegliere foto dalla galleria. Su Android il selettore di sistema non chiede nessun permesso (e l'app non
 * dichiara READ_EXTERNAL_STORAGE, anzi lo blocca): chiederlo risponderebbe «negato» subito, senza mostrare alcuna finestra.
 * Quindi su Android si va direttamente al selettore; su iPhone si chiede come prima.
 */
export async function libraryPermission(): Promise<ImagePicker.MediaLibraryPermissionResponse> {
  if (Platform.OS === 'android') return { status: ImagePicker.PermissionStatus.GRANTED, granted: true, canAskAgain: true, expires: 'never' };
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}
