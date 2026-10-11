import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { DocStage } from '@/components/club/DocStage';
import { useClubSeed } from '@/components/club/hooks';
import { KIND_LABEL } from '@/components/club/LessonRow';
import { LessonThread } from '@/components/club/LessonThread';
import { MediaStage, type SeekReq } from '@/components/club/MediaStage';
import { Chip, PreviewNote } from '@/components/club/parts';
import { PremiumSheet } from '@/components/club/PremiumSheet';
import { Body, Btn, Card, Empty, H, Input, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { anchorLabel, bubblesAt, countsAsWatched, courseProgress, effectiveTier, fmtClock, lessonAccess, nextLesson, sortedLessons, type Anchor, type Club, type ClubComment, type Course, type Lesson } from '@/lib/club';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { mkey, pkey, useClub } from '@/store/club';
import { findLesson, joinFreeClub } from '@/store/clubFlow';
import { toast } from '@/store/toast';

export default function ClubContent() {
  useClubSeed();
  const { id = '', lesson = '', t: tParam, page: pageParam, para: paraParam } = useLocalSearchParams<{ id?: string; lesson?: string; t?: string; page?: string; para?: string }>();
  const club = useClub((s) => s.clubs[id]);
  const found = useMemo(() => findLesson(club, lesson), [club, lesson]);
  if (!club || !found) return <Page id="clubContent" title="Lezione" back><Card><Empty text="Lezione non trovata." /></Card></Page>;
  return <LessonView key={`${club.id}-${found.lesson.id}`} club={club} course={found.course} lesson={found.lesson} startT={tParam ? Number(tParam) : undefined} startPage={pageParam ? Number(pageParam) : undefined} startPara={paraParam ? Number(paraParam) : undefined} />;
}

function LessonView({ club, course, lesson, startT, startPage, startPara }: { club: Club; course: Course; lesson: Lesson; startT?: number; startPage?: number; startPara?: number }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const m = useClub((s) => s.memberships[mkey(club.id, me)]);
  const prog = useClub((s) => s.progress);
  const allComments = useClub((s) => s.comments);
  const note = useClub((s) => s.notes[pkey(me, lesson.id)] ?? '');
  const tier = effectiveTier(m);
  const isOwner = club.owner === me;
  const [premium, setPremium] = useState(false);
  const saved = prog[pkey(me, lesson.id)];
  const timed = lesson.kind === 'video' || lesson.kind === 'audio';
  const resumeAt = startT ?? (saved?.posSec && saved.posSec > 5 && (!lesson.durationSec || saved.posSec < lesson.durationSec - 10) ? saved.posSec : 0);
  const [pos, setPos] = useState(Math.floor(resumeAt));
  const posRef = useRef(resumeAt);
  const [seekReq, setSeekReq] = useState<SeekReq>(null);
  const [anchor, setAnchor] = useState<Anchor | undefined>(startPage ? { kind: 'page', page: startPage } : startPara ? { kind: 'para', para: startPara } : undefined);
  const [page, setPage] = useState(startPage ?? saved?.page ?? 1);
  const [para, setPara] = useState<number | null>(startPara ?? null);
  const [focusNonce, setFocusNonce] = useState(0);

  const access = lessonAccess({ user: me, owner: club.owner, tier }, { published: course.published || isOwner }, lesson);
  const comments = useMemo(() => allComments.filter((c) => c.lessonId === lesson.id && c.clubId === club.id), [allComments, lesson.id, club.id]);
  const timedAnchors = useMemo(() => comments.filter((c) => c.anchor?.kind === 'time').map((c) => (c.anchor as { sec: number }).sec), [comments]);
  const counts = useMemo(() => {
    const o: Record<string, number> = {};
    comments.forEach((c) => { if (c.anchor?.kind === 'page') o[`p${c.anchor.page}`] = (o[`p${c.anchor.page}`] ?? 0) + 1; if (c.anchor?.kind === 'para') o[`q${c.anchor.para}`] = (o[`q${c.anchor.para}`] ?? 0) + 1; });
    return o;
  }, [comments]);

  // progresso: salvataggio periodico della posizione e completamento automatico
  const durRef = useRef(lesson.durationSec ?? 0);
  const member = isOwner || tier !== 'none';
  const persist = useCallback(() => {
    if (!member || !timed) return;
    const p = posRef.current;
    if (p > 5) useClub.getState().setProgress(me, lesson.id, { posSec: Math.floor(p) });
  }, [member, timed, me, lesson.id]);
  useEffect(() => { const i = setInterval(persist, 5000); return () => { clearInterval(i); persist(); }; }, [persist]);
  const onPos = useCallback((sec: number, dur: number) => {
    posRef.current = sec; durRef.current = dur || durRef.current;
    const s = Math.floor(sec);
    setPos((v) => (v === s ? v : s));
    if (member && countsAsWatched(sec, durRef.current) && !useClub.getState().progress[pkey(me, lesson.id)]?.done) {
      useClub.getState().setProgress(me, lesson.id, { done: true, posSec: 0 });
      toast('Lezione completata');
    }
  }, [member, me, lesson.id]);
  useEffect(() => { if (member && !timed) useClub.getState().setProgress(me, lesson.id, { page }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const seek = (a: Anchor) => {
    if (a.kind === 'time') { setSeekReq({ sec: a.sec, n: (seekReq?.n ?? 0) + 1 }); setPos(a.sec); }
    else if (a.kind === 'page') setPage(a.page);
    else setPara(a.para);
  };
  const ask = (a: Anchor) => { setAnchor(a); setFocusNonce((n) => n + 1); };

  const num = sortedLessons(course).findIndex((l) => l.id === lesson.id) + 1;
  const next = nextLesson(course, lesson.id);
  const done = !!saved?.done;
  const pr = courseProgress(course, Object.fromEntries(course.lessons.map((l) => [l.id, prog[pkey(me, l.id)]])), (l) => lessonAccess({ user: me, owner: club.owner, tier }, { published: true }, l).ok);

  if (!access.ok) {
    return (
      <Page id="clubContent" title={lesson.title} back>
        <Card>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
            <Icon name="lock" size={34} color={t.text} />
            <H>{access.reason === 'premium' ? 'Contenuto Premium' : access.reason === 'bozza' ? 'Non ancora pubblicato' : 'Contenuto per gli iscritti'}</H>
            <Body muted style={{ textAlign: 'center' }}>{access.reason === 'premium' ? `Questa lezione è per gli abbonati Premium di «${club.name}».` : access.reason === 'bozza' ? 'Il creatore sta ancora lavorando a questa lezione.' : 'Segui o iscriviti gratis per aprirla.'}</Body>
            {access.reason === 'premium' && <Btn title="Passa a Premium" onPress={() => setPremium(true)} />}
            {access.reason === 'iscriviti' && <Btn title="Iscriviti gratis" onPress={() => joinFreeClub(club)} />}
            <Btn small ghost title="Torna al LifeClub" onPress={() => go('clubPage', { id: club.id })} />
          </View>
        </Card>
        <PremiumSheet club={club} visible={premium} onClose={() => setPremium(false)} />
      </Page>
    );
  }

  const bubbles = timed ? bubblesAt(comments.filter((c) => !c.parentId), pos).slice(-2) : [];

  return (
    <Page id="clubContent" title={lesson.title} back>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={6}>
        <Text onPress={() => go('clubPage', { id: club.id })} style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{club.name}</Text>
        <Body small muted>{`· ${course.title} · lezione ${num} di ${course.lessons.length}`}</Body>
      </Row>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }} gap={6}>
        <Chip label={KIND_LABEL[lesson.kind]} />
        {lesson.tier === 'premium' && <Chip label="Premium" icon="lock" color="#b9892b" />}
        {lesson.preview && lesson.tier === 'premium' && <Chip label="Anteprima gratuita" color={t.positive} />}
        {!member && <Chip label="Non sei iscritto" />}
      </Row>

      {timed ? (
        <MediaStage lesson={lesson} startSec={resumeAt} seekReq={seekReq} onPos={onPos} markers={timedAnchors}
          overlay={<View pointerEvents="box-none" style={{ position: 'absolute', start: 8, end: 8, bottom: 8, gap: 5 }}>{bubbles.map((c) => <Bubble key={c.id} c={c} onPress={() => seek(c.anchor!)} />)}</View>} />
      ) : (
        <DocStage lesson={lesson} page={page} setPage={setPage} para={para} setPara={setPara} counts={counts} onAsk={ask} />
      )}
      {resumeAt > 5 && timed && !startT && <Body small muted style={{ marginTop: 8 }}>{`Ripreso da ${fmtClock(resumeAt)} dove eri arrivato.`}</Body>}
      {lesson.description ? <Body small style={{ marginTop: 10 }}>{lesson.description}</Body> : null}

      <Row style={{ marginTop: 12 }} gap={8}>
        <Btn style={{ flex: 1 }} small ghost={!done} icon="check" title={done ? 'Completata' : 'Segna come completata'} disabled={!member}
          onPress={() => { useClub.getState().setProgress(me, lesson.id, { done: !done, ...(done ? {} : { posSec: 0 }) }); toast(done ? 'Lezione riaperta' : 'Lezione completata'); }} />
        {next && <Btn style={{ flex: 1 }} small icon="arrow-right" title="Lezione successiva" onPress={() => go('clubContent', { id: club.id, lesson: next.id })} />}
      </Row>
      {member && (
        <View style={{ marginTop: 10 }}>
          <Body small muted>{`Progresso del corso: ${pr.done} di ${pr.total} · ${pr.pct}%`}</Body>
          <View style={{ height: 7, borderRadius: 10, backgroundColor: t.border, overflow: 'hidden', marginTop: 6 }}><View style={{ width: `${pr.pct}%`, height: '100%', backgroundColor: t.accent }} /></View>
        </View>
      )}

      <View style={{ height: 12 }} />
      <LessonThread club={club} course={course} lesson={lesson} tier={tier === 'none' ? 'none' : tier} pos={pos} anchor={anchor} setAnchor={setAnchor} onSeek={seek} focusNonce={focusNonce} timed={timed} />

      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="note" size={17} color={t.text} /><H>Le mie note</H></Row>
        <Body small muted style={{ marginTop: 2, marginBottom: 8 }}>Solo sul tuo telefono: il creatore e gli altri non le vedono.</Body>
        <Input placeholder="Appunti su questa lezione" value={note} onChangeText={(v) => useClub.getState().setNote(me, lesson.id, v)} maxLines={8} />
      </Card>
      <PreviewNote text={lesson.uri ? 'Il file resta nella memoria di questo telefono. Con il server i contenuti verranno serviti con link protetti e senza occupare spazio.' : 'Lezione di esempio: il video/audio vero arriva col server. Qui il cronometro mostra come funzionano i commenti legati al minuto.'} />
    </Page>
  );
}

function Bubble({ c, onPress }: { c: ClubComment; onPress: () => void }) {
  return (
    <Text onPress={onPress} numberOfLines={2} accessibilityRole="button" style={{ alignSelf: 'flex-start', maxWidth: '88%', color: '#fff', fontSize: 12, backgroundColor: '#000b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' }}>
      <Text style={{ fontWeight: '800', color: '#ffd166' }}>{`${c.author} · ${anchorLabel(c.anchor)}  `}</Text>{c.text}
    </Text>
  );
}
