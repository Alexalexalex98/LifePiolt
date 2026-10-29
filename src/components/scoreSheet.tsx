import { Pressable } from 'react-native';

import { LifeScoreBody } from '@/components/LifeScoreBody';
import { Body, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { computeDashboard } from '@/lib/analyticsData';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useWellbeing } from '@/store/wellbeing';

/** La scheda del Life Score (dal widget, dal Profilo, dalla Home): stessa vista di «La tua vita in un dato», con la «i» su ogni voce. */
export function LifeScoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  // sottoscrive gli store così il dettaglio si aggiorna
  useHealth((s) => s.series); useHealth((s) => s.extra); useLife((s) => s.goals); useLife((s) => s.tasks); useFin((s) => s.months); useFitness((s) => s.history); useFitness((s) => s.meals); useHealth((s) => s.moods); useWellbeing((s) => s.results); useWellbeing((s) => s.notes);
  return (
    <Sheet visible={visible} title={`Life Score: ${computeDashboard().scores.total ?? '—'}/100`} onClose={onClose}>
      <LifeScoreBody onClose={onClose} />
      <Pressable accessibilityRole="button" accessibilityLabel="Apri LifeHealth" onPress={() => { onClose(); go('lifehealth'); }} style={{ marginTop: 12 }}>
        <Row><Body bold>Apri LifeHealth</Body><Icon name="chevron" size={16} color={t.muted} /></Row>
      </Pressable>
    </Sheet>
  );
}
