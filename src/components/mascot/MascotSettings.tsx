import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, Card, H, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { EXPRESSIONS, MOTIONS, type Expression, type MotionId } from '@/lib/mascot';
import { go } from '@/lib/nav';
import { ACCENTS } from '@/lib/themeCustom';
import { useApp } from '@/store/app';
import { useStickers } from '@/store/stickers';

const MODES: { id: 'everywhere' | 'useful' | 'off'; title: string; body: string; mood: Expression }[] = [
  { id: 'everywhere', title: 'Ovunque', body: "Ti accompagna in tutta l'app: chat, pulsante, Dashboard, pagine vuote, attese e adesivi.", mood: 'love' },
  { id: 'useful', title: 'Solo dove serve', body: 'Compare dove aiuta: nella chat, quando pensa, sul pulsante e negli adesivi.', mood: 'happy' },
  { id: 'off', title: 'Da nessuna parte', body: 'Niente personaggio: Theia resta la stessa assistente, con la sua icona a scintilla.', mood: 'sleepy' },
];
type Tab = 'color' | 'expr' | 'move' | 'where';
const TABS: { id: Tab; label: string }[] = [{ id: 'color', label: 'Colore' }, { id: 'expr', label: 'Espressione' }, { id: 'move', label: 'Movimento' }, { id: 'where', label: 'Dove' }];

/** La scheda di Theia, la mascotte: una sola Theia grande e, sotto, menù a scorrimento per cambiare colore, espressione, movimento e dove compare: tutto in una schermata. */
export function MascotSettings() {
  const t = useTheme();
  const mode = useApp((s) => s.mascot ?? 'everywhere');
  const custom = useApp((s) => s.custom);
  const set = useApp((s) => s.set);
  const mine = useStickers((s) => s.mine.length);
  const [expr, setExpr] = useState<Expression>('happy');
  const [mv, setMv] = useState<{ id: MotionId; n: number }>({ id: 'bounce', n: 0 });
  const [tab, setTab] = useState<Tab>('color');
  const play = (id: MotionId) => setMv((x) => ({ id, n: x.n + 1 }));
  const off = mode === 'off';
  return (
    <>
      <Card accent={t.accent}>
        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Mascot size={200} color={t.accent} expression={off ? 'sleepy' : expr} motion={mv} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
          {TABS.map((x) => <Pill key={x.id} label={tl(x.label)} on={tab === x.id} onPress={() => setTab(x.id)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8, alignItems: 'center' }}>
          {tab === 'color' ? ACCENTS.map((a) => <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={{ selected: custom?.accent === a.hex }} onPress={() => set({ custom: { ...custom, accent: a.hex } })} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: a.hex, borderWidth: custom?.accent === a.hex ? 3 : 0, borderColor: t.text }} />) : null}
          {tab === 'expr' ? EXPRESSIONS.map((e) => <Pill key={e.id} label={tl(e.label)} on={expr === e.id} onPress={() => { setExpr(e.id); play('nod'); }} />) : null}
          {tab === 'move' ? MOTIONS.map((m) => <Pill key={m.id} label={tl(m.label)} on={mv.id === m.id && mv.n > 0} onPress={() => play(m.id)} />) : null}
          {tab === 'where' ? MODES.map((m) => <Pill key={m.id} label={tl(m.title)} on={mode === m.id} onPress={() => { set({ mascot: m.id }); setExpr(m.mood); play('bounce'); }} />) : null}
        </ScrollView>
        <Body small muted style={{ textAlign: 'center', minHeight: 36 }}>
          {tab === 'color' ? tl('Il colore di Theia è il colore dell\'app: cambialo e guarda la piccola scena.') : tab === 'expr' ? tl('Scegli lo stato d\'animo e guarda Theia cambiare.') : tab === 'move' ? tl('Tocca un movimento e guarda Theia farlo.') : tl(MODES.find((m) => m.id === mode)!.body)}
        </Body>
        {tab === 'color' && custom?.accent ? <Btn small ghost style={{ alignSelf: 'center' }} title="Torna al colore originale" onPress={() => set({ custom: { ...custom, accent: undefined } })} /> : null}
      </Card>

      {!off ? (
        <>
          <Card onPress={() => go('theiaPet')}>
            <Row gap={12}>
              <Mascot size={48} color={t.accent} expression="love" animated={false} />
              <View style={{ flex: 1 }}><H style={{ marginBottom: 2 }}>{tl('Theia, il gioco')}</H><Body small muted>{tl('Una creatura da accudire e da veder crescere. Se vuoi, gli altri possono vedere Theia.')}</Body></View>
            </Row>
          </Card>
          <Card>
            <H>{tl('Adesivi')}</H>
            <Body small muted>{tl('Nelle chat tocca il pulsante di allegati e scegli «Adesivi di Theia»: puoi mandarli o crearne di tuoi descrivendoli.')}</Body>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', marginTop: 8 }}>{tl('Adesivi tuoi: {0}', mine)}</Text>
          </Card>
        </>
      ) : null}
    </>
  );
}
