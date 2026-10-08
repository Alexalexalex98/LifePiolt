import { useMemo } from 'react';
import { View } from 'react-native';

import { Body } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmCorrelation, type Correlation } from '@/lib/analytics';
import { collect } from '@/lib/analyticsData';

type Status = 'confermata' | 'incerta' | 'non si ripete';

/** Etichetta "confermata / incerta / non si ripete" con la spiegazione. */
export function ConfirmBadge({ status, text, compact }: { status: Status; text?: string; compact?: boolean }) {
  const t = useTheme();
  const color = status === 'confermata' ? t.positive : status === 'incerta' ? t.warn : t.danger;
  return (
    <View>
      <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: compact ? 2 : 4, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66' }}>
        <Body small bold color={color}>{status === 'confermata' ? 'Confermata nel tempo' : status === 'incerta' ? 'Ancora incerta' : 'Non si ripete'}</Body>
      </View>
      {text && !compact ? <Body small muted style={{ marginTop: 6 }}>{text}</Body> : null}
    </View>
  );
}

/** Conferma di una correlazione della Dashboard: prima metà dei dati contro seconda metà. */
export function CorrelationConfirm({ c }: { c: Correlation }) {
  const res = useMemo(() => {
    try {
      const series = collect();
      const a = series.find((s) => s.def.id === c.a.id), b = series.find((s) => s.def.id === c.b.id);
      return a && b ? confirmCorrelation(a, b, c.lag) : null;
    } catch { return null; }
  }, [c]);
  if (!res) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Body bold style={{ marginBottom: 6 }}>Si ripete nel tempo?</Body>
      <ConfirmBadge status={res.status} text={res.text} />
    </View>
  );
}
