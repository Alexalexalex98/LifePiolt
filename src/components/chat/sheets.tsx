import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Input, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { peoplePool } from '@/lib/network';
import { DELETE_ALL_WINDOW, EDIT_WINDOW, EMOJIS, dmId, fmtClock, previewOf, useChat, type ChatMessage } from '@/store/chat';
import { toast } from '@/store/toast';

const dt = (ts: number) => { const d = new Date(ts); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${fmtClock(ts)}`; };

export type Action = 'reply' | 'copy' | 'forward' | 'star' | 'edit' | 'info' | 'delete' | 'select' | 'react';

export function MessageActions({ m, me, onClose, onAction }: { m: ChatMessage | null; me: string; onClose: () => void; onAction: (a: Action, emoji?: string) => void }) {
  const t = useTheme();
  if (!m) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const mine = m.from === me;
  const starred = !!m.starredBy?.includes(me);
  const canEdit = mine && m.kind === 'text' && !m.deletedForAll && Date.now() - m.ts < EDIT_WINDOW;
  const copyable = !!m.text && !m.deletedForAll;
  const row = (label: string, a: Action, show = true) => show ? <Item key={a} onPress={() => onAction(a)}><Body>{label}</Body></Item> : null;
  return (
    <Sheet visible title="Messaggio" onClose={onClose}>
      {!m.deletedForAll && (
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }} gap={4}>
          {EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => onAction('react', e)} style={{ padding: 6, borderRadius: 20, backgroundColor: m.reactions?.[me] === e ? t.chip : 'transparent' }} accessibilityLabel={`Reagisci ${e}`}><Text style={{ fontSize: 28 }}>{e}</Text></Pressable>
          ))}
        </Row>
      )}
      <Body small muted numberOfLines={2} style={{ marginBottom: 6 }}>{previewOf(m)}</Body>
      {!m.deletedForAll && row('↩︎ Rispondi', 'reply')}
      {row('⧉ Copia', 'copy', copyable)}
      {!m.deletedForAll && row('↪ Inoltra', 'forward')}
      {!m.deletedForAll && row(starred ? '★ Rimuovi dai preferiti' : '☆ Aggiungi ai preferiti', 'star')}
      {row('✎ Modifica', 'edit', canEdit)}
      {mine && !m.deletedForAll && row('ⓘ Info messaggio', 'info')}
      {row('☑ Seleziona', 'select')}
      <Item last onPress={() => onAction('delete')}><Body color={t.danger}>🗑 Elimina</Body></Item>
    </Sheet>
  );
}

export function copyText(m: ChatMessage) {
  if (m.text) void Clipboard.setStringAsync(m.text).then(() => toast('Copiato'));
}

export function DeleteSheet({ msgs, me, onClose, onDone }: { msgs: ChatMessage[] | null; me: string; onClose: () => void; onDone: (mode: 'me' | 'all') => void }) {
  const t = useTheme();
  if (!msgs?.length) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const allMine = msgs.every((m) => m.from === me && !m.deletedForAll && Date.now() - m.ts < DELETE_ALL_WINDOW);
  return (
    <Sheet visible title={msgs.length > 1 ? `Eliminare ${msgs.length} messaggi?` : 'Eliminare il messaggio?'} onClose={onClose}>
      {allMine && <Item onPress={() => onDone('all')}><Body color={t.danger}>Elimina per tutti</Body></Item>}
      <Item onPress={() => onDone('me')}><Body color={t.danger}>Elimina per me</Body></Item>
      <Item last onPress={onClose}><Body>Annulla</Body></Item>
      {!allMine && <Body small muted style={{ marginTop: 8 }}>“Elimina per tutti” è disponibile solo per i tuoi messaggi inviati negli ultimi 2 giorni.</Body>}
    </Sheet>
  );
}

export function InfoSheet({ m, onClose }: { m: ChatMessage | null; onClose: () => void }) {
  if (!m) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const label = { sending: 'In invio', sent: 'Inviato', delivered: 'Consegnato', read: 'Letto' }[m.status];
  return (
    <Sheet visible title="Info messaggio" onClose={onClose}>
      <Body small muted numberOfLines={3} style={{ marginBottom: 10 }}>{previewOf(m)}</Body>
      <Item><Row><Body>Inviato</Body><Body muted>{dt(m.ts)}</Body></Row></Item>
      <Item><Row><Body>Stato</Body><Body muted>{label}</Body></Row></Item>
      {m.edited && <Item><Row><Body>Modificato</Body><Body muted>sì</Body></Row></Item>}
      {m.expiresAt && <Item><Row><Body>Scompare</Body><Body muted>{dt(m.expiresAt)}</Body></Row></Item>}
      <Body small muted style={{ marginTop: 10 }}>Senza un server di messaggistica collegato, lo stato “Consegnato/Letto” non è reale: nella modalità demo viene simulato.</Body>
    </Sheet>
  );
}

/** Scelta destinatari (inoltro) — chat esistenti + persone. */
export function PickChatsSheet({ visible, title, me, onClose, onPick, exclude }: { visible: boolean; title: string; me: string; onClose: () => void; onPick: (chatIds: string[]) => void; exclude?: string }) {
  const chats = useChat((s) => s.chats);
  const ensureDm = useChat((s) => s.ensureDm);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const names = new Set<string>();
  Object.values(chats).forEach((c) => names.add(c.type === 'dm' ? c.name : '#' + c.id));
  peoplePool(me).forEach((n) => names.add(n));
  const rows = [...names].map((n) => (n.startsWith('#') ? { id: n.slice(1), name: chats[n.slice(1)].name, group: true } : { id: dmId(n), name: n, group: false }))
    .filter((r) => r.id !== exclude && r.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Input placeholder="Cerca…" value={q} onChangeText={setQ} />
      {rows.map((r) => (
        <Item key={r.id} onPress={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])}>
          <Row><Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>{r.group ? <Text style={{ fontSize: 22 }}>👥</Text> : <UserAvatar name={r.name} size={28} />}<Body>{r.name}</Body></Row>{sel.includes(r.id) ? <Text style={{ color: '#00a884', fontSize: 18 }}>✓</Text> : null}</Row>
        </Item>
      ))}
      <Btn style={{ marginTop: 12 }} title={sel.length ? `Invia a ${sel.length}` : 'Seleziona almeno una chat'} disabled={!sel.length} onPress={() => {
        sel.forEach((id) => { if (id.startsWith('dm:')) ensureDm(id.slice(3), me); });
        onPick(sel); setSel([]); setQ('');
      }} />
    </Sheet>
  );
}
