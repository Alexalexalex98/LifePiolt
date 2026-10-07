import { Body, Btn, Card } from '@/components/ui';
import { unreadMessages } from '@/lib/network';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';

/** Scorciatoia nella scheda Messaggi di LifeNetwork: la chat vera sta nella pagina Messaggi. */
export function Inbox() {
  const me = useApp((s) => s.account.name);
  const n = useChat((s) => { void s.messages; return unreadMessages(me); });
  return (
    <Card>
      <Body bold>{n > 0 ? `${n} ${n === 1 ? 'chat con messaggi non letti' : 'chat con messaggi non letti'}` : 'Nessun messaggio non letto'}</Body>
      <Body small muted style={{ marginTop: 4, marginBottom: 10 }}>Chat, gruppi, vocali, foto e allegati.</Body>
      <Btn title="Apri messaggi" onPress={() => go('messagesPage')} />
    </Card>
  );
}
