import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Btn } from '@/components/ui';
import { exportWeeklyReport } from '@/lib/report';
import { toast } from '@/store/toast';

/** Pulsante "Report della settimana": genera un PDF con salute, umore, finanze, task, impegni e correlazioni. */
export function WeeklyReportButton({ style, small, ghost = true }: { style?: StyleProp<ViewStyle>; small?: boolean; ghost?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Btn icon="file" small={small} ghost={ghost} style={style} disabled={busy} title={busy ? 'Preparo il report…' : 'Report della settimana'} onPress={async () => {
      setBusy(true);
      try { const r = await exportWeeklyReport(); toast(r.message); } finally { setBusy(false); }
    }} />
  );
}
