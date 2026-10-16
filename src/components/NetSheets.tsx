import { itemLine } from '@/lib/menu';
import { likersFor } from '@/lib/likers';
import { peoplePool } from '@/lib/network';
import { useMenus } from '@/store/menus';
import { MentionSuggest, MentionText } from '@/components/MentionBox';
import { CreateHubView } from '@/components/feed/CreateHub';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Text, TextInput } from '@/components/T';

import { SPONSORED_TEXT } from '@/components/market';
import { IdeaCard, LpTag, type ModTarget, MediaViewer, UserAvatar, doContribute, openPurchaseConfirm, openSheet, useNetSheet } from '@/components/network';
import { Body, Btn, IL, Input, Item, Link, Pill, Row, Select, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF, weekdayShortDate } from '@/lib/format';
import { IDEA_DEFAULT_DAYS, IDEA_MAX_DAYS, IDEA_PERIODS, ideaState } from '@/lib/ideas';
import { go } from '@/lib/nav';
import { MAX_POST, editInCommunity, editStandalone, parseRef, removeInCommunity, removeStandalone, validatePostText } from '@/lib/postEdit';
import { confirmDelete } from '@/lib/confirm';
import { paidCancel, freeCancel } from '@/data/marketSeed';
import { confirmAttendance, hasEnded } from '@/lib/enroll';
import { ConflictSheet } from '@/lib/planBooking';
import { dayKeyOf, fmtDuration, fmtRange, nextDays, timeOptions, tsOf } from '@/lib/when';
import { EVERY_LABEL, MAX_OCCURRENCES, applySeminarEdit, seriesDates, validateSeminar, type Every, type Scope, type SemForm, type SemLike } from '@/lib/offerEdit';
import { fmtDate } from '@/i18n/format';
import { WEEKDAYS, slotLabel, sortSlots, validateService, type ServiceForm } from '@/lib/offerEdit';
import { providerInfoFor, type ServiceInfo } from '@/data/marketSeed';
import { cancelEnrollmentOp } from '@/domain/operations';
import { myWithdrawInfo } from '@/lib/lpActions';
import { VOTE_BLOCK_MSG, lpReceived, cryptoRates, isVoteReasonRelevant, rateIdeaDetailed, textSimilarity } from '@/lib/network';
import { castProfileVote, profileVoteBlock, skillStatesOf } from '@/lib/profile/actions';
import { ReputationDetail, SkillChip } from '@/components/profile/ProfileParts';
import { HONESTY_NOTICE, quota } from '@/lib/profile/skills';
import { useApp } from '@/store/app';
import { newId, topicList, useNet } from '@/store/network';
import { showUndoToast, toast } from '@/store/toast';
import { Icon } from '@/lib/icons';
import { REPORT_NOTICE } from '@/components/ReportsSheet';
import { MediaPickerField } from '@/components/MediaPickerField';
import { pickNetMedia, type NetMedia } from '@/lib/netMedia';
import { REASONS, modKey, type ModKind, type ReasonId } from '@/lib/modRules';
import { useVisible } from '@/lib/moderation';
import { useChat } from '@/store/chat';
import { useMod } from '@/store/moderation';
import { endAlign } from '@/lib/rtl';
import { t as tl, translateText } from '@/i18n/core';

/** Un'unica Sheet che mostra la vista richiesta dal social (evita modali annidate). */
export function NetSheetHost() {
  return (
    <>
      <NetSheetInner />
      <ConflictSheet />
      <MediaViewer />
    </>
  );
}

function NetSheetInner() {
  const { kind, p, close } = useNetSheet();
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  if (!kind) return <Sheet visible={false} title="" onClose={close}><View /></Sheet>;

  let title = '';
  let body: React.ReactNode = null;

  switch (kind) {
    case 'comments': {
      title = 'Commenti';
      body = <CommentsView k={p.key} />;
      break;
    }
    case 'postMenu': {
      const { author, tag } = p;
      title = author;
      const fol = net.following.includes(author), mutedP = net.mutedAuthors.includes(author), mutedT = tag && net.mutedTopics.includes(tag);
      const mine = author === me && !!p.ref && parseRef(String(p.ref)) !== null;
      body = mine ? (
        <>
          <Item onPress={() => { close(); setTimeout(() => openSheet('editPost', { ref: p.ref }), 250); }}><IL icon="edit">Modifica</IL></Item>
          <Item onPress={() => { Share.share({ message: `Post di ${author} su LifePilot` }); }}><Body>Condividi fuori dall’app</Body></Item>
          <Item last onPress={() => { close(); setTimeout(() => deleteMyPost(String(p.ref), me), 250); }}><IL icon="trash" color={t.danger}>Elimina</IL></Item>
        </>
      ) : (
        <>
          <Item onPress={() => { Share.share({ message: `Post di ${author} su LifePilot` }); }}><Body>Condividi fuori dall’app</Body></Item>
          <Item onPress={() => { const f = net.toggleFollow(author); close(); toast(f ? 'Ora segui ' + author : 'Non segui più ' + author); }}><Body>{fol ? 'Smetti di seguire' : 'Segui'}</Body></Item>
          <Item onPress={() => { const m = net.toggleMuteAuthor(author); close(); toast(m ? `Post di ${author} silenziati` : `Post di ${author} riattivati`); }}><Body>{mutedP ? 'Riattiva ' + author : 'Silenzia ' + author}</Body></Item>
          {tag ? <Item onPress={() => { const m = net.toggleMuteTopic(tag); close(); toast(m ? `Post su ${tag} silenziati` : `Post su ${tag} riattivati`); }}><Body>{mutedT ? 'Riattiva argomento ' + tag : 'Silenzia argomento ' + tag}</Body></Item> : null}
          {p.ref ? <ModItems target={{ kind: 'post', ref: p.ref, label: p.label || 'Post di ' + author, author }} /> : null}
        </>
      );
      break;
    }
    case 'editPost': { title = 'Modifica il post'; body = <EditPostView ref_={String(p.ref)} resume={!!p.resume} />; break; }
    case 'contentMenu': {
      const tg = p as ModTarget;
      title = tg.label ? (tg.label.length > 40 ? tg.label.slice(0, 38) + '…' : tg.label) : 'Azioni';
      body = <ModItems target={tg} />;
      break;
    }
    case 'report': {
      title = 'Segnala';
      body = <ReportView target={p as ModTarget} />;
      break;
    }
    case 'donate': {
      title = 'Donare il LifePoint di oggi?';
      body = (
        <>
          <View style={{ alignItems: 'center', marginVertical: 10 }}><LpTag size={60} dark={false} /></View>
          <Body small muted style={{ textAlign: 'center' }}>Vuoi donare il tuo LifePoint giornaliero a <Text style={{ fontWeight: '700' }}>{p.author}</Text>?</Body>
          <Row style={{ marginTop: 14 }}>
            <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={close} />
            <Btn style={{ flex: 1 }} title="Dona" onPress={() => { const ok = net.donateDaily(p.author, p.key, me); close(); toast(ok ? 'Hai donato il tuo LifePoint di oggi a ' + p.author : 'Hai già donato il tuo LifePoint di oggi a ' + net.dailyPoint.to); }} />
          </Row>
        </>
      );
      break;
    }
    case 'scoreExpl': {
      const idea = net.ideas.find((x) => x.id === p.id);
      if (!idea) break;
      const { score, parts } = rateIdeaDetailed(idea.desc);
      title = `Perché ${score}/100`;
      body = (
        <>
          <Body small muted>Il punteggio nasce analizzando quanto la descrizione copre gli elementi chiave di un'idea solida: problema, mercato, ricavi, concorrenza, team.</Body>
          {parts.map((x, i) => <Item key={i}><Row><Body style={{ flex: 1 }}>{x.label}</Body><Body bold color={x.pts >= 0 ? t.positive : t.danger}>{x.pts >= 0 ? '+' : ''}{x.pts}</Body></Row></Item>)}
          <Item last><Row><Body muted>Totale</Body><Body bold>{score}/100</Body></Row></Item>
        </>
      );
      break;
    }
    case 'ideaMenu': {
      title = 'Idee';
      const muted = net.mutedIdeaAuthors.includes(p.author);
      body = (
        <>
          <Item onPress={() => { net.patch({ hideIdeas: !net.hideIdeas }); close(); toast(net.hideIdeas ? 'Le idee sono tornate visibili nella home' : 'Non vedrai più idee nella home'); }}><Body>{net.hideIdeas ? 'Torna a vedere le idee nella home' : 'Non vedere più idee nella home'}</Body></Item>
          <Item onPress={() => { net.patch({ mutedIdeaAuthors: muted ? net.mutedIdeaAuthors.filter((n) => n !== p.author) : [...net.mutedIdeaAuthors, p.author] }); close(); toast(muted ? `Idee di ${p.author} di nuovo visibili` : `Idee di ${p.author} nascoste dalla home`); }}><Body>{muted ? 'Rivedi le idee di ' + p.author : 'Non vedere più le idee di ' + p.author}</Body></Item>
          {p.id != null ? <ModItems target={{ kind: 'idea', ref: p.id, label: p.label || 'Idea di ' + p.author, author: p.author }} /> : null}
        </>
      );
      break;
    }
    case 'contribute': {
      const idea = net.ideas.find((x) => x.id === p.id);
      if (!idea) break;
      title = 'Contribuisci a ' + idea.title;
      body = <ContributeView idea={idea} />;
      break;
    }
    case 'likers': { title = 'Mi piace'; body = <LikersView k={p.key} author={p.author} count={p.count} />; break; }
    case 'create': { title = 'Crea'; body = <CreateHubView />; break; }
    case 'newIdea': { title = 'La tua idea'; body = <NewIdeaView resume={!!p.resume} />; break; }
    case 'newCommunity': { title = 'Crea community'; body = <NewCommunityView />; break; }
    case 'postToCommunity': {
      const c = net.communities.find((x) => x.id === p.id);
      if (!c) break;
      title = 'Pubblica in ' + c.name;
      body = <PostToCommunityView id={c.id} resume={!!p.resume} />;
      break;
    }
    case 'newSeminar': { title = 'Nuovo seminario'; body = <NewSeminarView />; break; }
    case 'editSeminar': { title = 'Modifica il seminario'; body = <NewSeminarView semId={Number(p.id)} />; break; }
    case 'editService': { title = p.new ? 'Offri un servizio' : 'Modifica il servizio'; body = <ServiceEditor resume={!!p.resume} />; break; }
    case 'promoteSeminar': { title = 'Promuovi seminario'; body = <PromoteView id={p.id} />; break; }
    case 'vote': {
      title = 'Vota ' + p.name;
      const why = profileVoteBlock(me, p.name);
      body = why ? (
        <>
          <IL icon="info" bold>Voto non disponibile</IL>
          <Body small style={{ marginTop: 10 }}>{why}</Body>
          <Body small muted style={{ marginTop: 8 }}>Così le valutazioni vengono solo da chi ha davvero un legame con la persona: un seminario, un servizio o un LifeClub.</Body>
          <Btn ghost style={{ marginTop: 14 }} title="Ho capito" onPress={close} />
        </>
      ) : <VoteView name={p.name} />;
      break;
    }
    case 'sponsoredInfo': {
      title = 'Cosa significa Sponsorizzato';
      body = (<><Body small>{SPONSORED_TEXT}</Body><Btn ghost style={{ marginTop: 14 }} title="Ho capito" onPress={close} /></>);
      break;
    }
    case 'confirmAttendance': { title = 'Conferma partecipazione'; body = <ConfirmAttendanceView id={p.id} />; break; }
    case 'rating': {
      title = 'Voto complessivo';
      body = <ReputationDetail name={p.name} onClose={close} />;
      break;
    }
    case 'createClub': { title = 'Crea il tuo LifeClub'; body = <CreateClubView />; break; }
    case 'clubManage': {
      const club = net.clubs[me];
      title = 'Il tuo LifeClub';
      body = club ? (<><Item><Row><Body muted>Quota mensile</Body><Body bold>{club.fee} LP</Body></Row></Item><Item><Row><Body muted>Membri</Body><Body bold>{club.members.length}</Body></Row></Item><Body small muted style={{ marginTop: 10 }}>{club.desc}</Body></>) : null;
      break;
    }
    case 'statDetail': {
      if (p.what === 'ideas') {
        title = 'Idee pubblicate';
        const list = net.ideas.filter((i) => i.author === p.name);
        body = list.length ? list.map((i) => <Item key={i.id} onPress={() => { close(); go('ideaProfile', { id: String(i.id) }); }}><Body bold>{i.title}</Body><Body small muted numberOfLines={2}>{i.desc}</Body></Item>) : <Body small muted>Nessuna idea ancora.</Body>;
      } else if (p.what === 'contributions') {
        title = 'Contributi dati';
        const list = net.ledger.filter((l) => l.desc.startsWith('Contributo a'));
        body = list.length ? list.map((l, i) => <Item key={i}><Row><View style={{ flex: 1 }}><Body>{l.desc}</Body><Body small muted>{l.date}</Body></View><Body bold>{formatCHF(l.amount)} LP</Body></Row></Item>) : <Body small muted>Nessun contributo ancora.</Body>;
      } else {
        title = p.what === 'seminars' ? 'Seminari' : 'Servizi prenotati';
        const kind = p.what === 'seminars' ? 'seminar' : 'service';
        const list = net.enrollments.filter((e) => e.kind === kind);
        body = list.length ? list.map((e) => <Item key={e.id} onPress={() => { close(); if (e.kind === 'seminar') go('seminarPage', { id: e.ref }); else go('servicePage', { name: e.host }); }}><Body bold>{e.kind === 'seminar' ? e.title : `${e.title} con ${e.host}`}</Body><Body small muted>{fmtRange(e.startsAt, e.durationMin)} · {e.status === 'attended' ? 'partecipazione confermata' : e.status === 'declined' ? 'non partecipato' : hasEnded(e) ? 'da confermare' : 'in programma'}</Body></Item>) : <Body small muted>Nessun elemento ancora.</Body>;
      }
      break;
    }
    case 'following': {
      title = 'Chi segui';
      body = (
        <>
          <Body small muted style={{ marginBottom: 10 }}>Visibile solo a te: nessun altro può vedere chi segui.</Body>
          {net.following.length === 0 ? <Body small muted>Non segui ancora nessuno.</Body> : net.following.map((n) => (
            <Item key={n}><Row><Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} onPress={() => { close(); go('userProfile', { name: n }); }}><UserAvatar name={n} size={32} /><Body bold>{n}</Body></Pressable><Link onPress={() => net.toggleFollow(n)}>Non seguire più</Link></Row></Item>
          ))}
        </>
      );
      break;
    }
    case 'editProfile': { title = 'Modifica profilo'; body = <EditProfileView />; break; }
    case 'verification': { title = 'Verifica identità'; body = <VerificationView />; break; }
    case 'lpDaily': {
      // lo vedono tutti: chi ha donato il LifePoint giornaliero a questa persona (e su quale post)
      const who = p.name ?? me;
      title = 'LifePoints Giornalieri ricevuti';
      const log = who === me ? [...(net.donorsLog?.[me] ?? []), ...(net.receivedLog ?? [])] : (net.donorsLog?.[who] ?? []);
      const distinct = new Set(log.map((l) => l.from)).size;
      body = log.length ? (
        <>
          <Body small muted style={{ marginBottom: 8 }}>{tl('{0} donazioni da {1} persone diverse. Questo elenco lo vedono tutti.', log.length, distinct)}</Body>
          {log.map((l, i) => (
            <Item key={i} last={i === log.length - 1} onPress={() => { close(); if (l.ref) go('postPage', { key: l.ref }); else go('userProfile', { name: l.from }); }}>
              <Row><UserAvatar name={l.from} size={32} /><View style={{ flex: 1, marginStart: 10 }}><Body bold>{l.from}</Body><Body small muted>{l.ref ? 'Su un post · tocca per vederlo' : 'Dal profilo'}</Body></View><Body small muted>{l.date}</Body></Row>
            </Item>
          ))}
        </>
      ) : <Body small muted>Ancora nessun LifePoint giornaliero ricevuto.</Body>;
      break;
    }
    case 'lpTotal': {
      title = 'LifePoints complessivi ricevuti';
      const rcv = lpReceived(me);
      const raised = rcv.ideas, daily = rcv.daily, pay = rcv.payments, total = rcv.total;
      const wi = myWithdrawInfo();
      const conv = Math.min(net.lpConverted ?? 0, total);
      const redeemable = wi.withdrawable;
      const lockedAll = rcv.blocked + wi.locked;
      const row = (label: string, n: number, last?: boolean, bold?: boolean) => <Item last={last}><Row><Body bold={bold} style={{ flex: 1 }}>{label}</Body><Row gap={2}><Body bold>{formatCHF(n)}</Body><LpTag size={13} /></Row></Row></Item>;
      body = (
        <>
          {row('Giornalieri', daily)}
          {row('Contributi alle tue idee', raised)}
          {rcv.ideasBlocked > 0 && <Body small muted style={{ marginBottom: 6 }}>{tl('Di cui {0} LP bloccati: si sbloccano quando l\'idea raggiunge l\'obiettivo, altrimenti tornano a chi ha contribuito.', formatCHF(rcv.ideasBlocked))}</Body>}
          {row('Quote, iscrizioni e servizi', pay)}
          {rcv.servicesBlocked > 0 && <Body small muted style={{ marginBottom: 6 }}>{tl('Di cui {0} LP bloccati: si sbloccano alla fine di ogni seminario o sessione.', formatCHF(rcv.servicesBlocked))}</Body>}
          {row('Totale ricevuti', total, true, true)}
          <Body bold style={{ marginTop: 14, marginBottom: 4 }}>Cosa puoi riscattare</Body>
          {row('Riscattabili adesso', redeemable)}
          {row('Bloccati: non ancora riscattabili', lockedAll)}
          {rcv.ideasBlocked > 0 && <Body small muted>{tl('Idee: {0} LP, si sbloccano quando raggiungono l\'obiettivo', formatCHF(rcv.ideasBlocked))}</Body>}
          {rcv.servicesBlocked > 0 && <Body small muted>{tl('Servizi e seminari: {0} LP, si sbloccano alla fine della sessione', formatCHF(rcv.servicesBlocked))}</Body>}
          {wi.locked > 0 && <Body small muted>{tl('Giornalieri: {0} LP, si sbloccano a {1} donatori diversi', formatCHF(wi.locked), formatCHF(wi.required))}</Body>}
          {lockedAll > 0 && <Body small muted style={{ marginBottom: 6, marginTop: 4 }}>Appena si sbloccano passano tra i riscattabili e li puoi ritirare.</Body>}
          {row('Già riconvertiti in denaro', conv, true)}
        </>
      );
      break;
    }
    case 'topup': { title = 'Come ottenere LifePoints'; body = <TopUpView />; break; }
    case 'cv': {
      const name = p.name;
      const states = skillStatesOf(name, me);
      const q = quota(states);
      title = 'Competenze di ' + name;
      body = (
        <>
          <Row style={{ justifyContent: 'flex-start', marginBottom: 14 }}><UserAvatar name={name} size={40} /><View><Body bold>{name}</Body><Body small muted>{q.total ? tl('{0} su {1} competenze verificate', q.verified, q.total) : 'Nessuna competenza dichiarata'}</Body></View></Row>
          {states.map((s2) => <Item key={s2.id}><Row><Body style={{ flex: 1 }}>{s2.label}</Body><SkillChip s={s2} /></Row></Item>)}
          <Body small muted style={{ marginTop: 12 }}>Niente curriculum: contano le competenze. {HONESTY_NOTICE}</Body>
        </>
      );
      break;
    }
    case 'newPost': { title = 'Nuovo post'; body = <NewPostView resume={!!p.resume} prefill={p.prefill} />; break; }
    default: break;
  }

  return <Sheet visible={!!body} title={title} onClose={close} lowerable={kind === 'comments'}>{body}</Sheet>;
}

/* ---------------- viste con stato locale ---------------- */
/** Chi ha messo mi piace a un contenuto (elenco dimostrativo finché non c'è un server che lo registra). */
function LikersView({ k, author, count }: { k: string; author?: string; count: number }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const liked = useNet((s) => s.likedPosts.includes(k));
  const following = useNet((s) => s.following);
  const list = useMemo(() => likersFor(k, count, peoplePool(me), me, liked, author), [k, count, me, liked, author]);
  return (
    <>
      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 8 }}>{count === 1 ? translateText('1 persona ha messo mi piace') : `${count} ${translateText('persone hanno messo mi piace')}`}</Text>
      {list.names.length === 0 ? <Body small muted>Ancora nessun mi piace: sii il primo.</Body> : list.names.map((n, i) => (
        <Item key={n} last={i === list.names.length - 1 && list.more === 0} onPress={() => { useNetSheet.getState().close(); go('userProfile', { name: n }); }}>
          <Row style={{ justifyContent: 'flex-start' }} gap={12}>
            <UserAvatar name={n} size={40} link={false} />
            <Body bold style={{ flex: 1 }}>{n === me ? translateText('Tu') : n}</Body>
            {n !== me && following.includes(n) ? <Text style={{ color: t.muted, fontSize: 12.5 }}>{translateText('Segui già')}</Text> : null}
          </Row>
        </Item>
      ))}
      {list.more > 0 ? <Body small muted style={{ marginTop: 8 }}>{`${translateText('e altre')} ${list.more} ${translateText('persone')}`}</Body> : null}
    </>
  );
}

function CommentsView({ k }: { k: string }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const [text, setText] = useState('');
  const visible = useVisible();
  const list = (net.comments[k] || []).map((c, i) => ({ ...c, i })).filter((c) => visible('comment', `${k}#${c.i}`, c.author));
  return (
    <>
      {list.length === 0 ? <Body small muted>Ancora nessun commento: scrivi il primo.</Body> : list.map((c, i) => (
        <Item key={c.i}><Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={8}><UserAvatar name={c.author} size={24} /><View style={{ flex: 1 }}><Body small bold>{c.author}</Body><Body small muted><MentionText text={c.text} /></Body></View></Row></Item>
      ))}
      <MentionSuggest text={text} onPick={setText} />
      <Input multiline style={{ marginTop: 12, minHeight: 60 }} placeholder="Scrivi un commento…" value={text} onChangeText={setText} />
      <Btn small title="Commenta" onPress={() => { if (!text.trim()) return; net.addComment(k, me, text.trim()); setText(''); }} />
    </>
  );
}

function ContributeView({ idea }: { idea: ReturnType<typeof useNet.getState>['ideas'][number] }) {
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [amt, setAmt] = useState('');
  return (
    <>
      <Body small muted>Il tuo saldo: {formatCHF(net.lifePoints)} LP · importo libero</Body>
      {idea.rewardDesc ? <Body small color="#c9b6ff" style={{ marginTop: 6 }}>In cambio: {idea.rewardDesc}</Body> : <Body small muted style={{ marginTop: 6 }}>Nessuna ricompensa specifica indicata dal titolare.</Body>}
      <Input keyboardType="decimal-pad" placeholder="Quanti LP vuoi versare?" style={{ marginTop: 10 }} value={amt} onChangeText={setAmt} />
      <Btn title="Continua" onPress={() => {
        const a = parseFloat(amt.replace(',', '.'));
        if (!Number.isFinite(a) || a <= 0) { toast('Inserisci un importo valido'); return; }
        close();
        openPurchaseConfirm('Contribuisci a ' + idea.title, [['Titolare', idea.author], ['Importo', formatCHF(a) + ' LP'], ['In cambio', idea.rewardDesc || 'Nessuna ricompensa specificata']], () => doContribute(idea.id, a));
      }} />
    </>
  );
}

function NewIdeaView({ resume }: { resume?: boolean }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const d = resume ? (drafts.newIdea as { title: string; desc: string; type: 'libero' | 'fisso'; fixed: string; reward: string; media: NetMedia | null; days: number; target: string } | undefined) : undefined;
  const [title, setTitle] = useState(d?.title ?? ''); const [desc, setDesc] = useState(d?.desc ?? '');
  const [type, setType] = useState<'libero' | 'fisso'>(d?.type ?? 'libero'); const [fixed, setFixed] = useState(d?.fixed ?? ''); const [reward, setReward] = useState(d?.reward ?? '');
  const [media, setMedia] = useState<NetMedia | null>(d?.media ?? null);
  const [days, setDays] = useState<number>(d?.days ?? IDEA_DEFAULT_DAYS); const [target, setTarget] = useState(d?.target ?? '500');
  return (
    <>
      <Body small muted>Titolare: {me} (le pagine idea sono sempre legate a chi le pubblica).</Body>
      <Input style={{ marginTop: 8 }} placeholder="Titolo dell'idea" value={title} onChangeText={setTitle} />
      <Input multiline placeholder="Descrivi l'idea: di cosa si tratta, a chi serve, come funziona…" value={desc} onChangeText={setDesc} />
      <MediaPickerField value={media} onChange={setMedia} detach={detachOnIos ? (k) => void pickOutsideSheet(k, 'newIdea', { title, desc, type, fixed, reward, media, days, target }, () => openSheet('newIdea', { resume: true })) : undefined} />
      <Body small muted style={{ marginVertical: 8 }}>Chi contribuisce riceve in cambio…</Body>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}><Pill label="Importo libero" on={type === 'libero'} onPress={() => setType('libero')} /><Pill label="Importo fisso" on={type === 'fisso'} onPress={() => setType('fisso')} /></View>
      {type === 'fisso' && <Input keyboardType="decimal-pad" placeholder="Importo fisso in LP" value={fixed} onChangeText={setFixed} />}
      <Input multiline style={{ minHeight: 60 }} placeholder="Cosa riceve in cambio: un ringraziamento, un prodotto, uno sconto, un invito…" value={reward} onChangeText={setReward} />
      <Body small muted style={{ marginVertical: 8 }}>Obiettivo e durata della raccolta (al massimo {IDEA_MAX_DAYS} giorni). I LifePoints ti arrivano solo se raggiungi l'obiettivo: altrimenti chi ha contribuito viene rimborsato.</Body>
      <Input keyboardType="number-pad" placeholder="Obiettivo in LP" value={target} onChangeText={setTarget} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>{IDEA_PERIODS.map((d) => <Pill key={d} label={tl('{0} giorni', d)} on={days === d} onPress={() => setDays(d)} />)}</View>
      <Btn title="Pubblica e fai valutare dall'AI" onPress={() => {
        const ti = title.trim(), de = desc.trim();
        if (!ti || !de) { toast('Compila titolo e descrizione'); return; }
        const fa = type === 'fisso' ? parseFloat(fixed.replace(',', '.')) : null;
        if (type === 'fisso' && (!fa || fa <= 0)) { toast('Inserisci un importo fisso valido'); return; }
        const tg = Math.floor(parseFloat(target.replace(',', '.')) || 0);
        if (tg < 10) { toast('L\'obiettivo deve essere di almeno 10 LP'); return; }
        const dup = net.ideas.find((x) => textSimilarity(x.title + ' ' + x.desc, ti + ' ' + de) > 0.35);
        net.patch({ ideas: [...net.ideas, { id: newId(), title: ti, desc: de, author: me, raised: 0, similarTo: dup ? dup.id : null, rewardType: type, fixedAmount: fa, rewardDesc: reward.trim(), target: tg, days, ts: Date.now(), media: media?.media ?? null, uri: media?.uri }] });
        close();
        toast(dup ? `Idea simile già presente: "${dup.title}". La tua è stata registrata come correlata.` : 'Idea pubblicata · punteggio AI: ' + rateIdeaDetailed(de).score + '/100');
      }} />
    </>
  );
}

function NewCommunityView() {
  const net = useNet();
  const me = useApp((a) => a.account.name);
  const close = useNetSheet((s) => s.close);
  const [name, setName] = useState(''); const [topic, setTopic] = useState(topicList[0]); const [ownerOnly, setOwnerOnly] = useState(true);
  const [desc, setDesc] = useState(''); const [rules, setRules] = useState('');
  return (
    <>
      <Input placeholder="Nome community" value={name} onChangeText={setName} />
      <Select title="Argomento" value={topic} options={topicList} onChange={setTopic} />
      <Input multiline style={{ minHeight: 80 }} placeholder="Descrizione: di cosa parla, per chi è, cosa si trova (almeno 30 caratteri)" value={desc} onChangeText={setDesc} />
      <Input multiline style={{ minHeight: 60 }} placeholder="Regole di pubblicazione aggiuntive (facoltativo)" value={rules} onChangeText={setRules} />
      <Toggle label="Solo io posso pubblicare" value={ownerOnly} onChange={setOwnerOnly} hint={ownerOnly ? 'I membri leggono e commentano' : 'Tutti i membri possono pubblicare'} />
      <Btn style={{ marginTop: 10 }} title="Crea" onPress={() => {
        if (!name.trim()) { toast('Inserisci un nome'); return; }
        if (desc.trim().length < 30) { toast('Scrivi una descrizione di almeno 30 caratteri: chi la trova deve capire di cosa si tratta'); return; }
        net.patch({ communities: [{ id: newId(), name: name.trim(), topic, owner: me, openPosting: !ownerOnly, members: [me], posts: [], desc: desc.trim(), rules: rules.trim() || undefined, ts: Date.now() }, ...net.communities] });
        close(); toast('Community creata');
      }} />
    </>
  );
}

function PostToCommunityView({ id, resume }: { id: number; resume?: boolean }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const d = resume ? (drafts.postToCommunity as { text: string; media: NetMedia | null } | undefined) : undefined;
  const [text, setText] = useState(d?.text ?? '');
  const [media, setMedia] = useState<NetMedia | null>(d?.media ?? null);
  return (
    <>
      <Input multiline placeholder="Scrivi qualcosa…" value={text} onChangeText={setText} />
      <MediaPickerField value={media} onChange={setMedia} detach={detachOnIos ? (k) => void pickOutsideSheet(k, 'postToCommunity', { text, media }, () => openSheet('postToCommunity', { id, resume: true })) : undefined} />
      <Btn title="Pubblica" onPress={() => {
        if (!text.trim() && !media) { toast('Scrivi qualcosa o aggiungi una foto'); return; }
        net.patch({ communities: net.communities.map((c) => (c.id === id ? { ...c, posts: [{ author: me, text: text.trim(), media: media?.media ?? null, uri: media?.uri, likes: 0, ts: Date.now() }, ...c.posts] } : c)) });
        close(); toast('Pubblicato');
      }} />
    </>
  );
}

const DURATIONS: [string, number][] = [['30 minuti', 30], ['45 minuti', 45], ['1 ora', 60], ['1 ora e 30', 90], ['2 ore', 120], ['3 ore', 180]];

/** Crea o modifica un seminario (anche ripetuto): dopo la pubblicazione chi lo tiene può cambiare ogni campo. */
function NewSeminarView({ semId }: { semId?: number }) {
  const net = useNet();
  const me = useApp((a) => a.account.name);
  const close = useNetSheet((s) => s.close);
  const cur = semId != null ? net.seminars.find((x) => x.id === semId && x.host === me) : undefined;
  const editing = !!cur;
  const now = Date.now();
  const started = !!cur?.startsAt && cur.startsAt <= now;
  const baseDays = nextDays(90);
  const curKey = cur?.startsAt ? dayKeyOf(cur.startsAt) : null;
  const days = curKey && !baseDays.some((d) => d.key === curKey) ? [{ key: curKey, label: fmtDate(cur!.startsAt!, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), ts: cur!.startsAt! }, ...baseDays] : baseDays;
  const curDay = curKey ? days.find((d) => d.key === curKey)?.label : undefined;
  const hh = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const [title, setTitle] = useState(cur?.title ?? ''); const [desc, setDesc] = useState(cur?.desc ?? ''); const [learn, setLearn] = useState((cur?.learn ?? []).join('\n')); const [audience, setAudience] = useState(cur?.audience ?? '');
  const [dayLabel, setDayLabel] = useState(curDay ?? days[1].label); const [time, setTime] = useState(cur?.startsAt ? hh(cur.startsAt) : '18:00');
  const [dur, setDur] = useState(DURATIONS.find((d) => d[1] === (cur?.durationMin ?? 60))?.[0] ?? '1 ora');
  const [mode, setMode] = useState<'online' | 'presenza'>(cur?.mode ?? 'online'); const [place, setPlace] = useState(cur?.place ?? ''); const [lang, setLang] = useState(cur?.language ?? 'Italiano');
  const [price, setPrice] = useState(cur ? String(cur.price) : ''); const [seats, setSeats] = useState(cur?.seats ? String(cur.seats) : '');
  const [every, setEvery] = useState<Every | 'none'>('none'); const [times, setTimes] = useState('4');
  const [scope, setScope] = useState<Scope>('one');
  const inSeries = !!cur?.series && net.seminars.filter((x) => x.series === cur.series).length > 1;
  const SCOPES: [Scope, string][] = [['one', 'Solo questo'], ['following', 'Questo e i successivi'], ['all', 'Tutta la serie']];
  const EVERY_OPTS: [Every | 'none', string][] = [['none', 'Non si ripete'], ['week', EVERY_LABEL.week], ['2weeks', EVERY_LABEL['2weeks']], ['month', EVERY_LABEL.month]];
  const save = () => {
    const day = days.find((d) => d.label === dayLabel)!.key;
    const startsAt = started && editing ? cur!.startsAt! : tsOf(day, time);
    const durationMin = DURATIONS.find((d) => d[0] === dur)![1];
    const form: SemForm = { title, desc, learn, audience, startsAt, durationMin, mode, place, language: lang, price, seats };
    const why = validateSeminar(form, { now, keepPast: started && editing, joined: cur?.joined ?? 0 });
    if (why) { toast(why); return; }
    const pr = parseFloat(price.replace(',', '.')), se = parseInt(seats, 10);
    const lines = learn.split('\n').map((l) => l.trim()).filter(Boolean);
    const body = { title: title.trim(), desc: desc.trim(), learn: lines.length ? lines : undefined, audience: audience.trim() || undefined, durationMin, mode, place: place.trim(), language: lang, price: pr, seats: se, cancelPolicy: pr ? paidCancel(pr) : freeCancel };
    if (editing) {
      const r = applySeminarEdit(net.seminars as SemLike[], cur!.id, { ...body, ...(startsAt !== cur!.startsAt ? { startsAt } : {}) }, inSeries ? scope : 'one', now);
      net.patch({ seminars: r.list as typeof net.seminars });
      const people = Math.max((net.participants?.[`seminar:${cur!.id}`] ?? []).length, cur!.joined ?? 0);
      close(); toast(people > 0 && (startsAt !== cur!.startsAt || pr !== cur!.price) ? tl('Seminario modificato: {0} iscritti avvisati. Chi ha già pagato mantiene il prezzo pagato.', people) : r.changed.length > 1 ? tl('{0} date modificate', r.changed.length) : 'Seminario modificato');
      return;
    }
    const dates = every === 'none' ? [startsAt] : seriesDates(startsAt, every, parseInt(times, 10) || 1);
    const series = dates.length > 1 ? `ser${newId()}` : undefined;
    const created = dates.map((ts, i) => ({
      id: newId() + i, ...body, host: me, promoted: false, ts: Date.now(), startsAt: ts, joined: 0, included: 'Partecipazione al seminario secondo la descrizione sopra.', ...(series ? { series } : {}),
    }));
    net.patch({ seminars: [...created.reverse(), ...net.seminars] });
    close(); toast(dates.length > 1 ? tl('{0} seminari pubblicati', dates.length) : 'Seminario pubblicato');
  };
  return (
    <>
      <Body small muted style={{ marginBottom: 8 }}>{editing ? 'Puoi cambiare tutto, anche dopo la pubblicazione. Chi è già iscritto viene avvisato se cambiano data o ora.' : 'Scrivi in modo chiaro e onesto: chi si iscrive deve capire cosa imparerà, quando e dove. Gli iscritti pagano al momento della prenotazione e i LifePoints ti arrivano alla fine.'}</Body>
      {editing && inSeries ? (
        <>
          <Body small muted style={{ marginBottom: 4 }}>Questo seminario fa parte di una serie: cosa vuoi modificare?</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{SCOPES.map(([k, l]) => <Pill key={k} label={l} on={scope === k} onPress={() => setScope(k)} />)}</View>
        </>
      ) : null}
      <Input placeholder="Titolo del seminario" value={title} onChangeText={setTitle} />
      <Input multiline style={{ minHeight: 100 }} placeholder="Descrizione completa: di cosa parli, come si svolge, cosa non è (almeno 80 caratteri)" value={desc} onChangeText={setDesc} />
      <Input multiline style={{ minHeight: 60 }} placeholder="Cosa si impara: una voce per riga (facoltativo)" value={learn} onChangeText={setLearn} />
      <Input placeholder="A chi è rivolto (facoltativo)" value={audience} onChangeText={setAudience} />
      <Body small muted style={{ marginBottom: 4 }}>Data e ora di inizio</Body>
      {started && editing ? <Body small muted style={{ marginBottom: 8 }}>Il seminario è già iniziato: la data non si può più cambiare.</Body> : (
        <>
          <Select title="Data" value={dayLabel} options={days.map((d) => d.label)} onChange={setDayLabel} />
          <Select title="Ora di inizio" value={time} options={timeOptions(6, 22)} onChange={setTime} />
        </>
      )}
      <Body small muted style={{ marginBottom: 4 }}>Durata</Body>
      <Select title="Durata" value={dur} options={DURATIONS.map((d) => d[0])} onChange={setDur} />
      {!editing ? (
        <>
          <Body small muted style={{ marginBottom: 4 }}>Si ripete?</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{EVERY_OPTS.map(([k, l]) => <Pill key={k} label={l} on={every === k} onPress={() => setEvery(k)} />)}</View>
          {every !== 'none' ? <Input keyboardType="number-pad" placeholder={`Quante volte in tutto (da 2 a ${MAX_OCCURRENCES})`} value={times} onChangeText={setTimes} /> : null}
        </>
      ) : null}
      <Body small muted style={{ marginBottom: 4 }}>Modalità</Body>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}><Pill label="Online" on={mode === 'online'} onPress={() => setMode('online')} /><Pill label="In presenza" on={mode === 'presenza'} onPress={() => setMode('presenza')} /></View>
      <Input placeholder={mode === 'online' ? 'Link o istruzioni per collegarsi' : 'Luogo e indirizzo'} value={place} onChangeText={setPlace} />
      <Body small muted style={{ marginBottom: 4 }}>Lingua</Body>
      <Select title="Lingua" value={lang} options={['Italiano', 'English', 'Français', 'Deutsch']} onChange={setLang} />
      <Input keyboardType="decimal-pad" placeholder="Prezzo in LP (0 = gratuito)" value={price} onChangeText={setPrice} />
      <Input keyboardType="number-pad" placeholder="Numero di posti" value={seats} onChangeText={setSeats} />
      <Btn title={editing ? 'Salva le modifiche' : 'Pubblica'} onPress={save} />
    </>
  );
}

/** Crea o modifica il proprio servizio (una persona = un servizio): cosa si offre, quanto costa, come si svolge e quando si è disponibili. Si può cambiare tutto anche dopo la pubblicazione. */
function ServiceEditor({ resume }: { resume?: boolean }) {
  void resume;
  const net = useNet();
  const me = useApp((a) => a.account.name);
  const t = useTheme();
  const close = useNetSheet((s) => s.close);
  const cur = net.providers.find((x) => x.name === me);
  const info = cur ? providerInfoFor(cur) : undefined;
  const [role, setRole] = useState(cur?.role ?? ''); const [tag, setTag] = useState(cur?.tag ?? topicList[0]);
  const [desc, setDesc] = useState(info?.desc && !info.desc.includes('non ha ancora aggiunto') ? info.desc : '');
  const [gets, setGets] = useState((info?.gets ?? []).join('\n')); const [forWho, setForWho] = useState(info?.forWho ?? '');
  const [price, setPrice] = useState(cur ? String(cur.price) : '');
  const [dur, setDur] = useState(DURATIONS.find((d) => d[1] === (info?.durationMin ?? 60))?.[0] ?? '1 ora');
  const [mode, setMode] = useState<'online' | 'presenza'>(info?.mode ?? 'online'); const [place, setPlace] = useState(info?.place ?? ''); const [lang, setLang] = useState(info?.language ?? 'Italiano');
  const [slots, setSlots] = useState<string[]>(cur?.slots ?? []);
  const [cover, setCover] = useState<string | undefined>(cur?.cover);
  const pickCover = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && perm.accessPrivileges !== 'limited') { toast('Permesso foto negato: abilitalo dalle impostazioni del telefono.'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
      if (!r.canceled && r.assets[0]) setCover(r.assets[0].uri);
    } catch { toast('Non riesco ad aprire le foto'); }
  };
  const [day, setDay] = useState<string>(WEEKDAYS[0]); const [time, setTime] = useState('16:00');
  const save = () => {
    const form: ServiceForm = { role, tag, price, durationMin: DURATIONS.find((d) => d[0] === dur)![1], mode, place, language: lang, desc, slots };
    const why = validateService(form);
    if (why) { toast(why); return; }
    const pr = parseFloat(price.replace(',', '.'));
    const provider = { name: me, role: role.trim(), price: pr, rating: cur?.rating ?? 0, tag, media: cur?.media ?? null, slots: sortSlots(slots), cover };
    const lines = gets.split('\n').map((l) => l.trim()).filter(Boolean);
    const next: ServiceInfo = { desc: desc.trim(), gets: lines.length ? lines : [`Una sessione di ${fmtDuration(form.durationMin)}`], durationMin: form.durationMin, mode, place: place.trim(), language: lang, forWho: forWho.trim() || 'Chiunque voglia provare.', cancel: pr ? `Paghi ${pr} LP al momento della prenotazione. Puoi disdire fino a 24 ore prima con rimborso intero e lo slot torna disponibile; puoi sempre riprogrammare.` : 'Gratuito: puoi disdire in qualsiasi momento.' };
    net.patch({ providers: cur ? net.providers.map((x) => (x.name === me ? provider : x)) : [provider, ...net.providers], serviceInfo: { ...(net.serviceInfo ?? {}), [me]: next } });
    close(); toast(cur ? 'Servizio modificato' : 'Servizio pubblicato');
    if (!cur) go('servicePage', { name: me });
  };
  const remove = () => {
    if (!cur) return;
    close();
    setTimeout(() => confirmDelete(`il tuo servizio «${cur.role}»`, () => {
      const st = useNet.getState();
      const prev = { providers: st.providers, serviceInfo: st.serviceInfo };
      const future = st.enrollments.filter((e) => e.kind === 'service' && e.host === me && e.status === 'enrolled' && e.startsAt > Date.now());
      future.forEach((e) => cancelEnrollmentOp(e.id));
      useNet.getState().patch({ providers: useNet.getState().providers.filter((x) => x.name !== me), serviceInfo: Object.fromEntries(Object.entries(useNet.getState().serviceInfo ?? {}).filter(([k]) => k !== me)) });
      if (future.length) toast(tl('{0} prenotazioni annullate e rimborsate', future.length));
      void prev;
      go('myServices');
    }, undefined, { title: 'Eliminare il servizio?' }), 250);
  };
  return (
    <>
      <Body small muted style={{ marginBottom: 8 }}>Chi prenota paga in LifePoints al momento della prenotazione e tu li ricevi alla fine di ogni sessione. Puoi cambiare tutto quando vuoi.</Body>
      <Body small muted style={{ marginBottom: 4 }}>Banda in alto del servizio</Body>
      <View style={{ height: 96, borderRadius: 14, overflow: 'hidden', marginBottom: 8, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }}>
        {cover ? <Image source={{ uri: cover }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" /> : <Body small muted style={{ textAlign: 'center', paddingHorizontal: 16 }}>Senza foto, LifePilot sceglie lo sfondo per te</Body>}
      </View>
      <Row gap={8} style={{ marginBottom: 10 }}>
        <Btn small ghost style={{ flex: 1 }} icon="image" title={cover ? 'Cambia foto' : 'Scegli una foto'} onPress={pickCover} />
        {cover ? <Btn small ghost style={{ flex: 1 }} title="Sfondo automatico" onPress={() => setCover(undefined)} /> : null}
      </Row>
      <Input placeholder="Cosa offri (es. Lezione di francese)" value={role} onChangeText={setRole} maxLength={60} />
      <Select title="Categoria" value={tag} options={topicList} onChange={setTag} />
      <Input multiline style={{ minHeight: 90 }} placeholder="Descrizione: come si svolge una sessione, cosa non è (almeno 40 caratteri)" value={desc} onChangeText={setDesc} />
      <Input multiline style={{ minHeight: 60 }} placeholder="Cosa ottiene chi prenota: una voce per riga (facoltativo)" value={gets} onChangeText={setGets} />
      <Input placeholder="A chi è rivolto (facoltativo)" value={forWho} onChangeText={setForWho} />
      <Body small muted style={{ marginBottom: 4 }}>Durata di una sessione</Body>
      <Select title="Durata" value={dur} options={DURATIONS.map((d) => d[0])} onChange={setDur} />
      <Body small muted style={{ marginBottom: 4 }}>Modalità</Body>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}><Pill label="Online" on={mode === 'online'} onPress={() => setMode('online')} /><Pill label="In presenza" on={mode === 'presenza'} onPress={() => setMode('presenza')} /></View>
      <Input placeholder={mode === 'online' ? 'Come ci si collega (es. videochiamata in LifePilot)' : 'Luogo e indirizzo'} value={place} onChangeText={setPlace} />
      <Body small muted style={{ marginBottom: 4 }}>Lingua</Body>
      <Select title="Lingua" value={lang} options={['Italiano', 'English', 'Français', 'Deutsch']} onChange={setLang} />
      <Input keyboardType="decimal-pad" placeholder="Prezzo a sessione in LP (0 = gratuito)" value={price} onChangeText={setPrice} />
      <Body small muted style={{ marginBottom: 4 }}>Quando sei disponibile (ogni settimana)</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>{WEEKDAYS.map((d) => <Pill key={d} label={d} on={day === d} onPress={() => setDay(d)} />)}</View>
      <Select title="Ora" value={time} options={timeOptions(6, 22)} onChange={setTime} />
      <Btn small ghost icon="plus" style={{ alignSelf: 'flex-start', marginBottom: 6 }} title={`Aggiungi ${day} ${time}`} onPress={() => setSlots((l) => (l.includes(slotLabel(day, time)) ? l : sortSlots([...l, slotLabel(day, time)])))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {slots.length === 0 ? <Body small muted>Nessun orario scelto.</Body> : slots.map((sl) => (
          <Pressable key={sl} onPress={() => setSlots((l) => l.filter((x) => x !== sl))} accessibilityRole="button" accessibilityLabel={`${translateText('Togli')} ${sl}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.chip, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{sl}</Text><Icon name="x" size={12} color={t.muted} stroke={2.4} />
          </Pressable>
        ))}
      </View>
      <Btn title={cur ? 'Salva le modifiche' : 'Pubblica il servizio'} onPress={save} />
      {cur ? <Btn ghost icon="trash" style={{ marginTop: 8 }} title="Elimina il servizio" onPress={remove} /> : null}
    </>
  );
}

function ConfirmAttendanceView({ id }: { id: string }) {
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [step, setStep] = useState(1);
  const e = net.enrollments.find((x) => x.id === id);
  if (!e) return <Body small muted>Iscrizione non trovata.</Body>;
  const noun = e.kind === 'seminar' ? 'seminario' : 'sessione';
  const needsPay = e.paid == null && e.price > 0; // prenotazioni vecchie, non ancora pagate
  const done = () => {
    if (!confirmAttendance(id)) { close(); return; }
    toast(needsPay ? `Partecipazione confermata: -${e.price} LP, accreditati a ${e.host}` : 'Partecipazione confermata');
    openSheet('vote', { name: e.host });
  };
  return (
    <>
      <Item><Row><Body muted>{e.kind === 'seminar' ? 'Seminario' : 'Servizio'}</Body><Body bold style={{ flexShrink: 1, textAlign: endAlign() }}>{e.title}</Body></Row></Item>
      <Item><Row><Body muted>{e.kind === 'seminar' ? 'Relatore' : 'Professionista'}</Body><Body bold>{e.host}</Body></Row></Item>
      <Item><Row><Body muted>Quando</Body><Body bold style={{ flexShrink: 1, textAlign: endAlign() }}>{fmtRange(e.startsAt, e.durationMin)}</Body></Row></Item>
      <Item last><Row><Body muted>{needsPay ? 'Importo' : 'Pagamento'}</Body><Body bold>{e.price ? (needsPay ? `${e.price} LP` : `${e.price} LP · già pagati`) : 'Gratuito'}</Body></Row></Item>
      {step === 1 ? (
        <>
          <Body small muted style={{ marginTop: 12 }}>{needsPay ? `Confermando dichiari di aver partecipato al ${noun}. Solo a questo punto ${e.price} LP vengono addebitati sul tuo saldo e accreditati a ${e.host}.` : `Confermando dichiari di aver partecipato al ${noun}. Non verrà addebitato nulla: hai già pagato alla prenotazione.`}</Body>
          <Row style={{ marginTop: 14 }}>
            <Btn ghost style={{ flex: 1 }} title="Non ora" onPress={close} />
            <Btn style={{ flex: 1 }} title={needsPay ? 'Continua' : 'Conferma'} onPress={() => (needsPay ? setStep(2) : done())} />
          </Row>
        </>
      ) : (
        <>
          <Body small style={{ marginTop: 12 }}>Conferma definitiva: verranno addebitati <Body small bold>{e.price} LP</Body> (saldo attuale {formatCHF(net.lifePoints)} LP). L'operazione non può essere annullata dopo questo punto.</Body>
          <Row style={{ marginTop: 14 }}>
            <Btn ghost style={{ flex: 1 }} title="Indietro" onPress={() => setStep(1)} />
            <Btn style={{ flex: 1 }} title={`Conferma e paga ${e.price} LP`} onPress={done} />
          </Row>
        </>
      )}
    </>
  );
}

function PromoteView({ id }: { id: number }) {
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [amt, setAmt] = useState('');
  return (
    <>
      <Body small muted>Versa LifePoints per farlo comparire in evidenza nella home di LifeNetwork.</Body>
      <Input keyboardType="decimal-pad" style={{ marginTop: 10 }} placeholder="Quanti LP vuoi versare?" value={amt} onChangeText={setAmt} />
      <Btn title="Continua" onPress={() => {
        const a = parseFloat(amt.replace(',', '.'));
        if (!Number.isFinite(a) || a <= 0) { toast('Inserisci un importo valido'); return; }
        const s = net.seminars.find((x) => x.id === id); if (!s) return;
        close();
        openPurchaseConfirm('Promuovi · ' + s.title, [['Seminario', s.title], ['Importo', formatCHF(a) + ' LP']], () => {
          const st = useNet.getState();
          if (!st.spend(a, 'Promozione seminario "' + s.title + '"')) { toast('LifePoints insufficienti'); return; }
          useNet.setState({ seminars: st.seminars.map((x) => (x.id === id ? { ...x, promoted: true } : x)) });
          toast('Seminario promosso, comparirà nella home');
        });
      }} />
    </>
  );
}

function VoteView({ name }: { name: string }) {
  const t = useTheme();
  const me = useApp((a) => a.account.name);
  const close = useNetSheet((s) => s.close);
  const [stars, setStars] = useState(0); const [reason, setReason] = useState('');
  return (
    <>
      <Body small color={t.positive} style={{ marginBottom: 6 }}>Com'è andata con questa persona?</Body>
      <Body small muted>Il tuo voto e la tua recensione compaiono sul profilo con il tuo nome. Il motivo viene controllato prima di pubblicare: deve essere pertinente, non un riempitivo.</Body>
      <Row style={{ justifyContent: 'center', marginVertical: 16 }} gap={12}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)}><Icon name="award" size={32} color={n <= stars ? t.accent : t.border} fill={n <= stars ? t.accent : 'none'} /></Pressable>)}</Row>
      <Input multiline style={{ minHeight: 70 }} placeholder="Perché dai questo voto? (obbligatorio)" value={reason} onChangeText={setReason} />
      <Btn title="Invia voto" onPress={() => {
        if (!stars) { toast('Seleziona da 1 a 5 stelle'); return; }
        if (!isVoteReasonRelevant(reason)) { toast('Il motivo non sembra abbastanza pertinente: spiega meglio perché dai questo voto'); return; }
        if (!castProfileVote(me, name, stars, reason)) { close(); toast(VOTE_BLOCK_MSG); return; }
        close(); toast('Voto pubblicato');
      }} />
    </>
  );
}

function CreateClubView() {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const [fee, setFee] = useState(''); const [desc, setDesc] = useState('');
  return (
    <>
      <Input keyboardType="decimal-pad" placeholder="Quota mensile in LP" value={fee} onChangeText={setFee} />
      <Input multiline placeholder="Cosa troveranno i membri: contenuti esclusivi, formazione, seminari…" value={desc} onChangeText={setDesc} />
      <Btn title="Crea LifeClub" onPress={() => {
        const f = parseFloat(fee.replace(',', '.'));
        if (!Number.isFinite(f) || f <= 0) { toast('Inserisci una quota valida'); return; }
        const cid = newId();
        net.patch({ communities: [{ id: cid, name: me + ' Club', topic: 'Mind', owner: me, openPosting: false, members: [me], posts: [], desc: desc.trim() || undefined, ts: Date.now() }, ...net.communities], clubs: { ...net.clubs, [me]: { fee: f, desc: desc.trim(), communityId: cid, members: [me] } } });
        close(); toast('LifeClub creato');
      }} />
    </>
  );
}

function EditProfileView() {
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [bio, setBio] = useState(net.bio);
  return (
    <>
      <Body small muted style={{ marginBottom: 8 }}>Nome e cognome si modificano da Settings, sezione Account.</Body>
      <Input multiline style={{ minHeight: 70 }} placeholder="Una riga su di te…" value={bio} onChangeText={setBio} />
      <Btn title="Salva" onPress={() => { net.patch({ bio: bio.trim() }); close(); toast('Profilo aggiornato'); }} />
    </>
  );
}

function VerificationView() {
  const close = useNetSheet((s) => s.close);
  return (
    <>
      <Body small muted>Per pubblicare, vendere e offrire servizi su LifeNetwork serve un documento: ogni account è collegato a una persona reale. Il resto dell’app funziona anche senza.</Body>
      <Btn style={{ marginTop: 12 }} icon="lock" title="Verifica con un documento" onPress={() => { close(); go('identityVerify'); }} />
    </>
  );
}

function TopUpView() {
  const close = useNetSheet((s) => s.close);
  return (
    <>
      <Body small>Nell'app non esistono soldi veri: si usano solo i LifePoints, e non si comprano. Si guadagnano.</Body>
      <Item><Row><Icon name="heart" size={18} /><Body style={{ flex: 1 }}>Ricevendo il LifePoint giornaliero da qualcuno che hai aiutato</Body></Row></Item>
      <Item><Row><Icon name="lifeclub" size={18} /><Body style={{ flex: 1 }}>Con le quote del tuo LifeClub e le iscrizioni ai tuoi seminari e servizi</Body></Row></Item>
      <Item last><Row><Icon name="lifenetwork" size={18} /><Body style={{ flex: 1 }}>Con i contributi alle tue idee e le ricompense dell'app</Body></Row></Item>
      <Btn style={{ marginTop: 14 }} ghost title="Ho capito" onPress={close} />
    </>
  );
}

/** Modifica tutto di un proprio post, come in una chat: testo, argomento, foto o video, mi piace visibili, commenti. Resta «modificato». */
function EditPostView({ ref_, resume }: { ref_: string; resume?: boolean }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const r = parseRef(ref_);
  const stand = r?.kind === 'standalone' ? net.posts.find((x) => String(x.id) === r.id) : undefined;
  const cur = stand ?? (r?.kind === 'community' ? net.communities.find((c) => String(c.id) === r.id)?.posts[r.index] : undefined);
  const d = resume ? (drafts.editPost as { text: string; tag: string; media: NetMedia | null; hideLikes: boolean; commentsOff: boolean } | undefined) : undefined;
  const [text, setText] = useState(d?.text ?? cur?.text ?? '');
  const [tag, setTag] = useState(d?.tag ?? stand?.tag ?? topicList[0]);
  const [media, setMedia] = useState<NetMedia | null>(d ? d.media : cur?.media && cur.uri ? { media: cur.media, uri: cur.uri } : null);
  const [hideLikes, setHideLikes] = useState(d?.hideLikes ?? !!stand?.hideLikes);
  const [commentsOff, setCommentsOff] = useState(d?.commentsOff ?? !!stand?.commentsOff);
  if (!r || !cur || cur.author !== me) return <Body muted>Questo post non c'è più o non è tuo.</Body>;
  // un post nato con la foto di esempio (senza file) la tiene finché non la cambi o la togli
  const keepsDemoMedia = !!cur.media && !cur.uri && !media;
  return (
    <>
      <Input multiline placeholder="Scrivi il testo del post" value={text} onChangeText={setText} maxLength={MAX_POST} />
      {r.kind === 'standalone' ? <Select title="Argomento" value={tag} options={topicList} onChange={setTag} /> : null}
      <MediaPickerField value={media} onChange={setMedia} detach={detachOnIos ? (k) => void pickOutsideSheet(k, 'editPost', { text, tag, media, hideLikes, commentsOff }, () => openSheet('editPost', { ref: ref_, resume: true })) : undefined} />
      {keepsDemoMedia ? <Body small muted style={{ marginBottom: 8 }}>Il post ha già un'immagine: sceglierne una nuova la sostituisce.</Body> : null}
      {r.kind === 'standalone' ? (
        <>
          <Toggle label="Nascondi il numero di mi piace agli altri" value={hideLikes} onChange={setHideLikes} hint="Tu lo vedi sempre" />
          <Toggle label="Disattiva i commenti" value={commentsOff} onChange={setCommentsOff} hint="Nessuno può commentare questo post" />
        </>
      ) : null}
      <Btn style={{ marginTop: 10 }} title="Salva" onPress={() => {
        const has = !!media || keepsDemoMedia;
        const why = validatePostText(text, has);
        if (why) { toast(why); return; }
        const now = Date.now();
        const mediaPatch = keepsDemoMedia ? {} : { media: media?.media ?? null, uri: media?.uri };
        if (r.kind === 'standalone') net.patch({ posts: editStandalone(net.posts, r.id, me, { text, tag, hideLikes, commentsOff, ...mediaPatch }, now) });
        else net.patch({ communities: editInCommunity(net.communities, r.id, r.index, me, { text, ...mediaPatch }, now) });
        close(); toast('Post modificato');
      }} />
    </>
  );
}

/** Elimina un proprio post, con possibilità di annullare subito dopo. */
function deleteMyPost(ref: string, me: string) {
  const net = useNet.getState();
  const r = parseRef(ref);
  if (!r) return;
  const before = { posts: net.posts, communities: net.communities };
  confirmDelete('questo post', () => {
    if (r.kind === 'standalone') net.patch({ posts: removeStandalone(net.posts, r.id, me) });
    else net.patch({ communities: removeInCommunity(net.communities, r.id, r.index, me) });
  }, () => net.patch(before), { title: 'Eliminare il post?', undoMessage: 'Post eliminato' });
}

/** Bozza di una finestra mentre si sceglie la foto: su iPhone il selettore non si apre sopra una finestra, quindi la finestra si chiude e si riapre con la bozza. */
const drafts: Record<string, Record<string, any>> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
async function pickOutsideSheet(kind: 'photo' | 'video', key: string, state: Record<string, any>, reopen: () => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  drafts[key] = state;
  useNetSheet.getState().close();
  await new Promise((r) => setTimeout(r, 550));
  try { const m = await pickNetMedia(kind); if (m) drafts[key] = { ...state, media: m }; }
  catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); }
  reopen();
}
const detachOnIos = Platform.OS === 'ios';

function NewPostView({ resume, prefill }: { resume?: boolean; prefill?: string }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const d = resume ? (drafts.newPost as { text: string; tag: string; media: NetMedia | null } | undefined) : undefined;
  const [text, setText] = useState(d?.text ?? prefill ?? '');
  const [dish, setDish] = useState<string | null>(null);
  const [capMode, setCapMode] = useState<'photo' | 'below'>('photo');
  const myMenu = useMenus((x) => x.byOwner[me]); const [tag, setTag] = useState(d?.tag ?? topicList[0]); const [media, setMedia] = useState<NetMedia | null>(d?.media ?? null);
  const t = useTheme();
  const publish = () => {
    if (!text.trim() && !media) { toast('Scrivi qualcosa o aggiungi una foto'); return; }
    net.patch({ posts: [{ id: newId(), author: me, text: text.trim(), media: media?.media ?? null, uri: media?.uri, tag, likes: 0, ts: Date.now(), ...(dish ? { menuItem: dish } : {}), ...(media && capMode === 'below' ? { captionMode: 'below' as const } : {}) }, ...net.posts] });
    delete drafts.newPost;
    close(); toast('Post pubblicato');
  };
  const ready = !!text.trim() || !!media;
  return (
    <View style={{ gap: 4 }}>
      {/* chi sei e dove pubblichi */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <UserAvatar name={me} size={44} link={false} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{me}</Text>
          <Text style={{ color: t.muted, fontSize: 12.5 }}>{translateText('Pubblichi in')} {tag}</Text>
        </View>
      </View>
      {/* testo senza riquadro: si scrive e basta */}
      <TextInput multiline autoFocus={false} value={text} onChangeText={setText} maxLength={MAX_POST} placeholder={translateText('Cosa vuoi condividere?')} placeholderTextColor={t.muted} accessibilityLabel={translateText('Testo del post')}
        style={{ color: t.text, fontSize: 19, lineHeight: 27, minHeight: 120, textAlignVertical: 'top', paddingVertical: 8 }} />
      <MentionSuggest text={text} onPick={setText} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={translateText('Tagga una persona')} onPress={() => setText((x) => (x && !/\s$/.test(x) ? x + ' @' : x + '@'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: t.chip }}>
          <Text style={{ color: t.accent, fontWeight: '900', fontSize: 15 }}>@</Text>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{translateText('Tagga')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={translateText('Aggiungi un hashtag')} onPress={() => setText((x) => (x && !/\s$/.test(x) ? x + ' #' : x + '#'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: t.chip }}>
          <Text style={{ color: t.accent, fontWeight: '900', fontSize: 15 }}>#</Text>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{translateText('Hashtag')}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ color: t.muted, fontSize: 12 }}>{text.length}/{MAX_POST}</Text>
      </View>
      <MediaPickerField value={media} onChange={setMedia} detach={detachOnIos ? (k) => void pickOutsideSheet(k, 'newPost', { text, tag, media }, () => openSheet('newPost', { resume: true })) : undefined} />
      {/* la scritta: sulla foto oppure didascalia fissa sotto, come primo commento */}
      {media && text.trim() ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: t.chip, borderRadius: 14, padding: 4, marginBottom: 10 }}>
          {([['photo', 'Scritta sulla foto'], ['below', 'Didascalia fissa']] as const).map(([k, l]) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: capMode === k }} accessibilityLabel={translateText(l)} onPress={() => setCapMode(k)} style={{ flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: capMode === k ? t.accent : 'transparent' }}>
              <Text style={{ color: capMode === k ? t.onText : t.text, fontWeight: '800', fontSize: 13.5 }}>{translateText(l)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {/* chi ha un menù può legare il post a un piatto: si vede cos'è e quanto costa */}
      {myMenu && myMenu.items.length ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 }}>{translateText('PIATTO DEL MENÙ')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
            <Pill label={translateText('Nessuno')} on={!dish} onPress={() => setDish(null)} />
            {myMenu.items.map((it) => <Pill key={it.id} label={itemLine(it)} on={dish === it.id} onPress={() => setDish(it.id)} />)}
          </ScrollView>
        </View>
      ) : null}
      {/* argomento: scegli con un tocco */}
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 2, marginBottom: 6 }}>{translateText('ARGOMENTO')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ flexGrow: 0 }}>
        {topicList.map((x) => <Pill key={x} label={x} on={tag === x} onPress={() => setTag(x)} />)}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} accessibilityLabel={translateText('Pubblica')} onPress={publish} style={({ pressed }) => ({ marginTop: 16, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? t.accent : t.chip, opacity: pressed ? 0.9 : 1 })}>
        <Text style={{ color: ready ? t.onText : t.muted, fontSize: 16.5, fontWeight: '800' }}>{translateText('Pubblica')}</Text>
      </Pressable>
    </View>
  );
}

void IdeaCard; void weekdayShortDate;


/** Segnala / Nascondi / Blocca utente per un contenuto della rete. */
function ModItems({ target }: { target: ModTarget }) {
  const me = useApp((a) => a.account.name);
  const close = useNetSheet((s) => s.close);
  const blocked = useChat((s) => s.blocked);
  const key = modKey(target.kind, target.ref);
  const a = target.author;
  const canBlock = !!a && a !== me;
  return (
    <>
      {a !== me && <Item last={false} onPress={() => openSheet('report', target)}><IL icon="alert">Segnala</IL></Item>}
      <Item last={!canBlock} onPress={() => { useMod.getState().hide(target.kind, target.ref, target.label); close(); showUndoToast('Contenuto nascosto', () => useMod.getState().unhide(key)); }}><IL icon="eye">Nascondi</IL></Item>
      {canBlock && (
        <Item last onPress={() => {
          const on = !blocked.includes(a!);
          useChat.getState().block(a!, on);
          close();
          toast(on ? `${a} bloccato: non vedrai più i suoi contenuti. Puoi sbloccarlo da Segnalazioni inviate.` : `${a} sbloccato`);
        }}><IL icon="block" color="#e5484d">{blocked.includes(a!) ? 'Sblocca ' + a : 'Blocca ' + a}</IL></Item>
      )}
    </>
  );
}


function ReportView({ target }: { target: ModTarget }) {
  const t = useTheme();
  const close = useNetSheet((s) => s.close);
  const [reason, setReason] = useState<ReasonId | null>(null);
  const [note, setNote] = useState('');
  return (
    <>
      <Body small muted style={{ marginBottom: 8 }}>Perché vuoi segnalare questo contenuto?</Body>
      {REASONS.map((r) => (
        <Item key={r.id} onPress={() => setReason(r.id)}>
          <Row style={{ justifyContent: 'flex-start' }} gap={10}>
            <Icon name={reason === r.id ? 'checksquare' : 'square'} size={20} color={reason === r.id ? t.accent : t.muted} />
            <View style={{ flex: 1 }}><Body>{r.label}</Body><Body small muted>{r.hint}</Body></View>
          </Row>
        </Item>
      ))}
      <Input multiline style={{ marginTop: 10, minHeight: 60 }} placeholder={reason === 'altro' ? 'Spiega il motivo (obbligatorio)' : 'Aggiungi una nota (facoltativa)'} value={note} onChangeText={setNote} />
      <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginBottom: 10 }}><Body small>{REPORT_NOTICE}</Body></View>
      <Btn danger title="Segnala" onPress={() => {
        if (!reason) { toast('Scegli un motivo'); return; }
        if (reason === 'altro' && !note.trim()) { toast('Spiega il motivo nella nota'); return; }
        useMod.getState().report({ kind: target.kind as ModKind, ref: target.ref, label: target.label, author: target.author, reason, note });
        close();
        toast('Segnalazione registrata sul dispositivo');
      }} />
    </>
  );
}
