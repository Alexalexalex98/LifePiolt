import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { TextInput as RNTextInput, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, H, Input, Pill, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { anchorLabel, canComment, canWriteChat, fmtClock, qaRating, qaScore, sortByAnchor, type Anchor, type Club, type ClubComment, type Course, type Lesson, type MemberTier } from '@/lib/club';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { useApp } from '@/store/app';
import { answerSignalsFor, useClub } from '@/store/club';
import { postLessonComment, replyToComment } from '@/store/clubFlow';
import { toast } from '@/store/toast';
import { AnswerVote } from './AnswerVote';
import { Chip } from './parts';

type Filter = 'Tutti' | 'Domande' | 'Da risolvere';

/** Domande e commenti ancorati (minuto, pagina, paragrafo) con thread, risolte e voto alle risposte. */
export function LessonThread({ club, course, lesson, tier, pos, anchor, setAnchor, onSeek, focusNonce, timed }: {
  club: Club; course: Course; lesson: Lesson; tier: MemberTier | 'none'; pos: number; anchor: Anchor | undefined; setAnchor: (a: Anchor | undefined) => void;
  onSeek: (a: Anchor) => void; focusNonce: number; timed: boolean;
}) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const all = useClub((s) => s.comments);
  const [filter, setFilter] = useState<Filter>('Tutti');
  const [text, setText] = useState('');
  const [isQ, setIsQ] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const inputRef = useRef<ComponentRef<typeof RNTextInput>>(null);
  useEffect(() => { if (focusNonce > 0) setTimeout(() => inputRef.current?.focus(), 80); }, [focusNonce]);

  const mine = useMemo(() => all.filter((c) => c.lessonId === lesson.id && c.clubId === club.id), [all, lesson.id, club.id]);
  const tops = useMemo(() => sortByAnchor(mine.filter((c) => !c.parentId)), [mine]);
  const shown = tops.filter((c) => (filter === 'Domande' ? c.isQuestion : filter === 'Da risolvere' ? c.isQuestion && !c.resolved : true));
  const viewer = { user: me, owner: club.owner, tier };
  const allowed = canComment(club.chat, viewer);
  const toChat = canWriteChat(club.chat, viewer).ok;

  function send() {
    const r = postLessonComment({ club, course, lesson, text, anchor, isQuestion: isQ });
    if (!r.ok) { toast(r.reason ?? 'Non riesco a inviare'); return; }
    setText(''); setAnchor(undefined);
    toast(r.chatMsgId ? 'Inviata anche nella chat del club' : 'Commento pubblicato');
  }

  return (
    <Card>
      <Row><H>{`Domande e commenti (${mine.length})`}</H></Row>
      <Row style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }} gap={6}>
        {(['Tutti', 'Domande', 'Da risolvere'] as Filter[]).map((f) => <Pill key={f} label={f} on={filter === f} onPress={() => setFilter(f)} />)}
      </Row>

      {/* scrivere */}
      <View style={{ marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: t.chip, gap: 8 }}>
        {allowed ? (
          <>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {timed && <Btn small icon="help" title={`Chiedi qui · ${fmtClock(pos)}`} onPress={() => { setAnchor({ kind: 'time', sec: Math.floor(pos) }); setTimeout(() => inputRef.current?.focus(), 50); }} />}
              {anchor && <Pill icon="x" label={anchor.kind === 'time' ? `al minuto ${anchorLabel(anchor)}` : anchor.kind === 'page' ? `pagina ${anchor.page}` : `paragrafo ${anchor.para}`} on onPress={() => setAnchor(undefined)} />}
              <Pill label="Domanda" icon="help" on={isQ} onPress={() => setIsQ(!isQ)} />
            </Row>
            <Input {...({ ref: inputRef } as object)} placeholder={anchor ? 'Scrivi la tua domanda o il commento…' : timed ? 'Scrivi un commento (o tocca «Chiedi qui» per legarlo al minuto)' : 'Scrivi un commento…'} value={text} onChangeText={setText} maxLines={4} maxLength={600} />
            <Row>
              <Body small muted style={{ flex: 1 }}>{isQ && toChat ? 'La domanda arriva anche nella chat del club: il creatore ti risponde lì e ricevi la notifica.' : isQ ? 'Resta nei commenti della lezione (la chat è in sola lettura per te).' : 'Visibile a chi guarda la lezione.'}</Body>
              <Btn small icon="send" title="Invia" disabled={!text.trim()} onPress={send} />
            </Row>
          </>
        ) : (
          <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="lock" size={16} color={t.muted} /><Body small muted style={{ flex: 1 }}>{tier === 'none' ? 'Iscriviti (anche gratis) per commentare e fare domande.' : 'Il creatore ha limitato i commenti per il tuo livello.'}</Body></Row>
        )}
      </View>

      {/* elenco */}
      <View style={{ marginTop: 6 }}>
        {shown.length === 0 && <Body small muted style={{ textAlign: 'center', paddingVertical: 18 }}>{mine.length ? 'Nessun commento in questo filtro.' : 'Nessuna domanda ancora: sii il primo.'}</Body>}
        {shown.map((c) => (
          <CommentItem key={c.id} c={c} club={club} replies={mine.filter((r) => r.parentId === c.id).sort((a, b) => a.ts - b.ts)} me={me} onSeek={onSeek}
            replying={replyTo === c.id} setReplying={(on) => setReplyTo(on ? c.id : null)} />
        ))}
      </View>
    </Card>
  );
}

function AuthorRating({ person }: { person: string }) {
  const t = useTheme();
  const votes = useClub((s) => s.votes);
  const comments = useClub((s) => s.comments);
  const r = useMemo(() => qaScore(answerSignalsFor({ votes, comments }, person)), [votes, comments, person]);
  if (r.n === 0) return null;
  return <Row gap={3}><Icon name="award" size={11} color={t.accent} /><Text style={{ color: t.accent, fontSize: 11, fontWeight: '700' }}>{r.rating.toFixed(1)}</Text></Row>;
}

function CommentItem({ c, club, replies, me, onSeek, replying, setReplying }: { c: ClubComment; club: Club; replies: ClubComment[]; me: string; onSeek: (a: Anchor) => void; replying: boolean; setReplying: (on: boolean) => void }) {
  const t = useTheme();
  const [reply, setReply] = useState('');
  const isOwner = club.owner === me;
  const body = (x: ClubComment, nested: boolean) => (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: nested ? 10 : 0 }}>
      <UserAvatar name={x.author} size={nested ? 26 : 32} />
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{x.author === me ? 'Tu' : x.author}</Text>
          {x.author === club.owner && <Chip label="Creatore" color={t.accent} />}
          {x.author !== club.owner && x.parentId ? null : null}
          <AuthorRating person={x.author} />
          {x.anchor && !nested ? (
            <Press onPress={() => onSeek(x.anchor!)} accessibilityLabel={`Vai a ${anchorLabel(x.anchor)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#f5b30133' }}>
              <Icon name={x.anchor.kind === 'time' ? 'play' : 'file'} size={10} color="#b9892b" fill={x.anchor.kind === 'time' ? '#b9892b' : 'none'} />
              <Text style={{ color: '#b9892b', fontSize: 11, fontWeight: '700' }}>{anchorLabel(x.anchor)}</Text>
            </Press>
          ) : null}
          {x.isQuestion && !nested ? <Chip label={x.resolved ? 'Risolta' : 'Domanda'} icon={x.resolved ? 'check' : 'help'} color={x.resolved ? t.positive : t.accent} /> : null}
          {x.chatMsgId && !nested ? <Chip label="Anche in chat" icon="comment" /> : null}
        </Row>
        <Text style={{ color: t.text, fontSize: 14, lineHeight: 20, marginTop: 3 }}>{x.text}</Text>
        <Row style={{ justifyContent: 'flex-start', marginTop: 4 }} gap={14}>
          <Press onPress={() => useClub.getState().toggleLike(x.id, me)} accessibilityLabel="Mi piace" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
            <Icon name="heart" size={15} color={x.likes.includes(me) ? '#ff5d7a' : t.muted} fill={x.likes.includes(me) ? '#ff5d7a' : 'none'} />
            <Text style={{ color: t.muted, fontSize: 12 }}>{x.likes.length || ''}</Text>
          </Press>
          <Press onPress={() => useClub.getState().toggleSave(x.id, me)} accessibilityLabel="Salva" style={{ paddingVertical: 4 }}><Icon name="bookmark" size={15} color={x.saved.includes(me) ? t.accent : t.muted} fill={x.saved.includes(me) ? t.accent : 'none'} /></Press>
          {!nested && <Press onPress={() => setReplying(!replying)} accessibilityLabel="Rispondi" style={{ paddingVertical: 4 }}><Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Rispondi</Text></Press>}
          {!nested && x.isQuestion && (x.author === me || isOwner) && <Press onPress={() => useClub.getState().setResolved(x.id, !x.resolved)} accessibilityLabel={x.resolved ? 'Riapri' : 'Segna come risolta'} style={{ paddingVertical: 4 }}><Text style={{ color: x.resolved ? t.muted : t.positive, fontSize: 12, fontWeight: '600' }}>{x.resolved ? 'Riapri' : 'Segna come risolta'}</Text></Press>}
          {(x.author === me || isOwner) && <Press onPress={() => confirmDelete(nested ? 'questa risposta' : 'questa domanda e le sue risposte', () => useClub.getState().deleteComment(x.id))} accessibilityLabel="Elimina" style={{ paddingVertical: 4 }}><Icon name="trash" size={14} color={t.muted} /></Press>}
        </Row>
        {nested && x.author !== c.author && <AnswerVote clubId={club.id} answerId={x.id} questionId={c.id} asker={c.author} answerer={x.author} />}
      </View>
    </View>
  );
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.border }}>
      {body(c, false)}
      {replies.length > 0 && <View style={{ marginStart: 20, paddingStart: 10, borderStartWidth: 2, borderStartColor: t.border }}>{replies.map((r) => <View key={r.id}>{body(r, true)}</View>)}</View>}
      {replying && (
        <View style={{ marginStart: 20, marginTop: 8, gap: 6 }}>
          <Input placeholder="Scrivi una risposta…" value={reply} onChangeText={setReply} maxLines={4} maxLength={600} />
          <Row style={{ justifyContent: 'flex-end' }} gap={8}>
            <Btn small ghost title="Annulla" onPress={() => { setReplying(false); setReply(''); }} />
            <Btn small icon="send" title="Rispondi" disabled={!reply.trim()} onPress={() => { const r = replyToComment(club, c, reply); if (!r.ok) toast(r.reason ?? 'Non riesco a inviare'); else { setReply(''); setReplying(false); } }} />
          </Row>
        </View>
      )}
    </View>
  );
}

export { qaRating };
