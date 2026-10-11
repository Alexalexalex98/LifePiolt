import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Anchor, Lesson } from '@/lib/club';
import { Icon } from '@/lib/icons';
import { fmtSize } from '@/lib/chatMedia';
import { toast } from '@/store/toast';

/** Pagine di un PDF di esempio (testo con \f) o paragrafi di una lezione di testo. */
export const textPages = (l: Lesson) => (l.text ?? '').split('\f').map((s) => s.trim()).filter(Boolean);
export const textParas = (l: Lesson) => (l.text ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

/**
 * Lettore di PDF, testo, file e link. I commenti si ancorano alla pagina (PDF) o al paragrafo (testo).
 * Un PDF vero scelto dal creatore si apre con l'app di sistema; la pagina da citare si imposta a mano.
 */
export function DocStage({ lesson, page, setPage, para, setPara, counts, onAsk }: {
  lesson: Lesson; page: number; setPage: (n: number) => void; para: number | null; setPara: (n: number | null) => void;
  /** numero di commenti per ancora: chiavi 'p<n>' pagina, 'q<n>' paragrafo */
  counts: Record<string, number>; onAsk: (a: Anchor) => void;
}) {
  const t = useTheme();
  const [imgErr, setImgErr] = useState(false);
  const openUri = (uri?: string) => {
    if (!uri) return toast('Questo file non è disponibile');
    void Linking.openURL(uri).catch(() => toast('Non riesco ad aprire il file con un\'altra app'));
  };

  if (lesson.kind === 'testo') {
    const paras = textParas(lesson);
    return (
      <View style={{ gap: 8 }}>
        {paras.map((p, i) => {
          const n = i + 1, c = counts[`q${n}`] ?? 0, sel = para === n;
          return (
            <Pressable key={i} onPress={() => setPara(sel ? null : n)} accessibilityLabel={`Paragrafo ${n}`} style={{ padding: 12, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: sel ? t.accent : t.border }}>
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{p}</Text>
              <Row style={{ marginTop: 6 }}>
                <Text style={{ color: t.muted, fontSize: 11 }}>{`Paragrafo ${n}${c ? ` · ${c} ${c === 1 ? 'commento' : 'commenti'}` : ''}`}</Text>
                {sel ? <Btn small icon="help" title="Chiedi qui" onPress={() => onAsk({ kind: 'para', para: n })} /> : null}
              </Row>
            </Pressable>
          );
        })}
        {!paras.length && <Body muted>Questa lezione non ha ancora testo.</Body>}
      </View>
    );
  }

  if (lesson.kind === 'pdf') {
    const pages = textPages(lesson);
    const total = pages.length || lesson.pages || 1;
    const hasText = pages.length > 0;
    const c = counts[`p${page}`] ?? 0;
    return (
      <View>
        <View style={{ minHeight: 200, padding: 16, borderRadius: 14, backgroundColor: '#fbfbf7', borderWidth: 1, borderColor: t.border }}>
          {hasText
            ? <Text style={{ color: '#1b1f27', fontSize: 15, lineHeight: 23 }}>{pages[Math.min(pages.length, page) - 1]}</Text>
            : (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
                <Icon name="file" size={34} color="#1b1f27" />
                <Text style={{ color: '#1b1f27', fontWeight: '700', textAlign: 'center' }}>{lesson.fileName ?? 'Documento PDF'}</Text>
                <Text style={{ color: '#55606f', fontSize: 12 }}>{[fmtSize(lesson.size), lesson.pages ? `${lesson.pages} pagine` : ''].filter(Boolean).join(' · ')}</Text>
                <Btn small icon="share" title="Apri il PDF" onPress={() => openUri(lesson.uri)} />
              </View>
            )}
        </View>
        <Row style={{ marginTop: 8 }}>
          <Row gap={8}>
            <Btn small ghost title="‹" disabled={page <= 1} onPress={() => setPage(page - 1)} />
            <Text style={{ color: t.text, fontWeight: '600' }}>{`Pagina ${page}${hasText || lesson.pages ? ` di ${total}` : ''}`}</Text>
            <Btn small ghost title="›" disabled={(hasText || !!lesson.pages) && page >= total} onPress={() => setPage(page + 1)} />
          </Row>
          <Btn small icon="help" title="Chiedi qui" onPress={() => onAsk({ kind: 'page', page })} />
        </Row>
        {c > 0 && <Body small muted style={{ marginTop: 4 }}>{`${c} ${c === 1 ? 'commento' : 'commenti'} su questa pagina`}</Body>}
      </View>
    );
  }

  if (lesson.kind === 'link') {
    return (
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center', gap: 8 }}>
        <Icon name="link" size={30} color={t.text} />
        <Text numberOfLines={2} style={{ color: t.accent, textAlign: 'center' }}>{lesson.url}</Text>
        <Btn small icon="arrow-right" title="Apri il link" onPress={() => openUri(lesson.url)} />
      </View>
    );
  }

  const isImage = (lesson.mime ?? '').startsWith('image/') && !!lesson.uri && !imgErr;
  return (
    <View>
      {isImage
        ? <Image source={{ uri: lesson.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: t.item }} contentFit="contain" onError={() => setImgErr(true)} accessibilityLabel={lesson.title} />
        : (
          <View style={{ padding: 18, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center', gap: 8 }}>
            <Icon name="paperclip" size={30} color={t.text} />
            <Text style={{ color: t.text, fontWeight: '700', textAlign: 'center' }}>{lesson.fileName ?? lesson.title}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{fmtSize(lesson.size)}</Text>
            <Btn small icon="share" title="Apri il file" onPress={() => openUri(lesson.uri)} />
          </View>
        )}
    </View>
  );
}
