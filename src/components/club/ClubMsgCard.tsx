import { View } from 'react-native';
import { Text } from '@/components/T';

import { Press } from '@/components/ui';
import { useChatColors } from '@/components/chat/parts';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import type { ChatMessage } from '@/store/chat';
import { useClub } from '@/store/club';
import { AnswerVote } from './AnswerVote';

const TITLE = { question: 'Domanda su', answer: 'Risposta su', content: 'Nuova lezione', announce: 'Annuncio' } as const;

/**
 * Parte "LifeClub" di una bolla: collegamento alla lezione (apre il video a quel minuto), domanda evidenziata, messaggio fissato,
 * e voto alla risposta ("Botta e risposta").
 */
export function ClubMsgCard({ m, me, quoted }: { m: ChatMessage; me: string; quoted?: ChatMessage }) {
  const c = useChatColors();
  const comments = useClub((s) => s.comments);
  const meta = m.club;
  const clubId = m.chatId.startsWith('club:') ? m.chatId.slice(5) : '';
  const open = () => {
    if (!meta?.lessonId) return;
    go('clubContent', { id: clubId, lesson: meta.lessonId, ...(meta.sec != null ? { t: String(Math.floor(meta.sec)) } : {}), ...(meta.page != null ? { page: String(meta.page) } : {}), ...(meta.para != null ? { para: String(meta.para) } : {}) });
  };
  // risposta votabile: o e' una risposta collegata a una lezione, o e' una risposta (reply) a una domanda segnata nella chat
  let vote: { answerId: string; questionId: string; asker: string; answerer: string } | null = null;
  if (meta?.kind === 'answer' && meta.commentId) {
    const a = comments.find((x) => x.id === meta.commentId);
    const q = a?.parentId ? comments.find((x) => x.id === a.parentId) : undefined;
    if (a && q) vote = { answerId: a.id, questionId: q.id, asker: q.author, answerer: a.author };
  } else if (!meta && quoted?.club?.kind === 'question' && quoted.from !== m.from) {
    vote = { answerId: m.id, questionId: quoted.id, asker: quoted.from, answerer: m.from };
  }
  const label = meta ? (meta.kind === 'question' && !meta.lessonId ? 'Domanda' : meta.label ? `${TITLE[meta.kind]} «${meta.label}»` : TITLE[meta.kind]) : '';
  return (
    <View>
      {m.pinned && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}><Icon name="pin" size={12} color={c.meta} /><Text style={{ color: c.meta, fontSize: 11, fontWeight: '700' }}>Fissato dal creatore</Text></View>}
      {meta && (
        <Press onPress={open} disabled={!meta.lessonId} accessibilityLabel={label} style={{ backgroundColor: c.quoteBg, borderStartWidth: 4, borderStartColor: meta.kind === 'question' ? '#e5a100' : meta.kind === 'answer' ? '#34a06b' : '#5b8def', borderRadius: 6, padding: 6, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name={meta.kind === 'question' ? 'help' : meta.kind === 'content' ? 'lifeclub' : meta.kind === 'answer' ? 'check' : 'info'} size={13} color={c.meta} />
            <Text numberOfLines={1} style={{ color: c.meta, fontSize: 12, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
            {meta.lessonId ? <Icon name={meta.sec != null ? 'play' : 'arrow-right'} size={11} color={c.meta} fill={meta.sec != null ? c.meta : 'none'} /> : null}
          </View>
          {meta.lessonTitle ? <Text numberOfLines={1} style={{ color: c.meta, fontSize: 12, marginTop: 1 }}>{meta.lessonTitle}</Text> : null}
        </Press>
      )}
      {vote && vote.answerer !== me && <AnswerVote clubId={clubId} {...vote} />}
    </View>
  );
}
