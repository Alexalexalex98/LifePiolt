import { View } from 'react-native';

import { Body, Pill, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { AUDIENCES, POST_AUDIENCES, type Audience } from '@/lib/people';

/** Sceglie a chi mostrare un contenuto. Per i post bastano «Tutti» e «Solo chi mi segue»; per annunci, servizi, seminari e idee c'è anche «Tutti tranne chi mi segue». */
export function AudienceSelect({ value, onChange, post }: { value: Audience; onChange: (a: Audience) => void; post?: boolean }) {
  const th = useTheme();
  const list = AUDIENCES.filter((a) => !post || POST_AUDIENCES.includes(a.k));
  return (
    <View style={{ gap: 8 }}>
      {list.map((a) => (
        <Press key={a.k} accessibilityLabel={tl(a.n)} selected={value === a.k} onPress={() => onChange(a.k)} style={{ borderWidth: 1, borderColor: value === a.k ? th.accent : th.border, borderRadius: 14, padding: 12 }}>
          <Body bold color={value === a.k ? th.accent : undefined}>{tl(a.n)}</Body>
          <Body small muted>{tl(a.d)}</Body>
        </Press>
      ))}
    </View>
  );
}

/** Versione compatta per i moduli di creazione: pulsanti con il pubblico scelto e, sotto, che cosa significa. */
export function AudiencePills({ value, onChange, post, label = 'Chi lo vede' }: { value: Audience; onChange: (a: Audience) => void; post?: boolean; label?: string }) {
  const list = AUDIENCES.filter((a) => !post || POST_AUDIENCES.includes(a.k));
  const cur = list.find((a) => a.k === value) ?? list[0]!;
  return (
    <View style={{ marginBottom: 10 }}>
      <Body small muted style={{ marginBottom: 6 }}>{tl(label)}</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{list.map((a) => <Pill key={a.k} label={tl(a.n)} on={value === a.k} onPress={() => onChange(a.k)} />)}</Row>
      <Body small muted style={{ marginTop: 6 }}>{tl(cur.d)}</Body>
    </View>
  );
}
