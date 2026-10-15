import { FIT, FitHero } from '@/components/fitness/kit';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { GymPaySheet, GymScan } from '@/components/fitness/GymPay';
import { PayQr } from '@/components/PayQr';
import { PARTNER_GYMS, type Gym, type GymKind } from '@/lib/fitness/data';
import { buildGymLink, creditsLeft, priceList } from '@/lib/fitness/gymPay';
import { useLocalSearchParams } from 'expo-router';
import { hasAccess } from '@/lib/fitness/premium';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const KIND: Record<GymKind, string> = { palestra: 'Palestra', piscina: 'Piscina', centro: 'Centro sportivo' };

/** I centri convenzionati: elenco, dettagli e ingresso con il LifePass. */
export default function FitnessGyms() {
  const t = useTheme();
  const fit = useFitness();
  const [kind, setKind] = useState<GymKind | 'tutti'>('tutti');
  const [open, setOpen] = useState<Gym | null>(null);
  const { pay } = useLocalSearchParams<{ pay?: string }>();
  const [scan, setScan] = useState(false);
  const [payLink, setPayLink] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => { if (pay) setPayLink(pay); }, [pay]);
  const credits = (g: Gym) => creditsLeft(fit.purchases, g.id, Date.now());
  const all = [...PARTNER_GYMS, ...fit.approved];
  const list = all.filter((g) => kind === 'tutti' || g.kind === kind);
  const access = hasAccess(fit.sub, Date.now());
  const enter = (g: Gym) => { const r = fit.enter(g.id); toast(r.message); if (r.ok) setOpen(null); };
  return (
    <Page id="fitnessGyms" back title="Centri convenzionati">
      <FitHero eyebrow="LifePass" title="Un solo pass, tanti centri" sub="Palestre, piscine e centri sportivi convenzionati." />
      <Card accent={FIT}><Row gap={10}><Icon name="coin" size={26} color={FIT} /><View style={{ flex: 1 }}><Body bold>Paga con il QR</Body><Body small muted>Senza LifePass: inquadra il QR del centro e paghi l'ingresso, il corso o un pacchetto in LifePoints.</Body></View></Row><Btn style={{ marginTop: 8 }} icon="camera" title="Scansiona il QR" onPress={() => setScan(true)} /></Card>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginVertical: 10 }} gap={8}>
        {(['tutti', 'palestra', 'piscina', 'centro'] as const).map((k) => <Pill key={k} label={k === 'tutti' ? 'Tutti' : KIND[k]} on={kind === k} onPress={() => setKind(k)} />)}
      </Row>
      {!access ? <Card accent={FIT}><Body small>Per entrare serve il LifePass (30 LP al mese) oppure un ingresso pagato in LifePoints con il QR.</Body><Btn small style={{ marginTop: 8 }} title="Vedi il LifePass" onPress={() => go('lifefitness')} /></Card> : null}
      {list.map((g) => (
        <Card key={g.id} accent={FIT} onPress={() => setOpen(g)}>
          <Row><View style={{ flex: 1 }}><Body bold>{g.name}</Body><Body small muted>{KIND[g.kind]} · {g.city}</Body></View>{g.rating ? <Row gap={3}><Icon name="star" size={14} color={FIT} /><Body small>{g.rating.toFixed(1).replace('.', ',')}</Body></Row> : null}</Row>
          <Body small muted style={{ marginTop: 4 }}>{g.services.join(' · ')}</Body>
        </Card>
      ))}
      <GymScan visible={scan} onClose={() => setScan(false)} onCode={(c) => { setScan(false); setPayLink(c); }} />
      <GymPaySheet link={payLink} onClose={() => setPayLink(null)} />
      <Sheet visible={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open ? (
          <>
            <Body muted>{KIND[open.kind]} · {open.address}, {open.city}</Body>
            <Body small style={{ marginTop: 8 }}>{open.hours}</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={6}>{open.services.map((s) => <Pill key={s} label={s} off />)}</Row>
            <Body bold style={{ marginTop: 12 }}>Listino · si paga in LifePoints</Body>
            {priceList(open).map((i) => <Row key={i.id} style={{ paddingVertical: 6 }}><Body style={{ flex: 1 }}>{i.label}</Body><Body bold>{i.lp} LP</Body><Btn small ghost style={{ marginStart: 8 }} title="Paga" onPress={() => { const l = buildGymLink(open.id, i); setOpen(null); setPayLink(l); }} /></Row>)}
            {credits(open) > 0 ? <Body small color={t.positive} style={{ marginTop: 4 }}>{tl('Hai {0} ingressi pagati in questo centro', credits(open))}</Body> : null}
            <Btn style={{ marginTop: 10 }} title={access ? 'Entra adesso con il LifePass' : credits(open) > 0 ? 'Entra con un ingresso pagato' : 'Serve il LifePass o un ingresso pagato'} onPress={() => (access || credits(open) > 0 ? enter(open) : go('lifefitness'))} />
            <Btn style={{ marginTop: 6 }} ghost icon="coin" title={showQr ? 'Nascondi il QR della cassa' : 'Mostra il QR della cassa (per il centro)'} onPress={() => setShowQr((v) => !v)} />
            {showQr ? <View style={{ alignItems: 'center', marginTop: 8, gap: 6 }}><PayQr text={buildGymLink(open.id, priceList(open)[0])} size={190} /><Body small muted style={{ textAlign: 'center' }}>Il centro mostra questo QR alla cassa: chi lo inquadra paga «{priceList(open)[0].label}» in LifePoints.</Body></View> : null}
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>{tl('Un ingresso al giorno per centro, fino a 2 centri al giorno.')}</Text>
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
