import { FIT, FitHero } from '@/components/fitness/kit';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS, type Gym, type GymKind } from '@/lib/fitness/data';
import { hasAccess } from '@/lib/fitness/premium';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const KIND: Record<GymKind, string> = { palestra: 'Palestra', piscina: 'Piscina', centro: 'Centro sportivo' };

/** I centri convenzionati: elenco, dettagli e ingresso con il Premium. */
export default function FitnessGyms() {
  const t = useTheme();
  const fit = useFitness();
  const [kind, setKind] = useState<GymKind | 'tutti'>('tutti');
  const [open, setOpen] = useState<Gym | null>(null);
  const all = [...PARTNER_GYMS, ...fit.approved];
  const list = all.filter((g) => kind === 'tutti' || g.kind === kind);
  const access = hasAccess(fit.sub, Date.now());
  const enter = (g: Gym) => { const r = fit.enter(g.id); toast(r.message); if (r.ok) setOpen(null); };
  return (
    <Page id="fitnessGyms" back title="Centri convenzionati">
      <FitHero eyebrow="Premium" title="Un abbonamento, tanti centri" sub="Palestre, piscine e centri sportivi convenzionati." />
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 10 }} gap={8}>
        {(['tutti', 'palestra', 'piscina', 'centro'] as const).map((k) => <Pill key={k} label={k === 'tutti' ? 'Tutti' : KIND[k]} on={kind === k} onPress={() => setKind(k)} />)}
      </Row>
      {!access ? <Card accent={FIT}><Body small>Per entrare serve il Premium (30 LP al mese). Puoi comunque vedere i centri.</Body><Btn small style={{ marginTop: 8 }} title="Vedi il Premium" onPress={() => go('lifefitness')} /></Card> : null}
      {list.map((g) => (
        <Card key={g.id} accent={FIT} onPress={() => setOpen(g)}>
          <Row><View style={{ flex: 1 }}><Body bold>{g.name}</Body><Body small muted>{KIND[g.kind]} · {g.city}</Body></View>{g.rating ? <Row gap={3}><Icon name="star" size={14} color={FIT} /><Body small>{g.rating.toFixed(1).replace('.', ',')}</Body></Row> : null}</Row>
          <Body small muted style={{ marginTop: 4 }}>{g.services.join(' · ')}</Body>
        </Card>
      ))}
      <Sheet visible={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open ? (
          <>
            <Body muted>{KIND[open.kind]} · {open.address}, {open.city}</Body>
            <Body small style={{ marginTop: 8 }}>{open.hours}</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={6}>{open.services.map((s) => <Pill key={s} label={s} off />)}</Row>
            <Btn style={{ marginTop: 14 }} title={access ? 'Entra adesso' : 'Serve il Premium'} onPress={() => (access ? enter(open) : go('lifefitness'))} />
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>{tl('Un ingresso al giorno per centro, fino a 2 centri al giorno.')}</Text>
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
