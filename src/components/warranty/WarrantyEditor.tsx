import { useState } from 'react';
import { Image, View } from 'react-native';

import { DayField } from '@/components/work/DayField';
import { Body, Btn, Input, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { DEFAULT_MONTHS, durationLabel, validDay, type Purchase, type WProduct } from '@/lib/warranty';
import { toast } from '@/store/toast';

const MONTHS = [12, 24, 36, 48, 60];
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const pid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
type Draft = Omit<WProduct, 'price'> & { price: string };

/** Controlla e correggi quello che Theia ha letto (o scrivi tutto a mano). Per ogni prodotto: nome, dati e durata della garanzia. */
export function WarrantyEditor({ purchase, preview, onSave, onClose, notice }: { purchase: Purchase; preview?: string; onSave: (p: Purchase) => void; onClose: () => void; notice?: string }) {
  const [store, setStore] = useState(purchase.store); const [date, setDate] = useState(purchase.date); const [cur, setCur] = useState(purchase.currency); const [total, setTotal] = useState(purchase.total != null ? String(purchase.total) : '');
  const [items, setItems] = useState<Draft[]>(purchase.products.length ? purchase.products.map((x) => ({ ...x, price: x.price != null ? String(x.price) : '' })) : [{ id: pid(), name: '', months: DEFAULT_MONTHS, price: '' }]);
  const set = (i: number, p: Partial<Draft>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const save = () => {
    const prods = items.filter((x) => x.name.trim());
    if (!prods.length) { toast('Scrivi il nome di almeno un prodotto'); return; }
    if (!validDay(date)) { toast('Scegli la data di acquisto'); return; }
    onSave({ ...purchase, store: store.trim(), date, currency: cur, ...(num(total) >= 0 ? { total: num(total) } : { total: undefined }), products: prods.map((x) => ({ id: x.id, name: x.name.trim(), months: x.months, ...(x.assumed ? { assumed: true } : {}), ...(x.brand?.trim() ? { brand: x.brand.trim() } : {}), ...(x.model?.trim() ? { model: x.model.trim() } : {}), ...(x.serial?.trim() ? { serial: x.serial.trim() } : {}), ...(num(x.price) >= 0 ? { price: num(x.price) } : {}) })) });
  };
  return (
    <Sheet visible title="Dati della garanzia" onClose={onClose}>
      {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: 140, borderRadius: 12, marginBottom: 10 }} resizeMode="cover" accessibilityLabel={tl('Documento')} /> : null}
      {notice ? <Body small muted style={{ marginBottom: 8 }}>{notice}</Body> : null}
      <Input placeholder="Negozio o venditore" value={store} onChangeText={setStore} />
      <DayField value={date} onChange={setDate} placeholder="Data di acquisto" />
      <Row><Input flex={2} placeholder="Totale pagato (facoltativo)" keyboardType="numeric" value={total} onChangeText={setTotal} /><Pill label="EUR" on={cur === 'EUR'} onPress={() => setCur('EUR')} /><Pill label="CHF" on={cur === 'CHF'} onPress={() => setCur('CHF')} /></Row>
      {items.map((x, i) => (
        <View key={x.id} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.3)' }}>
          <Row><Body small bold muted style={{ flex: 1 }}>{`${tl('PRODOTTO').toUpperCase()} ${i + 1}`}</Body>{items.length > 1 ? <Btn small ghost danger icon="trash" title="" onPress={() => setItems(items.filter((_, k) => k !== i))} /> : null}</Row>
          <Input placeholder="Nome del prodotto" value={x.name} onChangeText={(v) => set(i, { name: v })} />
          <Row><Input flex={1} placeholder="Marca" value={x.brand ?? ''} onChangeText={(v) => set(i, { brand: v })} /><Input flex={1} placeholder="Modello" value={x.model ?? ''} onChangeText={(v) => set(i, { model: v })} /></Row>
          <Row><Input flex={1} placeholder="Numero di serie" value={x.serial ?? ''} onChangeText={(v) => set(i, { serial: v })} /><Input flex={1} placeholder="Prezzo" keyboardType="numeric" value={x.price} onChangeText={(v) => set(i, { price: v })} /></Row>
          <Body small bold muted style={{ marginBottom: 6 }}>{tl('DURATA DELLA GARANZIA').toUpperCase()}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MONTHS.map((m) => <Pill key={m} label={durationLabel(m)} on={x.months === m} onPress={() => set(i, { months: m, assumed: false })} />)}{!MONTHS.includes(x.months) ? <Pill label={durationLabel(x.months)} on /> : null}</View>
          <Row style={{ marginTop: 6 }}><Input flex={1} placeholder="Oppure scrivi i mesi" keyboardType="numeric" value="" onChangeText={(v) => { const n = parseInt(v, 10); if (n >= 1 && n <= 120) set(i, { months: n, assumed: false }); }} /></Row>
          {x.assumed ? <Body small style={{ color: '#f59e0b' }}>{tl('Sul documento non ho trovato la durata: ho messo 24 mesi (la garanzia legale tipica). Controlla e correggi.')}</Body> : null}
        </View>
      ))}
      <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small ghost icon="plus" title="Un altro prodotto" onPress={() => setItems([...items, { id: pid(), name: '', months: DEFAULT_MONTHS, price: '' }])} /></View>
      <View style={{ height: 12 }} /><Btn icon="check" title="Salva la garanzia" onPress={save} />
      <Body small muted style={{ marginTop: 8 }}>{tl('La durata vale dalla data di acquisto. Per i beni nuovi di solito è di 24 mesi, ma controlla il tuo documento.')}</Body>
    </Sheet>
  );
}
