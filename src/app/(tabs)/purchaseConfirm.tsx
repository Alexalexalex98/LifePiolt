import { useState } from 'react';

import { usePurchase } from '@/components/network';
import { Body, Btn, Card, Item, Page, Row, Sheet } from '@/components/ui';
import { go } from '@/lib/nav';
import { toast } from '@/store/toast';

export default function PurchaseConfirm() {
  const { pending, set } = usePurchase();
  const [final, setFinal] = useState(false);
  const back = pending?.returnTo ?? 'lifenetwork';
  const cancel = () => { set(null); go(back); toast('Acquisto annullato'); };
  const finalize = () => {
    setFinal(false);
    const fn = pending?.onConfirm;
    set(null);
    fn?.();
    go(back);
  };
  return (
    <Page id="purchaseConfirm" title={pending?.title ?? 'Conferma acquisto'} noTop back={false}>
      {!pending ? <Body muted>Nessun acquisto in corso.</Body> : (
        <>
          <Card>{pending.rows.map(([l, v], i) => <Item key={l} last={i === pending.rows.length - 1}><Row><Body muted>{l}</Body><Body bold style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Body></Row></Item>)}</Card>
          <Row style={{ marginTop: 22 }}>
            <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={cancel} />
            <Btn style={{ flex: 1 }} title="Conferma" onPress={() => setFinal(true)} />
          </Row>
          <Sheet visible={final} title="Conferma definitiva" onClose={() => setFinal(false)}>
            <Body small muted>Stai per completare: <Body small bold>{pending.title}</Body>.</Body>
            {pending.rows.map(([l, v], i) => <Item key={l} last={i === pending.rows.length - 1}><Row><Body muted>{l}</Body><Body bold>{v}</Body></Row></Item>)}
            <Body small muted style={{ marginTop: 10 }}>L'operazione versa i LifePoints e non può essere annullata dopo questo punto.</Body>
            <Row style={{ marginTop: 16 }}><Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setFinal(false)} /><Btn style={{ flex: 1 }} title="Conferma definitivamente" onPress={finalize} /></Row>
          </Sheet>
        </>
      )}
    </Page>
  );
}
