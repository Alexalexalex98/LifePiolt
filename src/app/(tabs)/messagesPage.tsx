import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { PickPeopleSheet } from '@/components/chat/NewChat';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Empty, Input, Item, Page, Pill, Row, Sheet, IL } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { buildRows, previewParts, searchText, sortRows, visibleTo } from '@/lib/chatList';
import { isMuted, listTime, useChat, type Chat } from '@/store/chat';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';
import { translateText } from '@/i18n/core';

const FILTERS = ['Tutte', 'Non lette', 'Gruppi'] as const;

export default function MessagesPage() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const messages = useChat((s) => s.messages);
  const st = useChat.getState;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Tutte');
  const [archived, setArchived] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const base = buildRows(Object.values(chats), messages, me).map((r) => ({
      ...r,
      hit: ql ? visibleTo(messages[r.c.id], me).filter((m) => searchText(m).includes(ql)).sort((x, y) => y.ts - x.ts)[0] : undefined,
    }));
    return sortRows(base
      // cercando si guarda in tutte le chat, archiviate comprese
      .filter((r) => (ql ? true : archived ? r.c.archived : !r.c.archived))
      .filter((r) => (ql ? r.c.name.toLowerCase().includes(ql) || !!r.hit : true))
      .filter((r) => (filter === 'Non lette' && !archived ? r.unread : filter === 'Gruppi' && !archived ? r.c.type === 'group' : true)));
  }, [chats, messages, q, filter, archived, me]);

  const archivedCount = Object.values(chats).filter((c) => c.archived).length;
  const selChats = sel.map((x) => chats[x]).filter(Boolean) as Chat[];
  const allPinned = selChats.length > 0 && selChats.every((c) => c.pinned);
  const allMuted = selChats.length > 0 && selChats.every(isMuted);
  const allArchived = selChats.length > 0 && selChats.every((c) => c.archived);
  const apply = (p: (c: Chat) => Partial<Chat>) => { selChats.forEach((c) => st().patchChat(c.id, p(c))); setSel([]); };

  const open = (c: Chat) => { if (sel.length) setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id]); else go('conversationPage', { id: c.id }); };

  return (
    <Page id="messagesPage" title={sel.length ? `${sel.length} selezionate` : archived ? 'Archiviate' : 'Messaggi'}
      right={<Row gap={8}>
        {archived && <Pressable onPress={() => setArchived(false)}><Text style={{ color: t.accent }}>Chiudi</Text></Pressable>}
        <Pressable onPress={() => go('chatSettings')} hitSlop={8} accessibilityLabel={translateText("Impostazioni chat")}><Icon name="gear" size={21} color={t.text} /></Pressable>
      </Row>}>
      {sel.length > 0 ? (
        <Row style={{ flexWrap: 'wrap', marginBottom: 8 }} gap={6}>
          <Pill icon="pin" label={allPinned ? 'Rimuovi fissa' : 'Fissa'} onPress={() => apply((c) => ({ pinned: !allPinned && !c.pinned }))} />
          <Pill icon={allMuted ? 'bell' : 'bell-off'} label={allMuted ? 'Riattiva' : 'Silenzia'} onPress={() => apply(() => ({ mutedUntil: allMuted ? undefined : Date.now() + 365 * 86400000 }))} />
          <Pill icon="archive" label={allArchived ? 'Ripristina' : 'Archivia'} onPress={() => apply(() => ({ archived: !allArchived }))} />
          <Pill label="Segna da leggere" onPress={() => apply(() => ({ markedUnread: true }))} />
          <Pill icon="trash" label="Elimina" onPress={() => setConfirmDel(true)} />
          <Pill label="Annulla" off onPress={() => setSel([])} />
        </Row>
      ) : (
        <>
          <Input placeholder="Cerca chat e messaggi" value={q} onChangeText={setQ} />
          {!archived && <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={6}>{FILTERS.map((f) => <Pill key={f} label={f} on={filter === f} onPress={() => setFilter(f)} />)}</Row>}
          {!archived && archivedCount > 0 && !q && <Item onPress={() => setArchived(true)}><Row><IL icon="archive">Archiviate</IL><Body muted>{archivedCount}</Body></Row></Item>}
        </>
      )}

      {rows.length === 0 ? <Empty text={q ? 'Nessun risultato.' : filter === 'Non lette' ? 'Nessun messaggio non letto.' : archived ? 'Nessuna chat archiviata.' : 'Nessuna chat: premi “+” per iniziare.'} /> : rows.map(({ c, last, u, hit }) => {
        const unread = u > 0 || c.markedUnread;
        const muted = isMuted(c);
        const shown = q && hit ? hit : last;
        const pp = shown ? previewParts(shown) : null;
        const showDraft = !!c.draft && !q;
        const mineLast = shown?.from === me;
        const emptyText = c.type === 'group' ? `${c.members.length} membri` : 'Nessun messaggio';
        return (
          <Pressable key={c.id} onPress={() => open(c)} onLongPress={() => setSel(sel.includes(c.id) ? sel : [...sel, c.id])} delayLongPress={300}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: sel.includes(c.id) ? t.chip : 'transparent' }}
            accessibilityLabel={translateText(`${c.name}${unread ? ', non letto' : ''}`)}>
            {c.type === 'group' ? <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={24} color={t.text} /></View> : <UserAvatar name={c.name} size={48} />}
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: unread ? '800' : '600', flex: 1 }}>{c.name}</Text>
                <Text style={{ color: unread && !muted ? t.accent : t.muted, fontSize: 12 }}>{shown ? listTime(shown.ts) : ''}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }} gap={6}>
                <Row gap={4} style={{ flex: 1, justifyContent: 'flex-start' }}>
                  {showDraft ? <Text style={{ color: '#e5484d', fontSize: 14 }}>Bozza:</Text> : null}
                  {!showDraft && mineLast && shown && !shown.deletedForAll && shown.kind !== 'system' ? <Text style={{ color: shown.status === 'read' ? t.accent : t.muted, fontSize: 14 }}>{shown.status === 'read' ? 'Letto ·' : shown.status === 'delivered' ? 'Consegnato ·' : 'Inviato ·'}</Text> : null}
                  {!showDraft && !mineLast && c.type === 'group' && shown && shown.kind !== 'system' ? <Text style={{ color: t.muted, fontSize: 14 }}>{shown.from}:</Text> : null}
                  {!showDraft && pp?.icon ? <Icon name={pp.icon} size={14} color={t.muted} /> : null}
                  <Text numberOfLines={1} style={{ color: t.muted, fontSize: 14, flex: 1, fontWeight: unread ? '700' : '400' }}>{showDraft ? c.draft : pp ? pp.text : emptyText}</Text>
                </Row>
                {muted && <Icon name="bell-off" size={13} color={t.muted} />}
                {c.pinned && <Icon name="pin" size={13} color={t.muted} />}
                {unread && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: muted ? t.muted : t.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.onText, fontSize: 11, fontWeight: '800' }}>{u > 0 ? u : ''}</Text></View>}
              </Row>
            </View>
          </Pressable>
        );
      })}

      {!sel.length && <Btn title="+ Nuova chat" style={{ marginTop: 14 }} onPress={() => setNewOpen(true)} />}

      <PickPeopleSheet visible={newOpen} onClose={() => setNewOpen(false)} />

      <Sheet visible={confirmDel} title={`Eliminare ${sel.length} ${sel.length === 1 ? 'chat' : 'chat'}?`} onClose={() => setConfirmDel(false)}>
        <Body small muted style={{ marginBottom: 10 }}>I messaggi verranno rimossi da questo dispositivo.</Body>
        <Btn danger title="Elimina" onPress={() => { sel.forEach((id) => st().deleteChat(id)); setSel([]); setConfirmDel(false); toast('Chat eliminate'); }} />
        <Btn ghost title="Annulla" style={{ marginTop: 8 }} onPress={() => setConfirmDel(false)} />
      </Sheet>
    </Page>
  );
}
