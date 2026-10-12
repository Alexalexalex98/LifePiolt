import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { ClubChatPreview } from '@/components/club/ChatPreview';
import { dayLong, perMonth } from '@/components/club/format';
import { useClubSeed } from '@/components/club/hooks';
import { LessonRow } from '@/components/club/LessonRow';
import { Chip, CoverArt, PreviewNote, Stars } from '@/components/club/parts';
import { PremiumSheet } from '@/components/club/PremiumSheet';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, H, Input, Page, Row, Seg, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtInt } from '@/i18n/format';
import { WRITE_LABEL, courseHasPremium, courseProgress, effectiveTier, hasPremium, lessonAccess, postVisible, qaRating, resumeLesson, sortedLessons, subInfo, type Course, type MemberTier } from '@/lib/club';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { clubChatId } from '@/store/chat';
import { memberCounts, mkey, pkey, useClub } from '@/store/club';
import { ensureChat, followClub, joinFreeClub, leaveClub, resumeClub } from '@/store/clubFlow';
import { toast } from '@/store/toast';

const TABS = ['Free', 'Premium', 'Chat'] as const;
type Preview = 'me' | 'none' | 'free' | 'premium';

export default function ClubPage() {
  const t = useTheme();
  useClubSeed();
  const { id = '', tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const me = useApp((s) => s.account.name);
  const club = useClub((s) => s.clubs[id]);
  const memberships = useClub((s) => s.memberships);
  const progress = useClub((s) => s.progress);
  const ratings = useClub((s) => s.ratings[id]);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS.includes(tabParam as never) ? (tabParam as (typeof TABS)[number]) : 'Free');
  const [premium, setPremium] = useState(false);
  const [rate, setRate] = useState(false);
  const [preview, setPreview] = useState<Preview>('me');
  useEffect(() => { if (club && memberships[mkey(club.id, me)]) ensureChat(club); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [club?.id]);

  const m = club ? memberships[mkey(club.id, me)] : undefined;
  const isOwner = !!club && club.owner === me;
  const realTier = effectiveTier(m);
  const tier: MemberTier | 'none' = isOwner && preview !== 'me' ? (preview === 'none' ? 'none' : preview) : realTier;
  const viewerUser = isOwner && preview !== 'me' ? '·anteprima·' : me;
  const viewer = useMemo(() => ({ user: viewerUser, owner: club?.owner ?? '', tier }), [viewerUser, club?.owner, tier]);
  const counts = club ? memberCounts({ memberships }, club) : null;
  const rv = Object.values(ratings ?? {});
  const rr = qaRating(rv.map((r) => r.stars));

  if (!club || (!club.published && !isOwner)) return <Page id="clubPage" title="LifeClub" back><Card><Empty text="LifeClub non trovato." /></Card></Page>;
  const info = subInfo(m);
  const paid = hasPremium(club);
  const accessOf = (c: Course, l: Course['lessons'][number]) => lessonAccess(viewer, { published: c.published || isOwner }, l);
  const open = (c: Course, l: Course['lessons'][number]) => {
    const a = accessOf(c, l);
    if (a.ok) return go('clubContent', { id: club.id, lesson: l.id });
    if (a.reason === 'premium') return setPremium(true);
    toast('Segui o iscriviti gratis per aprire questa lezione');
  };

  function unsubscribe() {
    const prev = m;
    const premiumNow = effectiveTier(m) === 'premium' && m?.status === 'attiva';
    confirmDelete(premiumNow ? `l'abbonamento Premium a «${club!.name}» (resti Premium fino al ${dayLong(m?.endsAt)})` : `la tua iscrizione a «${club!.name}»`, () => {
      const r = leaveClub(club!);
      toast(r.immediate ? 'Disiscritto' : `Abbonamento annullato: Premium fino al ${dayLong(r.endsAt)}`);
    }, () => { useClub.getState().putMembership(prev, me, club!.id); ensureChat(club!); }, { title: 'Disiscriversi?', okLabel: 'Disiscriviti', undoMessage: 'Disiscritto' });
  }

  const freeCourses = club.courses.filter((c) => isOwner || c.published);
  const freePosts = club.posts.filter((p) => p.tier === 'free');
  const premPosts = club.posts.filter((p) => p.tier === 'premium');
  const sorted = (c: Course) => sortedLessons(c);

  return (
    <Page id="clubPage" title={undefined} back>
      <CoverArt cover={club.cover} height={150} radius={20} icon="lifeclub" style={{ marginTop: 10, marginBottom: 12 }} />
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 24, fontWeight: '800' }}>{club.name}</Text>
      {club.tagline ? <Body muted style={{ marginTop: 2 }}>{club.tagline}</Body> : null}
      <Row style={{ justifyContent: 'flex-start', marginTop: 10 }} gap={10}>
        <UserAvatar name={club.owner} size={32} />
        <View style={{ flex: 1 }}>
          <Text onPress={() => go('userProfile', { name: club.owner })} style={{ color: t.text, fontWeight: '700' }}>{club.owner}</Text>
          <Body small muted>{`Creatore · ${fmtInt(counts!.subscribers)} iscritti · ${fmtInt(counts!.followers)} follower`}</Body>
        </View>
        {rv.length > 0 ? <Row gap={4}><Icon name="award" size={15} color={t.accent} fill={t.accent} /><Text style={{ color: t.text, fontWeight: '700' }}>{rr.rating.toFixed(1)}</Text><Body small muted>{`(${rv.length})`}</Body></Row> : null}
      </Row>
      {club.categories.length > 0 && <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}>{club.categories.map((c) => <Chip key={c} label={c} />)}</Row>}
      {club.description ? <Body small style={{ marginTop: 10 }}>{club.description}</Body> : null}

      {/* stato e azioni */}
      <Card style={{ marginTop: 14 }}>
        {isOwner ? (
          <>
            <Body bold>Questo è il tuo LifeClub</Body>
            <Body small muted style={{ marginTop: 2 }}>{club.published ? 'È pubblicato.' : 'È una bozza: solo tu lo vedi.'} Vedi come lo vede chi lo visita:</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}>
              {([['me', 'Creatore'], ['none', 'Visitatore'], ['free', 'Iscritto free'], ['premium', 'Premium']] as const).map(([k, l]) => (
                <Btn key={k} small ghost={preview !== k} title={l} onPress={() => setPreview(k)} />
              ))}
            </Row>
            <Btn style={{ marginTop: 10 }} small icon="edit" title="Apri lo Studio" onPress={() => go('clubStudio', { id: club.id })} />
          </>
        ) : (
          <>
            <Row style={{ justifyContent: 'flex-start' }} gap={8}>
              <Icon name={info.state === 'nessuna' ? 'users' : info.state === 'premium' || info.state === 'prova' ? 'award' : 'check'} size={18} color={t.text} />
              <Body bold style={{ flex: 1 }}>{({ nessuna: 'Non sei iscritto', follower: 'Segui questo LifeClub', free: 'Sei iscritto (gratis)', prova: `Prova gratuita fino al ${dayLong(info.until)}`, premium: `Premium · prossimo rinnovo ${dayLong(info.until)}`, in_scadenza: `Premium annullato: accesso fino al ${dayLong(info.until)}`, in_pausa: 'Abbonamento in pausa' } as const)[info.state]}</Body>
            </Row>
            <View style={{ gap: 8, marginTop: 10 }}>
              {(info.state === 'nessuna') && <Btn small ghost icon="plus" title="Segui" onPress={() => followClub(club)} />}
              {(info.state === 'nessuna' || info.state === 'follower') && <Btn title="Iscriviti gratis" icon="check" onPress={() => joinFreeClub(club)} />}
              {paid && info.state !== 'premium' && info.state !== 'prova' && info.state !== 'in_scadenza' && <Btn tone={undefined} title={`Passa a Premium (${perMonth(club.pricing)}/mese)`} icon="lifeclub" onPress={() => setPremium(true)} />}
              {info.state === 'in_scadenza' && <Btn title="Riprendi l'abbonamento" onPress={() => { resumeClub(club); toast('Abbonamento ripreso'); }} />}
              {info.state !== 'nessuna' && <Btn small ghost danger title={info.state === 'follower' ? 'Smetti di seguire' : 'Disiscriviti'} onPress={unsubscribe} />}
            </View>
            <Body small muted style={{ marginTop: 8 }}>Puoi disiscriverti quando vuoi. Il Premium annullato resta attivo fino a fine periodo pagato.</Body>
          </>
        )}
      </Card>

      <Seg options={[...TABS]} value={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />

      {tab === 'Free' && (
        <>
          {freePosts.map((p) => <PostCard key={p.id} text={p.text} ts={p.ts} pinned={p.pinned} />)}
          {freeCourses.length === 0 ? <Card><Empty text="Il creatore non ha ancora pubblicato corsi." /></Card> : freeCourses.map((c) => <CourseCard key={c.id} course={c} tierLabel="free" lessonsFilter={(l) => !(l.tier === 'premium' && !l.preview)} />)}
        </>
      )}
      {tab === 'Premium' && (
        <>
          {!paid ? <Card><Empty text="Questo LifeClub non ha una sezione a pagamento." /></Card> : (
            <>
              {tier !== 'premium' && (
                <Card accent={t.accent}>
                  <H>Premium</H>
                  <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{perMonth(club.pricing)}<Text style={{ fontSize: 14, fontWeight: '500', color: t.muted }}>{' / mese'}</Text></Text>
                  <Body small muted style={{ marginTop: 4 }}>{[club.pricing.trialDays ? `${club.pricing.trialDays} giorni di prova` : null, club.pricing.yearlyDiscountPct ? `${club.pricing.yearlyDiscountPct}% di sconto sul piano annuale` : null, 'annulli quando vuoi'].filter(Boolean).join(' · ')}</Body>
                  {!isOwner && <Btn style={{ marginTop: 10 }} title={`Passa a Premium (${perMonth(club.pricing)}/mese)`} onPress={() => setPremium(true)} />}
                </Card>
              )}
              {premPosts.filter((p) => postVisible(viewer, p)).map((p) => <PostCard key={p.id} text={p.text} ts={p.ts} premium />)}
              {premPosts.some((p) => !postVisible(viewer, p)) && <Card><Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="lock" size={16} color={t.muted} /><Body small muted>{`${premPosts.filter((p) => !postVisible(viewer, p)).length} annunci riservati agli abbonati`}</Body></Row></Card>}
              {freeCourses.filter(courseHasPremium).map((c) => <CourseCard key={c.id} course={c} lessonsFilter={(l) => l.tier === 'premium'} />)}
              {freeCourses.filter(courseHasPremium).length === 0 && <Card><Empty text="Nessun contenuto a pagamento per ora." /></Card>}
            </>
          )}
        </>
      )}
      {tab === 'Chat' && (
        <Card>
          <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="comment" size={18} color={t.text} /><H>Chat del LifeClub</H></Row>
          <Body small muted style={{ marginTop: 4 }}>{`Chi può scrivere: ${WRITE_LABEL[club.chat.write]}${club.chat.slowSec ? ` · modalità lenta ${club.chat.slowSec} s` : ''}. Chi è iscritto la trova tra le sue chat e può silenziarla o uscire quando vuole.`}</Body>
          {club.chat.write === 'creator' && <Body small muted style={{ marginTop: 6 }}>Qui scrive solo il creatore. Le domande sulle lezioni si fanno nei commenti sotto ogni video.</Body>}
          {isOwner || tier !== 'none' ? (
            <>
              <ClubChatPreview club={club} />
              <Btn style={{ marginTop: 10 }} icon="comment" title="Apri la chat" onPress={() => { ensureChat(club); go('conversationPage', { id: clubChatId(club.id) }); }} />
            </>
          ) : <Btn style={{ marginTop: 10 }} title="Iscriviti gratis per entrare" onPress={() => joinFreeClub(club)} />}
        </Card>
      )}

      {/* valutazione */}
      {!isOwner && (
        <Card>
          <Row><H>Cosa ne pensi?</H><Btn small ghost title={ratings?.[me] ? 'Modifica il voto' : 'Vota'} onPress={() => setRate(true)} /></Row>
          <Body small muted>{rv.length ? `Media ${rr.rating.toFixed(1)} su 5 da ${rv.length} ${rv.length === 1 ? 'voto' : 'voti'} (pochi voti pesano meno)` : 'Ancora nessun voto. Si vota dopo essersi iscritti almeno una volta.'}</Body>
        </Card>
      )}
      <PreviewNote />

      <PremiumSheet club={club} visible={premium} onClose={() => setPremium(false)} />
      <RateSheet visible={rate} onClose={() => setRate(false)} clubId={club.id} />
    </Page>
  );

  function CourseCard({ course, lessonsFilter, tierLabel }: { course: Course; lessonsFilter: (l: Course['lessons'][number]) => boolean; tierLabel?: string }) {
    const list = sorted(course).filter(lessonsFilter);
    if (!list.length) return null;
    const prog = Object.fromEntries(course.lessons.map((l) => [l.id, progress[pkey(me, l.id)]]));
    const pr = courseProgress(course, prog, (l) => accessOf(course, l).ok);
    const resume = tier !== 'none' || isOwner ? resumeLesson(course, prog, (l) => accessOf(course, l).ok) : null;
    void tierLabel;
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{course.title}</Text>
            <Body small muted style={{ marginTop: 2 }}>{`${({ base: 'Base', intermedio: 'Intermedio', avanzato: 'Avanzato' } as const)[course.level]} · ${course.lessons.length} lezioni`}{!course.published ? ' · bozza' : ''}</Body>
          </View>
        </Row>
        {course.description ? <Body small style={{ marginTop: 6 }}>{course.description}</Body> : null}
        {pr.done > 0 && (
          <View style={{ marginTop: 8 }}>
            <Body small muted>{`${pr.done} di ${pr.total} completate · ${pr.pct}%`}</Body>
            <View style={{ height: 7, borderRadius: 10, backgroundColor: t.border, overflow: 'hidden', marginTop: 6 }}><View style={{ width: `${pr.pct}%`, height: '100%', backgroundColor: t.accent }} /></View>
          </View>
        )}
        {resume && pr.done > 0 && pr.done < pr.total && <Btn small style={{ marginTop: 10, alignSelf: 'flex-start' }} icon="play" title="Continua da dove eri" onPress={() => go('clubContent', { id: club!.id, lesson: resume.lesson.id, ...(resume.posSec ? { t: String(Math.floor(resume.posSec)) } : {}) })} />}
        <View style={{ marginTop: 8 }}>
          {list.map((l, i) => <LessonRow key={l.id} index={sorted(course).indexOf(l) + 1} lesson={l} access={accessOf(course, l)} done={!!progress[pkey(me, l.id)]?.done} last={i === list.length - 1} onPress={() => open(course, l)} />)}
        </View>
      </Card>
    );
  }
}

function PostCard({ text, ts, pinned, premium }: { text: string; ts: number; pinned?: boolean; premium?: boolean }) {
  const t = useTheme();
  return (
    <Card>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 4 }} gap={6}>
        {pinned && <Icon name="pin" size={13} color={t.muted} />}
        <Body small muted>{`${pinned ? 'In evidenza · ' : ''}${dayLong(ts)}`}</Body>
        {premium && <Chip label="Premium" icon="lock" color="#b9892b" />}
      </Row>
      <Body>{text}</Body>
    </Card>
  );
}

function RateSheet({ visible, onClose, clubId }: { visible: boolean; onClose: () => void; clubId: string }) {
  const me = useApp((s) => s.account.name);
  const cur = useClub((s) => s.ratings[clubId]?.[me]);
  const [stars, setStars] = useState(cur?.stars ?? 5);
  const [text, setText] = useState(cur?.text ?? '');
  return (
    <Sheet visible={visible} title="Il tuo voto" onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Stars value={stars} onChange={setStars} size={34} /></View>
      <Input placeholder="Una riga facoltativa" value={text} onChangeText={setText} maxLength={200} />
      <Btn title="Salva il voto" onPress={() => { const r = useClub.getState().rateClub(clubId, me, stars, text); if (!r.ok) toast(r.reason ?? 'Non posso salvare il voto'); else { toast('Grazie per il voto'); onClose(); } }} />
    </Sheet>
  );
}
