import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { CATALOG_BY_ID } from '@/lib/recipes/catalog';
import { fmtMin } from '@/lib/recipes/book';
import { readAloud, stopReading } from '@/lib/voice/readAloud';
import { useRecipes } from '@/store/recipes';

/** Barra fissa sopra il campo di scrittura mentre si cucina con Theia: avanti, indietro, ripeti, timer, leggi a voce, esci. */
export function CookBar({ onCmd }: { onCmd: (text: string) => void }) {
  const th = useTheme();
  const c = useRecipes((s) => s.cooking);
  const [reading, setReading] = useState(false);
  useEffect(() => () => stopReading(), []);
  const r = c?.chat && Date.now() - c.startedAt < 6 * 3600 * 1000 ? CATALOG_BY_ID.get(c.recipeId) : undefined;
  if (!c || !r) return null;
  const i = Math.min(c.step, r.steps.length - 1); const s = r.steps[i]!;
  const btn = (label: string, onPress: () => void, o: { icon?: string; primary?: boolean; flex?: number; danger?: boolean } = {}) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: o.flex ?? 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8, backgroundColor: o.primary ? th.text : th.card, borderWidth: 1, borderColor: o.primary ? th.text : th.border }}>
      {o.icon ? <Icon name={o.icon} size={17} color={o.primary ? th.onText : o.danger ? th.danger : th.text} stroke={2.4} /> : null}
      <Text numberOfLines={1} style={{ color: o.primary ? th.onText : o.danger ? th.danger : th.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 8, paddingTop: 8, paddingBottom: 4 }} accessibilityLabel={tl('Comandi della cucina guidata')}>
      <Text numberOfLines={1} style={{ color: th.muted, fontSize: 12, fontWeight: '700' }}>{`${r.name} · ${tl('passaggio {0} di {1}', i + 1, r.steps.length)}`}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {btn(tl('Indietro'), () => onCmd('indietro'), { icon: 'arrow-left' })}
        {btn(tl('Avanti'), () => onCmd('avanti'), { icon: 'chevron-right', primary: true, flex: 1.6 })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {btn(tl('Ripeti'), () => onCmd('ripeti'))}
        {s.timer ? btn(`${tl('Timer')} ${fmtMin(Math.round(s.timer.sec / 60))}`, () => onCmd('timer'), { icon: 'timer' }) : null}
        {btn(reading ? tl('Stop') : tl('Leggi'), () => { if (reading) { stopReading(); setReading(false); } else { setReading(true); void readAloud(s.text).done.finally(() => setReading(false)); } }, { icon: 'volume' })}
        {btn(tl('Esci'), () => onCmd('esci'), { danger: true })}
      </View>
    </View>
  );
}
