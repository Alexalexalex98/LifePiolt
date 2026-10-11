import { View } from 'react-native';
import { Text } from '@/components/T';

import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { fmtClock, type Access, type Lesson } from '@/lib/club';
import { Chip } from './parts';

export const KIND_ICON: Record<Lesson['kind'], string> = { video: 'video', audio: 'headphones', pdf: 'file', testo: 'note', file: 'paperclip', link: 'link' };
export const KIND_LABEL: Record<Lesson['kind'], string> = { video: 'Video', audio: 'Audio', pdf: 'PDF', testo: 'Testo', file: 'File', link: 'Link' };

/** Riga di una lezione: icona del tipo, titolo, durata, lucchetto se premium e non sbloccata, spunta se completata. */
export function LessonRow({ index, lesson, access, done, onPress, last }: { index: number; lesson: Lesson; access: Access; done?: boolean; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  const locked = !access.ok;
  return (
    <Press onPress={onPress} accessibilityLabel={`${lesson.title}${locked ? ', bloccata' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: done ? t.positiveBg : t.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={done ? 'check' : locked ? 'lock' : KIND_ICON[lesson.kind]} size={done ? 18 : 17} color={done ? t.positive : t.text} stroke={done ? 2.4 : 1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ color: locked ? t.muted : t.text, fontSize: 15, fontWeight: '600' }}>{`${index}. ${lesson.title}`}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <Text style={{ color: t.muted, fontSize: 12 }}>{KIND_LABEL[lesson.kind]}{lesson.durationSec ? ` · ${fmtClock(lesson.durationSec)}` : lesson.pages ? ` · ${lesson.pages} pag.` : ''}</Text>
          {lesson.preview && lesson.tier === 'premium' ? <Chip label="Anteprima gratuita" color={t.positive} /> : lesson.tier === 'premium' ? <Chip label="Premium" icon="lock" color="#b9892b" /> : null}
        </View>
      </View>
      <Icon name="chevron-right" size={16} color={t.muted} />
    </Press>
  );
}
