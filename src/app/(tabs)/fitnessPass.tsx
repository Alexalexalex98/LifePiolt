import { View } from 'react-native';
import { Text } from '@/components/T';

import { FIT, FitHero } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Page, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS, type GymKind } from '@/lib/fitness/data';
import { PREMIUM_PRICE_LP, daysLeft, premiumState } from '@/lib/fitness/premium';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { useNet } from '@/store/network';

const KIND: Record<GymKind, string> = { palestra: 'Palestra', piscina: 'Piscina', centro: 'Centro sportivo' };
const STEPS: [string, string, string][] = [
  ['coin', 'Attivi il LifePass', `Paghi ${PREMIUM_PRICE_LP} LifePoints e l'abbonamento parte subito, per 30 giorni.`],
  ['lifefitness', 'Mostri il pass', 'All’ingresso del centro mostri il codice QR del tuo pass: il centro controlla che sia attivo.'],
  ['check', 'Ti alleni', 'Entri nei centri convenzionati: palestre, piscine e centri sportivi.'],
  ['repeat', 'Rinnovo o disdetta', 'Ogni 30 giorni si rinnova da solo, se hai i LifePoints. Lo disattivi quando vuoi dal LifePass: resta attivo fino a fine periodo.'],
];

/** LifePass spiegato prima di abbonarsi: come funziona, regole e tutti i centri convenzionati. L'acquisto si conferma solo dopo, in LifeFitness. */
export default function FitnessPass() {
  const t = useTheme();
  const fit = useFitness();
  const net = useNet();
  const now = Date.now();
  const state = premiumState(fit.sub, now);
  const active = state === 'attivo' || state === 'in-scadenza';
  const gyms = [...PARTNER_GYMS, ...fit.approved];
  const cities = [...new Set(gyms.map((g) => g.city))].sort((a, b) => a.localeCompare(b));
  return (
    <Page id="fitnessPass" back title="LifePass">
      <FitHero eyebrow="LifePass" title="Un solo pass, tanti centri" sub={`${PREMIUM_PRICE_LP} LP al mese · 1 LP = 1 CHF`} />

      <Card>
        <H>Come funziona</H>
        {STEPS.map(([ic, title, text], i) => (
          <Row key={title} gap={12} style={{ alignItems: 'flex-start', justifyContent: 'flex-start', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.item }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: FIT + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={17} color={FIT} stroke={2} /></View>
            <View style={{ flex: 1 }}><Body bold>{i + 1}. {title}</Body><Body small muted>{text}</Body></View>
          </Row>
        ))}
      </Card>

      <Card>
        <H>Cosa include e le regole</H>
        {['Accesso a tutti i centri convenzionati qui sotto', 'Un ingresso al giorno per centro, fino a 2 centri diversi al giorno', 'Pagamento solo in LifePoints, nessun’altra valuta', 'Senza LifePass puoi comunque pagare un singolo ingresso, un corso o un pacchetto inquadrando il QR del centro'].map((x) => (
          <Row key={x} gap={8} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', paddingVertical: 4 }}><Icon name="check" size={15} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{x}</Body></Row>
        ))}
      </Card>

      <Card accent={FIT} onPress={() => go('fitnessGyms')}>
        <Row gap={10}><View style={{ flex: 1 }}><H style={{ marginBottom: 2 }}>{tl('Centri convenzionati ({0})', gyms.length)}</H><Body small muted>Tocca per vedere la scheda dei centri: servizi, orari e prezzi.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
      </Card>

      <Card accent={FIT}>
        {active ? (
          <>
            <Body bold>{tl('LifePass attivo: ancora {0} giorni', daysLeft(fit.sub, now))}</Body>
            <Row style={{ marginTop: 10 }}><Body style={{ flex: 1 }}>Rinnovo automatico</Body><Switch value={!!fit.sub?.autoRenew} onValueChange={(v) => fit.setAutoRenew(v)} accessibilityLabel="Rinnovo automatico" /></Row>
            {fit.visits.length ? <Body small muted style={{ marginTop: 8 }}>{tl('Ingressi con il LifePass: {0}', fit.visits.length)}</Body> : null}
            <Btn style={{ marginTop: 8 }} title="Mostra il pass d'ingresso" onPress={() => go('lifefitness')} />
          </>
        ) : (
          <>
            <Body small muted>{tl('Hai {0} LP. Non paghi niente finché non confermi nel passaggio successivo.', net.lifePoints)}</Body>
            <Btn style={{ marginTop: 8 }} title={tl('Continua: attiva il LifePass · {0} LP', PREMIUM_PRICE_LP)} onPress={() => go('lifefitness', { buy: '1' })} />
          </>
        )}
      </Card>
    </Page>
  );
}
