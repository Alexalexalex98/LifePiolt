import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { PickPeopleSheet } from '@/components/chat/NewChat';
import { MediaViewer, wallpapers } from '@/components/chat/parts';
import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Item, Page, Row, Sheet, TabRow, IL } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtSize } from '@/lib/chatMedia';
import { go, goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { dayLabel, fmtClock, isMuted, previewOf, urlRe, useChat, visibleMsgs } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

const DISAPPEAR: [string, number][] = [['Disattivati', 0], ['24 ore', 86400], ['7 giorni', 7 * 86400], ['90 giorni', 90 * 86400]];

export default function ChatInfo() {
  const t = useTheme();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const chat = useChat((s) => s.chats[id]);
  const messages = useChat((s) => s.messages[id]);
  const blocked = useChat((s) => s.blocked);
  const st = useChat.getState;
  const [tab, setTab] = useState('Media');
  const [viewer, setViewer] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'mute' | 'disappear' | 'wall' | 'clear' | 'delete' | 'leave' | 'add'>(null);
  const [member, setMember] = useState<string | null>(null);

  const msgs = useMemo(() => visibleMsgs(messages, me).filter((m) => !m.deletedForAll), [messages, me]);
  const media = msgs.filter((m) => m.kind === 'image' || m.kind === 'video');
  const docs = msgs.filter((m) => m.kind === 'file');
  const links = msgs.flatMap((m) => ((m.text ?? '').match(urlRe) ?? []).map((u) => ({ u, ts: m.ts })));
  const starred = msgs.filter((m) => m.starredBy?.includes(me));

  if (!chat) return <Page id="chatInfo" back><Body muted>Chat non trovata.</Body></Page>;
  const isGroup = chat.type === 'group';
  const iAmAdmin = chat.admins.includes(me);
  const isBlocked = blocked.includes(chat.name);
  const muted = isMuted(chat);
  const dis = DISAPPEAR.find(([, s]) => s === (chat.disappearingSec ?? 0))?.[0] ?? 'Disattivati';

  async function exportChat() {
    const text = msgs.map((m) => `[${dayLabel(m.ts)} ${fmtClock(m.ts)}] ${m.from === 'system' ? '' : m.from + ': '}${previewOf(m)}`).join('\n');
    try { await Share.share({ message: text || 'Chat vuota', title: `Chat con ${chat!.name}` }); } catch { toast('Esportazione annullata'); }
  }

  const sect = (label: string) => <Body small muted style={{ marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Body>;

  return (
    <Page id="chatInfo" back>
      <View style={{ alignItems: 'center', marginVertical: 14 }}>
        {isGroup ? <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={44} color={t.text} /></View> : <UserAvatar name={chat.name} size={92} />}
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 10 }}>{chat.name}</Text>
        <Body small muted>{isGroup ? `Gruppo · ${chat.members.length} partecipanti` : 'Contatto'}</Body>
        {!isGroup && <Btn small ghost style={{ marginTop: 10 }} title="Vedi profilo" onPress={() => go('userProfile', { name: chat.name })} />}
        {isGroup && chat.description ? <Body small style={{ marginTop: 8, textAlign: 'center' }}>{chat.description}</Body> : null}
      </View>

      <Card>
        <TabRow options={['Media', 'Documenti', 'Link']} value={tab} onChange={setTab} />
        {tab === 'Media' && (media.length === 0 ? <Body small muted>Nessuna foto o video condiviso.</Body> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {media.map((m, i) => (
              <Pressable key={m.id} onPress={() => setViewer(i)} style={{ width: '32.5%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: t.item }}>
                <Image source={{ uri: m.media?.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                {m.kind === 'video' && <View style={{ position: 'absolute', end: 4, bottom: 4 }}><Icon name="play" size={14} color="#fff" fill="#fff" /></View>}
              </Pressable>
            ))}
          </View>
        ))}
        {tab === 'Documenti' && (docs.length === 0 ? <Body small muted>Nessun documento condiviso.</Body> : docs.map((m, i) => (
          <Item key={m.id} last={i === docs.length - 1} onPress={() => m.media?.uri && void Linking.openURL(m.media.uri).catch(() => undefined)}><Row><IL icon="file">{m.media?.name}</IL><Body small muted>{fmtSize(m.media?.size)}</Body></Row></Item>
        )))}
        {tab === 'Link' && (links.length === 0 ? <Body small muted>Nessun link condiviso.</Body> : links.map((l, i) => (
          <Item key={i} last={i === links.length - 1} onPress={() => void Linking.openURL(/^https?:/i.test(l.u) ? l.u : `https://${l.u}`)}><Body numberOfLines={1} color="#34a0f1">{l.u}</Body></Item>
        )))}
      </Card>

      <Card>
        <Item onPress={() => go('starredPage', { id })}><Row><IL icon="star">Messaggi importanti</IL><Body muted>{starred.length}</Body></Row></Item>
        <Item onPress={() => setSheet('mute')}><Row><IL icon="bell-off">Silenzia notifiche</IL><Body muted>{muted ? 'Sì' : 'No'}</Body></Row></Item>
        <Item onPress={() => setSheet('disappear')}><Row><IL icon="timer">Messaggi a tempo</IL><Body muted>{dis}</Body></Row></Item>
        <Item onPress={() => setSheet('wall')}><Row><IL icon="image">Sfondo chat</IL><Body muted>{wallpapers[chat.wallpaper ?? 'default']?.label}</Body></Row></Item>
        <Item onPress={() => st().patchChat(id, { pinned: !chat.pinned })}><Row><IL icon="pin">Fissa in alto</IL><Body muted>{chat.pinned ? 'Sì' : 'No'}</Body></Row></Item>
        <Item last onPress={() => { st().patchChat(id, { archived: !chat.archived }); toast(chat.archived ? 'Chat ripristinata' : 'Chat archiviata'); }}><Row><IL icon="archive">Archivia chat</IL><Body muted>{chat.archived ? 'Sì' : 'No'}</Body></Row></Item>
      </Card>

      {isGroup && (
        <Card>
          <Row><Body bold>{chat.members.length} partecipanti</Body>{iAmAdmin && <Pressable onPress={() => setSheet('add')}><Text style={{ color: t.accent, fontWeight: '700' }}>+ Aggiungi</Text></Pressable>}</Row>
          {chat.members.map((n, i) => (
            <Item key={n} last={i === chat.members.length - 1} onPress={() => n !== me && setMember(n)}>
              <Row><Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}><UserAvatar name={n} size={32} /><Body>{n === me ? 'Tu' : n}</Body></Row>{chat.admins.includes(n) && <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700' }}>ADMIN</Text>}</Row>
            </Item>
          ))}
        </Card>
      )}

      <Card>
        <Item onPress={exportChat}><IL icon="share">Esporta chat</IL></Item>
        {!isGroup && <Item onPress={() => { st().block(chat.name, !isBlocked); toast(isBlocked ? `${chat.name} sbloccato` : `${chat.name} bloccato`); }}><Body color={t.danger}>{isBlocked ? `Sblocca ${chat.name}` : `Blocca ${chat.name}`}</Body></Item>}
        <Item onPress={() => { useNet.getState().report(chat.name); toast('Segnalazione inviata, verrà valutata'); }}><Body color={t.danger}>Segnala {isGroup ? 'gruppo' : chat.name}</Body></Item>
        <Item last={!isGroup} onPress={() => setSheet('clear')}><Body color={t.danger}>Svuota chat</Body></Item>
        {isGroup && <Item last onPress={() => setSheet('leave')}><Body color={t.danger}>Esci dal gruppo</Body></Item>}
        <Item last onPress={() => setSheet('delete')}><Body color={t.danger}>Elimina chat</Body></Item>
      </Card>

      <MediaViewer items={media} index={viewer} onClose={() => setViewer(null)} />
      {isGroup && <PickPeopleSheet visible={sheet === 'add'} onClose={() => setSheet(null)} addTo={{ chatId: id, existing: chat.members }} />}

      <Sheet visible={sheet === 'mute'} title="Silenzia notifiche" onClose={() => setSheet(null)}>
        {([['8 ore', 8 * 3600000], ['1 settimana', 7 * 86400000], ['Sempre', 3650 * 86400000]] as [string, number][]).map(([l, ms]) => <Item key={l} onPress={() => { st().patchChat(id, { mutedUntil: Date.now() + ms }); setSheet(null); }}><Body>{l}</Body></Item>)}
        <Item last onPress={() => { st().patchChat(id, { mutedUntil: undefined }); setSheet(null); }}><Body>Riattiva notifiche</Body></Item>
      </Sheet>
      <Sheet visible={sheet === 'disappear'} title="Messaggi a tempo" onClose={() => setSheet(null)}>
        <Body small muted style={{ marginBottom: 8 }}>I nuovi messaggi di questa chat vengono eliminati dopo il tempo scelto. Non riguarda i messaggi già inviati.</Body>
        {DISAPPEAR.map(([l, s]) => <Item key={l} onPress={() => { st().setDisappearing(id, s, me); setSheet(null); }}><Row><Body>{l}</Body>{(chat.disappearingSec ?? 0) === s ? <Icon name="check" size={17} color={t.accent} stroke={2.5} /> : null}</Row></Item>)}
      </Sheet>
      <Sheet visible={sheet === 'wall'} title="Sfondo chat" onClose={() => setSheet(null)}>
        {Object.entries(wallpapers).map(([k, w]) => <Item key={k} onPress={() => { st().patchChat(id, { wallpaper: k }); setSheet(null); }}><Row><Row style={{ justifyContent: 'flex-start' }} gap={10}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: w.dark, borderWidth: 1, borderColor: t.border }} /><Body>{w.label}</Body></Row>{(chat.wallpaper ?? 'default') === k ? <Icon name="check" size={17} color={t.accent} stroke={2.5} /> : null}</Row></Item>)}
      </Sheet>
      <Sheet visible={sheet === 'clear'} title="Svuotare la chat?" onClose={() => setSheet(null)}>
        <Item onPress={() => { st().clearChat(id, false); setSheet(null); toast('Chat svuotata'); }}><Body color={t.danger}>Svuota tutto</Body></Item>
        <Item last onPress={() => { st().clearChat(id, true); setSheet(null); toast('Chat svuotata (preferiti mantenuti)'); }}><Body>Svuota e tieni i messaggi preferiti</Body></Item>
      </Sheet>
      <Sheet visible={sheet === 'delete'} title="Eliminare la chat?" onClose={() => setSheet(null)}>
        <Body small muted style={{ marginBottom: 10 }}>La chat e i suoi messaggi verranno rimossi da questo dispositivo.</Body>
        <Btn danger title="Elimina" onPress={() => { st().deleteChat(id); setSheet(null); go('messagesPage'); }} />
      </Sheet>
      <Sheet visible={sheet === 'leave'} title="Uscire dal gruppo?" onClose={() => setSheet(null)}>
        <Btn danger title="Esci" onPress={() => { st().leaveGroup(id, me); setSheet(null); goBack(); }} />
      </Sheet>
      <Sheet visible={!!member} title={member ?? ''} onClose={() => setMember(null)}>
        <Item onPress={() => { const n = member!; setMember(null); const d = st().ensureDm(n, me); go('conversationPage', { id: d }); }}><Body>Scrivi a {member}</Body></Item>
        <Item onPress={() => { const n = member!; setMember(null); go('userProfile', { name: n }); }}><Body>Vedi profilo</Body></Item>
        {iAmAdmin && member && <Item onPress={() => { st().setAdmin(id, member, !chat.admins.includes(member)); setMember(null); }}><Body>{chat.admins.includes(member) ? 'Rimuovi come admin' : 'Rendi admin'}</Body></Item>}
        {iAmAdmin && member && <Item last onPress={() => { st().removeMember(id, member, me); setMember(null); }}><Body color={t.danger}>Rimuovi dal gruppo</Body></Item>}
      </Sheet>
    </Page>
  );
}
