import { useState } from 'react';
import { View } from 'react-native';

import { LpTag } from '@/components/network';
import { Body, Btn, Card, Empty, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDate } from '@/i18n/format';
import { go } from '@/lib/nav';
import { RETURN_DAYS, STATUS_LABEL, canReturn, statusAt } from '@/lib/shop';
import { openShopChat, requestReturn } from '@/lib/shopActions';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/** I miei ordini: stato, chat con il negozio e richiesta di reso. */
export default function Orders() {
  const t = useTheme();
  const orders = useNet((s) => s.orders) ?? [];
  const [ret, setRet] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const now = Date.now();
  return (
    <Page id="orders" back title="I miei ordini">
      {orders.length === 0 ? <Card><Empty text="Non hai ancora ordini. Li trovi qui dopo il primo acquisto in un negozio." /></Card> : orders.map((o) => {
        const st = statusAt(o, now);
        return (
          <Card key={o.id}>
            <Row>
              <View style={{ flex: 1 }}><Body bold>{o.qty} × {o.name}</Body><Body small muted>{o.shop} · {fmtDate(new Date(o.ts), { day: 'numeric', month: 'long' })}</Body></View>
              <Pill label={STATUS_LABEL[st]} on={st === 'consegnato'} />
            </Row>
            <Row style={{ marginTop: 6 }}>
              <Body small muted>{o.credit > 0 ? tl('Pagati {0} LP (sconto {1} LP)', o.paid, o.credit) : tl('Pagati {0} LP', o.paid)}</Body>
              <LpTag size={12} />
            </Row>
            <Row style={{ marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
              <Btn small ghost icon="comment" title="Chat con il negozio" onPress={() => go('conversationPage', { id: openShopChat(o.shop) })} />
              {canReturn(o, now) && <Btn small ghost icon="repeat" title="Richiedi il reso" onPress={() => { setWhy(''); setRet(o.id); }} />}
            </Row>
            {st === 'consegnato' && !canReturn(o, now) && <Body small color={t.muted} style={{ marginTop: 6 }}>{tl('Il reso era possibile entro {0} giorni dalla consegna.', RETURN_DAYS)}</Body>}
          </Card>
        );
      })}
      <Sheet visible={!!ret} title="Richiedi il reso" onClose={() => setRet(null)}>
        <Body small muted>Scrivi il motivo: la richiesta arriva al negozio nella vostra chat.</Body>
        <Input multiline maxLines={4} placeholder="Motivo del reso" value={why} onChangeText={setWhy} />
        <Btn title="Invia la richiesta" onPress={() => { if (ret && requestReturn(ret, why)) { toast('Richiesta inviata al negozio'); setRet(null); } }} />
      </Sheet>
    </Page>
  );
}
