import { Pressable } from 'react-native';

import { Body, Item, Progress, Row, Sheet } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { dayOf } from '@/lib/fitness/mealInsights';
import { useTheme } from '@/hooks/use-theme';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useFin } from '@/store/finance';
import { computeScores } from '@/lib/scores';
import { computeDashboard } from '@/lib/analyticsData';
import { attainment } from '@/lib/analytics';
import { useFitness } from '@/store/fitness';
import { scoreInfo } from '@/data/metricInfo';

/** Ogni area porta alla sua pagina; le voci della Salute alla loro sezione. */
const PAGE: Record<string, string> = { Salute: 'lifehealth', Mente: 'mood', Finanze: 'lifefinance', Crescita: 'plan' };
const METRIC_PAGE = (id: string): [string, Record<string, string>?] => id === 'training' ? ['lifefitness'] : id === 'diet' ? ['fitnessDay', { day: dayOf(Date.now()) }] : ['lifehealth'];

export function LifeScoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  // sottoscrive gli store così il dettaglio si aggiorna
  useHealth((s) => s.series); useLife((s) => s.goals); useFin((s) => s.months); useFitness((s) => s.history); useFitness((s) => s.meals);
  const sc = computeScores();
  const subs: [string, number | null, string][] = [
    ['Salute', sc.health, "Dormi un po' di più e muoviti di più per alzarla."],
    ['Mente', sc.mind, 'Qualche minuto di mindfulness o un check-in in più aiuta.'],
    ['Finanze', sc.finance, 'Aumentare il tasso di risparmio del mese lo alza.'],
    ['Crescita', sc.growth, 'Fai avanzare i tuoi obiettivi in Plan per alzarla.'],
  ];
  const weigh = computeDashboard().list.filter((a) => a.def.domain === 'salute').map((a) => ({ id: a.def.id, label: a.def.label, pct: attainment(a.def, a.avg7) })).filter((x): x is { id: string; label: string; pct: number } => x.pct != null);
  const known = subs.filter((s) => s[1] != null) as [string, number, string][];
  const lowest = known.slice().sort((a, b) => a[1] - b[1])[0];
  return (
    <Sheet visible={visible} title={`Life Score: ${sc.total ?? '—'}/100`} onClose={onClose}>
      <Body small muted>{scoreInfo.total.what}</Body>
      <Body small style={{ marginTop: 6 }}>Riferimento: {scoreInfo.total.optimal}</Body>
      {subs.map(([label, val]) => (
        <Item key={label}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Apri ${label}`} onPress={() => { onClose(); go(PAGE[label]); }}>
          <Row><Body>{label}</Body><Row gap={6}><Body bold>{val == null ? 'nessun dato' : `${val}/100`}</Body><Icon name="chevron" size={16} color={t.muted} /></Row></Row>
          </Pressable>
          <Progress value={val ?? 0} />
          <Body small muted style={{ marginTop: 4 }}>{scoreInfo[label === 'Salute' ? 'salute' : label === 'Mente' ? 'mente' : label === 'Finanze' ? 'finanza' : 'crescita'].what}</Body>
          {val != null && val < 80 && <Body small style={{ marginTop: 2 }}>Per alzarlo: {scoreInfo[label === 'Salute' ? 'salute' : label === 'Mente' ? 'mente' : label === 'Finanze' ? 'finanza' : 'crescita'].improve.join(' · ')}</Body>}
        </Item>
      ))}
      {weigh.length ? (
        <Item>
          <Body bold>Cosa pesa nella Salute</Body>
          <Body small muted style={{ marginBottom: 4 }}>Ogni voce vale quanto le altre. Se non ti alleni o mangi cibo spazzatura, qui scende.</Body>
          {weigh.map((x) => <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`Apri ${x.label}`} onPress={() => { onClose(); const [pg, pr] = METRIC_PAGE(x.id); go(pg, pr); }}><Row style={{ marginTop: 2 }}><Body small>{x.label}</Body><Body small bold color={x.pct < 60 ? t.warn : undefined}>{`${x.pct}/100`}</Body></Row></Pressable>)}
        </Item>
      ) : null}
      {lowest && <Body small color={t.warn} style={{ marginTop: 12 }}>Il punto più basso è <Body small bold color={t.warn}>{lowest[0]}</Body>: {lowest[2]}</Body>}
    </Sheet>
  );
}
