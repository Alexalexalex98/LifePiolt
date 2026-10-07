import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DataChart } from '@/components/DataChart';
import { Body, XBtn } from '@/components/ui';
import type { FileRef, Question } from '@/data/skillBank';
import { useTheme } from '@/hooks/use-theme';
import { fmtDuration } from '@/lib/hiring';
import { Icon } from '@/lib/icons';
import { fmtBytes, isImage, openFile } from '@/lib/jobFiles';
import { toast } from '@/store/toast';

/** Riga di un file: toccandola si scarica / apre. Con `onRemove` mostra "Rimuovi". */
export function FileChip({ f, onRemove, label }: { f: FileRef; onRemove?: () => void; label?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={async () => { if (!(await openFile(f))) toast('Impossibile aprire il file su questo dispositivo'); }}
      accessibilityRole="button" accessibilityLabel={`${label ?? 'Apri'} ${f.name}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.item, borderRadius: 12, padding: 10, marginTop: 6, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={isImage(f) ? 'image' : 'file'} size={20} color={t.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{f.name}</Text>
        <Text style={{ color: t.muted, fontSize: 11 }}>{[fmtBytes(f.size), label ?? 'Tocca per aprire'].filter(Boolean).join(' · ')}</Text>
      </View>
      {onRemove ? <XBtn onPress={onRemove} /> : <Icon name="share" size={16} color={t.muted} />}
    </Pressable>
  );
}

export function FileList({ files, onRemove, label }: { files: FileRef[]; onRemove?: (i: number) => void; label?: string }) {
  return <>{files.map((f, i) => <FileChip key={`${f.uri.slice(-24)}-${i}`} f={f} label={label} onRemove={onRemove ? () => onRemove(i) : undefined} />)}</>;
}

/** Contesto, immagine, grafico e testo di una domanda (usata da candidato, correzione e anteprima). */
export function QuestionView({ q, noPrompt }: { q: Question; noPrompt?: boolean }) {
  const t = useTheme();
  return (
    <View>
      {q.ctx ? (
        <View style={{ backgroundColor: t.item, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Testo di riferimento</Text>
          <Text style={{ color: t.text, fontSize: 14, lineHeight: 21 }}>{q.ctx}</Text>
        </View>
      ) : null}
      {q.img ? <Image source={{ uri: q.img.uri }} contentFit="contain" accessibilityLabel={q.img.name} style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: t.item, marginBottom: 12 }} /> : null}
      {q.chart ? <DataChart spec={q.chart} /> : null}
      {!noPrompt && <Body bold style={{ fontSize: 17, marginBottom: 12 }}>{q.prompt}</Body>}
    </View>
  );
}

/** Ora corrente che si aggiorna ogni secondo (per i conti alla rovescia). */
export function useNow(active = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Countdown({ leftMs, big }: { leftMs: number; big?: boolean }) {
  const t = useTheme();
  const over = leftMs <= 0;
  const c = over ? t.danger : leftMs < 300000 ? t.warn : t.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="timer" size={big ? 22 : 16} color={c} />
      <Text style={{ color: c, fontWeight: '800', fontSize: big ? 28 : 14, fontVariant: ['tabular-nums'] }}>{over ? `-${fmtDuration(leftMs)}` : fmtDuration(leftMs)}</Text>
    </View>
  );
}
