import { useState } from 'react';
import { Image, View } from 'react-native';

import { DayField } from '@/components/work/DayField';
import { Body, Btn, Input, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { DEFAULT_MONTHS, INSURANCE_KINDS, answer, coverage, durationLabel, expiryOf, validDay, withCoverage, type Insurance, type Purchase, type Question, type WProduct } from '@/lib/warranty';
import { toast } from '@/store/toast';

const LEGAL = [12, 24];
const EXTRA = [0, 12, 24, 36, 48];
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const pid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
type Draft = Omit<WProduct, 'price'> & { price: string };

/** Controlla e correggi quello che Theia ha letto (o scrivi tutto a mano). Per ogni prodotto: nome, dati e durata della garanzia. */
export function WarrantyEditor({ purchase, preview, onSave, onClose, notice, questions }: { purchase: Purchase; preview?: string; onSave: (p: Purchase) => void; onClose: () => void; notice?: string; questions?: Question[] }) {
  const [store, setStore] = useState(purchase.store); const [date, setDate] = useState(purchase.date); const [cur, setCur] = useState(purchase.currency); const [total, setTotal] = useState(purchase.total != null ? String(purchase.total) : '');
  const [items, setItems] = useState<Draft[]>(purchase.products.length ? purchase.products.map((x) => ({ ...x, price: x.price != null ? String(x.price) : '' })) : [{ id: pid(), name: '', months: DEFAULT_MONTHS, price: '' }]);
  const [qs, setQs] = useState<Question[]>(questions ?? []); const [notes, setNotes] = useState<string[]>([]); const [why, setWhy] = useState<Record<string, string>>({}); const [open, setOpen] = useState<string | null>(null);
  const reply = (q: Question, opt: string) => { const a = answer(items, qs, q.id, opt, why[q.id]); setItems(a.items); setQs(a.qs); if (a.note) setNotes((n) => [...n, a.note!]); setOpen(null); };
  const set = (i: number, p: Partial<Draft>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const doSave = () => {
    const prods = items.filter((x) => x.name.trim());
    if (!prods.length) { toast('Scrivi il nome di almeno un prodotto'); return; }
    if (!validDay(date)) { toast('Scegli la data di acquisto'); return; }
    const note = [purchase.note, ...notes, ...qs.map((q) => `Da chiarire: «${q.line ?? q.item.name ?? ''}»`)].filter(Boolean).join('\n'); onSave({ ...purchase, ...(note ? { note } : {}), store: store.trim(), date, currency: cur, ...(num(total) >= 0 ? { total: num(total) } : { total: undefined }), products: prods.map((x) => ({ id: x.id, name: x.name.trim(), months: x.months, legal: coverage(x).legal, ...(x.ins?.name?.trim() ? { ins: { ...x.ins, name: x.ins.name.trim() } } : {}), ...(coverage(x).extended && (x.ext?.by?.trim() || x.ext?.name || x.ext?.cost != null) ? { ext: { ...(x.ext?.by?.trim() ? { by: x.ext.by.trim() } : {}), ...(x.ext?.name ? { name: x.ext.name } : {}), ...(x.ext?.cost != null ? { cost: x.ext.cost } : {}) } } : {}), ...(x.assumed ? { assumed: true } : {}), ...(x.brand?.trim() ? { brand: x.brand.trim() } : {}), ...(x.model?.trim() ? { model: x.model.trim() } : {}), ...(x.serial?.trim() ? { serial: x.serial.trim() } : {}), ...(num(x.price) >= 0 ? { price: num(x.price) } : {}) })) });
  };
  const save = () => { if (qs.length) alertT('Ci sono cose da chiarire', `${qs.length} ${qs.length === 1 ? 'voce' : 'voci'} del documento non chiare. Se salvi ora le segno nelle note.`, [{ text: 'Torna', style: 'cancel' }, { text: 'Salva lo stesso', onPress: doSave }]); else doSave(); };
  return (
    <Sheet visible title="Dati della garanzia" onClose={onClose}>
      {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: 140, borderRadius: 12, marginBottom: 10 }} resizeMode="cover" accessibilityLabel={tl('Documento')} /> : null}
      {notice ? <Body small muted style={{ marginBottom: 8 }}>{notice}</Body> : null}
      {qs.length ? (
        <View style={{ marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)', gap: 12 }}>
          <Body bold>{tl('Da chiarire ({0})', qs.length)}</Body>
          {qs.map((q) => (
            <View key={q.id}>
              <Body>{q.text}</Body>
              {q.line ? <Body small muted>{`${tl('Sul documento leggo')}: «${q.line}»`}</Body> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>{q.options.map((o) => <Pill key={o.id} label={o.label} onPress={() => reply(q, o.id)} />)}<Pill label={tl('Spiego io')} on={open === q.id} onPress={() => setOpen(open === q.id ? null : q.id)} /></View>
              {open === q.id ? <View style={{ marginTop: 6 }}><Input placeholder="Scrivi cos'è" value={why[q.id] ?? ''} onChangeText={(v) => setWhy({ ...why, [q.id]: v })} maxLines={3} /><Btn small title="Conferma" onPress={() => reply(q, 'spiega')} /></View> : null}
            </View>
          ))}
        </View>
      ) : null}
      <Input placeholder="Negozio o venditore" value={store} onChangeText={setStore} />
      <DayField value={date} onChange={setDate} placeholder="Data di acquisto" />
      <Row><Input flex={2} placeholder="Totale pagato (facoltativo)" keyboardType="numeric" value={total} onChangeText={setTotal} /><Pill label="EUR" on={cur === 'EUR'} onPress={() => setCur('EUR')} /><Pill label="CHF" on={cur === 'CHF'} onPress={() => setCur('CHF')} /></Row>
      {items.map((x, i) => (
        <View key={x.id} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.3)' }}>
          <Row><Body small bold muted style={{ flex: 1 }}>{`${tl('PRODOTTO').toUpperCase()} ${i + 1}`}</Body>{items.length > 1 ? <Btn small ghost danger icon="trash" title="" onPress={() => setItems(items.filter((_, k) => k !== i))} /> : null}</Row>
          <Input placeholder="Nome del prodotto" value={x.name} onChangeText={(v) => set(i, { name: v })} />
          <Row><Input flex={1} placeholder="Marca" value={x.brand ?? ''} onChangeText={(v) => set(i, { brand: v })} /><Input flex={1} placeholder="Modello" value={x.model ?? ''} onChangeText={(v) => set(i, { model: v })} /></Row>
          <Row><Input flex={1} placeholder="Numero di serie" value={x.serial ?? ''} onChangeText={(v) => set(i, { serial: v })} /><Input flex={1} placeholder="Prezzo" keyboardType="numeric" value={x.price} onChangeText={(v) => set(i, { price: v })} /></Row>
          {(() => { const cv = coverage(x); const exp = validDay(date) ? expiryOf(date, x.months) : null; return (
            <>
              <Body small bold muted style={{ marginBottom: 6 }}>{tl('GARANZIA LEGALE').toUpperCase()}</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LEGAL.map((m) => <Pill key={m} label={durationLabel(m)} on={cv.legal === m} onPress={() => setItems(items.map((y, k) => (k === i ? { ...withCoverage(y, m, cv.extra), price: y.price } : y)))} />)}{!LEGAL.includes(cv.legal) ? <Pill label={durationLabel(cv.legal)} on /> : null}</View>
              {x.assumed ? <Body small style={{ color: '#f59e0b', marginTop: 4 }}>{tl('Sul documento non c\'è una durata: per legge vale la garanzia legale (di solito 24 mesi). Se hai un\'estensione, aggiungila qui sotto.')}</Body> : null}
              <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('ESTENSIONE DI GARANZIA (SE C\'È)').toUpperCase()}</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{EXTRA.map((m) => <Pill key={m} label={m ? `+${durationLabel(m)}` : tl('Nessuna')} on={cv.extra === m} onPress={() => setItems(items.map((y, k) => (k === i ? { ...withCoverage(y, cv.legal, m), price: y.price, ...(m ? {} : { ext: undefined }) } : y)))} />)}{!EXTRA.includes(cv.extra) ? <Pill label={`+${durationLabel(cv.extra)}`} on /> : null}</View>
              <Row style={{ marginTop: 6 }}><Input flex={1} placeholder="Oppure mesi in più" keyboardType="numeric" value="" onChangeText={(v) => { const n = parseInt(v, 10); if (n >= 1 && n <= 96) setItems(items.map((y, k) => (k === i ? { ...withCoverage(y, cv.legal, n), price: y.price } : y))); }} /></Row>
              {cv.extended ? <Row><Input flex={1} placeholder="Chi la dà (produttore, negozio…)" value={x.ext?.by ?? ''} onChangeText={(v) => set(i, { ext: { ...x.ext, by: v } })} /><Input flex={1} placeholder="Costo dell\'estensione" keyboardType="numeric" value={x.ext?.cost != null ? String(x.ext.cost) : ''} onChangeText={(v) => set(i, { ext: { ...x.ext, ...(num(v) >= 0 ? { cost: num(v) } : { cost: undefined }) } })} /></Row> : null}
              <Body small bold style={{ marginTop: 8 }}>{exp ? `${tl('Dura in tutto')} ${durationLabel(x.months)} · ${tl('scade il')} ${new Date(exp + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : `${tl('Dura in tutto')} ${durationLabel(x.months)}`}</Body>
            </>
          ); })()}
          <Body small bold muted style={{ marginTop: 12, marginBottom: 6 }}>{tl('ASSICURAZIONE (SE C\'È)').toUpperCase()}</Body>
          <Body small muted style={{ marginBottom: 6 }}>{tl('È diversa dalla garanzia: copre furto o danni. Se sullo scontrino c\'è, segnala qui.')}</Body>
          {x.ins ? (
            <>
              <Input placeholder="Nome dell'assicurazione" value={x.ins.name} onChangeText={(v) => set(i, { ins: { ...x.ins!, name: v } })} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{INSURANCE_KINDS.map((k) => <Pill key={k} label={tl(k)} on={x.ins!.kind === k} onPress={() => set(i, { ins: { ...x.ins!, kind: k } })} />)}</View>
              <Row><Input flex={1} placeholder="Chi la dà" value={x.ins.by ?? ''} onChangeText={(v) => set(i, { ins: { ...x.ins!, by: v } })} /><Input flex={1} placeholder="Costo" keyboardType="numeric" value={x.ins.cost != null ? String(x.ins.cost) : ''} onChangeText={(v) => set(i, { ins: { ...x.ins!, cost: num(v) >= 0 ? num(v) : undefined } as Insurance })} /></Row>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>{[0, 12, 24, 36].map((m) => <Pill key={m} label={m ? durationLabel(m) : tl('Durata non nota')} on={(x.ins!.months ?? 0) === m} onPress={() => set(i, { ins: { ...x.ins!, months: m || undefined } as Insurance })} />)}</View>
              <Btn small ghost danger title="Togli l'assicurazione" onPress={() => set(i, { ins: undefined })} />
            </>
          ) : <View style={{ alignSelf: 'flex-start' }}><Btn small ghost icon="plus" title="Aggiungi un'assicurazione" onPress={() => set(i, { ins: { name: 'Assicurazione', kind: 'altro' } })} /></View>}
        </View>
      ))}
      <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small ghost icon="plus" title="Un altro prodotto" onPress={() => setItems([...items, { id: pid(), name: '', months: DEFAULT_MONTHS, price: '' }])} /></View>
      <View style={{ height: 12 }} /><Btn icon="check" title="Salva la garanzia" onPress={save} />
      <Body small muted style={{ marginTop: 8 }}>{tl('La garanzia conta dalla data di acquisto. Per legge i beni di consumo nuovi hanno di solito 24 mesi; se la garanzia è stata prolungata, scrivi l\'estensione: è importante.')}</Body>
    </Sheet>
  );
}
