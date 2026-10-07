import { Body, Item, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useFin } from '@/store/finance';
import { computeScores } from '@/lib/scores';
import { scoreInfo } from '@/data/metricInfo';

export function LifeScoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  // sottoscrive gli store così il dettaglio si aggiorna
  useHealth((s) => s.series); useLife((s) => s.goals); useFin((s) => s.months);
  const sc = computeScores();
  const subs: [string, number | null, string][] = [
    ['Salute', sc.health, "Dormi un po' di più e muoviti di più per alzarla."],
    ['Mente', sc.mind, 'Qualche minuto di mindfulness o un check-in in più aiuta.'],
    ['Finanze', sc.finance, 'Aumentare il tasso di risparmio del mese lo alza.'],
    ['Crescita', sc.growth, 'Fai avanzare i tuoi obiettivi in Plan per alzarla.'],
  ];
  const known = subs.filter((s) => s[1] != null) as [string, number, string][];
  const lowest = known.slice().sort((a, b) => a[1] - b[1])[0];
  return (
    <Sheet visible={visible} title={`Life Score: ${sc.total ?? '—'}/100`} onClose={onClose}>
      <Body small muted>{scoreInfo.total.what}</Body>
      <Body small style={{ marginTop: 6 }}>Riferimento: {scoreInfo.total.optimal}</Body>
      {subs.map(([label, val]) => (
        <Item key={label}>
          <Row><Body>{label}</Body><Body bold>{val == null ? 'nessun dato' : `${val}/100`}</Body></Row>
          <Progress value={val ?? 0} />
          <Body small muted style={{ marginTop: 4 }}>{scoreInfo[label === 'Salute' ? 'salute' : label === 'Mente' ? 'mente' : label === 'Finanze' ? 'finanza' : 'crescita'].what}</Body>
          {val != null && val < 80 && <Body small style={{ marginTop: 2 }}>Per alzarlo: {scoreInfo[label === 'Salute' ? 'salute' : label === 'Mente' ? 'mente' : label === 'Finanze' ? 'finanza' : 'crescita'].improve.join(' · ')}</Body>}
        </Item>
      ))}
      {lowest && <Body small color={t.warn} style={{ marginTop: 12 }}>Il punto più basso è <Body small bold color={t.warn}>{lowest[0]}</Body>: {lowest[2]}</Body>}
    </Sheet>
  );
}
