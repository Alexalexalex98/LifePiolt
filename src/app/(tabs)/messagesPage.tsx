import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PickPeopleSheet } from '@/components/chat/NewChat';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Empty, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { isMuted, listTime, previewOf, unreadCount, useChat, visibleMsgs, type Chat } from '@/store/chat';
import { toast } from '@/store/toast';

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
    return Object.values(chats).map((c) => {
      const msgs = visibleMsgs(messages[c.id], me);
      const last = msgs[msgs.length - 1];
      const u = unreadCount(c, messages[c.id], me);
      const hit = ql ? msgs.find((m) => !m.deletedForAll && previewOf(m).toLowerCase().includes(ql)) : undefined;
      return { c, last, u, hit, ts: last?.ts ?? c.createdAt };
    })
      .filter((r) => (archived ? r.c.archived : !r.c.archived))
      .filter((r) => (ql ? r.c.name.toLowerCase().includes(ql) || !!r.hit : true))
      .filter((r) => (filter === 'Non lette' ? r.u > 0 || r.c.markedUnread : filter === 'Gruppi' ? r.c.type === 'group' : true))
      .sort((a, b) => Number(!!b.c.pinned) - Number(!!a.c.pinned) || b.ts - a.ts);
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
        <Pressable onPress={() => go('chatSettings')} hitSlop={8} accessibilityLabel="Impostazioni chat"><Text style={{ color: t.text, fontSize: 20 }}>⚙︎</Text></Pressable>
      </Row>}>
      {sel.length > 0 ? (
        <Row style={{ flexWrap: 'wrap', marginBottom: 8 }} gap={6}>
          <Pill label={allPinned ? 'Rimuovi fissa' : '📌 Fissa'} onPress={() => apply((c) => ({ pinned: !allPinned && !c.pinned }))} />
          <Pill label={allMuted ? '🔔 Riattiva' : '🔕 Silenzia'} onPress={() => apply(() => ({ mutedUntil: allMuted ? undefined : Date.now() + 365 * 86400000 }))} />
          <Pill label={allArchived ? 'Ripristina' : '🗄 Archivia'} onPress={() => apply(() => ({ archived: !allArchived }))} />
          <Pill label="Segna da leggere" onPress={() => apply(() => ({ markedUnread: true }))} />
          <Pill label="🗑 Elimina" onPress={() => setConfirmDel(true)} />
          <Pill label="Annulla" off onPress={() => setSel([])} />
        </Row>
      ) : (
        <>
          <Input placeholder="Cerca chat e messaggi" value={q} onChangeText={setQ} />
          {!archived && <Row style={{ justifyContent: 'flex-start', marginBottom: 8 }} gap={6}>{FILTERS.map((f) => <Pill key={f} label={f} on={filter === f} onPress={() => setFilter(f)} />)}</Row>}
          {!archived && archivedCount > 0 && !q && <Item onPress={() => setArchived(true)}><Row><Body>🗄 Archiviate</Body><Body muted>{archivedCount}</Body></Row></Item>}
        </>
      )}

      {rows.length === 0 ? <Empty text={q ? 'Nessun risultato.' : filter === 'Non lette' ? 'Nessun messaggio non letto.' : 'Nessuna chat: premi “+” per iniziare.'} /> : rows.map(({ c, last, u, hit }) => {
        const unread = u > 0 || c.markedUnread;
        const muted = isMuted(c);
        const preview = hit && q ? previewOf(hit) : c.draft ? c.draft : last ? previewOf(last) : c.type === 'group' ? `${c.members.length} membri` : 'Nessun messaggio';
        const mineLast = last?.from === me;
        return (
          <Pressable key={c.id} onPress={() => open(c)} onLongPress={() => setSel(sel.includes(c.id) ? sel : [...sel, c.id])} delayLongPress={300}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: sel.includes(c.id) ? t.chip : 'transparent' }}
            accessibilityLabel={`${c.name}${unread ? ', non letto' : ''}`}>
            {c.type === 'group' ? <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>👥</Text></View> : <UserAvatar name={c.name} size={48} />}
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: unread ? '800' : '600', flex: 1 }}>{c.name}</Text>
                <Text style={{ color: unread && !muted ? '#00a884' : t.muted, fontSize: 12 }}>{last ? listTime(last.ts) : ''}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }} gap={6}>
                <Text numberOfLines={1} style={{ color: t.muted, fontSize: 14, flex: 1, fontWeight: unread ? '700' : '400' }}>
                  {c.draft && !q ? <Text style={{ color: '#e5484d' }}>Bozza: </Text> : null}
                  {!c.draft && mineLast && last && !last.deletedForAll ? <Text style={{ color: last.status === 'read' ? '#34b7f1' : t.muted }}>{last.status === 'sent' ? '✓ ' : '✓✓ '}</Text> : null}
                  {!c.draft && c.type === 'group' && last && !mineLast && last.kind !== 'system' ? `${last.from}: ` : ''}{preview}
                </Text>
                {muted && <Text style={{ fontSize: 12 }}>🔕</Text>}
                {c.pinned && <Text style={{ fontSize: 12 }}>📌</Text>}
                {unread && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: muted ? t.muted : '#00a884', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{u > 0 ? u : ''}</Text></View>}
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
