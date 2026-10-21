import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Body, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';

/** Una «i» piccola: toccandola si apre una scheda con la spiegazione, così in pagina non restano testi lunghi. `body` può essere testo o più righe. */
export function InfoTip({ title, body, size = 18 }: { title: string; body: string | string[] | ReactNode; size?: number }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${tl('Informazioni')}: ${tl(title)}`} hitSlop={12} onPress={() => setOpen(true)} style={{ padding: 2 }}>
        <Icon name="info" size={size} color={t.muted} stroke={2} />
      </Pressable>
      <Sheet visible={open} title={title} onClose={() => setOpen(false)}>
        {typeof body === 'string' ? <Body>{body}</Body> : Array.isArray(body) ? body.map((b, i) => <Body key={i} style={i ? { marginTop: 8 } : undefined}>{b}</Body>) : body}
      </Sheet>
    </>
  );
}
