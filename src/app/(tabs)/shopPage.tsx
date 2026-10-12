import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { LpTag, UserAvatar } from '@/components/network';
import { Body, Btn, Card, Empty, Input, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { applyCredit } from '@/lib/shop';
import { addProduct, buyProduct, creditFor, openShopChat, productsOf, removeProduct, restoreProduct } from '@/lib/shopActions';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';

/** Negozio di un profilo: prodotti acquistabili con LifePoints, spediti direttamente dal negozio. Il titolare aggiunge i prodotti. */
export default function ShopPage() {
  const t = useTheme();
  const { name: param } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const shop = param || me;
  const isMe = shop === me;
  useNet((s) => s.products);
  const balance = useNet((s) => s.lifePoints);
  useNet((s) => s.shopCredits);
  const products = productsOf(shop);
  const credit = creditFor(shop);
  const [openId, setOpenId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [nm, setNm] = useState(''); const [ds, setDs] = useState(''); const [pr, setPr] = useState(''); const [st, setSt] = useState('1');
  const prod = products.find((p) => p.id === openId);
  const total = prod ? prod.price * qty : 0;
  const { used, pay } = applyCredit(total, credit);
  const lp = (n: number, size = 14, bold = true) => <Row gap={2}><Text style={{ color: t.text, fontSize: size + 1, fontWeight: bold ? '800' : '500' }}>{n}</Text><LpTag size={size} /></Row>;

  return (
    <Page id="shopPage" back title={isMe ? 'Il tuo negozio' : `Negozio di ${shop}`}>
      <Row style={{ justifyContent: 'flex-start' }} gap={12}>
        <UserAvatar name={shop} size={46} />
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => go('userProfile', { name: shop })}><Text style={{ color: t.text, fontWeight: '800', fontSize: 17 }}>{shop}</Text></Pressable>
          <Body small muted>Si paga solo con LifePoints. Spedisce direttamente il negozio.</Body>
        </View>
        {!isMe && <Btn small ghost icon="comment" title="Scrivi" onPress={() => go('conversationPage', { id: openShopChat(shop) })} />}
      </Row>
      {!isMe && credit > 0 && (
        <Card accent={t.positive}><Row><Icon name="check" size={18} color={t.positive} /><Body style={{ flex: 1 }}>{tl('Hai {0} LP di sconto da usare qui, grazie ai tuoi contributi alle idee.', credit)}</Body></Row></Card>
      )}
      {isMe && <Btn style={{ marginTop: 12 }} icon="plus" title="Aggiungi un prodotto" onPress={() => setAddOpen(true)} />}
      <Btn small ghost icon="file" style={{ marginTop: 8, alignSelf: 'flex-start' }} title="I miei ordini" onPress={() => go('orders')} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
        {products.length === 0 ? <View style={{ width: '100%' }}><Empty text={isMe ? 'Il tuo negozio è vuoto: aggiungi il primo prodotto.' : 'Questo negozio non ha ancora prodotti.'} /></View> : products.map((p) => (
          <Pressable key={p.id} onPress={() => { setOpenId(p.id); setQty(1); }} accessibilityRole="button" accessibilityLabel={`${p.name} ${p.price} LifePoints`} style={{ width: '47.5%', backgroundColor: t.card, borderRadius: 18, overflow: 'hidden', borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
            <View style={{ height: 110, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>{p.name.trim().charAt(0).toUpperCase()}</Text></View>
            <View style={{ padding: 10, gap: 4 }}>
              <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '700', minHeight: 36 }}>{p.name}</Text>
              <Row>{lp(p.price)}<Text style={{ color: p.stock > 0 ? t.muted : t.danger, fontSize: 11.5 }}>{p.stock > 0 ? tl('{0} disp.', p.stock) : 'Esaurito'}</Text></Row>
            </View>
          </Pressable>
        ))}
      </View>

      <Sheet visible={!!prod} title={prod?.name ?? ''} onClose={() => setOpenId(null)}>
        {prod ? (
          <>
            <View style={{ height: 120, borderRadius: 16, backgroundColor: prod.color, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><Text style={{ color: '#fff', fontSize: 44, fontWeight: '800' }}>{prod.name.trim().charAt(0).toUpperCase()}</Text></View>
            {prod.desc ? <Body>{prod.desc}</Body> : null}
            {isMe ? (
              <Btn style={{ marginTop: 12 }} ghost danger icon="trash" title="Togli dal negozio" onPress={() => { const p = prod; setOpenId(null); confirmDelete(`il prodotto «${p.name}»`, () => removeProduct(p.id), () => restoreProduct(p)); }} />
            ) : (
              <>
                <Row style={{ marginTop: 12 }}>
                  <Body muted>Quantità</Body>
                  <Row gap={14}>
                    <Pressable onPress={() => setQty(Math.max(1, qty - 1))} accessibilityLabel="Meno" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={16} color={t.text} /></Pressable>
                    <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{qty}</Text>
                    <Pressable onPress={() => setQty(Math.min(prod.stock, qty + 1))} accessibilityLabel="Più" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={t.text} /></Pressable>
                  </Row>
                </Row>
                <Input placeholder="Indirizzo di spedizione" value={address} onChangeText={setAddress} />
                <Row><Body muted>Prezzo</Body>{lp(total)}</Row>
                {used > 0 && <Row><Body muted>Sconto da contributo</Body><Row gap={2}><Text style={{ color: t.positive, fontWeight: '800' }}>-{used}</Text><LpTag size={13} /></Row></Row>}
                <Row><Body bold>Da pagare</Body>{lp(pay, 16)}</Row>
                <Body small muted>{tl('Il tuo saldo: {0} LP', balance)}</Body>
                <Btn style={{ marginTop: 12 }} disabled={prod.stock === 0} title={prod.stock === 0 ? 'Esaurito' : 'Compra con LifePoints'} onPress={() => {
                  const r = buyProduct(prod.id, qty, address);
                  toast(r.message);
                  if (r.ok) { setOpenId(null); go('orders'); }
                }} />
                <Body small muted style={{ marginTop: 8 }}>Dopo l'acquisto si apre una chat con il negozio per spedizione, resi e assistenza.</Body>
              </>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={addOpen} title="Nuovo prodotto" onClose={() => setAddOpen(false)}>
        <Input placeholder="Nome del prodotto" maxLength={60} value={nm} onChangeText={setNm} />
        <Input multiline maxLines={4} placeholder="Descrizione" value={ds} onChangeText={setDs} />
        <Input keyboardType="decimal-pad" placeholder="Prezzo in LifePoints" value={pr} onChangeText={setPr} />
        <Input keyboardType="number-pad" placeholder="Quanti ne hai" value={st} onChangeText={setSt} />
        <Btn title="Aggiungi al negozio" onPress={() => {
          const err = addProduct(shop, { name: nm, desc: ds, price: parseFloat(pr.replace(',', '.')), stock: parseInt(st, 10) });
          if (err) { toast(err); return; }
          setNm(''); setDs(''); setPr(''); setSt('1'); setAddOpen(false); toast('Prodotto aggiunto');
        }} />
      </Sheet>
    </Page>
  );
}
