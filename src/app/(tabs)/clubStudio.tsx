import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { dayLong, money } from '@/components/club/format';
import { useClubSeed } from '@/components/club/hooks';
import { LessonEditor } from '@/components/club/LessonEditor';
import { KIND_LABEL } from '@/components/club/LessonRow';
import { Chip, CoverArt, PreviewNote } from '@/components/club/parts';
import { pickClubFile } from '@/components/club/pickFile';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, H, Input, Item, Page, Pill, Press, Row, Seg, Sheet, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { PLATFORM_FEE_PCT, WRITE_LABEL, WRITE_ORDER, courseProgress, effectiveTier, hasYearly, monthlyRevenue, sanitizePricing, sortedLessons, yearlyPrice, type ChatWrite, type Club, type Course, type Lesson, type Level } from '@/lib/club';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { clubsOf, memberCounts, pkey, useClub } from '@/store/club';
import { announceContent, ensureChat } from '@/store/clubFlow';
import { toast } from '@/store/toast';

const TABS = ['Contenuti', 'Prezzi', 'Chat', 'Iscritti'] as const;
const COVERS: [string, string][] = [['#ff9966', '#ff5e62'], ['#36d1dc', '#5b86e5'], ['#56ab2f', '#a8e063'], ['#8e2de2', '#4a00e0'], ['#f7971e', '#ffd200'], ['#00b09b', '#96c93d']];
const LEVELS: Level[] = ['base', 'intermedio', 'avanzato'];
const LEVEL_L: Record<Level, string> = { base: 'Base', intermedio: 'Intermedio', avanzato: 'Avanzato' };

export default function ClubStudio() {
  useClubSeed();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const clubs = useClub((s) => s.clubs);
  const club = (id && clubs[id]) || clubsOf({ clubs }, me)[0];
  if (!club || club.owner !== me) return <CreateClub />;
  return <Studio club={club} />;
}

/* ---------- creazione ---------- */
function CreateClub() {
  const me = useApp((s) => s.account.name);
  const [name, setName] = useState(''); const [tag, setTag] = useState(''); const [desc, setDesc] = useState(''); const [cats, setCats] = useState('');
  const [cv, setCv] = useState(0); const [img, setImg] = useState<string | undefined>();
  async function pickCover() {
    try { const f = await pickClubFile('image'); if (f) setImg(f.uri); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); }
  }
  return (
    <Page id="clubStudio" title="Crea il tuo LifeClub" back>
      <PreviewNote text="Il LifeClub è la tua zona con i follower: corsi e contenuti free, una sezione a pagamento e una chat. In questa versione tutto resta su questo telefono." />
      <Card>
        <CoverArt cover={{ c1: COVERS[cv][0], c2: COVERS[cv][1], uri: img }} height={110} radius={16} style={{ marginBottom: 10 }} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={8}>
          {COVERS.map((c, i) => <Pill key={i} label={`Colore ${i + 1}`} on={cv === i && !img} onPress={() => { setCv(i); setImg(undefined); }} />)}
          <Btn small ghost icon="image" title={img ? 'Cambia immagine' : 'Usa un\'immagine'} onPress={() => void pickCover()} />
        </Row>
        <Input placeholder="Nome del LifeClub" value={name} onChangeText={setName} maxLength={60} />
        <Input placeholder="Frase breve (es. Cene semplici in 20 minuti)" value={tag} onChangeText={setTag} maxLength={90} />
        <Input placeholder="Descrizione: cosa trovano gli iscritti" value={desc} onChangeText={setDesc} multiline maxLines={6} />
        <Input placeholder="Categorie separate da virgola (es. Cucina, Casa)" value={cats} onChangeText={setCats} />
        <Btn title="Crea il LifeClub" disabled={!name.trim()} onPress={() => {
          const cid = useClub.getState().createClub(me, { name, tagline: tag.trim(), description: desc.trim(), categories: cats.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5), cover: { c1: COVERS[cv][0], c2: COVERS[cv][1], uri: img } });
          ensureChat(useClub.getState().clubs[cid]);
          toast('LifeClub creato come bozza: aggiungi i contenuti e pubblicalo');
        }} />
      </Card>
    </Page>
  );
}

/* ---------- studio ---------- */
function Studio({ club }: { club: Club }) {
  const t = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Contenuti');
  const [editInfo, setEditInfo] = useState(false);
  const counts = memberCounts({ memberships: useClub((s) => s.memberships) }, club);
  const st = useClub.getState;

  function del() {
    const snap = { club, ms: Object.values(st().memberships).filter((m) => m.clubId === club.id), cm: st().comments.filter((c) => c.clubId === club.id) };
    confirmDelete(`il LifeClub «${club.name}» con tutti i suoi contenuti e commenti`, () => { st().deleteClub(club.id); go('profile'); }, () => { st().restoreClub(snap.club, snap.ms, snap.cm); ensureChat(snap.club); }, { undoMessage: 'LifeClub eliminato' });
  }

  return (
    <Page id="clubStudio" title="Studio del LifeClub" back>
      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={12}>
          <CoverArt cover={club.cover} size={56} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{club.name}</Text>
            <Body small muted>{`${counts.subscribers} iscritti · ${counts.followers} follower`}</Body>
          </View>
        </Row>
        <Row style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '700' }}>{club.published ? 'Pubblicato' : 'Bozza'}</Text><Body small muted>{club.published ? 'Visibile a chi ti segue.' : 'Solo tu lo vedi finché non lo pubblichi.'}</Body></View>
          <Switch value={club.published} onValueChange={(v) => { st().patchClub(club.id, { published: v }); if (v) ensureChat(club); toast(v ? 'LifeClub pubblicato' : 'Tornato in bozza'); }} accessibilityLabel="Pubblicato" />
        </Row>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          <Btn small icon="eye" title="Vedi come lo vede un iscritto" onPress={() => go('clubPage', { id: club.id })} />
          <Btn small ghost icon="edit" title="Modifica info" onPress={() => setEditInfo(true)} />
          <Btn small ghost icon="comment" title="Apri la chat" onPress={() => { ensureChat(club); go('conversationPage', { id: `club:${club.id}` }); }} />
        </Row>
      </Card>
      <PreviewNote text="Anteprima: i contenuti restano nella memoria di questo telefono, i pagamenti e le statistiche sono dimostrativi. Con il server saranno reali." />
      <Seg options={[...TABS]} value={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />
      {tab === 'Contenuti' && <ContentTab club={club} />}
      {tab === 'Prezzi' && <PriceTab club={club} />}
      {tab === 'Chat' && <ChatTab club={club} />}
      {tab === 'Iscritti' && <MembersTab club={club} />}
      <Btn style={{ marginTop: 14 }} ghost danger icon="trash" title="Elimina il LifeClub" onPress={del} />
      <InfoSheet club={club} visible={editInfo} onClose={() => setEditInfo(false)} />
    </Page>
  );
}

function InfoSheet({ club, visible, onClose }: { club: Club; visible: boolean; onClose: () => void }) {
  const [name, setName] = useState(club.name); const [tag, setTag] = useState(club.tagline); const [desc, setDesc] = useState(club.description); const [cats, setCats] = useState(club.categories.join(', '));
  const [cv, setCv] = useState(club.cover);
  async function pickCover() { try { const f = await pickClubFile('image'); if (f) setCv({ ...cv, uri: f.uri }); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); } }
  return (
    <Sheet visible={visible} title="Informazioni del LifeClub" onClose={onClose}>
      <CoverArt cover={cv} height={100} radius={14} style={{ marginBottom: 10 }} />
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={8}>
        {COVERS.map((c, i) => <Pill key={i} label={`Colore ${i + 1}`} on={!cv.uri && cv.c1 === c[0]} onPress={() => setCv({ c1: c[0], c2: c[1] })} />)}
        <Btn small ghost icon="image" title="Immagine" onPress={() => void pickCover()} />
      </Row>
      <Input placeholder="Nome" value={name} onChangeText={setName} maxLength={60} />
      <Input placeholder="Frase breve" value={tag} onChangeText={setTag} maxLength={90} />
      <Input placeholder="Descrizione" value={desc} onChangeText={setDesc} multiline maxLines={6} />
      <Input placeholder="Categorie separate da virgola" value={cats} onChangeText={setCats} />
      <Btn title="Salva" disabled={!name.trim()} onPress={() => { useClub.getState().patchClub(club.id, { name, tagline: tag.trim(), description: desc.trim(), cover: cv, categories: cats.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5) }); ensureChat({ ...club, name }); onClose(); }} />
    </Sheet>
  );
}

/* ---------- contenuti ---------- */
function ContentTab({ club }: { club: Club }) {
  const t = useTheme();
  const st = useClub.getState;
  const [newCourse, setNewCourse] = useState(false);
  const [cTitle, setCTitle] = useState(''); const [cDesc, setCDesc] = useState(''); const [cLevel, setCLevel] = useState<Level>('base');
  const [post, setPost] = useState(''); const [postTier, setPostTier] = useState<'free' | 'premium'>('free');
  const [editor, setEditor] = useState<{ course: Course; sectionId: string; lesson?: Lesson } | null>(null);
  const [secName, setSecName] = useState<{ courseId: string } | null>(null); const [secTitle, setSecTitle] = useState('');

  const snapshot = () => club.courses;
  const undoCourses = (snap: Course[]) => () => useClub.getState().patchClub(club.id, { courses: snap });

  return (
    <View>
      <Card>
        <Row><H>Annunci</H></Row>
        <Input placeholder="Scrivi un annuncio per i tuoi follower" value={post} onChangeText={setPost} multiline maxLines={5} maxLength={1200} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}><Pill icon="unlock" label="Free" on={postTier === 'free'} onPress={() => setPostTier('free')} /><Pill icon="lock" label="Premium" on={postTier === 'premium'} onPress={() => setPostTier('premium')} /></Row>
          <Btn small title="Pubblica" disabled={!post.trim()} onPress={() => { st().addPost(club.id, post, postTier); setPost(''); toast('Annuncio pubblicato'); }} />
        </Row>
        {club.posts.map((p, i) => (
          <Item key={p.id} last={i === club.posts.length - 1}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}><Row style={{ justifyContent: 'flex-start' }} gap={6}><Body small muted>{dayLong(p.ts)}</Body><Chip label={p.tier === 'free' ? 'Free' : 'Premium'} icon={p.tier === 'free' ? 'unlock' : 'lock'} /></Row><Body numberOfLines={3}>{p.text}</Body></View>
            </Row>
          </Item>
        ))}
      </Card>
      {club.posts.length > 0 && (
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={6}>
          {club.posts.map((p) => (
            <Row key={p.id} gap={4}>
              <Pill icon="pin" label={`Fissa «${p.text.slice(0, 14)}…»`} on={!!p.pinned} onPress={() => st().togglePinPost(club.id, p.id)} />
              <Pill icon="trash" label="Elimina" onPress={() => { const prev = club.posts; confirmDelete('questo annuncio', () => st().removePost(club.id, p.id), () => useClub.getState().patchClub(club.id, { posts: prev })); }} />
            </Row>
          ))}
        </Row>
      )}

      <Row style={{ marginBottom: 8 }}><H>Corsi e contenuti</H><Btn small icon="plus" title="Nuovo corso" onPress={() => setNewCourse(true)} /></Row>
      {club.courses.length === 0 && <Card><Body muted>Nessun corso: creane uno e carica video, audio, PDF, testi o file dal telefono.</Body></Card>}
      {club.courses.map((c) => (
        <Card key={c.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{c.title}</Text>
              <Body small muted>{`${LEVEL_L[c.level]} · ${c.lessons.length} lezioni`}</Body>
            </View>
            <Row gap={6}><Body small muted>{c.published ? 'Pubblicato' : 'Bozza'}</Body><Switch value={c.published} onValueChange={(v) => { st().patchCourse(club.id, c.id, { published: v }); if (v) { ensureChat(club); sortedLessons(c).slice(0, 1).forEach((l) => announceContent(club, l, c)); } toast(v ? 'Corso pubblicato' : 'Corso in bozza'); }} accessibilityLabel={`Pubblica ${c.title}`} /></Row>
          </Row>
          {c.sections.map((s) => {
            const ls = c.lessons.filter((l) => l.sectionId === s.id).sort((a, b) => a.order - b.order);
            return (
              <View key={s.id} style={{ marginTop: 12 }}>
                <Row>
                  <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.title}</Text>
                  <Row gap={6}>
                    <Btn small ghost icon="plus" title="Lezione" onPress={() => setEditor({ course: c, sectionId: s.id })} />
                    {c.sections.length > 1 && <Btn small ghost icon="trash" title="" label="Elimina sezione" onPress={() => { const snap = snapshot(); confirmDelete(`la sezione «${s.title}» e le sue lezioni`, () => st().removeSection(club.id, c.id, s.id), undoCourses(snap)); }} />}
                  </Row>
                </Row>
                {ls.length === 0 && <Body small muted style={{ paddingVertical: 8 }}>Sezione vuota.</Body>}
                {ls.map((l) => (
                  <Item key={l.id} onPress={() => setEditor({ course: c, sectionId: s.id, lesson: l })}>
                    <Row>
                      <Row style={{ flex: 1, justifyContent: 'flex-start' }} gap={10}>
                        <Icon name={l.tier === 'premium' ? 'lock' : 'unlock'} size={16} color={t.muted} />
                        <View style={{ flex: 1 }}><Body numberOfLines={1}>{l.title}</Body><Body small muted>{`${KIND_LABEL[l.kind]}${l.fileName ? ` · ${l.fileName}` : l.uri ? '' : l.kind === 'video' || l.kind === 'audio' || l.kind === 'pdf' ? ' · esempio' : ''}${l.preview ? ' · anteprima gratuita' : ''}`}</Body></View>
                      </Row>
                      <Press onPress={() => { const snap = snapshot(); confirmDelete(`la lezione «${l.title}»`, () => st().removeLesson(club.id, c.id, l.id), undoCourses(snap)); }} accessibilityLabel={`Elimina ${l.title}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Icon name="trash" size={18} color={t.muted} /></Press>
                    </Row>
                  </Item>
                ))}
              </View>
            );
          })}
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 12 }} gap={8}>
            <Btn small ghost icon="plus" title="Sezione" onPress={() => setSecName({ courseId: c.id })} />
            <Btn small ghost icon="trash" title="Elimina corso" onPress={() => { const snap = snapshot(); confirmDelete(`il corso «${c.title}»`, () => st().removeCourse(club.id, c.id), undoCourses(snap)); }} />
          </Row>
        </Card>
      ))}

      <Sheet visible={newCourse} title="Nuovo corso" onClose={() => setNewCourse(false)}>
        <Input placeholder="Titolo del corso" value={cTitle} onChangeText={setCTitle} maxLength={80} />
        <Input placeholder="Descrizione" value={cDesc} onChangeText={setCDesc} multiline maxLines={5} />
        <Row style={{ justifyContent: 'flex-start', marginBottom: 10 }} gap={6}>{LEVELS.map((l) => <Pill key={l} label={LEVEL_L[l]} on={cLevel === l} onPress={() => setCLevel(l)} />)}</Row>
        <Btn title="Crea il corso" disabled={!cTitle.trim()} onPress={() => { st().addCourse(club.id, { title: cTitle, description: cDesc, level: cLevel }); setCTitle(''); setCDesc(''); setNewCourse(false); toast('Corso creato come bozza'); }} />
      </Sheet>
      <Sheet visible={!!secName} title="Nuova sezione" onClose={() => setSecName(null)}>
        <Input placeholder="Nome della sezione" value={secTitle} onChangeText={setSecTitle} maxLength={60} />
        <Btn title="Aggiungi" disabled={!secTitle.trim()} onPress={() => { st().addSection(club.id, secName!.courseId, secTitle); setSecTitle(''); setSecName(null); }} />
      </Sheet>
      <LessonEditor visible={!!editor} onClose={() => setEditor(null)} sectionId={editor?.sectionId ?? ''} lesson={editor?.lesson}
        onSave={(d) => {
          if (!editor) return;
          if (editor.lesson) st().patchLesson(club.id, editor.course.id, editor.lesson.id, d);
          else {
            const lid = st().addLesson(club.id, editor.course.id, d);
            const fresh = useClub.getState().clubs[club.id]?.courses.find((x) => x.id === editor.course.id);
            const nl = fresh?.lessons.find((x) => x.id === lid);
            if (fresh?.published && nl) announceContent(club, nl, fresh);
          }
          toast('Lezione salvata');
        }} />
    </View>
  );
}

/* ---------- prezzi ---------- */
function PriceTab({ club }: { club: Club }) {
  const p = club.pricing;
  const [monthly, setMonthly] = useState(String(p.monthly || ''));
  const [trial, setTrial] = useState(String(p.trialDays || ''));
  const [disc, setDisc] = useState(String(p.yearlyDiscountPct || ''));
  const draft = sanitizePricing({ monthly: Number(monthly.replace(',', '.')), trialDays: Number(trial), yearlyDiscountPct: Number(disc) }, p.currency);
  const rev = monthlyRevenue(draft, memberCounts({ memberships: useClub((s) => s.memberships) }, club).premium);
  return (
    <View>
      <Card>
        <H>Sezione a pagamento</H>
        <Body small muted style={{ marginTop: 2, marginBottom: 10 }}>I tuoi follower pagano una quota mensile per le lezioni e gli annunci Premium. Lascia 0 per non avere una sezione a pagamento.</Body>
        <Body small muted>{`Quota mensile (${p.currency})`}</Body>
        <Input keyboardType="decimal-pad" placeholder="Es. 9" value={monthly} onChangeText={setMonthly} />
        <Body small muted>Giorni di prova gratuita (0-30)</Body>
        <Input keyboardType="number-pad" placeholder="Es. 7" value={trial} onChangeText={setTrial} />
        <Body small muted>Sconto sul piano annuale in % (0-50)</Body>
        <Input keyboardType="number-pad" placeholder="Es. 20" value={disc} onChangeText={setDisc} />
        {draft.monthly > 0 && (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#8884', gap: 3, marginBottom: 10 }}>
            <Body bold>{`${money(draft.monthly, draft.currency)} / mese`}</Body>
            {hasYearly(draft) && <Body small muted>{`Annuale: ${money(yearlyPrice(draft), draft.currency)} (-${draft.yearlyDiscountPct}%)`}</Body>}
            {draft.trialDays > 0 && <Body small muted>{`${draft.trialDays} giorni di prova prima del primo addebito`}</Body>}
          </View>
        )}
        <Btn title="Salva i prezzi" onPress={() => { useClub.getState().setPricing(club.id, draft); toast('Prezzi salvati'); }} />
      </Card>
      <Card>
        <H>Guadagni (dimostrativi)</H>
        <Body small muted style={{ marginTop: 2 }}>{`Con ${rev.gross ? '' : 'nessun abbonato Premium: '}${money(rev.gross, draft.currency)} lordi al mese, commissione ${PLATFORM_FEE_PCT}% (${money(rev.fee, draft.currency)}), ti restano circa ${money(rev.net, draft.currency)}. È un calcolo di esempio: nessun pagamento reale avviene in questa versione.`}</Body>
      </Card>
      <Card>
        <H>Cosa serve per incassare davvero</H>
        <Body small muted style={{ marginTop: 2 }}>Provider di pagamento (carta, Apple Pay, Google Pay), verifica dell&apos;identità del creatore, fatturazione e IVA, diritto di recesso degli abbonati. Dettagli in docs/lifeclub.md.</Body>
      </Card>
    </View>
  );
}

/* ---------- chat ---------- */
function ChatTab({ club }: { club: Club }) {
  const t = useTheme();
  const c = club.chat;
  const st = useClub.getState;
  const demo = useApp((s) => s.demo);
  const memberships = useClub((s) => s.memberships);
  const comments = useClub((s) => s.comments);
  const people = useMemo(() => {
    const set = new Set<string>();
    Object.values(memberships).filter((m) => m.clubId === club.id && effectiveTier(m) !== 'none').forEach((m) => set.add(m.user));
    comments.filter((x) => x.clubId === club.id && x.author !== club.owner).forEach((x) => set.add(x.author));
    if (demo) ['Giulia M.', 'Tommaso V.', 'Federica L.'].forEach((n) => set.add(n));
    c.chosen.forEach((n) => set.add(n));
    set.delete(club.owner);
    return [...set];
  }, [memberships, comments, club.id, club.owner, demo, c.chosen]);
  const HINT: Record<ChatWrite, string> = { creator: 'Solo tu scrivi: gli altri leggono.', members: 'Chiunque sia iscritto (anche gratis) può scrivere. I semplici follower leggono.', premium: 'Scrivono solo gli abbonati Premium; gli altri leggono.', chosen: 'Scrivono solo le persone che scegli qui sotto.', none: 'Nessuno scrive: la chat è chiusa (resta leggibile).' };
  return (
    <View>
      <Card>
        <H>Chi può scrivere nella chat</H>
        <Body small muted style={{ marginTop: 2, marginBottom: 6 }}>La chat compare tra i messaggi di chi è iscritto, che può silenziarla o uscire quando vuole.</Body>
        {WRITE_ORDER.map((w, i) => (
          <Item key={w} last={i === WRITE_ORDER.length - 1} onPress={() => st().setChatConfig(club.id, { write: w })}>
            <Row><View style={{ flex: 1 }}><Body bold>{WRITE_LABEL[w]}</Body><Body small muted>{HINT[w]}</Body></View>{c.write === w ? <Icon name="check" size={18} color={t.accent} stroke={2.5} /> : null}</Row>
          </Item>
        ))}
      </Card>
      {c.write === 'chosen' && (
        <Card>
          <H>Persone abilitate</H>
          {people.length === 0 && <Body small muted style={{ marginTop: 4 }}>Nessuno ancora: compariranno qui gli iscritti.</Body>}
          {people.map((n, i) => (
            <Item key={n} last={i === people.length - 1} onPress={() => st().setChatConfig(club.id, { chosen: c.chosen.includes(n) ? c.chosen.filter((x) => x !== n) : [...c.chosen, n] })}>
              <Row><Row style={{ flex: 1, justifyContent: 'flex-start' }} gap={10}><UserAvatar name={n} size={30} /><Body>{n}</Body></Row>{c.chosen.includes(n) ? <Icon name="check" size={18} color={t.accent} stroke={2.5} /> : null}</Row>
            </Item>
          ))}
        </Card>
      )}
      <Card>
        <H>Modalità lenta</H>
        <Body small muted style={{ marginTop: 2, marginBottom: 8 }}>Tempo minimo tra due messaggi della stessa persona (tu sei escluso).</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
          {([[0, 'Spenta'], [10, '10 s'], [30, '30 s'], [60, '1 min'], [300, '5 min']] as const).map(([v, l]) => <Pill key={v} label={l} on={c.slowSec === v} onPress={() => st().setChatConfig(club.id, { slowSec: v })} />)}
        </Row>
      </Card>
      <Card>
        <Row>
          <View style={{ flex: 1 }}><Body bold>Commenti sulle lezioni</Body><Body small muted>Se la chat è in sola lettura per qualcuno, può comunque fare domande sotto i video.</Body></View>
          <Switch value={c.commentsWhenReadOnly} onValueChange={(v) => st().setChatConfig(club.id, { commentsWhenReadOnly: v })} accessibilityLabel="Commenti sempre abilitati" />
        </Row>
      </Card>
      <Body small muted>Per fissare un messaggio o silenziare una persona apri la chat: tocca a lungo un messaggio (Fissa in alto) o le info della chat (iscritti).</Body>
    </View>
  );
}

/* ---------- iscritti e statistiche ---------- */
function MembersTab({ club }: { club: Club }) {
  const t = useTheme();
  const memberships = useClub((s) => s.memberships);
  const comments = useClub((s) => s.comments);
  const progress = useClub((s) => s.progress);
  const c = memberCounts({ memberships }, club);
  const mine = Object.values(memberships).filter((m) => m.clubId === club.id && m.user !== club.owner && effectiveTier(m) !== 'none');
  const open = comments.filter((x) => x.clubId === club.id && x.isQuestion && !x.resolved && !x.parentId).length + (club.demoStats?.openQuestions ?? 0);
  const avg = useMemo(() => {
    const users = [...new Set(mine.map((m) => m.user))];
    if (!users.length) return club.demoStats?.avgCompletionPct;
    const pcts = users.flatMap((u) => club.courses.filter((x) => x.published).map((co) => courseProgress(co, Object.fromEntries(co.lessons.map((l) => [l.id, progress[pkey(u, l.id)]]))).pct));
    return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : club.demoStats?.avgCompletionPct;
  }, [mine, club, progress]);
  const rev = monthlyRevenue(club.pricing, c.premium);
  const stat = (label: string, value: string) => <View style={{ flex: 1, minWidth: '45%', padding: 12, borderRadius: 14, backgroundColor: t.chip }}><Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{value}</Text></View>;
  return (
    <View>
      <Card>
        <Row><H>Numeri</H><Chip label="Dimostrativi" /></Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {stat('Follower', String(c.followers))}{stat('Iscritti free', String(c.free))}{stat('Iscritti Premium', String(c.premium))}{stat('Domande aperte', String(open))}
          {stat('Completamento medio', avg != null ? `${avg}%` : '—')}{stat('Netto al mese (stima)', money(rev.net, club.pricing.currency))}
        </View>
        {club.baseline && <Body small muted style={{ marginTop: 8 }}>I club di esempio includono iscritti fittizi; le persone vere di questo telefono si sommano.</Body>}
      </Card>
      <Card>
        <H>Iscritti su questo telefono</H>
        {mine.length === 0 && <Body small muted style={{ marginTop: 4 }}>Nessuno ancora. Quando altre persone si iscriveranno (col server) le vedrai qui.</Body>}
        {mine.map((m, i) => (
          <Item key={m.user} last={i === mine.length - 1}>
            <Row><Row style={{ flex: 1, justifyContent: 'flex-start' }} gap={10}><UserAvatar name={m.user} size={32} /><View><Body>{m.user}</Body><Body small muted>{`${m.tier === 'premium' ? 'Premium' : m.tier === 'free' ? 'Free' : 'Follower'} dal ${dayLong(m.since)}`}</Body></View></Row>
              <Row gap={6}>
                <Btn small ghost title={m.mutedByOwner ? 'Riabilita' : 'Silenzia'} onPress={() => useClub.getState().ownerMuteMember(club.id, m.user, !m.mutedByOwner)} />
                <Btn small ghost danger title="Rimuovi" onPress={() => confirmDelete(`${m.user} dal LifeClub`, () => useClub.getState().ownerRemoveMember(club.id, m.user), undefined, { okLabel: 'Rimuovi' })} />
              </Row>
            </Row>
          </Item>
        ))}
      </Card>
    </View>
  );
}
