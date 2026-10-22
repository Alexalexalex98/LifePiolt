import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, Card, H, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { EXPRESSIONS, type Expression } from '@/lib/mascot';
import { ACCENTS } from '@/lib/themeCustom';
import { useApp } from '@/store/app';

/** Theia, la mascotte: la vedi, le cambi espressione e colore (cambia il colore di tutta l'app, e lei fa la sua scena). */
export default function MascotPage() {
  const t = useTheme();
  const custom = useApp((s) => s.custom);
  const set = useApp((s) => s.set);
  const [expr, setExpr] = useState<Expression>('happy');
  return (
    <Page id="mascot" back title="Theia">
      <Card accent={t.accent}>
        <View style={{ alignItems: 'center', paddingVertical: 18 }}>
          <Mascot size={190} color={t.accent} expression={expr} />
        </View>
        <Body small muted style={{ textAlign: 'center' }}>Cambia il colore: Theia si adatta e fa una piccola scena.</Body>
      </Card>
      <Card>
        <H>Colore</H>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
          {ACCENTS.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={{ selected: custom?.accent === a.hex }} onPress={() => set({ custom: { ...custom, accent: a.hex } })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: a.hex, borderWidth: custom?.accent === a.hex ? 3 : 0, borderColor: t.text }} />
          ))}
        </ScrollView>
      </Card>
      <Card>
        <H>Espressione</H>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={8}>
          {EXPRESSIONS.map((e) => <Pill key={e.id} label={tl(e.label)} on={expr === e.id} onPress={() => setExpr(e.id)} />)}
        </Row>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 10 }}>{tl('Presto: la usi al posto delle emoji nelle chat e crei la tua.')}</Text>
      </Card>
      {custom?.accent ? <Btn ghost title="Torna al colore originale" onPress={() => set({ custom: { ...custom, accent: undefined } })} /> : null}
    </Page>
  );
}
