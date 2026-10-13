import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/components/T';
import { kindOfFile, presentHelp } from '@/lib/presentation';
import { PdfView } from './PdfView';

/** Mostra un file nell'app: PDF e immagini. Gli altri tipi spiegano cosa fare. */
export function DocView({ uri, name, mime, dark = true }: { uri: string; name: string; mime?: string | null; dark?: boolean }) {
  const kind = kindOfFile(name, mime);
  if (kind === 'pdf') return <PdfView uri={uri} dark={dark} />;
  if (kind === 'image') return <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={name} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={{ color: dark ? '#fff' : '#111', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{presentHelp(kind)}</Text>
    </View>
  );
}
