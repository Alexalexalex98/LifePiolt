import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { SPONSORED_TEXT } from '@/components/market';
import { IdeaCard, LpTag, type ModTarget, MediaViewer, UserAvatar, doContribute, openPurchaseConfirm, openSheet, useNetSheet } from '@/components/network';
import { Body, Btn, Empty, IL, Input, Item, Link, Pill, Progress, Row, Select, Sheet, Toggle, Metric, Chev } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF, weekdayShortDate } from '@/lib/format';
import { goBack, go } from '@/lib/nav';
import { paidCancel, freeCancel } from '@/data/marketSeed';
import { confirmAttendance, hasEnded } from '@/lib/enroll';
import { ConflictSheet } from '@/lib/planBooking';
import { fmtRange, nextDays, timeOptions, tsOf } from '@/lib/when';
import { VOTE_BLOCK_MSG, canVote, castVote, convertAmount, cryptoRates, isVoteReasonRelevant, rateIdeaDetailed, ratingFor, textSimilarity, voteBlockReason } from '@/lib/network';
import { useApp } from '@/store/app';
import { newId, topicList, useNet } from '@/store/network';
import { showUndoToast, toast } from '@/store/toast';
import { Icon } from '@/lib/icons';
import { REPORT_NOTICE } from '@/components/ReportsSheet';
import { MediaPickerField } from '@/components/MediaPickerField';
import type { NetMedia } from '@/lib/netMedia';
import { REASONS, modKey, type ModKind, type ReasonId } from '@/lib/modRules';
import { useVisible } from '@/lib/moderation';
import { useChat } from '@/store/chat';
import { useMod } from '@/store/moderation';
import { formatMoney } from '@/i18n/format';

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
      body = (
        <>
          <Item onPress={() => { Share.share({ message: `Post di ${author} su LifePilot` }); }}><Body>Condividi</Body></Item>
          <Item onPress={() => { const f = net.toggleFollow(author); close(); toast(f ? 'Ora segui ' + author : 'Non segui più ' + author); }}><Body>{fol ? 'Smetti di seguire' : 'Segui'}</Body></Item>
          <Item onPress={() => { const m = net.toggleMuteAuthor(author); close(); toast(m ? `Post di ${author} silenziati` : `Post di ${author} riattivati`); }}><Body>{mutedP ? 'Riattiva ' + author : 'Silenzia ' + author}</Body></Item>
          {tag ? <Item onPress={() => { const m = net.toggleMuteTopic(tag); close(); toast(m ? `Post su ${tag} silenziati` : `Post su ${tag} riattivati`); }}><Body>{mutedT ? 'Riattiva argomento ' + tag : 'Silenzia argomento ' + tag}</Body></Item> : null}
          {p.ref ? <ModItems target={{ kind: 'post', ref: p.ref, label: p.label || 'Post di ' + author, author }} /> : null}
        </>
      );
      break;
    }
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
            <Btn style={{ flex: 1 }} title="Dona" onPress={() => { const ok = net.donateDaily(p.author); close(); toast(ok ? 'Hai donato il tuo LifePoint di oggi a ' + p.author : 'Hai già donato il tuo LifePoint di oggi a ' + net.dailyPoint.to); }} />
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
    case 'newIdea': { title = 'La tua idea'; body = <NewIdeaView />; break; }
    case 'newCommunity': { title = 'Crea community'; body = <NewCommunityView />; break; }
    case 'postToCommunity': {
      const c = net.communities.find((x) => x.id === p.id);
      if (!c) break;
      title = 'Pubblica in ' + c.name;
      body = <PostToCommunityView id={c.id} />;
      break;
    }
    case 'newSeminar': { title = 'Nuovo seminario'; body = <NewSeminarView />; break; }
    case 'promoteSeminar': { title = 'Promuovi seminario'; body = <PromoteView id={p.id} />; break; }
    case 'vote': {
      title = 'Vota ' + p.name;
      const why = voteBlockReason(me, p.name);
      body = why ? (
        <>
          <IL icon="info" bold>Voto non disponibile</IL>
          <Body small style={{ marginTop: 10 }}>{why}</Body>
          <Body small muted style={{ marginTop: 8 }}>Così le valutazioni vengono solo da chi ha provato davvero il servizio o seguito il seminario.</Body>
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
      title = 'Voti di ' + p.name;
      const r = ratingFor(p.name);
      body = !r.count ? <Empty text="Nessun voto ancora." /> : (
        <>
          <Metric big>{r.avg}/5</Metric>
          <Body small muted style={{ marginBottom: 10 }}>{r.count} voti totali</Body>
          {[5, 4, 3, 2, 1].map((s) => { const n = r.counts[s] || 0; return <Item key={s}><Row><Body>{s} stelle</Body><Body small muted>{n}</Body></Row><Progress value={r.count ? Math.round((n / r.count) * 100) : 0} /></Item>; })}
        </>
      );
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
    case 'topup': { title = 'Carica LifePoints'; body = <TopUpView />; break; }
    case 'cardPicker': {
      title = 'Scegli carta';
      body = (
        <>
          {net.cards.map((c) => <Item key={c.id} onPress={() => { net.patch({ defaultCard: c.id }); openSheet('topup'); }}><Row><View><Body>{c.brand} ···· {c.last4}</Body><Body small muted>{c.holder} · scad. {c.expiry}</Body></View>{c.id === net.defaultCard ? <Icon name="check" size={17} color={t.positive} stroke={2.4} /> : null}</Row></Item>)}
          <Btn small ghost style={{ marginTop: 10 }} title="+ Aggiungi nuova carta" onPress={() => openSheet('addCard')} />
        </>
      );
      break;
    }
    case 'addCard': { title = 'Aggiungi carta'; body = <AddCardView />; break; }
    case 'cv': {
      const name = p.name;
      const mine = name === me;
      title = 'CV completo';
      body = (
        <>
          <Row style={{ justifyContent: 'flex-start', marginBottom: 14 }}><UserAvatar name={name} size={40} /><View><Body bold>{name}</Body><Body small muted>{mine ? net.myCard.profession : 'Membro della community LifeNetwork'}</Body></View></Row>
          {mine ? (
            <>
              <Body small muted>FORMAZIONE</Body><Item><Body small>{net.myCard.schools || '—'}</Body></Item>
              <Body small muted style={{ marginTop: 12 }}>ESPERIENZA</Body><Item><Body small>{net.myCard.experience || '—'}</Body></Item>
              <Body small muted style={{ marginTop: 12 }}>COMMENTI AZIENDALI</Body><Item><Body small>{net.myCard.companyComments}</Body></Item>
            </>
          ) : <Body small muted>{name} non ha reso pubblico un CV completo su LifeNetwork.</Body>}
        </>
      );
      break;
    }
    case 'newPost': { title = 'Nuovo post'; body = <NewPostView />; break; }
    default: break;
  }

  return <Sheet visible={!!body} title={title} onClose={close}>{body}</Sheet>;
}

/* ---------------- viste con stato locale ---------------- */
function CommentsView({ k }: { k: string }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const [text, setText] = useState('');
  const visible = useVisible();
  const list = (net.comments[k] || []).map((c, i) => ({ ...c, i })).filter((c) => visible('comment', `${k}#${c.i}`, c.author));
  return (
    <>
      {list.length === 0 ? <Body small muted>Ancora nessun commento: scrivi il primo.</Body> : list.map((c, i) => (
        <Item key={c.i}><Row style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={8}><UserAvatar name={c.author} size={24} /><View style={{ flex: 1 }}><Body small bold>{c.author}</Body><Body small muted>{c.text}</Body></View></Row></Item>
      ))}
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

function NewIdeaView() {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
  const [type, setType] = useState<'libero' | 'fisso'>('libero'); const [fixed, setFixed] = useState(''); const [reward, setReward] = useState('');
  const [media, setMedia] = useState<NetMedia | null>(null);
  return (
    <>
      <Body small muted>Titolare: {me} (le pagine idea sono sempre legate a un titolare, come nel registro di commercio).</Body>
      <Input style={{ marginTop: 8 }} placeholder="Titolo dell'idea" value={title} onChangeText={setTitle} />
      <Input multiline placeholder="Descrivi l'idea: problema, mercato, come funziona…" value={desc} onChangeText={setDesc} />
      <MediaPickerField value={media} onChange={setMedia} />
      <Body small muted style={{ marginVertical: 8 }}>Chi contribuisce riceve in cambio…</Body>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}><Pill label="Importo libero" on={type === 'libero'} onPress={() => setType('libero')} /><Pill label="Importo fisso" on={type === 'fisso'} onPress={() => setType('fisso')} /></View>
      {type === 'fisso' && <Input keyboardType="decimal-pad" placeholder="Importo fisso in LP" value={fixed} onChangeText={setFixed} />}
      <Input multiline style={{ minHeight: 60 }} placeholder="Cosa riceve in cambio: prodotto, sconto, equity, ringraziamento…" value={reward} onChangeText={setReward} />
      <Btn title="Pubblica e fai valutare dall'AI" onPress={() => {
        const ti = title.trim(), de = desc.trim();
        if (!ti || !de) { toast('Compila titolo e descrizione'); return; }
        const fa = type === 'fisso' ? parseFloat(fixed.replace(',', '.')) : null;
        if (type === 'fisso' && (!fa || fa <= 0)) { toast('Inserisci un importo fisso valido'); return; }
        const dup = net.ideas.find((x) => textSimilarity(x.title + ' ' + x.desc, ti + ' ' + de) > 0.35);
        net.patch({ ideas: [...net.ideas, { id: newId(), title: ti, desc: de, author: me, raised: 0, similarTo: dup ? dup.id : null, rewardType: type, fixedAmount: fa, rewardDesc: reward.trim(), target: 500, ts: Date.now(), media: media?.media ?? null, uri: media?.uri }] });
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

function PostToCommunityView({ id }: { id: number }) {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<NetMedia | null>(null);
  return (
    <>
      <Input multiline placeholder="Scrivi qualcosa…" value={text} onChangeText={setText} />
      <MediaPickerField value={media} onChange={setMedia} />
      <Btn title="Pubblica" onPress={() => {
        if (!text.trim() && !media) { toast('Scrivi qualcosa o aggiungi una foto'); return; }
        net.patch({ communities: net.communities.map((c) => (c.id === id ? { ...c, posts: [{ author: me, text: text.trim(), media: media?.media ?? null, uri: media?.uri, likes: 0, ts: Date.now() }, ...c.posts] } : c)) });
        close(); toast('Pubblicato');
      }} />
    </>
  );
}

const DURATIONS: [string, number][] = [['30 minuti', 30], ['45 minuti', 45], ['1 ora', 60], ['1 ora e 30', 90], ['2 ore', 120], ['3 ore', 180]];

function NewSeminarView() {
  const net = useNet();
  const me = useApp((a) => a.account.name);
  const close = useNetSheet((s) => s.close);
  const days = nextDays(90);
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [learn, setLearn] = useState(''); const [audience, setAudience] = useState('');
  const [dayLabel, setDayLabel] = useState(days[1].label); const [time, setTime] = useState('18:00'); const [dur, setDur] = useState('1 ora');
  const [mode, setMode] = useState<'online' | 'presenza'>('online'); const [place, setPlace] = useState(''); const [lang, setLang] = useState('Italiano');
  const [price, setPrice] = useState(''); const [seats, setSeats] = useState('');
  return (
    <>
      <Body small muted style={{ marginBottom: 8 }}>Scrivi in modo chiaro e onesto: chi si iscrive deve capire cosa imparerà, quando e dove. Gli iscritti ti pagano solo dopo il seminario, quando confermano di aver partecipato.</Body>
      <Input placeholder="Titolo del seminario" value={title} onChangeText={setTitle} />
      <Input multiline style={{ minHeight: 100 }} placeholder="Descrizione completa: di cosa parli, come si svolge, cosa non è (almeno 80 caratteri)" value={desc} onChangeText={setDesc} />
      <Input multiline style={{ minHeight: 60 }} placeholder="Cosa si impara: una voce per riga (facoltativo)" value={learn} onChangeText={setLearn} />
      <Input placeholder="A chi è rivolto (facoltativo)" value={audience} onChangeText={setAudience} />
      <Body small muted style={{ marginBottom: 4 }}>Data e ora di inizio</Body>
      <Select title="Data" value={dayLabel} options={days.map((d) => d.label)} onChange={setDayLabel} />
      <Select title="Ora di inizio" value={time} options={timeOptions(6, 22)} onChange={setTime} />
      <Body small muted style={{ marginBottom: 4 }}>Durata</Body>
      <Select title="Durata" value={dur} options={DURATIONS.map((d) => d[0])} onChange={setDur} />
      <Body small muted style={{ marginBottom: 4 }}>Modalità</Body>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}><Pill label="Online" on={mode === 'online'} onPress={() => setMode('online')} /><Pill label="In presenza" on={mode === 'presenza'} onPress={() => setMode('presenza')} /></View>
      <Input placeholder={mode === 'online' ? 'Link o istruzioni per collegarsi' : 'Luogo e indirizzo'} value={place} onChangeText={setPlace} />
      <Body small muted style={{ marginBottom: 4 }}>Lingua</Body>
      <Select title="Lingua" value={lang} options={['Italiano', 'English', 'Français', 'Deutsch']} onChange={setLang} />
      <Input keyboardType="decimal-pad" placeholder="Prezzo in LP (0 = gratuito)" value={price} onChangeText={setPrice} />
      <Input keyboardType="number-pad" placeholder="Numero di posti" value={seats} onChangeText={setSeats} />
      <Btn title="Pubblica" onPress={() => {
        const ti = title.trim(), de = desc.trim();
        if (ti.length < 8) { toast('Inserisci un titolo di almeno 8 caratteri'); return; }
        if (de.length < 80) { toast(`La descrizione è troppo breve (${de.length}/80 caratteri): spiega cosa si impara e come si svolge`); return; }
        const day = days.find((d) => d.label === dayLabel)!.key;
        const startsAt = tsOf(day, time);
        if (startsAt <= Date.now()) { toast('La data e l\'ora devono essere nel futuro'); return; }
        if (place.trim().length < 3) { toast(mode === 'online' ? 'Indica il link o come collegarsi' : 'Indica il luogo e l\'indirizzo'); return; }
        if (price.trim() === '') { toast('Inserisci il prezzo in LP (0 per un seminario gratuito)'); return; }
        const pr = parseFloat(price.replace(',', '.'));
        if (!Number.isFinite(pr) || pr < 0) { toast('Inserisci un prezzo valido'); return; }
        const se = parseInt(seats, 10);
        if (!Number.isFinite(se) || se < 1 || se > 1000) { toast('Inserisci il numero di posti (da 1 a 1000)'); return; }
        const durationMin = DURATIONS.find((d) => d[0] === dur)![1];
        const lines = learn.split('\n').map((l) => l.trim()).filter(Boolean);
        net.patch({ seminars: [{
          id: newId(), title: ti, host: me, price: pr, promoted: false, ts: Date.now(), startsAt, durationMin, mode, place: place.trim(), seats: se, joined: 0,
          desc: de, learn: lines.length ? lines : undefined, audience: audience.trim() || undefined, included: 'Partecipazione al seminario secondo la descrizione sopra.', language: lang,
          cancelPolicy: pr ? paidCancel(pr) : freeCancel,
        }, ...net.seminars] });
        close(); toast('Seminario pubblicato');
      }} />
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
  const done = () => {
    if (!confirmAttendance(id)) { close(); return; }
    toast(e.price ? `Partecipazione confermata: -${e.price} LP, accreditati a ${e.host}` : 'Partecipazione confermata');
    openSheet('vote', { name: e.host });
  };
  return (
    <>
      <Item><Row><Body muted>{e.kind === 'seminar' ? 'Seminario' : 'Servizio'}</Body><Body bold style={{ flexShrink: 1, textAlign: 'right' }}>{e.title}</Body></Row></Item>
      <Item><Row><Body muted>{e.kind === 'seminar' ? 'Relatore' : 'Professionista'}</Body><Body bold>{e.host}</Body></Row></Item>
      <Item><Row><Body muted>Quando</Body><Body bold style={{ flexShrink: 1, textAlign: 'right' }}>{fmtRange(e.startsAt, e.durationMin)}</Body></Row></Item>
      <Item last><Row><Body muted>Importo</Body><Body bold>{e.price ? `${e.price} LP` : 'Gratuito'}</Body></Row></Item>
      {step === 1 ? (
        <>
          <Body small muted style={{ marginTop: 12 }}>{e.price ? `Confermando dichiari di aver partecipato al ${noun}. Solo a questo punto ${e.price} LP vengono addebitati sul tuo saldo e accreditati a ${e.host}.` : `Confermando dichiari di aver partecipato al ${noun}. Non verrà addebitato nulla.`}</Body>
          <Row style={{ marginTop: 14 }}>
            <Btn ghost style={{ flex: 1 }} title="Non ora" onPress={close} />
            <Btn style={{ flex: 1 }} title={e.price ? 'Continua' : 'Conferma'} onPress={() => (e.price ? setStep(2) : done())} />
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
      <Body small color={t.positive} style={{ marginBottom: 6 }}>Grazie per aver partecipato: com'è andata?</Body>
      <Body small muted>Il voto resta aggregato (si vede la media e la distribuzione, non chi ha votato). Il motivo che scrivi qui viene controllato prima di pubblicare il voto: deve essere pertinente, non un riempitivo.</Body>
      <Row style={{ justifyContent: 'center', marginVertical: 16 }} gap={12}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)}><Icon name="star" size={32} color={t.text} fill={n <= stars ? t.text : 'none'} /></Pressable>)}</Row>
      <Input multiline style={{ minHeight: 70 }} placeholder="Perché dai questo voto? (obbligatorio)" value={reason} onChangeText={setReason} />
      <Btn title="Invia voto" onPress={() => {
        if (!stars) { toast('Seleziona da 1 a 5 stelle'); return; }
        if (!isVoteReasonRelevant(reason)) { toast('Il motivo non sembra abbastanza pertinente: spiega meglio perché dai questo voto'); return; }
        if (!castVote(me, name, stars)) { close(); toast(VOTE_BLOCK_MSG); return; }
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
        net.patch({ communities: [{ id: cid, name: me + ' Club', topic: 'Business', owner: me, openPosting: false, members: [me], posts: [], desc: desc.trim() || undefined, ts: Date.now() }, ...net.communities], clubs: { ...net.clubs, [me]: { fee: f, desc: desc.trim(), communityId: cid, members: [me] } } });
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
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [country, setCountry] = useState(''); const [year, setYear] = useState('');
  return (
    <>
      <Body small muted>Per accedere a LifeNetwork serve confermare l'età minima (di norma 16 anni, o l'età prevista dal tuo paese). Qui dichiari i tuoi dati: la verifica con un documento vero richiederà un provider di identity verification.</Body>
      <Input style={{ marginTop: 10 }} placeholder="Paese del documento (es. Svizzera)" value={country} onChangeText={setCountry} />
      <Input keyboardType="number-pad" placeholder="Anno di nascita" value={year} onChangeText={setYear} />
      <Btn title="Verifica" onPress={() => {
        const c = country.trim() || 'Svizzera', y = parseInt(year);
        if (!y) { toast('Inserisci un anno di nascita valido'); return; }
        const age = new Date().getFullYear() - y;
        const minAge = /stati uniti|usa/i.test(c) ? 18 : 16;
        if (age < minAge) { close(); toast(`Età minima non raggiunta per ${c} (richiesti ${minAge} anni)`); return; }
        net.patch({ identity: { verified: true, country: c, birthYear: y } });
        close(); toast('Identità verificata, benvenuto su LifeNetwork');
      }} />
    </>
  );
}

function TopUpView() {
  const net = useNet();
  const close = useNetSheet((s) => s.close);
  const [amt, setAmt] = useState('');
  const card = net.cards.find((c) => c.id === net.defaultCard) ?? net.cards[0];
  const a = parseFloat(amt.replace(',', '.')) || 0;
  const cur = net.payCurrency;
  const isCrypto = !!cryptoRates[cur];
  const note = !a ? '' : cur === 'CHF' ? `Addebito: ${formatMoney(a)}` : `Addebito indicativo: ${convertAmount(a, cur).toFixed(isCrypto ? 6 : 2)} ${cur}${isCrypto ? ' · tasso illustrativo, non di mercato' : ' · include un margine di cambio del 2%'}`;
  return (
    <>
      <Body small muted>Ricarica di prova: nessun pagamento reale è collegato. In versione pubblicata l'acquisto di LifePoints dovrà passare dai pagamenti in-app dello store.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }}>{[50, 100, 250].map((v) => <Pill key={v} label={`${v} LP`} onPress={() => setAmt(String(v))} />)}</View>
      <Input keyboardType="decimal-pad" placeholder="Quanti LifePoints vuoi caricare?" value={amt} onChangeText={setAmt} />
      <Body small muted style={{ marginBottom: 6 }}>Valuta di pagamento · 1 CHF = 1 LifePoint</Body>
      <Select title="Valuta" value={cur} options={['CHF', 'EUR', 'USD', 'GBP', 'BTC', 'ETH']} onChange={(v) => net.patch({ payCurrency: v })} />
      {note ? <Body small muted style={{ marginBottom: 12 }}>{note}</Body> : null}
      <Body small muted style={{ marginBottom: 6 }}>Carta di pagamento</Body>
      {card ? <Item onPress={() => openSheet('cardPicker')}><Row><View><Body>{card.brand} ···· {card.last4}</Body><Body small muted>{card.holder} · scad. {card.expiry}</Body></View><Body muted>Cambia</Body></Row></Item> : <Btn small ghost title="+ Aggiungi carta" onPress={() => openSheet('addCard')} />}
      <Btn style={{ marginTop: 12 }} disabled={!card} title="Carica" onPress={() => {
        if (!a || a <= 0) { toast('Inserisci un importo valido'); return; }
        if (!card) { toast('Aggiungi prima una carta'); return; }
        const rows: [string, string][] = [['Importo', formatCHF(a) + ' LP']];
        if (cur !== 'CHF') rows.push(['Addebito', convertAmount(a, cur).toFixed(isCrypto ? 6 : 2) + ' ' + cur]);
        rows.push(['Carta', card.brand + ' ···· ' + card.last4]);
        close();
        openPurchaseConfirm('Carica LifePoints', rows, () => { useNet.getState().earn(a, 'Ricarica LifePoints'); toast(`Hai caricato ${formatCHF(a)} LP`); }, 'lifepointsPage');
      }} />
    </>
  );
}

function AddCardView() {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const [brand, setBrand] = useState('Visa'); const [last4, setLast4] = useState(''); const [holder, setHolder] = useState(me); const [exp, setExp] = useState('');
  return (
    <>
      <Body small muted>Bastano le ultime 4 cifre: non gestiamo mai il numero completo della carta.</Body>
      <Select title="Circuito" value={brand} options={['Visa', 'Mastercard', 'American Express']} onChange={setBrand} />
      <Input keyboardType="number-pad" maxLength={4} placeholder="Ultime 4 cifre" value={last4} onChangeText={setLast4} />
      <Input placeholder="Intestatario" value={holder} onChangeText={setHolder} />
      <Input placeholder="Scadenza MM/AA" value={exp} onChangeText={setExp} />
      <Btn title="Salva carta" onPress={() => {
        if (!/^\d{4}$/.test(last4)) { toast('Inserisci le ultime 4 cifre'); return; }
        if (!holder.trim() || !exp.trim()) { toast('Completa tutti i campi'); return; }
        const id = newId();
        net.patch({ cards: [...net.cards, { id, brand, last4, holder: holder.trim(), expiry: exp.trim() }], defaultCard: id });
        toast('Carta salvata'); openSheet('topup');
      }} />
    </>
  );
}

function NewPostView() {
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const close = useNetSheet((s) => s.close);
  const [text, setText] = useState(''); const [tag, setTag] = useState('Business'); const [media, setMedia] = useState<NetMedia | null>(null);
  return (
    <>
      <Input multiline placeholder="Cosa vuoi condividere?" value={text} onChangeText={setText} />
      <Select title="Argomento" value={tag} options={topicList} onChange={setTag} />
      <MediaPickerField value={media} onChange={setMedia} />
      <Btn title="Pubblica" onPress={() => {
        if (!text.trim() && !media) { toast('Scrivi qualcosa o aggiungi una foto'); return; }
        net.patch({ posts: [{ id: newId(), author: me, text: text.trim(), media: media?.media ?? null, uri: media?.uri, tag, likes: 0, ts: Date.now() }, ...net.posts] });
        close(); toast('Post pubblicato');
      }} />
    </>
  );
}

void IdeaCard; void weekdayShortDate; void canVote;


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
