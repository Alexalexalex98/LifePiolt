import { useState } from 'react';

import { BarcodeSheet } from '@/components/fitness/BarcodeSheet';
import { Body, Btn, Page } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { goBack } from '@/lib/nav';

/** Pagina del widget «Controlla un alimento»: apre subito il lettore del codice a barre. */
export default function FoodScan() {
  const [open, setOpen] = useState(true);
  return (
    <Page id="foodScan" title={tl('Controlla un alimento')} back>
      <Body muted>{tl('Inquadra il codice a barre di un prodotto: vedi valori e Nutri-Score e scegli se aggiungerlo al diario.')}</Body>
      <Btn title={tl('Scansiona')} onPress={() => setOpen(true)} />
      <BarcodeSheet visible={open} onClose={() => { setOpen(false); goBack(); }} />
    </Page>
  );
}
