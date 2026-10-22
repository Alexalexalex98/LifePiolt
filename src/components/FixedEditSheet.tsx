import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Input, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { formatMoney } from '@/i18n/format';
import { payeeKey, type Cls } from '@/lib/statementAnalysis';
import { useFin, type StatementInfo } from '@/store/finance';
import { toast } from '@/store/toast';

const CLASSES: Cls[] = ['Affitto', 'Cassa malati e assicurazioni', 'Mutuo', 'Prestiti e leasing', 'Telefono e internet', 'Energia e acqua', 'Trasporti', 'Abbonamenti', 'Tasse e imposte', 'Cibo', 'Ristoranti e bar', 'Altro'];

/** Correggere ciò che l'estratto ha letto male: importo della spesa fissa, classe, «non è una spesa fissa», e ogni singolo movimento (importo, descrizione, elimina). */
export function FixedEditSheet({ item, onClose }: { item: StatementInfo['fixed'][number] | null; onClose: () => void }) {
  const f = useFin();
  const [amt, setAmt] = useState('');
  const [edit, setEdit] = useState<{ mi: number; vi: number; label: string; amount: string } | null>(null);
  const rows = item ? f.months.flatMap((m, mi) => m.movements.map((x, vi) => ({ mi, vi, x, m })).filter((r) => r.x.amount < 0 && payeeKey(r.x.label) === item.key)) : [];
  const num = (s: string) => { const n = Number(s.replace(/['\s]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  return (
    <Sheet visible={!!item} title={item?.name ?? ''} onClose={() => { setEdit(null); setAmt(''); onClose(); }}>
      {item ? (
        <View style={{ gap: 8 }}>
          <Body small muted>Se qualcosa è stato letto male, correggilo qui: ricalcolo tutto subito.</Body>
          <Body bold>Importo al mese</Body>
          <Row gap={8}>
            <View style={{ flex: 1 }}><Input value={amt} onChangeText={setAmt} placeholder={String(Math.round(item.monthly))} keyboardType="numeric" /></View>
            <Btn small title="Salva" onPress={() => { const n = num(amt); if (!(n >= 0)) { toast('Scrivi un importo valido'); return; } f.setFixedOverride(item.key, n); toast('Importo corretto'); setAmt(''); }} />
          </Row>
          {item.overridden ? <Btn small ghost title={`Torna al calcolo (${formatMoney(item.overridden.calculated)})`} onPress={() => { f.setFixedOverride(item.key, null); toast('Calcolo ripristinato'); }} /> : null}
          <Body bold style={{ marginTop: 6 }}>Che tipo di spesa è</Body>
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {CLASSES.map((c) => <Pill key={c} label={c} on={item.cls === c} onPress={() => { f.setPayeeFix(item.key, { ...(f.payeeFix?.[item.key] ?? {}), cls: c }); toast('Tipo cambiato'); }} />)}
          </Row>
          <Toggle label="Non è una spesa fissa (toglila da qui)" value={false} onChange={(v) => { if (v) { f.setPayeeFix(item.key, { ...(f.payeeFix?.[item.key] ?? {}), hide: true }); toast('Tolta dalle spese fisse'); onClose(); } }} />
          <Body bold style={{ marginTop: 6 }}>I movimenti letti</Body>
          {rows.map((r) => (
            <View key={`${r.mi}-${r.vi}`} style={{ paddingVertical: 6 }}>
              {edit && edit.mi === r.mi && edit.vi === r.vi ? (
                <View style={{ gap: 6 }}>
                  <Input value={edit.label} onChangeText={(v) => setEdit({ ...edit, label: v })} />
                  <Input value={edit.amount} onChangeText={(v) => setEdit({ ...edit, amount: v })} keyboardType="numeric" />
                  <Row gap={8}>
                    <Btn small style={{ flex: 1 }} title="Salva" onPress={() => { const n = num(edit.amount); if (!Number.isFinite(n) || !edit.label.trim()) { toast('Controlla descrizione e importo'); return; } f.editMovement(r.mi, r.vi, { label: edit.label.trim(), amount: -Math.abs(n) }); setEdit(null); toast('Movimento corretto'); }} />
                    <Btn small ghost style={{ flex: 1 }} title="Annulla" onPress={() => setEdit(null)} />
                  </Row>
                </View>
              ) : (
                <Row gap={8}>
                  <View style={{ flex: 1 }}><Body small muted>{`${r.x.date} · ${r.m.label}`}</Body><Body numberOfLines={2}>{r.x.label}</Body></View>
                  <Body bold>{formatMoney(r.x.amount)}</Body>
                  <Btn small ghost icon="edit" title="" label="Modifica" onPress={() => setEdit({ mi: r.mi, vi: r.vi, label: r.x.label, amount: String(Math.abs(r.x.amount)) })} />
                  <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => { f.delMovement(r.mi, r.vi); toast('Movimento eliminato'); }} />
                </Row>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}
