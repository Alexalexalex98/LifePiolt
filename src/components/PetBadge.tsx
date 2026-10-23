import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { go } from '@/lib/nav';
import { publicOf } from '@/lib/pet';
import { useApp } from '@/store/app';
import { usePet } from '@/store/pet';

/** La Theia di una persona sul suo profilo: la propria solo se ha scelto di mostrarla, quella degli altri solo se loro l'hanno permesso. */
export function PetBadge({ name }: { name: string }) {
  const th = useTheme();
  const me = useApp((s) => s.account.name);
  const pet = usePet((s) => s.pet);
  const others = usePet((s) => s.others);
  const mine = name === me;
  const p = mine ? (pet.share ? publicOf(pet, dayKey()) : null) : others[name] ?? null;
  if (!p) return null;
  return (
    <Card onPress={mine ? () => go('theiaPet') : undefined}>
      <Row gap={12}>
        <Mascot size={64} color={th.accent} expression={p.expr} animated={false} />
        <View style={{ flex: 1 }}>
          <Body bold>{`${p.name} · ${tl('livello')} ${p.level}`}</Body>
          <Body small muted>{`${p.streak > 0 ? `${p.streak} ${tl('giorni di serie')} · ` : ''}${tl(p.label)}`}</Body>
        </View>
      </Row>
    </Card>
  );
}
