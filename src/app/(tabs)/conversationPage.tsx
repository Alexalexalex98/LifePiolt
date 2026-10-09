import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble } from '@/components/chat/Bubble';
import { Composer } from '@/components/chat/Composer';
import type { SharePayload } from '@/components/chat/ShareSheets';
import { MediaViewer, fontPx, useChatColors, wallColor } from '@/components/chat/parts';
import { DeleteSheet, InfoSheet, MessageActions, PickChatsSheet, copyText, type Action } from '@/components/chat/sheets';
import { UserAvatar } from '@/components/network';
import { Body, Item, Sheet, IL } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Picked } from '@/lib/chatMedia';
import { searchText } from '@/lib/chatList';
import { simulateDelivery, simulateRsvp } from '@/lib/chatSim';
import { go, goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { dayLabel, dmId, isMuted, previewOf, useChat, visibleMsgs, type ChatMessage, type Poll } from '@/store/chat';
import { askTheiaAbout } from '@/store/theia';
import { dayKey } from '@/lib/format';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

type Row = { type: 'day'; key: string; label: string } | { type: 'unread'; key: string; n: number } | { type: 'msg'; key: string; m: ChatMessage; showSender: boolean };

export default function Conversation() {
  const t = useTheme();
  const c = useChatColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; type?: string; key?: string; jump?: string }>();
  const id = params.id ?? (params.type === 'group' ? `g:${params.key}` : dmId(params.key ?? ''));
  const me = useApp((s) => s.account.name);
  const demo = useApp((s) => s.demo);
  const chat = useChat((s) => s.chats[id]);
  const allMsgs = useChat((s) => s.messages[id]);
  const settings = useChat((s) => s.settings);
  const blocked = useChat((s) => s.blocked);
  const st = useChat.getState;
  const msgs = useMemo(() => visibleMsgs(allMsgs, me), [allMsgs, me]);
  const list = useRef<FlatList<Row>>(null);

  const [replyTo, setReplyTo] = useState<ChatMessage | undefined>();
  const [editing, setEditing] = useState<ChatMessage | undefined>();
  const [draft, setDraftState] = useState('');
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<ChatMessage[] | null>(null);
  const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage[] | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  // crea la chat se arrivo da un profilo
  useEffect(() => { if (!chat && id.startsWith('dm:')) st().ensureDm(id.slice(3), me); }, [chat, id, me, st]);

  // bozza
  useEffect(() => { setDraftState(chat?.draft ?? ''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  const setDraft = (v: string) => { setDraftState(v); st().patchChat(id, { draft: v }); };

  // segna come letta quando la schermata è aperta
  useEffect(() => { st().markRead(id, me); }, [id, me, allMsgs?.length, st]);
  useEffect(() => { st().purgeExpired(); const i = setInterval(() => st().purgeExpired(), 15000); return () => clearInterval(i); }, [st]);

  // il divisore "non letti" si calcola una sola volta all'apertura della chat
  const firstUnread = useMemo(() => {
    const lr = useChat.getState().chats[id]?.lastRead ?? 0;
    const list = visibleMsgs(useChat.getState().messages[id], me).filter((m) => m.from !== me && m.kind !== 'system' && m.ts > lr);
    return { id: list[0]?.id ?? null, n: list.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rows = useMemo<Row[]>(() => {
    const q = search?.trim().toLowerCase();
    const src = q ? msgs.filter((m) => searchText(m).includes(q)) : msgs;
    const out: Row[] = [];
    let lastDay = ''; let lastFrom = ''; let unreadShown = false;
    src.forEach((m) => {
      const d = dayLabel(m.ts);
      if (d !== lastDay) { out.push({ type: 'day', key: 'd' + m.id, label: d }); lastDay = d; lastFrom = ''; }
      if (!q && !unreadShown && m.id === firstUnread.id) { out.push({ type: 'unread', key: 'u', n: firstUnread.n }); unreadShown = true; }
      out.push({ type: 'msg', key: m.id, m, showSender: m.from !== lastFrom });
      lastFrom = m.from;
    });
    return out;
  }, [msgs, search, firstUnread, me]);

  const byId = useMemo(() => Object.fromEntries(msgs.map((m) => [m.id, m])), [msgs]);
  const mediaItems = useMemo(() => msgs.filter((m) => (m.kind === 'image' || m.kind === 'video') && !m.deletedForAll), [msgs]);

  // resta in fondo all'apertura e a ogni nuovo messaggio, anche quando le schede (agenda, inviti...) si disegnano dopo
  const stick = useRef(true);
  useEffect(() => { if (search || params.jump) return; stick.current = true; const tm = setTimeout(() => { stick.current = false; }, 1500); return () => clearTimeout(tm); }, [id, msgs.length, search, params.jump]);
  useEffect(() => { if (params.jump) setTimeout(() => jumpTo(params.jump!), 300); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.jump]);

  const jumpTo = useCallback((mid: string) => {
    const i = rows.findIndex((r) => r.type === 'msg' && r.m.id === mid);
    if (i < 0) { toast('Messaggio non trovato'); return; }
    list.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.4 });
    setHighlight(mid); setTimeout(() => setHighlight(null), 1500);
  }, [rows]);

  const peer = chat?.type === 'dm' ? chat.name : '';
  const isBlocked = !!peer && blocked.includes(peer);
  const left = chat?.type === 'group' && !chat.members.includes(me);
  const title = chat?.name ?? '';
  const font = fontPx(settings.fontSize);

  /* ---- invio ---- */
  function afterSend(mid: string) {
    if (demo && chat?.type === 'dm') simulateDelivery(id, mid, chat.name, true);
    else if (demo && chat?.type === 'group') simulateDelivery(id, mid, chat.members.find((x) => x !== me) ?? '', false);
  }
  function sendText(text: string) {
    if (editing) { st().editMsg(id, editing.id, text); setEditing(undefined); setDraft(''); return; }
    const mid = st().send(id, me, { kind: 'text', text, replyTo: replyTo?.id });
    setReplyTo(undefined); setDraftState('');
    afterSend(mid);
  }
  function sendPicked(p: Picked, caption?: string) {
    const mid = st().send(id, me, { kind: p.kind, media: p.media, location: p.location, contact: p.contact, text: caption, replyTo: replyTo?.id });
    setReplyTo(undefined); afterSend(mid);
  }
  function sendVoice(uri: string, durationMs: number, waveform: number[]) {
    const mid = st().send(id, me, { kind: 'audio', media: { uri, durationMs, waveform, mime: 'audio/m4a' }, replyTo: replyTo?.id });
    setReplyTo(undefined); afterSend(mid);
  }
  function sendPoll(poll: Poll) { afterSend(st().send(id, me, { kind: 'poll', poll })); }
  function sendShare(m: SharePayload) {
    const mid = st().send(id, me, { ...m, replyTo: replyTo?.id });
    afterSend(mid); setReplyTo(undefined);
    if (demo && m.kind === 'event' && chat) simulateRsvp(id, mid, chat.members.filter((x) => x !== me));
  }

  /* ---- azioni ---- */
  function onAction(a: Action, emoji?: string) {
    const m = actionMsg; setActionMsg(null);
    if (!m) return;
    if (a === 'react') st().react(id, m.id, me, emoji ?? null);
    if (a === 'reply') { setReplyTo(m); setEditing(undefined); }
    if (a === 'copy') copyText(m);
    if (a === 'forward') setForwarding([m]);
    if (a === 'star') toast(st().toggleStar(id, [m.id], me) ? 'Segnato come importante' : 'Tolto dagli importanti');
    if (a === 'edit') { setEditing(m); setReplyTo(undefined); setDraftState(m.text ?? ''); }
    if (a === 'info') setInfoMsg(m);
    if (a === 'delete') setDeleting([m]);
    if (a === 'select') setSelected([m.id]);
    if (a === 'theia') askAbout([m]);
    if (a === 'task' && m.text) { useLife.getState().addTask({ t: m.text.length > 90 ? m.text.slice(0, 88) + '…' : m.text, done: false }); toast('Aggiunto ai tuoi task'); }
    if (a === 'note' && m.text) { useLife.getState().saveNote(null, `Dalla chat con ${title}:\n${m.text}`); toast('Salvato nelle note'); }
    if (a === 'event' && m.text) {
      const d = new Date(); const h = Math.min(23, d.getHours() + 1);
      useLife.getState().addEvent(dayKey(d), { time: `${String(h).padStart(2, '0')}:00`, title: m.text.length > 60 ? m.text.slice(0, 58) + '…' : m.text });
      toast(`Aggiunto al piano di oggi alle ${String(h).padStart(2, '0')}:00`);
    }
  }
  function askAbout(list: ChatMessage[]) {
    const text = list.map((m) => (m.text ? (list.length > 1 ? `${m.from}: ${m.text}` : m.text) : previewOf(m))).join('\n');
    const img = list.find((m) => m.kind === 'image')?.media?.uri;
    askTheiaAbout({ text: text || undefined, imageUri: img, source: 'chat', label: list.length > 1 ? `${list.length} messaggi` : `Messaggio di ${list[0].from === me ? 'te' : list[0].from}`, replyToChat: id });
    setSelected([]);
  }
  const selMsgs = selected.map((x) => byId[x]).filter(Boolean);
  const exitSel = () => setSelected([]);

  function openMsg(m: ChatMessage) {
    if (selected.length) setSelected(selected.includes(m.id) ? selected.filter((x) => x !== m.id) : [...selected, m.id]);
  }
  function longPress(m: ChatMessage) {
    if (selected.length) { openMsg(m); return; }
    setActionMsg(m);
  }

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'day') return <View style={{ alignSelf: 'center', backgroundColor: c.quoteBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 8 }}><Text style={{ color: c.meta, fontSize: 12 }}>{item.label}</Text></View>;
    if (item.type === 'unread') return <View style={{ alignSelf: 'center', backgroundColor: c.quoteBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 8 }}><Text style={{ color: c.read, fontSize: 12, fontWeight: '700' }}>{item.n} {item.n === 1 ? 'messaggio non letto' : 'messaggi non letti'}</Text></View>;
    const m = item.m;
    return (
      <Bubble
        m={m} me={me} quoted={m.replyTo ? byId[m.replyTo] : undefined} isGroup={chat?.type === 'group'} showSender={item.showSender}
        selected={selected.includes(m.id)} highlight={highlight === m.id} fontSize={font} starred={!!m.starredBy?.includes(me)}
        onPress={() => openMsg(m)} onLongPress={() => longPress(m)}
        onSwipeReply={() => { if (!m.deletedForAll && m.kind !== 'system') { setReplyTo(m); setEditing(undefined); } }}
        onJump={jumpTo}
        onOpenMedia={() => { if (selected.length) openMsg(m); else setViewer(mediaItems.findIndex((x) => x.id === m.id)); }}
        onVote={(o) => st().votePoll(id, m.id, o, me)}
        onReact={(mm) => setActionMsg(mm)}
      />
    );
  };

  if (!chat) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* intestazione */}
      <View style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 10, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {selected.length ? (
          <>
            <Pressable onPress={exitSel} hitSlop={10}><Icon name="x" size={22} color={t.text} /></Pressable>
            <Text style={{ flex: 1, color: t.text, fontSize: 18, fontWeight: '700' }}>{selected.length}</Text>
            {selected.length === 1 && <Pressable onPress={() => { setReplyTo(selMsgs[0]); exitSel(); }} hitSlop={8} accessibilityLabel="Rispondi"><Icon name="reply" size={21} color={t.text} /></Pressable>}
            <Pressable onPress={() => { toast(st().toggleStar(id, selected, me) ? 'Segnati come importanti' : 'Tolti dagli importanti'); exitSel(); }} hitSlop={8} accessibilityLabel="Importante"><Icon name="star" size={21} color={t.text} /></Pressable>
            <Pressable onPress={() => { const txt = selMsgs.map((m) => m.text).filter(Boolean).join('\n'); if (txt) copyText({ ...selMsgs[0], text: txt }); exitSel(); }} hitSlop={8} accessibilityLabel="Copia"><Icon name="copy" size={21} color={t.text} /></Pressable>
            <Pressable onPress={() => askAbout(selMsgs)} hitSlop={8} accessibilityLabel="Chiedi a Theia"><Icon name="sparkle" size={21} color={t.text} /></Pressable>
            <Pressable onPress={() => setForwarding(selMsgs)} hitSlop={8} accessibilityLabel="Inoltra"><Icon name="forward" size={21} color={t.text} /></Pressable>
            <Pressable onPress={() => setDeleting(selMsgs)} hitSlop={8} accessibilityLabel="Elimina"><Icon name="trash" size={21} color={t.danger} /></Pressable>
          </>
        ) : search != null ? (
          <>
            <Pressable onPress={() => setSearch(null)} hitSlop={10}><Icon name="arrow-left" size={22} color={t.text} /></Pressable>
            <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Cerca nella chat…" placeholderTextColor={t.muted} style={{ flex: 1, color: t.text, fontSize: 16, paddingVertical: 6 }} />
            <Text style={{ color: t.muted, fontSize: 12 }}>{rows.filter((r) => r.type === 'msg').length}</Text>
          </>
        ) : (
          <>
            <Pressable onPress={goBack} hitSlop={10} accessibilityLabel="Indietro"><Icon name="arrow-left" size={24} color={t.text} /></Pressable>
            <Pressable onPress={() => go('chatInfo', { id })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {chat.type === 'group' ? <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={19} color={t.text} /></View> : <UserAvatar name={title} size={38} />}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
                <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{chat.type === 'group' ? chat.members.join(', ') : 'tocca per le info'}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="Menu"><Icon name="more" size={22} color={t.text} /></Pressable>
          </>
        )}
      </View>

      {chat.disappearingSec ? <View style={{ backgroundColor: c.quoteBg, paddingVertical: 4 }}><Text style={{ color: c.meta, fontSize: 12, textAlign: 'center' }}>I messaggi scompaiono dopo {chat.disappearingSec >= 86400 * 30 ? '90 giorni' : chat.disappearingSec >= 86400 * 7 ? '7 giorni' : '24 ore'}</Text></View> : null}

      <FlatList
        ref={list}
        style={{ flex: 1, backgroundColor: wallColor(chat.wallpaper ?? settings.wallpaper, c) }}
        contentContainerStyle={{ paddingVertical: 8 }}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        extraData={[selected, highlight, settings.fontSize]}
        onContentSizeChange={() => { if (stick.current && !search) list.current?.scrollToEnd({ animated: false }); }}
        onScrollToIndexFailed={(e) => setTimeout(() => list.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true }), 50)}
        ListEmptyComponent={<Body muted small style={{ textAlign: 'center', marginTop: 40 }}>{search ? 'Nessun risultato.' : 'Nessun messaggio ancora: scrivi per primo.'}</Body>}
        keyboardShouldPersistTaps="handled"
        // su Android removeClippedSubviews (attivo di default) taglia e sovrappone le schede alte e di altezza variabile
        removeClippedSubviews={false}
        initialNumToRender={40}
        maxToRenderPerBatch={20}
        windowSize={21}
        onLayout={() => { if (stick.current && !search) list.current?.scrollToEnd({ animated: false }); }}
      />

      <View style={{ paddingBottom: insets.bottom }}>
        <Composer
          me={me} draft={draft} enterSends={settings.enterSends} fontSize={font}
          replyTo={replyTo} editing={editing}
          disabledReason={isBlocked ? `Hai bloccato ${peer}. Sbloccalo dalle info per scrivere.` : left ? 'Non sei più un membro di questo gruppo.' : undefined}
          onDraft={setDraft} onSendText={sendText} onSendPicked={sendPicked} onSendVoice={sendVoice} onSendPoll={sendPoll} onSendShare={sendShare}
          onCancelContext={() => { setReplyTo(undefined); if (editing) { setEditing(undefined); setDraft(''); } }}
        />
      </View>

      <MessageActions m={actionMsg} me={me} onClose={() => setActionMsg(null)} onAction={onAction} />
      <DeleteSheet msgs={deleting} me={me} onClose={() => setDeleting(null)} onDone={(mode) => {
        deleting?.forEach((m) => (mode === 'all' ? st().deleteForAll(id, m.id) : null));
        if (mode === 'me') st().deleteForMe(id, deleting?.map((m) => m.id) ?? [], me);
        setDeleting(null); exitSel();
      }} />
      <InfoSheet m={infoMsg} onClose={() => setInfoMsg(null)} />
      <PickChatsSheet visible={!!forwarding} title="Inoltra a…" me={me} onClose={() => setForwarding(null)} onPick={(ids) => { st().forward(ids, forwarding ?? [], me); setForwarding(null); exitSel(); toast(`Inoltrato a ${ids.length} ${ids.length === 1 ? 'chat' : 'chat'}`); }} />
      <MediaViewer items={mediaItems} index={viewer} onClose={() => setViewer(null)} onDelete={(m) => { setViewer(null); setTimeout(() => setDeleting([m]), 350); }} />

      <Sheet visible={menu} title={title} onClose={() => setMenu(false)}>
        <Item onPress={() => { setMenu(false); go('chatInfo', { id }); }}><IL icon="info">Info {chat.type === 'group' ? 'gruppo' : 'contatto'}</IL></Item>
        <Item onPress={() => { setMenu(false); setSearch(''); }}><IL icon="search">Cerca</IL></Item>
        <Item onPress={() => { setMenu(false); setSelected([msgs[msgs.length - 1]?.id].filter(Boolean) as string[]); }}><IL icon="checksquare">Seleziona messaggi</IL></Item>
        <Item onPress={() => { setMenu(false); go('starredPage', { id }); }}><IL icon="star">Messaggi importanti</IL></Item>
        <Item onPress={() => { setMenu(false); st().patchChat(id, { mutedUntil: isMuted(chat) ? undefined : Date.now() + 8 * 3600000 }); toast(isMuted(chat) ? 'Notifiche riattivate' : 'Chat silenziata per 8 ore'); }}><IL icon={isMuted(chat) ? 'bell' : 'bell-off'}>{isMuted(chat) ? 'Riattiva notifiche' : 'Silenzia (8 ore)'}</IL></Item>
        <Item onPress={() => { setMenu(false); st().patchChat(id, { archived: !chat.archived }); toast(chat.archived ? 'Chat ripristinata' : 'Chat archiviata'); if (!chat.archived) goBack(); }}><IL icon="archive">{chat.archived ? 'Ripristina dagli archivi' : 'Archivia chat'}</IL></Item>
        <Item last onPress={() => { setMenu(false); go('chatSettings'); }}><IL icon="gear">Impostazioni chat</IL></Item>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
