import { Platform } from 'react-native';
import { create } from 'zustand';

import { addDaysIso, describeSync, planSync, type RawCalEvent, type SyncPlan } from '@/lib/calendarMap';
import { dayKey } from '@/lib/format';
import { persisted } from '@/store/persist';
import { useLife } from '@/store/life';

export { describeSync, isIcalRef, mapEvent, planSync } from '@/lib/calendarMap';

/**
 * Import dal calendario del telefono (iOS/Android) tramite expo-calendar (API "legacy", valida anche in Expo Go).
 * Tutto è difensivo: se il modulo non c'è o il permesso è negato si restituisce un messaggio chiaro e l'app non si rompe.
 * La logica di mappatura/deduplica è in calendarMap.ts (pura e testata).
 */
export const IMPORT_DAYS = 60;
export const CAL_WEB_MSG = 'Disponibile solo sul telefono: apri LifePilot sull’iPhone per importare i tuoi calendari.';

export type DeviceCalendar = { id: string; title: string; source: string; color?: string };

type CalPrefs = { selected: string[] | null; lastSync: number | null; lastMessage: string | null; prune: boolean; set: (p: Partial<Omit<CalPrefs, 'set'>>) => void };
/** Calendari scelti (null = non ancora scelti, si propongono tutti) e data dell'ultima importazione. */
export const useCalPrefs = create<CalPrefs>()(persisted<CalPrefs>('calsync', (set) => ({ selected: null, lastSync: null, lastMessage: null, prune: true, set: (p) => set(p) })));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mod(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-calendar/legacy');
  } catch {
    return null;
  }
}

export type CalResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function ensurePermission(C: any): Promise<string | null> {
  try {
    let p = await C.getCalendarPermissionsAsync?.();
    if (!p?.granted) p = await C.requestCalendarPermissionsAsync();
    if (p?.granted) return null;
    return 'Permesso al calendario non concesso. Puoi attivarlo da Impostazioni > LifePilot > Calendari.';
  } catch {
    return 'Il calendario del telefono non è disponibile in questa versione dell’app.';
  }
}

export async function listDeviceCalendars(): Promise<CalResult<DeviceCalendar[]>> {
  if (Platform.OS === 'web') return { ok: false, message: CAL_WEB_MSG };
  const C = mod();
  if (!C) return { ok: false, message: 'Il calendario del telefono non è disponibile in questa versione dell’app.' };
  const err = await ensurePermission(C);
  if (err) return { ok: false, message: err };
  try {
    const list = (await C.getCalendarsAsync(C.EntityTypes?.EVENT ?? 'event')) as { id: string; title?: string; color?: string; source?: { name?: string } }[];
    return { ok: true, data: list.map((c) => ({ id: String(c.id), title: c.title || 'Calendario', source: c.source?.name || '', color: c.color })) };
  } catch (e) {
    return { ok: false, message: 'Non riesco a leggere i calendari: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

async function fetchRaw(C: any, ids: string[], from: Date, to: Date): Promise<RawCalEvent[]> {
  const evs = (await C.getEventsAsync(ids, from, to)) as { id: string; title?: string; startDate: string | Date; endDate?: string | Date; allDay?: boolean; calendarId?: string }[];
  return evs.map((e) => ({ id: String(e.id), title: e.title, startDate: e.startDate, endDate: e.endDate, allDay: !!e.allDay, calendarId: e.calendarId }));
}

export type ImportResult = { ok: boolean; message: string; plan?: SyncPlan };

/** Importa (o risincronizza) i prossimi 60 giorni dei calendari scelti. `preview` calcola solo il piano senza scrivere. */
export async function importCalendars(calendarIds: string[], opts: { prune?: boolean; preview?: boolean } = {}): Promise<ImportResult> {
  if (Platform.OS === 'web') return { ok: false, message: CAL_WEB_MSG };
  const C = mod();
  if (!C) return { ok: false, message: 'Il calendario del telefono non è disponibile in questa versione dell’app.' };
  if (!calendarIds.length) return { ok: false, message: 'Scegli almeno un calendario.' };
  const err = await ensurePermission(C);
  if (err) return { ok: false, message: err };
  try {
    const today = dayKey();
    const to = addDaysIso(today, IMPORT_DAYS);
    const raws = await fetchRaw(C, calendarIds, new Date(today + 'T00:00:00'), new Date(to + 'T23:59:59'));
    const life = useLife.getState();
    const plan = planSync(raws, life.events, { from: today, to }, { prune: opts.prune });
    if (opts.preview) return { ok: true, message: describeSync(plan), plan };
    // ordine sicuro per gli indici: aggiornamenti, rimozioni dal fondo, poi aggiunte
    plan.update.forEach((u) => life.patchEvent(u.day, u.idx, u.patch));
    [...plan.remove].sort((a, b) => (a.day === b.day ? b.idx - a.idx : a.day < b.day ? -1 : 1)).forEach((r) => life.delEvent(r.day, r.idx));
    plan.add.forEach((a) => life.addEvent(a.day, a.ev));
    const message = describeSync(plan);
    useCalPrefs.getState().set({ selected: calendarIds, lastSync: Date.now(), lastMessage: message });
    return { ok: true, message, plan };
  } catch (e) {
    return { ok: false, message: 'Importazione non riuscita: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Risincronizza in silenzio con i calendari già scelti (non fa nulla se non c'è una scelta o il permesso manca). */
export async function resyncCalendars(): Promise<void> {
  try {
    const { selected, prune } = useCalPrefs.getState();
    if (!selected?.length || Platform.OS === 'web') return;
    await importCalendars(selected, { prune });
  } catch { /* mai bloccare l'app */ }
}
