import { useState } from 'react';
import { View } from 'react-native';

import { AiNote } from '@/components/AiNote';
import { FormHead, AmountField, Segments } from '@/components/formKit';
import { Body, Btn, Input, Row, Sheet } from '@/components/ui';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { movementLabel } from '@/lib/csvImport';
import { saveMediaToDrive } from '@/lib/driveSave';
import { pickNetMedia, takeNetPhoto } from '@/lib/netMedia';
import { RECEIPT_PROMPT, isoFromInput, parseReceipt } from '@/lib/receipt';
import { categoryOf, useFin } from '@/store/finance';
import { showUndoToast, toast } from '@/store/toast';

const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

/**
 * Un movimento a mano o da una foto dello scontrino, nel momento dell'acquisto. Resta «in attesa» (src: manual):
 * quando poi carichi l'estratto conto e lo stesso importo compare nei giorni vicini, vale l'estratto e questo si toglie da solo.
 */
export function AddMovementSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [out, setOut] = useState(true);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const reset = () => { setOut(true); setLabel(''); setAmount(''); setDate(today()); setNote(''); };

  async function scan(camera: boolean) {
    setBusy(true); setNote('');
    try {
      const m = camera ? await takeNetPhoto() : await pickNetMedia('photo');
      if (!m) return;
      saveMediaToDrive({ uri: m.uri, media: 'photo', from: 'Scontrino', folder: 'Ricevute' });
      if (!aiServerConfigured) { setNote('Per leggere lo scontrino serve il server AI, che qui non è collegato. Scrivi tu descrizione e importo.'); return; }
      if (!(await askSend('files', 'Foto di uno scontrino'))) { setNote('Non invio la foto: senza il permesso non posso leggere lo scontrino. Scrivi tu descrizione e importo.'); return; }
      logSend('files', 0, ['image/jpeg']);
      const r = parseReceipt(await aiReadFiles(RECEIPT_PROMPT, [{ uri: m.uri, mime: 'image/jpeg' }]));
      if (!r) { setNote('Non riesco a leggere lo scontrino: scrivi tu descrizione e importo.'); return; }
      setOut(true); setLabel(r.shop); setAmount(String(r.total).replace('.', ',')); if (r.date) setDate(`${r.date.slice(8, 10)}.${r.date.slice(5, 7)}.${r.date.slice(0, 4)}`);
      setNote(r.currency !== 'CHF' ? `Lo scontrino è in ${r.currency}: controlla l’importo prima di salvare.` : 'Controlla che negozio, data e importo siano giusti prima di salvare.');
    } catch (e) { setNote(e instanceof AiServerError ? e.message : 'Non riesco a leggere la foto.'); }
    finally { setBusy(false); }
  }

  function save() {
    const n = Number(amount.replace(/['’\s]/g, '').replace(',', '.'));
    const iso = isoFromInput(date);
    if (!label.trim() || !Number.isFinite(n) || n <= 0 || !iso) { toast('Inserisci descrizione, importo e data validi'); return; }
    const st = useFin.getState();
    const prev = st.months;
    const signed = out ? -n : n;
    const lbl = movementLabel({ date: iso, label: label.trim(), amount: signed, category: out ? categoryOf(label, st.categories) : null });
    const res = st.importMovements([{ date: iso, label: lbl, amount: signed }], 'manual');
    if (!res.added) { toast('La data è nel futuro: non la inserisco'); return; }
    showUndoToast('Movimento aggiunto (in attesa dell’estratto conto)', () => useFin.getState().restoreMonths(prev));
    reset(); onClose();
  }

  return (
    <Sheet visible={visible} title="Aggiungi un movimento" onClose={() => { reset(); onClose(); }}>
      <FormHead icon={out ? 'arrow-down' : 'arrow-up'} title={out ? 'Una spesa' : 'Un’entrata'} text="Finisce nei conti subito e si toglie da sola quando l’estratto la conferma." />
      <Segments value={out ? 'out' : 'in'} onChange={(v) => setOut(v === 'out')} options={[{ v: 'out', label: 'Uscita' }, { v: 'in', label: 'Entrata' }]} />
      <View style={{ marginTop: 8 }}>
        <Row gap={8} style={{ justifyContent: 'flex-start' }}>
          <Btn small ghost icon="camera" title={busy ? 'Leggo…' : 'Foto dello scontrino'} disabled={busy} onPress={() => void scan(true)} />
          <Btn small ghost icon="image" title="Dalla galleria" disabled={busy} onPress={() => void scan(false)} />
        </Row>
        {note ? <Body small muted style={{ marginTop: 6 }}>{note}</Body> : null}
        <AmountField label="Importo" value={amount} onChange={setAmount} />
        <Body bold style={{ marginBottom: 4 }}>Cosa è</Body>
        <Input placeholder="Descrizione (es. Coop Lugano)" value={label} onChangeText={setLabel} accessibilityLabel="Descrizione" />
        <Body bold style={{ marginBottom: 4 }}>Quando</Body>
        <Input placeholder="gg.mm.aaaa" value={date} onChangeText={setDate} accessibilityLabel="Data" />
        <AiNote />
        <Body small muted>Quando carichi l’estratto conto della banca, questo movimento si toglie da solo se l’estratto lo conferma.</Body>
        <Btn style={{ marginTop: 10 }} title="Salva" onPress={save} />
      </View>
    </Sheet>
  );
}
