import { View } from 'react-native';

import { Body, Btn, Input, Item, Pill, Select, Sheet, Toggle } from '@/components/ui';
import { t } from '@/i18n/core';
import { currentCurrency } from '@/i18n/format';
import { isSupported, requestPermission } from '@/lib/notify';
import { refreshBillReminders } from '@/lib/bills/schedule';
import { useFin } from '@/store/finance';
import { toast } from '@/store/toast';

const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const TIMES = Array.from({ length: 29 }, (_, i) => hm(6 + Math.floor(i / 2), (i % 2) * 30)).filter((x) => x <= '20:00');

/** Impostazioni finanze: quando ricordare le scadenze, margine per il bonifico, liquidita' minima, festivita'. */
export function ReminderPrefsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const p = useFin((s) => s.billPrefs);
  const set = useFin((s) => s.setBillPrefs);

  async function enable() {
    if (!isSupported()) { toast(t('I promemoria funzionano sull\'app installata: qui vedi solo l\'anteprima.')); return; }
    const r = await requestPermission();
    toast(r.ok ? t('Notifiche consentite') : r.message);
    void refreshBillReminders();
  }

  return (
    <Sheet visible={visible} title="Impostazioni finanze" onClose={onClose}>
      <Body small muted style={{ marginBottom: 6 }}>I promemoria sono notifiche locali programmate sul telefono: nessun server vede le tue bollette.</Body>
      <Toggle label="Promemoria delle scadenze" value={p.on} onChange={(v) => { set({ on: v }); if (v) void enable(); }} />
      <View style={{ opacity: p.on ? 1 : 0.45 }} pointerEvents={p.on ? 'auto' : 'none'}>
        <Item><Toggle label="7 giorni prima" value={p.d7} onChange={(v) => set({ d7: v })} /></Item>
        <Item><Toggle label="3 giorni prima" value={p.d3} onChange={(v) => set({ d3: v })} /></Item>
        <Item><Toggle label="Il giorno prima" value={p.d1} onChange={(v) => set({ d1: v })} /></Item>
        <Item><Toggle label="La mattina della scadenza" value={p.d0} onChange={(v) => set({ d0: v })} /></Item>
        <Item><Toggle label="Se è scaduta: il giorno dopo e ogni 3 giorni (3 volte)" value={p.overdue} onChange={(v) => set({ overdue: v })} /></Item>
        <Item last>
          <Body small muted style={{ marginBottom: 4 }}>Ora di invio</Body>
          <Select value={hm(p.hour, p.minute)} options={TIMES} title="Ora di invio" onChange={(v) => { const [h, m] = v.split(':').map(Number); set({ hour: h, minute: m }); }} />
        </Item>
      </View>

      <Body bold style={{ marginTop: 18, marginBottom: 4 }}>Piano di pagamento</Body>
      <Body small muted style={{ marginBottom: 6 }}>Giorni lavorativi di margine per il bonifico (la banca non lavora nel weekend e nei festivi).</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((n) => <Pill key={n} label={n === 1 ? '1 giorno' : `${n} giorni`} on={p.safetyDays === n} onPress={() => set({ safetyDays: n })} />)}
      </View>
      <Body small muted style={{ marginTop: 12, marginBottom: 6 }}>«In scadenza» quando mancano al massimo</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[3, 5, 7, 10, 14].map((n) => <Pill key={n} label={`${n} giorni`} on={p.soonDays === n} onPress={() => set({ soonDays: n })} />)}
      </View>
      <Body small muted style={{ marginTop: 12, marginBottom: 6 }}>Liquidità minima da non toccare ({currentCurrency()})</Body>
      <Input keyboardType="decimal-pad" placeholder="0" defaultValue={p.reserve ? String(p.reserve) : ''} onChangeText={(v) => set({ reserve: Math.max(0, parseFloat(v.replace(',', '.')) || 0) })} />
      <Body small muted style={{ marginTop: 4, marginBottom: 6 }}>Festività da escludere dai giorni lavorativi</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(['CH', 'IT'] as const).map((c) => (
          <Pill key={c} label={c === 'CH' ? 'Svizzera' : 'Italia'} on={p.countries.includes(c)} onPress={() => set({ countries: p.countries.includes(c) ? p.countries.filter((x) => x !== c) : [...p.countries, c] })} />
        ))}
      </View>
      <Btn style={{ marginTop: 18 }} title="Fatto" onPress={onClose} />
    </Sheet>
  );
}
