import { useEffect, useRef, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { PhotoEditor } from '@/components/photo/PhotoEditor';
import { Body, Btn } from '@/components/ui';
import { openSheet } from '@/components/network';
import { setEditorInput, setEditorResult, takeEditorInput, type PostFx } from '@/lib/editorHandoff';
import type { NetMedia } from '@/lib/netMedia';
import { go, goBack } from '@/lib/nav';
import { loadSkia } from '@/lib/skiaSafe';

/** Editor foto a schermo intero: parte dalla foto del post, restituisce la foto ritoccata (un file nuovo) e riapre il post. */
export default function PhotoEdit() {
  const input = useRef(takeEditorInput());
  const [Canvas, setCanvas] = useState<ComponentType<never> | null>(null);
  const [missing, setMissing] = useState(false);
  const media = input.current?.items[0] as NetMedia | undefined;
  const fx = input.current?.fx as PostFx | undefined;

  useEffect(() => {
    if (!loadSkia()) { setMissing(true); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setCanvas(() => (require('@/components/photo/PhotoCanvas') as { default: ComponentType<never> }).default);
    } catch { setMissing(true); }
  }, []);

  const back = (m: NetMedia, f?: PostFx) => { setEditorResult({ items: [m], ...(f ? { fx: f } : {}) }); goBack(); setTimeout(() => openSheet('newPost', { resume: true }), 350); };

  if (!media) return <View style={{ flex: 1, backgroundColor: '#0b0c10', alignItems: 'center', justifyContent: 'center' }}><Body>Nessuna foto da modificare.</Body><Btn style={{ marginTop: 12 }} title="Indietro" onPress={() => goBack()} /></View>;
  if (missing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0c10', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>Questa versione dell’app non ha ancora il nuovo editor</Text>
        <Text style={{ color: '#9aa3b5', textAlign: 'center' }}>Serve una build aggiornata. Intanto puoi usare l’editor semplice.</Text>
        <Btn title="Usa l’editor semplice" onPress={() => { setEditorInput({ items: [media], ...(fx ? { fx } : {}) }); go('storyCreate', { for: 'post' }); }} />
        <Btn ghost title="Indietro" onPress={() => back(media, fx)} />
      </View>
    );
  }
  if (!Canvas) return <View style={{ flex: 1, backgroundColor: '#0b0c10' }} />;
  return <PhotoEditor uri={media.uri} Canvas={Canvas as never} onCancel={() => back(media, fx)} onDone={(uri) => back(uri ? { ...media, uri } : media, fx)} />;
}
