import { useState } from 'react';
import { View } from 'react-native';

import { PayQr } from '@/components/PayQr';
import { Text } from '@/components/T';
import { LpTag } from '@/components/network';
import { Body, Btn, Card, Page, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { POS_ITEMS, posLink, type PosItem } from '@/lib/posDemo';

/** Casse di esempio: simulano un POS. Apri uno scontrino, salva lo schermo e poi leggilo con «Scansiona e paga» in LifePay (anche da foto). */
export default function PosDemo() {
  const t = useTheme();
  const [open, setOpen] = useState<PosItem | null>(null);
  if (open) {
    return (
      <Page id="posDemo" back title="Cassa">
        <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center' }}>
          <Text style={{ color: '#555', fontSize: 12, letterSpacing: 1.2, fontWeight: '700' }}>CASSA · {open.place.toUpperCase()}</Text>
          <Text style={{ color: '#111', fontSize: 24, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>{open.shop}</Text>
          <Text style={{ color: '#333', fontSize: 16, marginTop: 4, textAlign: 'center' }}>{open.item}</Text>
          <View style={{ marginVertical: 16 }}><PayQr text={posLink(open)} size={240} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ color: '#111', fontSize: 40, fontWeight: '800' }}>{formatCHF(open.lp)}</Text><LpTag size={26} dark /></View>
          <Text style={{ color: '#777', fontSize: 12, marginTop: 10, textAlign: 'center' }}>Scansiona con LifePay. Si paga solo in LifePoints.</Text>
        </View>
        <Body small muted style={{ marginTop: 12, textAlign: 'center' }}>Per salvarlo fai uno screenshot di questa schermata.</Body>
        <Btn ghost style={{ marginTop: 10 }} title="Altre casse" onPress={() => setOpen(null)} />
      </Page>
    );
  }
  return (
    <Page id="posDemo" back title="Casse di esempio">
      <Body small muted style={{ marginBottom: 10 }}>Quattro casse finte con prezzi diversi, per provare il pagamento in LifePoints. Aprine una, salva lo schermo e leggilo con LifePay.</Body>
      {POS_ITEMS.map((p) => (
        <Press key={p.id} onPress={() => setOpen(p)} accessibilityLabel={`${p.shop}, ${p.item}, ${p.lp} LP`} style={{ marginBottom: 10 }}>
          <Card>
            <Row>
              <View style={{ flex: 1 }}><Body bold>{p.shop}</Body><Body small muted>{p.item} · {p.place}</Body></View>
              <Row gap={4}><Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{formatCHF(p.lp)}</Text><LpTag size={15} /></Row>
              <Icon name="chevron-right" size={18} color={t.muted} />
            </Row>
          </Card>
        </Press>
      ))}
    </Page>
  );
}
