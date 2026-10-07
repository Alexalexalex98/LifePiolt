import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, H, Input, Label, Metric, Pill, Row, Screen } from '@/components/ui';
import { todayKey } from '@/lib/id';
import { healthScore } from '@/lib/score';
import { useTheme } from '@/hooks/use-theme';
import { useStore, type Mood } from '@/store';

const moods: { v: Mood; emoji: string; label: string }[] = [
  { v: 1, emoji: '😞', label: 'Male' },
  { v: 2, emoji: '😕', label: 'Così così' },
  { v: 3, emoji: '😐', label: 'Neutro' },
  { v: 4, emoji: '🙂', label: 'Bene' },
  { v: 5, emoji: '😄', label: 'Ottimo' },
];

export default function Health() {
  const t = useTheme();
  const { health, logHealth } = useStore();
  const day = health[todayKey()];
  const [sleep, setSleep] = useState(day?.sleepHours?.toString() ?? '');
  const [steps, setSteps] = useState(day?.steps?.toString() ?? '');
  const [weight, setWeight] = useState(day?.weightKg?.toString() ?? '');

  const num = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: todayKey(d), d };
  });

  return (
    <Screen title="LifeHealth" back>
      <Card>
        <Row>
          <View><Label>Stato di salute oggi</Label><Metric big>{healthScore(day) ?? '—'}</Metric></View>
        </Row>
        <Body muted small style={{ marginTop: 6 }}>Calcolato da sonno e passi che inserisci a mano.</Body>
      </Card>

      <Card>
        <H>Come ti senti?</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {moods.map((m) => (
            <Pill key={m.v} label={`${m.emoji} ${m.label}`} on={day?.mood === m.v} onPress={() => logHealth({ mood: m.v })} />
          ))}
        </View>
      </Card>

      <Card>
        <H>Registra oggi</H>
        <Label>Sonno (ore)</Label>
        <Input keyboardType="decimal-pad" placeholder="7.5" value={sleep} onChangeText={setSleep} />
        <Label>Passi</Label>
        <Input keyboardType="number-pad" placeholder="8000" value={steps} onChangeText={setSteps} />
        <Label>Peso (kg)</Label>
        <Input keyboardType="decimal-pad" placeholder="70" value={weight} onChangeText={setWeight} />
        <Button
          title="Salva"
          onPress={() => logHealth({ sleepHours: num(sleep), steps: num(steps), weightKg: num(weight) })}
        />
      </Card>

      <Card>
        <H>Ultimi 7 giorni · sonno</H>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, marginTop: 6 }}>
          {last7.map(({ key, d }) => {
            const h = health[key]?.sleepHours ?? 0;
            return (
              <View key={key} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: '100%', height: Math.max(3, (Math.min(h, 10) / 10) * 60), borderRadius: 5, backgroundColor: h ? t.accent : t.border }} />
                <Text style={{ color: t.muted, fontSize: 10, marginTop: 4 }}>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</Text>
              </View>
            );
          })}
        </View>
        <Body muted small style={{ marginTop: 10 }}>
          I valori sono indicativi e non sostituiscono il parere di un medico.
        </Body>
      </Card>
    </Screen>
  );
}
