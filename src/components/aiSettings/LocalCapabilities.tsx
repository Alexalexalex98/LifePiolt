import { View } from 'react-native';

import { Body, Card, H, Item } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { LOCAL_CAPABILITIES } from '@/lib/aiRouter/localFirst';

/** Cosa fa Theia da sola, senza AI esterna: l'elenco di cio' che funziona anche offline. */
export function LocalCapabilities() {
  const t = useTheme();
  return (
    <Card>
      <H>Cosa fa Theia da sola, senza AI</H>
      <Body small muted style={{ marginBottom: 8 }}>Theia non «pensa»: delega solo ciò che serve davvero a un altro modello. Tutto questo lo fa sul tuo telefono, anche senza internet, e non esce niente.</Body>
      {LOCAL_CAPABILITIES.map((c, i) => (
        <Item key={c.id} last={i === LOCAL_CAPABILITIES.length - 1}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ marginTop: 2 }}><Icon name="check" size={17} color={t.positive} stroke={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Body bold>{c.label}</Body>
              <Body small muted>{`Ad esempio: «${c.example}»`}</Body>
            </View>
          </View>
        </Item>
      ))}
      <Body small muted style={{ marginTop: 10 }}>Si delega solo per: creare immagini, leggere foto, comporre canzoni, documenti complessi, agenti a più passi, ricerca sul web, testi liberi molto complessi e traduzioni lunghe.</Body>
    </Card>
  );
}
