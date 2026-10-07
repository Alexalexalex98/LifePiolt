import { Inbox } from '@/components/Inbox';
import { openSheet } from '@/components/network';
import { Btn, Page } from '@/components/ui';

export default function Messages() {
  return (
    <Page id="messagesPage" title="Messaggi" back>
      <Btn small ghost style={{ marginBottom: 12 }} title="+ Nuova chat di gruppo" onPress={() => openSheet('newGroup')} />
      <Inbox />
    </Page>
  );
}
