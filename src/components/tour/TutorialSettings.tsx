import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Item, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { TUTORIALS } from '@/lib/tutorials';
import { useTour } from '@/store/tour';
import { toast } from '@/store/toast';

/** Impostazioni → Tutorial: un tutorial per ogni sezione, da riprendere quando vuoi o da disattivare tutti insieme. */
export function TutorialSettings() {
  const t = useTheme();
  const seen = useTour((s) => s.seen);
  const off = useTour((s) => !!s.tutOff);
  const start = (id: string, page: string) => { go(page); setTimeout(() => useTour.getState().start(id), 500); };
  const [all, setAll] = useState(false);
  const done = TUTORIALS.filter((x) => seen.includes(x.id)).length;
  /* chiusa mostra solo i primi da vedere: tutti i 18 si aprono con un tocco */
  const list = all ? TUTORIALS : [...TUTORIALS].sort((a, b) => Number(seen.includes(a.id)) - Number(seen.includes(b.id))).slice(0, 3);
  return (
    <Card>
      <H>Tutorial</H>
      <Body small muted>Un tutorial per ogni sezione: parte la prima volta che la apri, qui lo rivedi quando vuoi.</Body>
      <Row style={{ marginTop: 10, marginBottom: 6 }}>
        <View style={{ flex: 1 }}><Body bold>Mostra i tutorial aprendo una sezione</Body><Body small muted>{done} di {TUTORIALS.length} visti</Body></View>
        <Switch value={!off} onValueChange={(on) => useTour.getState().setTutOff(!on)} accessibilityLabel="Mostra i tutorial aprendo una sezione" />
      </Row>
      {list.map((x, i) => {
        const isSeen = seen.includes(x.id);
        return (
          <Item key={x.id} last={i === list.length - 1}>
            <Row>
              <Icon name={x.icon} size={18} color={isSeen ? t.positive : t.muted} />
              <View style={{ flex: 1, marginStart: 10 }}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{x.title}</Text>
                <Text style={{ color: t.muted, fontSize: 12.5 }}>{isSeen ? 'Visto' : 'Da vedere'} · {x.short}</Text>
              </View>
              <Btn small ghost title={isSeen ? 'Rivedi' : 'Avvia'} onPress={() => start(x.id, x.page)} />
            </Row>
          </Item>
        );
      })}
      <Btn small ghost style={{ marginTop: 8 }} title={all ? 'Mostra meno' : `Mostra tutti i ${TUTORIALS.length} tutorial`} onPress={() => setAll((v) => !v)} />
      <Btn small style={{ marginTop: 8 }} icon="help" title="Aiuto e domande: chiedi a Theia" onPress={() => go('help')} />
      <Row style={{ marginTop: 8 }} gap={8}>
        <Btn small ghost style={{ flex: 1 }} title="Rivedi il benvenuto" onPress={() => { go('home'); setTimeout(() => useTour.getState().start('welcome'), 500); }} />
        <Btn small ghost style={{ flex: 1 }} title="Rimetti tutti da vedere" onPress={() => { useTour.getState().resetTutorials(); toast('Tutorial rimessi da vedere'); }} />
      </Row>
    </Card>
  );
}
