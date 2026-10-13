import { Platform } from 'react-native';
import { create } from 'zustand';

import { addDaysIso, describeSync, planExport, planSync, type RawCalEvent, type SyncPlan } from '@/lib/calendarMap';
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

type CalPrefs = { selected: string[] | null; lastSync: number | null; lastMessage: string | null; prune: boolean; /** scrive anche gli eventi di LifePilot nel calendario del telefono */ exportOn: boolean; /** chiave evento -> id sul telefono (solo ciò che abbiamo scritto noi) */ exportMap: Record<string, string>; exportCalId: string | null; lastExport: number | null; set: (p: Partial<Omit<CalPrefs, 'set'>>) => void };
/** Calendari scelti (null = non ancora scelti, si propongono tutti) e data dell'ultima importazione. */
export const useCalPrefs = create<CalPrefs>()(persisted<CalPrefs>('calsync', (set) => ({ selected: null, lastSync: null, lastMessage: null, prune: true, exportOn: false, exportMap: {}, exportCalId: null, lastExport: null, set: (p) => set(p) })));

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
    const { selected, prune, exportOn } = useCalPrefs.getState();
    if (Platform.OS === 'web') return;
    if (selected?.length) await importCalendars(selected, { prune });
    if (exportOn) await exportToDevice();
  } catch { /* mai bloccare l'app */ }
}


const EXPORT_CAL_TITLE = 'LifePilot';

/** Trova (o crea) il calendario «LifePilot» sul telefono: gli eventi nostri stanno lì, separati dai tuoi. */
async function ensureExportCalendar(C: any): Promise<string> {
  const prefs = useCalPrefs.getState();
  const list = (await C.getCalendarsAsync(C.EntityTypes?.EVENT ?? 'event')) as { id: string; title?: string; allowsModifications?: boolean }[];
  const known = list.find((c) => String(c.id) === prefs.exportCalId) ?? list.find((c) => c.title === EXPORT_CAL_TITLE && c.allowsModifications !== false);
  if (known) { if (prefs.exportCalId !== String(known.id)) prefs.set({ exportCalId: String(known.id) }); return String(known.id); }
  let source: any;
  if (Platform.OS === 'ios') source = (await C.getDefaultCalendarAsync())?.source;
  else source = { isLocalAccount: true, name: EXPORT_CAL_TITLE, type: C.SourceType?.LOCAL ?? 'local' };
  const id = String(await C.createCalendarAsync({ title: EXPORT_CAL_TITLE, color: '#6c8cff', entityType: C.EntityTypes?.EVENT ?? 'event', sourceId: source?.id, source, name: EXPORT_CAL_TITLE, ownerAccount: 'personal', accessLevel: C.CalendarAccessLevel?.OWNER ?? 'owner' }));
  prefs.set({ exportCalId: id });
  return id;
}

/** Scrive nel calendario del telefono gli eventi creati in LifePilot dei prossimi 60 giorni (e toglie quelli cancellati o modificati). */
export async function exportToDevice(opts: { preview?: boolean } = {}): Promise<ImportResult> {
  if (Platform.OS === 'web') return { ok: false, message: CAL_WEB_MSG };
  const C = mod();
  if (!C) return { ok: false, message: 'Il calendario del telefono non è disponibile in questa versione dell’app.' };
  const err = await ensurePermission(C);
  if (err) return { ok: false, message: err };
  try {
    const prefs = useCalPrefs.getState();
    const today = dayKey();
    const plan = planExport(useLife.getState().events, prefs.exportMap, { from: today, to: addDaysIso(today, IMPORT_DAYS) });
    const text = `${plan.add.length} da scrivere, ${plan.remove.length} da togliere, ${plan.unchanged} già sul telefono.`;
    if (opts.preview) return { ok: true, message: text };
    const calId = await ensureExportCalendar(C);
    const map = { ...prefs.exportMap };
    for (const key of plan.remove) {
      try { await C.deleteEventAsync(map[key], { futureEvents: false }); } catch { /* già tolto dall'utente */ }
      delete map[key];
    }
    let failed = 0;
    for (const a of plan.add) {
      try {
        map[a.key] = String(await C.createEventAsync(calId, { title: a.title, startDate: a.start, endDate: a.end, allDay: a.allDay, location: a.place, notes: 'Creato da LifePilot', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
      } catch { failed++; }
    }
    useCalPrefs.getState().set({ exportMap: map, lastExport: Date.now() });
    const msg = `Sul calendario del telefono: ${plan.add.length - failed} scritti, ${plan.remove.length} tolti${failed ? `, ${failed} non riusciti` : ''}.`;
    return { ok: failed === 0, message: msg };
  } catch (e) {
    return { ok: false, message: 'Scrittura sul calendario non riuscita: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Toglie dal telefono tutto ciò che LifePilot ha scritto (quando spegni la sincronizzazione in uscita). */
export async function clearDeviceExport(): Promise<void> {
  const C = mod();
  const prefs = useCalPrefs.getState();
  try {
    if (C) for (const id of Object.values(prefs.exportMap)) { try { await C.deleteEventAsync(id, { futureEvents: false }); } catch { /* già tolto */ } }
  } finally { prefs.set({ exportMap: {}, lastExport: null }); }
}
