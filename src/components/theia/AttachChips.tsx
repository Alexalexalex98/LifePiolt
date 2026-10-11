import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Pill } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { DOC_LABEL, fmtBytes, type Att } from '@/lib/attachments';
import { Icon } from '@/lib/icons';
import { openBillReview } from './billRoute';

const ICON: Record<Att['kind'], string> = { image: 'image', document: 'file', text: 'edit', location: 'location', contact: 'contact', note: 'note', event: 'calendar' };

/** Riga secondaria del chip: tipo e dimensione, oppure il dettaglio (telefono, orario...). */
export function attMeta(a: Att): string {
  if (a.kind === 'document') return [a.mime?.startsWith('video/') ? 'Video' : DOC_LABEL[a.docType ?? 'other'], fmtBytes(a.size)].filter(Boolean).join(' · ');
  if (a.kind === 'text') return [translateText('Testo'), a.size ? `${a.size} ${translateText('caratteri')}` : ''].filter(Boolean).join(' · ');
  if (a.kind === 'note') return translateText('Nota di LifePilot');
  if (a.kind === 'event') return a.sub ?? translateText('Impegno');
  return a.sub ?? '';
}

/** Anteprima di un allegato: miniatura per le immagini, chip con icona/nome/dimensione per il resto. `onRemove` mostra la X. */
export function AttachChip({ a, onRemove, me }: { a: Att; onRemove?: () => void; me?: boolean }) {
  const t = useTheme();
  const ink = me ? '#111' : t.text, soft = me ? '#556' : t.muted;
  if (a.kind === 'image' && a.uri) {
    return (
      <View style={{ width: 64, height: 64 }}>
        <Image source={{ uri: a.uri }} accessible accessibilityRole="image" accessibilityLabel={`${translateText('Immagine allegata')}: ${a.name}`} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.item }} contentFit="cover" />
        {onRemove ? <RemoveX onPress={onRemove} label={`${translateText('Rimuovi')} ${a.name}`} /> : null}
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={`${a.name}. ${attMeta(a)}`} style={{ minHeight: 48, maxWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 8, paddingStart: 10, paddingEnd: onRemove ? 30 : 12, backgroundColor: me ? '#d4dbe8' : t.chip }}>
      <Icon name={ICON[a.kind]} size={20} color={a.kind === 'document' && a.docType === 'pdf' ? '#e5484d' : (me ? '#334' : t.accent)} stroke={1.9} />
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ color: ink, fontSize: 13, fontWeight: '700' }}>{a.name}</Text>
        {attMeta(a) ? <Text numberOfLines={1} style={{ color: soft, fontSize: 11 }}>{attMeta(a)}</Text> : null}
      </View>
      {onRemove ? <RemoveX onPress={onRemove} label={`${translateText('Rimuovi')} ${a.name}`} /> : null}
    </View>
  );
}

function RemoveX({ onPress, label }: { onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={{ position: 'absolute', top: -6, end: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="x" size={12} color={t.bg} stroke={2.6} />
    </Pressable>
  );
}

/** Chip "Analizza come bolletta/fattura" per i documenti che ne hanno l'aspetto. */
export function BillChip({ a }: { a: Att }) {
  if (!a.billish || a.kind === 'image') return null;
  return <Pill icon="euro" label="Analizza come bolletta/fattura" onPress={() => openBillReview(a)} />;
}

/** Allegati di un messaggio già inviato (sola lettura). */
export function MessageAttachments({ items, me }: { items: Att[]; me?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 6, marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{items.map((a) => <AttachChip key={a.id} a={a} me={me} />)}</View>
      {items.some((a) => a.billish && a.kind !== 'image') ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{items.filter((a) => a.billish && a.kind !== 'image').map((a) => <BillChip key={a.id} a={a} />)}</View> : null}
    </View>
  );
}
