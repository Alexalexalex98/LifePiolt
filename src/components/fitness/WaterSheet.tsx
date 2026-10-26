import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Ring } from '@/components/fitness/kit';
import { Body, Btn, Input, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const BLUE = '#6aa8ff';
const L = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;
const AMOUNTS = [100, 200, 330, 500, 750, 1000];

/** Scheda al centro per aggiungere acqua al volo (dalla Dashboard e da LifeFitness): quanto hai bevuto finora, l'obiettivo e i tasti rapidi. */
export function WaterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const fit = useFitness();
  const [custom, setCustom] = useState('');
  const key = dayOf(Date.now());
  const ml = (fit.water ?? {})[key] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  const left = Math.max(0, goal - ml);
  const add = (n: number) => { fit.addWater(n); toast(n > 0 ? tl('Segnato: {0} ml', n) : tl('Tolti {0} ml', -n)); };
  return (
    <Sheet visible={visible} title="Aggiungi acqua" onClose={onClose}>
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Ring value={ml / goal} size={150} stroke={14} color={BLUE} big={L(ml)} small={tl('su {0}', L(goal))} />
        <Text style={{ color: ml >= goal ? '#5fd39a' : t.muted, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>
          {ml >= goal ? tl('Obiettivo di oggi raggiunto') : tl('Ti mancano ancora {0}', L(left))}
        </Text>
      </View>
      <Body small bold muted style={{ marginTop: 16, marginBottom: 8 }}>Quanta ne hai bevuta adesso?</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AMOUNTS.map((n) => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={tl('Aggiungi {0} ml', n)} onPress={() => add(n)} style={{ flexBasis: '31%', flexGrow: 1, height: 48, borderRadius: 16, backgroundColor: BLUE + '22', borderWidth: 1, borderColor: BLUE + '55', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{n >= 1000 ? '1 L' : `${n} ml`}</Text>
          </Pressable>
        ))}
      </View>
      <Row style={{ marginTop: 12 }} gap={8}>
        <Input flex={1} keyboardType="number-pad" placeholder="Altra quantità (ml)" value={custom} onChangeText={setCustom} style={{ marginBottom: 0 }} />
        <Btn small title="Aggiungi" onPress={() => { const n = parseInt(custom.replace(/\D/g, ''), 10); if (!n || n > 3000) { toast('Scrivi una quantità tra 1 e 3000 ml'); return; } add(n); setCustom(''); }} />
      </Row>
      <Row style={{ marginTop: 14 }} gap={8}>
        {ml > 0 ? <Btn small ghost style={{ flex: 1 }} title="Togli 200 ml" onPress={() => add(-Math.min(200, ml))} /> : null}
        <Btn small ghost style={{ flex: 1 }} title="Come va l'acqua" onPress={() => { onClose(); go('fitnessDay', { day: key, focus: 'water' }); }} />
      </Row>
    </Sheet>
  );
}
