import { t } from '@/i18n/core';
import { cancelByPrefix, isSupported, native, scheduleAt } from '@/lib/notify';
import { useRadar } from '@/store/radar';
import { collectSnap } from './collect';
import { planRadarNotifications } from './radarNotify';
import { radar } from './radar';

/**
 * Riprogramma le notifiche del radar. Parte all'apertura dell'app e quando cambi le impostazioni: il testo è quello di adesso, calcolato sul telefono.
 * Se non apri l'app per giorni, resta l'ultimo avviso programmato e poi nulla (non invento avvisi a distanza). Mai bloccante.
 */
export async function refreshRadarNotifications(): Promise<void> {
  if (!isSupported()) return;
  try {
    const N = native();
    if (!N) return;
    await cancelByPrefix('lp-radar-');
    const st = useRadar.getState();
    if (!st.notify.on) return;
    if ((await N.getPermissionsAsync()).status !== 'granted') return;
    const planned = planRadarNotifications(radar(collectSnap(), st.dismissed), Date.now(), st.notify);
    for (const p of planned) await scheduleAt(p.id, new Date(p.at), t(p.title), p.body, { ref: p.ref }, 'promemoria');
  } catch { /* mai bloccare l'app per una notifica */ }
}
