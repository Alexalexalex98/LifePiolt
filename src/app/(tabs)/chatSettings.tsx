import { Text, View } from 'react-native';

import { wallpapers } from '@/components/chat/parts';
import { Body, Card, Item, Page, Pill, Row, Seg, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useChat } from '@/store/chat';
import { toast } from '@/store/toast';

const DIS: [string, number][] = [['Disattivati', 0], ['24 ore', 86400], ['7 giorni', 7 * 86400], ['90 giorni', 90 * 86400]];

export default function ChatSettings() {
  const t = useTheme();
  const s = useChat((x) => x.settings);
  const blocked = useChat((x) => x.blocked);
  const set = useChat((x) => x.setSettings);
  const unblock = (n: string) => { useChat.getState().block(n, false); toast(`${n} sbloccato`); };
  return (
    <Page id="chatSettings" back title="Impostazioni chat">
      <Card>
        <Body bold>Privacy</Body>
        <Toggle label="Conferme di lettura" hint="Se disattivi, non invii né vedi le spunte blu (nella modalità demo vengono simulate)." value={s.readReceipts} onChange={(v) => set({ readReceipts: v })} />
        <Body small muted style={{ marginTop: 8 }}>Messaggi a tempo predefiniti per le nuove chat</Body>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }} gap={6}>{DIS.map(([l, v]) => <Pill key={l} label={l} on={s.defaultDisappearingSec === v} onPress={() => set({ defaultDisappearingSec: v })} />)}</Row>
      </Card>
      <Card>
        <Body bold>Chat</Body>
        <Toggle label="Invio con Invio" hint="Il tasto Invio della tastiera invia il messaggio." value={s.enterSends} onChange={(v) => set({ enterSends: v })} />
        <Body small muted style={{ marginTop: 8, marginBottom: 6 }}>Dimensione del testo</Body>
        <Seg options={['S', 'M', 'L']} value={s.fontSize} onChange={(v) => set({ fontSize: v as 'S' | 'M' | 'L' })} />
        <Body small muted style={{ marginTop: 12, marginBottom: 6 }}>Sfondo predefinito</Body>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={8}>
          {Object.entries(wallpapers).map(([k, w]) => (
            <Pill key={k} label={w.label} on={s.wallpaper === k} onPress={() => set({ wallpaper: k })} />
          ))}
        </Row>
      </Card>
      <Card>
        <Body bold>Archivio</Body>
        <Item onPress={() => go('starredPage')}><Body>★ Tutti i messaggi preferiti</Body></Item>
        <Item last onPress={() => go('messagesPage')}><Body>🗄 Chat archiviate</Body></Item>
      </Card>
      <Card>
        <Body bold>Contatti bloccati</Body>
        {blocked.length === 0 ? <Body small muted style={{ marginTop: 6 }}>Nessun contatto bloccato.</Body> : blocked.map((n, i) => (
          <Item key={n} last={i === blocked.length - 1} onPress={() => unblock(n)}><Row><Body>{n}</Body><Text style={{ color: t.accent }}>Sblocca</Text></Row></Item>
        ))}
      </Card>
      <View style={{ height: 6 }} />
      <Body small muted>I messaggi sono salvati solo su questo dispositivo. Finché non è collegato un server di messaggistica, i messaggi non vengono recapitati ad altre persone e le conferme di consegna/lettura sono simulate solo in modalità demo.</Body>
    </Page>
  );
}
