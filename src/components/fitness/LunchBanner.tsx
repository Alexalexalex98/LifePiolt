import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { lunchAsk } from '@/lib/fitness/lunch';
import { dayOf } from '@/lib/fitness/mealInsights';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** «Hai mangiato?»: compare quando apri l'app durante la pausa pranzo che hai impostato. Se hai mangiato puoi fotografare il piatto. */
export function LunchBanner() {
  const fit = useFitness();
  const [tick, setTick] = useState(0);
  const [photo, setPhoto] = useState(false);
  useEffect(() => { const s = AppState.addEventListener('change', (st) => { if (st === 'active') setTick((n) => n + 1); }); return () => s.remove(); }, []);
  void tick;
  const now = new Date();
  const day = dayOf(now.getTime());
  const ask = lunchAsk({ now, cfg: fit.lunch, answer: (fit.lunchLog ?? {})[day], snoozeUntil: fit.lunchSnooze });
  if (photo) {
    return (
      <Card accent={FIT}>
        <Row gap={10}>
          <Icon name="camera" size={26} color={FIT} />
          <View style={{ flex: 1 }}><Body bold>Vuoi fotografare il piatto?</Body><Body small muted>Lo analizzo e lo segno nel diario dei pasti. Se preferisci, puoi saltare.</Body></View>
        </Row>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          <Btn small icon="camera" title="Scatta" onPress={() => { setPhoto(false); go('fitnessMeal', { start: 'camera' }); }} />
          <Btn small ghost icon="image" title="Dalla galleria" onPress={() => { setPhoto(false); go('fitnessMeal', { start: 'gallery' }); }} />
          <Btn small ghost title="No, grazie" onPress={() => setPhoto(false)} />
        </Row>
      </Card>
    );
  }
  if (!ask) return null;
  return (
    <Card accent={FIT}>
      <Row gap={10}>
        <Icon name="clock" size={26} color={FIT} />
        <View style={{ flex: 1 }}><Body bold>Hai mangiato?</Body><Body small muted>È l'ora della tua pausa pranzo.</Body></View>
      </Row>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
        <Btn small title="Sì" onPress={() => { fit.answerLunch(day, 'si'); setPhoto(true); }} />
        <Btn small ghost title="No" onPress={() => { fit.answerLunch(day, 'no', 30); toast(tl('Va bene, te lo richiedo tra 30 minuti')); }} />
      </Row>
    </Card>
  );
}
