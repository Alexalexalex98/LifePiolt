import { Body, Item, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useFin } from '@/store/finance';
import { computeScores } from '@/lib/scores';

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
      <Body small muted>Media di quattro aree della tua vita, calcolata dai dati reali dell'app: salute, mente, finanze e avanzamento sugli obiettivi.</Body>
      {subs.map(([label, val]) => (
        <Item key={label}>
          <Row><Body>{label}</Body><Body bold>{val == null ? 'nessun dato' : `${val}/100`}</Body></Row>
          <Progress value={val ?? 0} />
        </Item>
      ))}
      {lowest && <Body small color={t.warn} style={{ marginTop: 12 }}>Il punto più basso è <Body small bold color={t.warn}>{lowest[0]}</Body>: {lowest[2]}</Body>}
    </Sheet>
  );
}
