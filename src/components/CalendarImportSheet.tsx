import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Body, Btn, Item, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { CAL_WEB_MSG, IMPORT_DAYS, importCalendars, listDeviceCalendars, useCalPrefs, type DeviceCalendar } from '@/lib/calendarImport';
import { Icon } from '@/lib/icons';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

/** Foglio per importare gli eventi dei prossimi 60 giorni dal calendario del telefono. */
export function CalendarImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const prefs = useCalPrefs();
  const [cals, setCals] = useState<DeviceCalendar[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (!visible || web) return;
    let alive = true;
    setMsg(''); setCals(null);
    listDeviceCalendars().then((r) => {
      if (!alive) return;
      if (!r.ok) { setMsg(r.message); setCals([]); return; }
      setCals(r.data);
      const known = prefs.selected?.filter((id) => r.data.some((c) => c.id === id));
      setSel(known?.length ? known : r.data.map((c) => c.id));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function run() {
    setBusy(true);
    try {
      prefs.set({ selected: sel });
      const r = await importCalendars(sel, { prune: prefs.prune });
      setMsg(r.message); toast(r.message);
    } finally { setBusy(false); }
  }

  return (
    <Sheet visible={visible} title="Calendario del telefono" onClose={onClose}>
      {web ? (
        <Body small muted>{CAL_WEB_MSG}</Body>
      ) : (
        <>
          <Body small muted style={{ marginBottom: 10 }}>Importo nel Plan gli eventi dei prossimi {IMPORT_DAYS} giorni dei calendari che scegli. Gli eventi già importati non vengono duplicati e quelli che crei tu non vengono toccati.</Body>
          {cals === null && <Body small muted>Leggo i calendari…</Body>}
          {cals?.length === 0 && !msg && <Body small muted>Nessun calendario trovato sul telefono.</Body>}
          {cals?.map((c, i) => {
            const on = sel.includes(c.id);
            return (
              <Item key={c.id} last={i === cals.length - 1}>
                <Pressable onPress={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={translateText(c.title)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name={on ? 'checksquare' : 'square'} size={20} color={on ? t.positive : t.muted} />
                  <View style={{ flex: 1 }}><Body>{c.title}</Body>{c.source ? <Body small muted>{c.source}</Body> : null}</View>
                  {c.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} /> : null}
                </Pressable>
              </Item>
            );
          })}
          {cals && cals.length > 0 && (
            <>
              <Toggle label="Rimuovi gli eventi importati che non esistono più sul telefono" value={prefs.prune} onChange={(v) => prefs.set({ prune: v })} />
              <Row style={{ marginTop: 10 }} gap={8}>
                <Btn style={{ flex: 1 }} disabled={busy || !sel.length} title={busy ? 'Importo…' : prefs.lastSync ? 'Sincronizza di nuovo' : 'Importa'} onPress={run} />
              </Row>
            </>
          )}
          {msg ? <Body small color={cals?.length ? t.positive : t.warn} style={{ marginTop: 10 }}>{msg}</Body> : null}
          {prefs.lastSync ? <Body small muted style={{ marginTop: 8 }}>Ultima importazione: {new Date(prefs.lastSync).toLocaleString('it-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Body> : null}
        </>
      )}
    </Sheet>
  );
}
