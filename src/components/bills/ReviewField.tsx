import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Input } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/core';
import type { Field } from '@/lib/bills/types';
import type { TextInputProps } from 'react-native';
import { ConfBadge, SourceLine } from './shared';

/** Un campo della revisione: valore modificabile, confidenza, riga di origine evidenziata, errore. Mai inserito senza conferma. */
export function ReviewField({ label, value, onValue, read, edited, error, children, ...rest }: {
  label: string; value: string; onValue: (v: string) => void; read?: Field<unknown>; edited?: boolean; error?: string; children?: ReactNode;
} & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const th = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <Body small bold style={{ flexShrink: 1 }}>{label}</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {edited ? <Text style={{ color: th.accent, fontSize: 11, fontWeight: '700' }}>{t('Corretto da te')}</Text> : null}
          {read ? <ConfBadge level={read.confidence} /> : <Text style={{ color: th.muted, fontSize: 11 }}>{t('Da compilare')}</Text>}
        </View>
      </View>
      <Input value={value} onChangeText={onValue} accessibilityLabel={label} style={[{ marginBottom: 4 }, error ? { borderColor: th.danger } : null]} {...rest} />
      {error ? <Body small color={th.danger}>{error}</Body> : null}
      {read?.note ? <Body small muted style={{ marginBottom: 2 }}>{read.note}</Body> : null}
      {read?.source ? <SourceLine source={read.source} match={read.match} /> : null}
      {children}
    </View>
  );
}
