import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn, H, Input, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { isBarcode, offUrl, parseOff, type OffFood } from '@/lib/fitness/barcode';
import { macrosFor, type Food } from '@/lib/fitness/nutrition';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** Scansione del codice a barre di un prodotto: lo cerca su Open Food Facts (gratis) e lo aggiunge al diario con i grammi che scegli. */
export function BarcodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [perm, ask] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [food, setFood] = useState<OffFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [note, setNote] = useState('');
  const done = useRef(false);

  const lookup = async (code: string) => {
    if (!isBarcode(code)) { setNote(tl('Il codice deve avere da 8 a 14 cifre.')); done.current = false; return; }
    setBusy(true); setNote('');
    try {
      const ctl = new AbortController(); const h = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(offUrl(code), { signal: ctl.signal }); clearTimeout(h);
      const f = parseOff(code, await r.json());
      if (!f) { setNote(tl('Non trovo questo prodotto o mancano i valori nutrizionali. Puoi aggiungerlo a mano.')); done.current = false; }
      else { setFood(f); setGrams(String(f.portion)); }
    } catch { setNote(tl('Non riesco a cercarlo adesso: controlla la connessione e riprova.')); done.current = false; }
    setBusy(false);
  };
  const close = () => { setFood(null); setNote(''); setManual(''); done.current = false; onClose(); };
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

  return (
    <Sheet visible={visible} title={tl('Scansiona un prodotto')} onClose={close}>
      {food ? (
        <View style={{ gap: 10 }}>
          <H>{food.name}</H>
          <Body small muted>{tl('Per 100 g: {0} kcal · proteine {1} g · carboidrati {2} g · grassi {3} g', food.kcal, food.p, food.c, food.f)}</Body>
          <Input value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder={tl('Grammi')} />
          <Btn title={tl('Aggiungi al diario')} onPress={add} />
          <Btn ghost small title={tl('Scansiona un altro')} onPress={() => { setFood(null); done.current = false; }} />
        </View>
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
