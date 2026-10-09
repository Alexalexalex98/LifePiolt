import { useState } from 'react';
import { View } from 'react-native';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Input, Item, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

/** Nuova chat: scegli una persona oppure crea un gruppo. */
export function PickPeopleSheet({ visible, onClose, addTo }: { visible: boolean; onClose: () => void; addTo?: { chatId: string; existing: string[] } }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(!!addTo);
  const [sel, setSel] = useState<string[]>([]);
  const [name, setName] = useState('');
  const people = peoplePool(me).filter((n) => !addTo?.existing.includes(n) && n.toLowerCase().includes(q.trim().toLowerCase()));
  const reset = () => { setQ(''); setSel([]); setName(''); setGroup(!!addTo); };
  const done = () => { reset(); onClose(); };

  return (
    <Sheet visible={visible} title={addTo ? 'Aggiungi partecipanti' : group ? 'Nuovo gruppo' : 'Nuova chat'} onClose={done}>
      {!addTo && !group && <Item onPress={() => setGroup(true)}><Row style={{ justifyContent: 'flex-start' }} gap={10}><Icon name="users" size={22} color={t.text} /><Body bold>Nuovo gruppo</Body></Row></Item>}
      {group && !addTo && <Input placeholder="Nome del gruppo" value={name} onChangeText={setName} />}
      <Input placeholder="Cerca una persona…" value={q} onChangeText={setQ} />
      {sel.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{sel.map((n) => <Pill key={n} on label={n} onPress={() => setSel(sel.filter((x) => x !== n))} />)}</View>}
      {people.length === 0 ? <Body small muted>Nessuna persona trovata.</Body> : people.map((n) => (
        <Item key={n} onPress={() => {
          if (!group) { const id = useChat.getState().ensureDm(n, me); done(); go('conversationPage', { id }); return; }
          setSel(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]);
        }}>
          <Row><Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}><UserAvatar name={n} size={30} /><Body>{n}</Body></Row>{sel.includes(n) ? <Icon name="check" size={18} color={t.accent} stroke={2.5} /> : null}</Row>
        </Item>
      ))}
      {group && (
        <Btn style={{ marginTop: 12 }} title={addTo ? 'Aggiungi' : 'Crea gruppo'} onPress={() => {
          if (addTo) { if (!sel.length) { toast('Scegli almeno una persona'); return; } useChat.getState().addMembers(addTo.chatId, sel, me); done(); return; }
          if (!name.trim() || !sel.length) { toast('Dai un nome al gruppo e scegli almeno una persona'); return; }
          const id = useChat.getState().createGroup(name.trim(), sel, me);
          done(); toast('Gruppo creato'); go('conversationPage', { id });
        }} />
      )}
    </Sheet>
  );
}
