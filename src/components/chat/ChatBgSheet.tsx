import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import { wallpapers } from '@/components/chat/parts';
import { Text } from '@/components/T';
import { Body, Btn, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { parseWall, photoWall, presetWall } from '@/lib/chatBg';
import { PRESETS } from '@/lib/dash/backgrounds';
import { pickNetMedia } from '@/lib/netMedia';
import { useChatBg } from '@/store/chatBg';
import { toast } from '@/store/toast';

/** Sceglie lo sfondo di una chat: un colore, un modello di sfumatura oppure una tua foto. */
export function ChatBgSheet({ visible, value, onPick, onClose, onReopen, title = 'Sfondo della chat' }: { visible: boolean; value: string | undefined; onPick: (key: string) => void; onClose: () => void; /** riapre la scheda dopo la scelta della foto */ onReopen?: () => void; title?: string }) {
  const t = useTheme();
  const dim = useChatBg((s) => s.dim);
  const setDim = useChatBg((s) => s.setDim);
  const cur = parseWall(value);
  const photo = cur.kind === 'photo' ? cur.uri : null;
  const ring = (on: boolean) => ({ borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.border });
  const pick = async () => {
    // su iPhone il selettore foto non si apre sopra una finestra: si chiude, si sceglie e si riapre
    onClose();
    await new Promise((r) => setTimeout(r, 550));
    try { const m = await pickNetMedia('photo'); if (m) onPick(photoWall(m.uri)); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); }
    onReopen?.();
  };
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Body bold>Colori</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={10}>
        {Object.entries(wallpapers).map(([k, w]) => (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={w.label} onPress={() => onPick(k)} style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: t.mode === 'light' ? w.light : w.dark, ...ring(cur.kind === 'color' && cur.key === k) }} />
            <Text style={{ color: t.muted, fontSize: 10.5 }}>{w.label}</Text>
          </Pressable>
        ))}
      </Row>
      <Body bold style={{ marginTop: 16 }}>Modelli</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={10}>
        {PRESETS.filter((p) => p.colors.length > 2).map((p) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => onPick(presetWall(p.id))} style={{ alignItems: 'center', gap: 4 }}>
            <LinearGradient colors={p.colors as [string, string, ...string[]]} start={{ x: p.from[0], y: p.from[1] }} end={{ x: p.to[0], y: p.to[1] }} style={{ width: 60, height: 60, borderRadius: 14, ...ring(cur.kind === 'preset' && cur.preset.id === p.id) }} />
            <Text style={{ color: t.muted, fontSize: 10.5 }}>{p.name}</Text>
          </Pressable>
        ))}
      </Row>
      <Body bold style={{ marginTop: 16 }}>La tua foto</Body>
      <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={10}>
        {photo ? <Image source={{ uri: photo }} style={{ width: 60, height: 80, borderRadius: 14, ...ring(true) }} contentFit="cover" /> : null}
        <View style={{ gap: 8 }}>
          <Btn small icon="image" title={photo ? 'Cambia foto' : 'Scegli una foto'} onPress={() => void pick()} />
          {photo ? <Btn small ghost danger icon="trash" title="Togli la foto" onPress={() => onPick('default')} /> : null}
        </View>
      </Row>
      {photo ? (
        <View>
          <Body small muted style={{ marginTop: 10 }}>Quanto scurirla, per tenere leggibili i messaggi:</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={6}>
            {[0, 0.25, 0.4, 0.6, 0.8].map((d) => <Pill key={d} label={d === 0 ? 'Niente' : `${Math.round(d * 100)}%`} on={Math.abs(dim - d) < 0.01} onPress={() => setDim(d)} />)}
          </Row>
        </View>
      ) : null}
    </Sheet>
  );
}
