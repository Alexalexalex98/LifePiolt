import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Btn, Input, Pill, Row, SectionLabel, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { MANUAL_GROUPS, collectManual, recentDays, type ManualKey } from '@/lib/healthManual';
import { pointsOf, useHealth, type ExtraKey, type Metric } from '@/store/health';
import { toast } from '@/store/toast';

/** Inserimento a mano di tutti i dati di salute, per oggi o per un giorno passato: alimenta l'analisi incrociata e «La tua vita in un dato». */
export function ManualHealthSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const h = useHealth();
  const days = recentDays(14);
  const [day, setDay] = useState(days[0].key);
  const [vals, setVals] = useState<Record<string, string>>({});

  /* i valori già presenti per il giorno scelto, da correggere */
  useEffect(() => {
    if (!visible) return;
    const cur: Record<string, string> = {};
    for (const g of MANUAL_GROUPS) for (const f of g.fields) {
      const pts = f.extra ? h.extra?.[f.key as ExtraKey] ?? [] : pointsOf(h, f.key as Metric);
      const p = pts.find((x) => x.d === day);
      if (p) cur[f.key] = String(Math.round(p.v * 100) / 100);
    }
    setVals(cur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, day]);

  function save() {
    const { entries, errors } = collectManual(vals);
    if (errors.length) { toast(errors[0]); return; }
    if (!entries.length) { toast(tl('Niente da salvare')); return; }
    const st = useHealth.getState();
    for (const { field, value } of entries) {
      if (field.extra) st.setExtra(field.key as ExtraKey, [{ d: day, v: value }]);
      else {
        const src = st.sources[field.key as Metric];
        st.setPoints(field.key as Metric, [{ d: day, v: value }], src === 'apple' || src === 'hc' ? src : 'manuale');
      }
    }
    onClose();
    toast(entries.length === 1 ? tl('Salvato 1 dato') : tl('Salvati {0} dati', entries.length));
  }

  return (
    <Sheet visible={visible} title={tl('Inserisci i dati a mano')} onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Compila solo quello che vuoi, anche per i giorni passati. Più dati inserisci, più l\'analisi incrociata e «La tua vita in un dato» sono precisi.')}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
        {days.map((d) => <Pill key={d.key} label={tl(d.label)} on={d.key === day} onPress={() => setDay(d.key)} />)}
      </ScrollView>
      {MANUAL_GROUPS.map((g) => (
        <View key={g.id}>
          <SectionLabel>{tl(g.title)}</SectionLabel>
          {g.fields.map((f) => (
            <View key={f.key} style={{ marginBottom: 6 }}>
              <Row><Body small muted>{tl(f.label)}</Body>{f.unit ? <Body small muted>{f.unit}</Body> : null}</Row>
              <Input keyboardType="decimal-pad" placeholder={f.placeholder} value={vals[f.key as ManualKey] ?? ''} onChangeText={(v) => setVals((p) => ({ ...p, [f.key]: v }))} accessibilityLabel={tl(f.label)} />
            </View>
          ))}
        </View>
      ))}
      <Btn style={{ marginTop: 10 }} title={tl('Salva')} onPress={save} />
    </Sheet>
  );
}
