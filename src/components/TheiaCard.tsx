import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { predictNeeds, theiaOnline } from '@/lib/theia';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { useTheia, askTheiaAbout } from '@/store/theia';
import { Icon } from '@/lib/icons';

/** "Theia per te": ciò che probabilmente ti serve adesso, con il motivo. */
export function TheiaCard() {
  const t = useTheme();
  const name = useApp((s) => s.assistantName);
  const dismissed = useTheia((s) => s.dismissed);
  const dismiss = useTheia((s) => s.dismiss);
  const tasks = useLife((s) => s.tasks), events = useLife((s) => s.events), goals = useLife((s) => s.goals);
  const msgs = useChat((s) => s.messages), visits = useApp((s) => s.visitHours);
  const [why, setWhy] = useState<string | null>(null);
  // si ricalcola quando cambiano i dati e a ogni apertura della Home
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => predictNeeds().filter((s) => !dismissed[s.id] || Date.now() - dismissed[s.id] > 6 * 3600000), [tasks, events, goals, msgs, visits, dismissed]);
  return (
    <Card style={{ marginTop: 10 }}>
      <Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name="sparkle" size={18} color={t.accent} /><Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{name} per te</Text></View>
        <Pressable onPress={() => askTheiaAbout({ source: 'home' })} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '700' }}>Chiedi</Text></Pressable>
      </Row>
      {list.length === 0 ? <Body small muted style={{ marginTop: 6 }}>Per ora non vedo nulla di urgente. Più usi l'app, più imparo cosa ti serve e quando.</Body> : list.slice(0, 3).map((s) => (
        <View key={s.id} style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Body bold>{s.title}</Body>
              <Body small muted style={{ marginTop: 2 }}>{s.detail}</Body>
              {why === s.id && <Body small color={t.accent} style={{ marginTop: 4 }}>Perché lo vedi: {s.why}</Body>}
            </View>
            <Pressable onPress={() => dismiss(s.id)} hitSlop={10}><Icon name="x" size={17} color={t.muted} /></Pressable>
          </Row>
          <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>
            {s.page && <Btn small title={s.cta} onPress={() => go(s.page!, s.params)} />}
            <Btn small ghost title={why === s.id ? 'Nascondi motivo' : 'Perché?'} onPress={() => setWhy(why === s.id ? null : s.id)} />
          </Row>
        </View>
      ))}
      <Body small muted style={{ marginTop: 10 }}>{theiaOnline ? 'Analisi con AI sul server.' : 'Calcolato sul telefono dalle tue abitudini e dai tuoi dati: nulla esce dal dispositivo.'}</Body>
    </Card>
  );
}
