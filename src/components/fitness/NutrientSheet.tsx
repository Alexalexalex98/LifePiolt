import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { NUTRIENTS, NUTRIENT_DISCLAIMER, portionAmount, type FoodSource, type NutrientId } from '@/lib/fitness/nutrientInfo';

const KIND: Record<string, string> = { vitamina: 'Vitamina', minerale: 'Minerale', macronutriente: 'Macronutriente', 'da limitare': 'Da tenere sotto controllo', altro: 'Nutriente' };
const nf = (n: number) => (Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace('.', ','));

/** Scheda di un nutriente: a cosa serve, perché fa bene e 5 alimenti dove si trova; toccando un alimento si apre la sua scheda. */
export function NutrientSheet({ id, onClose }: { id: NutrientId | null; onClose: () => void }) {
  const t = useTheme();
  const [food, setFood] = useState<FoodSource | null>(null);
  useEffect(() => { setFood(null); }, [id]);
  const n = id ? NUTRIENTS[id] : null;
  const title = !n ? '' : food ? food.name : `${tl(n.label)}`;
  return (
    <Sheet visible={!!n} title={title} onClose={onClose}>
      {n && !food ? (
        <View>
          <Row style={{ justifyContent: 'flex-start' }} gap={8}>
            <View style={{ backgroundColor: FIT + '26', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: FIT, fontSize: 12, fontWeight: '800' }}>{tl(KIND[n.kind])}</Text></View>
          </Row>
          <Body style={{ marginTop: 10 }}>{tl(n.what)}</Body>
          <Body small muted style={{ marginTop: 4 }}>{tl(n.ref)}</Body>

          <Body bold style={{ marginTop: 14 }}>Perché fa bene</Body>
          {n.why.map((w, i) => <Row key={i} gap={8} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: 4 }}><Icon name="check" size={15} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{tl(w)}</Body></Row>)}

          <Body bold style={{ marginTop: 14 }}>{n.kind === 'da limitare' ? 'Dove si trova' : 'Dove trovarla'}</Body>
          <Body small muted style={{ marginBottom: 2 }}>Tocca un alimento per vedere la scheda.</Body>
          {n.sources.map((f, i) => (
            <Item key={f.name} last={i === n.sources.length - 1}>
              <Pressable accessibilityRole="button" accessibilityLabel={f.name} onPress={() => setFood(f)}>
                <Row gap={10}>
                  <View style={{ flex: 1 }}>
                    <Body bold>{tl(f.name)}</Body>
                    <Body small muted>{`${nf(f.per100)} ${n.unit} ${tl('ogni 100 g')}`}</Body>
                  </View>
                  <Icon name="chevron" size={18} color={t.muted} />
                </Row>
              </Pressable>
            </Item>
          ))}

          <Body bold style={{ marginTop: 14 }}>Un consiglio</Body>
          <Body small>{tl(n.tip)}</Body>
          {n.caution ? <Body small style={{ marginTop: 10, color: '#ffb020' }}>{tl(n.caution)}</Body> : null}
          <Body small muted style={{ marginTop: 12 }}>{tl(NUTRIENT_DISCLAIMER)}</Body>
        </View>
      ) : null}

      {n && food ? (
        <View>
          {(() => {
            const p = portionAmount(n.id, food);
            return (
              <View>
                <Body small muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{tl(n.label)}</Body>
                <Body bold style={{ fontSize: 30, marginTop: 2 }}>{`${nf(food.per100)} ${n.unit}`}</Body>
                <Body small muted>{tl('ogni 100 g di {0}', food.name.toLowerCase())}</Body>
                <View style={{ marginTop: 14, backgroundColor: t.chip, borderRadius: 14, padding: 12 }}>
                  <Body bold>{`${tl(food.portionLabel)} (${food.portion} g)`}</Body>
                  <Body style={{ marginTop: 2 }}>{`${tl('circa')} ${nf(p.amount)} ${n.unit}${p.pct !== null ? ` · ${p.pct}% ${tl('del riferimento giornaliero')}` : ''}`}</Body>
                </View>
                <Body bold style={{ marginTop: 14 }}>Come mangiarlo</Body>
                <Body small>{tl(food.note)}</Body>
                {food.also ? <><Body bold style={{ marginTop: 14 }}>Contiene anche</Body><Body small>{tl(food.also)}</Body></> : null}
                <Body small muted style={{ marginTop: 14 }}>{tl(NUTRIENT_DISCLAIMER)}</Body>
                <Btn style={{ marginTop: 14 }} ghost title={tl('Torna a {0}', n.label)} onPress={() => setFood(null)} />
              </View>
            );
          })()}
        </View>
      ) : null}
    </Sheet>
  );
}
