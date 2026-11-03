import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Image, Platform, ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, H, Input, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { isBarcode, offUrl, parseOff, type OffFood } from '@/lib/fitness/barcode';
import { RISK_LABEL, healthScore, parseDetails, type ProductDetails } from '@/lib/fitness/foodDetails';
import { macrosFor, type Food } from '@/lib/fitness/nutrition';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** Scansione del codice a barre di un prodotto: lo cerca su Open Food Facts (gratis) e lo aggiunge al diario con i grammi che scegli. */
export function BarcodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [perm, ask] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const th = useTheme();
  const [food, setFood] = useState<OffFood | null>(null);
  const [det, setDet] = useState<ProductDetails | null>(null);
  const [grams, setGrams] = useState('100');
  const [note, setNote] = useState('');
  const done = useRef(false);

  const lookup = async (code: string) => {
    if (!isBarcode(code)) { setNote(tl('Il codice deve avere da 8 a 14 cifre.')); done.current = false; return; }
    setBusy(true); setNote('');
    try {
      const ctl = new AbortController(); const h = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(offUrl(code), { signal: ctl.signal }); clearTimeout(h);
      const json = await r.json();
      const f = parseOff(code, json); setDet(parseDetails(code.trim(), json));
      if (!f) { setNote(tl('Non trovo questo prodotto o mancano i valori nutrizionali. Puoi aggiungerlo a mano.')); done.current = false; }
      else { setFood(f); setGrams(String(f.portion)); }
    } catch { setNote(tl('Non riesco a cercarlo adesso: controlla la connessione e riprova.')); done.current = false; }
    setBusy(false);
  };
  const close = () => { setFood(null); setDet(null); setNote(''); setManual(''); done.current = false; onClose(); };
  const add = () => {
    if (!food) return;
    const g = Math.max(1, parseFloat(grams.replace(',', '.')) || food.portion);
    const fit = useFitness.getState();
    const f: Food = { id: food.id, name: food.name, kcal: food.kcal, p: food.p, c: food.c, f: food.f, portion: food.portion, cat: food.cat, ...(food.fib != null ? { fib: food.fib } : {}), ...(food.sat != null ? { sat: food.sat } : {}), ...(food.sug != null ? { sug: food.sug } : {}), ...(food.salt != null ? { salt: food.salt } : {}) };
    if (!fit.aiFoods.some((x) => x.id === f.id)) useFitness.setState({ aiFoods: [...fit.aiFoods, f] });
    fit.addMeal({ ts: Date.now(), name: f.name, foodId: f.id, grams: g, macros: macrosFor(f, g) });
    toast(tl('Aggiunto al diario'));
    close();
  };

  const score = det ? healthScore(det) : null;
  return (
    <Sheet visible={visible} title={tl('Controlla o aggiungi un alimento')} onClose={close}>
      {food ? (
        <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {det?.image ? <Image source={{ uri: det.image }} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: th.card }} resizeMode="contain" /> : null}
            <View style={{ flex: 1 }}>
              <H>{det?.name ?? food.name}</H>
              <Body small muted>{[det?.brand, det?.quantity, ...(det?.categories ?? []).slice(0, 2)].filter(Boolean).join(' · ')}</Body>
            </View>
          </View>
          {score ? (
            <View style={{ backgroundColor: th.card, borderRadius: 18, borderWidth: 1, borderColor: th.border, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 7, borderColor: score.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontSize: 28, fontWeight: '800' }}>{score.score}</Text><Text style={{ color: th.muted, fontSize: 10, marginTop: -2 }}>su 100</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: score.color, fontSize: 20, fontWeight: '800' }}>{tl(score.label)}</Text><Body small muted>{tl('Quanto è sano: equilibrio dei nutrienti, lavorazione, additivi e come è prodotto.')}</Body></View>
              </View>
              {score.parts.map((p) => (
                <View key={p.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: th.text, fontSize: 13, fontWeight: '700' }}>{tl(p.label)}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${tl(p.note)} · ${p.value}`}</Text></View>
                  <View style={{ height: 6, backgroundColor: th.border, borderRadius: 3, marginTop: 4 }}><View style={{ width: `${p.value}%`, height: 6, borderRadius: 3, backgroundColor: p.value >= 65 ? '#3fbf8a' : p.value >= 40 ? '#e0c97b' : '#e0615f' }} /></View>
                </View>
              ))}
              {score.capped ? <Body small muted>{tl(score.capped)}</Body> : null}
              {score.confidence < 70 ? <Body small muted>{tl('Dati incompleti su Open Food Facts: il voto è meno sicuro.')}</Body> : null}
            </View>
          ) : null}
          {score && (score.good.length || score.bad.length) ? (
            <View style={{ gap: 6 }}>
              {score.good.map((x) => <Body key={x} small color="#3fbf8a">{`+ ${tl(x)}`}</Body>)}
              {score.bad.map((x) => <Body key={x} small color="#e0615f">{`− ${tl(x)}`}</Body>)}
            </View>
          ) : null}
          <Sec title={tl('Valori per 100 g')}>
            <Body small>{tl('Calorie {0} kcal · proteine {1} g · carboidrati {2} g · grassi {3} g', food.kcal, food.p, food.c, food.f)}</Body>
            <Body small muted>{[det?.per100.sugars != null ? tl('di cui zuccheri {0} g', det.per100.sugars) : '', det?.per100.sat != null ? tl('grassi saturi {0} g', det.per100.sat) : '', det?.per100.mono != null ? tl('monoinsaturi {0} g', det.per100.mono) : '', det?.per100.poly != null ? tl('polinsaturi {0} g', det.per100.poly) : '', det?.per100.fiber != null ? tl('fibre {0} g', det.per100.fiber) : '', det?.per100.salt != null ? tl('sale {0} g', det.per100.salt) : '', det?.per100.chol != null ? tl('colesterolo {0} g', det.per100.chol) : ''].filter(Boolean).join(' · ')}</Body>
            {det && Object.keys(det.levels).length ? <Body small muted>{(['fat', 'saturated-fat', 'sugars', 'salt'] as const).filter((k) => det.levels[k]).map((k) => `${tl({ fat: 'Grassi', 'saturated-fat': 'Saturi', sugars: 'Zuccheri', salt: 'Sale' }[k])}: ${tl({ low: 'bassi', moderate: 'medi', high: 'alti' }[det.levels[k]!])}`).join(' · ')}</Body> : null}
            {det?.micros.length ? <Body small muted>{det.micros.map((m) => `${tl(m.name)} ${m.value} ${m.unit}`).join(' · ')}</Body> : null}
          </Sec>
          {det?.ingredients ? <Sec title={tl('Ingredienti')}><Body small>{det.ingredients}</Body><Body small muted>{[det.palmOil === true ? tl('Contiene olio di palma') : det.palmOil === false ? tl('Senza olio di palma') : '', det.vegan === true ? tl('Vegano') : det.vegetarian === true ? tl('Vegetariano') : '', det.ingredientsCount ? tl('{0} ingredienti', det.ingredientsCount) : ''].filter(Boolean).join(' · ')}</Body></Sec> : null}
          {det?.additives.length ? <Sec title={tl('Additivi ({0})', det.additives.length)}>{det.additives.map((a) => <View key={a.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ['#3fbf8a', '#e0c97b', '#e8955f', '#e0615f'][a.risk] }} /><Body small style={{ flex: 1 }}>{`${a.code} · ${tl(a.name)}`}</Body><Body small muted>{tl(RISK_LABEL[a.risk]!)}</Body></View>)}<Body small muted>{tl('Il giudizio sugli additivi è orientativo (EFSA, normative UE): non è un parere medico.')}</Body></Sec> : null}
          {det && (det.allergens.length || det.traces.length) ? <Sec title={tl('Allergeni')}>{det.allergens.length ? <Body small>{tl('Contiene: {0}', det.allergens.join(', '))}</Body> : null}{det.traces.length ? <Body small muted>{tl('Può contenere tracce di: {0}', det.traces.join(', '))}</Body> : null}</Sec> : null}
          {det?.labels.length ? <Sec title={tl('Etichette')}><Body small>{det.labels.join(' · ')}</Body></Sec> : null}
          {det && (det.origins || det.places || det.countries.length || det.packaging || det.eco) ? (
            <Sec title={tl('Provenienza, imballaggio e ambiente')}>
              {det.origins ? <Body small>{tl('Origine degli ingredienti: {0}', det.origins)}</Body> : null}
              {det.places ? <Body small>{tl('Prodotto a: {0}', det.places)}</Body> : null}
              {det.countries.length ? <Body small muted>{tl('Venduto in: {0}', det.countries.join(', '))}</Body> : null}
              {det.packaging ? <Body small muted>{tl('Imballaggio: {0}', det.packaging)}</Body> : null}
              {det.eco ? <Body small>{tl('Impatto ambientale (Eco-Score): {0}', det.eco.grade ?? Math.round(det.eco.score ?? 0))}</Body> : null}
            </Sec>
          ) : null}
          <Body small muted>{tl('Il voto è un indice di LifePilot costruito su dati pubblici di Open Food Facts, che possono avere errori. Non misura i residui di pesticidi: come è stato coltivato lo desumiamo solo dall\'etichetta bio. Non sostituisce il parere di un medico o di un nutrizionista.')}</Body>
          <Input value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder={tl('Grammi')} />
          <Btn title={tl('Aggiungi al diario')} onPress={add} />
          <Btn ghost title={tl('Solo controllo: non aggiungere')} onPress={close} />
          <Btn ghost small title={tl('Scansiona un altro')} onPress={() => { setFood(null); setDet(null); done.current = false; }} />
        </ScrollView>
      ) : (
        <View style={{ gap: 10 }}>
          {Platform.OS !== 'web' && perm?.granted ? (
            <View style={{ height: 240, borderRadius: 18, overflow: 'hidden' }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                onBarcodeScanned={(r) => { if (done.current || busy) return; done.current = true; void lookup(r.data); }} />
            </View>
          ) : Platform.OS !== 'web' ? (
            <Btn title={tl('Consenti la fotocamera')} onPress={() => { void ask(); }} />
          ) : null}
          <Body small muted>{tl('Oppure scrivi il numero sotto il codice a barre:')}</Body>
          <Input value={manual} onChangeText={setManual} keyboardType="number-pad" placeholder="8076809513722" />
          <Btn ghost disabled={busy || !manual.trim()} title={busy ? tl('Cerco…') : tl('Cerca')} onPress={() => void lookup(manual)} />
          {note ? <Body small>{note}</Body> : null}
          <Body small muted>{tl('Dati di Open Food Facts (archivio libero). Possono avere errori: controlla i valori.')}</Body>
        </View>
      )}
    </Sheet>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  const th = useTheme();
  return <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: th.border, paddingTop: 10 }}><Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{title}</Text>{children}</View>;
}
