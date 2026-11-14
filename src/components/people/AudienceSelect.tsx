import { View } from 'react-native';

import { Body, Press } from '@/components/ui';
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
