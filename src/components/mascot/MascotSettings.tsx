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
  { id: 'everywhere', title: 'Theia è ovunque', body: "Ti accompagna in tutta l'app: chat, pulsante, Dashboard, pagine vuote, attese e adesivi.", mood: 'love' },
  { id: 'useful', title: 'Solo dove serve', body: 'Compare dove aiuta: nella chat, quando pensa, sul pulsante e negli adesivi. Il resto resta pulito.', mood: 'happy' },
  { id: 'off', title: 'Nessuna mascotte', body: 'Niente personaggio da nessuna parte: Theia resta la stessa assistente, con la sua icona a scintilla.', mood: 'sleepy' },
];

/** La scheda di Theia, la mascotte: dove compare, colore, espressioni e adesivi. */
export function MascotSettings() {
  const t = useTheme();
  const mode = useApp((s) => s.mascot ?? 'everywhere');
  const custom = useApp((s) => s.custom);
  const set = useApp((s) => s.set);
  const mine = useStickers((s) => s.mine.length);
  const [expr, setExpr] = useState<Expression>('happy');
  const [mv, setMv] = useState<{ id: MotionId; n: number }>({ id: 'bounce', n: 0 });
  const play = (id: MotionId) => setMv((x) => ({ id, n: x.n + 1 }));
  return (
    <>
      <Card accent={t.accent}>
        <View style={{ alignItems: 'center', paddingVertical: 14 }}>
          <Mascot size={180} color={t.accent} expression={mode === 'off' ? 'sleepy' : expr} motion={mv} />
        </View>
        <Body small muted style={{ textAlign: 'center' }}>{tl('Cambia il colore: Theia si adatta e fa una piccola scena.')}</Body>
      </Card>

      <Card>
        <H>{tl('Dove vuoi Theia?')}</H>
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={tl(m.title)} onPress={() => { set({ mascot: m.id }); setExpr(m.mood); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.border }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.accent : t.border, alignItems: 'center', justifyContent: 'center' }}>{on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.accent }} /> : null}</View>
              <View style={{ flex: 1 }}><Body bold>{tl(m.title)}</Body><Body small muted>{tl(m.body)}</Body></View>
            </Pressable>
          );
        })}
      </Card>

      {mode !== 'off' ? (
        <>
          <Card>
            <Row><H style={{ flex: 1 }}>{tl('Colore')}</H><Mascot size={72} color={t.accent} expression={expr} /></Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
              {ACCENTS.map((a) => <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={{ selected: custom?.accent === a.hex }} onPress={() => set({ custom: { ...custom, accent: a.hex } })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: a.hex, borderWidth: custom?.accent === a.hex ? 3 : 0, borderColor: t.text }} />)}
            </ScrollView>
            <Body small muted>{tl("Il colore di Theia è il colore dell'app.")}</Body>
            {custom?.accent ? <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} title="Torna al colore originale" onPress={() => set({ custom: { ...custom, accent: undefined } })} /> : null}
          </Card>
          <Card>
            <Row><H style={{ flex: 1 }}>{tl('Espressione')}</H><Mascot size={72} color={t.accent} expression={expr} motion={mv} /></Row>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={8}>
              {EXPRESSIONS.map((e) => <Pill key={e.id} label={tl(e.label)} on={expr === e.id} onPress={() => { setExpr(e.id); play('nod'); }} />)}
            </Row>
          </Card>
          <Card>
            <Row><H style={{ flex: 1 }}>{tl('Movimenti')}</H><Mascot size={72} color={t.accent} expression={expr} motion={mv} /></Row>
            <Body small muted>{tl('Tocca un movimento e guarda Theia farlo.')}</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6 }} gap={8}>
              {MOTIONS.map((m) => <Pill key={m.id} label={tl(m.label)} on={mv.id === m.id && mv.n > 0} onPress={() => play(m.id)} />)}
            </Row>
          </Card>
          <Card>
            <H>{tl('Theia da accudire')}</H>
            <Body small muted>{tl('Un piccolo gioco: dalle da mangiare e da bere facendo le cose di ogni giorno e fate insieme attività per capire meglio cosa senti. Theia non ti fa stare meglio: sei tu a fare la differenza, il gioco è qui per darti consapevolezza. Gli altri possono vederla, se vuoi.')}</Body>
            <Btn small style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="heart" title="Vai da Theia" onPress={() => go('theiaPet')} />
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
