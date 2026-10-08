import { Platform } from 'react-native';

import { dayKey, hashStr, mulberry32 } from '@/lib/format';
import { useApp } from '@/store/app';
import { useContext, type WeatherDay } from '@/store/context';
import { useNet } from '@/store/network';

/**
 * Meteo giornaliero per confrontarlo con umore, sonno, impegni e spese.
 * Fonte: Open-Meteo (gratuita, senza chiave): previsioni + ultimi 60 giorni.
 * La città si ricava dalla posizione (expo-location) SE il permesso è concesso; altrimenti si digita a mano.
 * In modalità demo i dati sono sintetici e dichiarati tali.
 */
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return dayKey(x); };

export function demoWeather(today = dayKey(), days = 70): Record<string, WeatherDay> {
  const out: Record<string, WeatherDay> = {};
  const month = new Date(today + 'T00:00:00').getMonth();
  const base = 12 + 9 * Math.cos(((month - 6) / 12) * Math.PI * 2);
  let wet = false;
  for (let i = days - 1; i >= -2; i--) {
    const d = addDays(today, -i);
    const r = mulberry32(hashStr('w' + d));
    wet = wet ? r() < 0.55 : r() < 0.22; // le giornate di pioggia tendono a raggrupparsi
    const rain = wet ? Math.round((1 + r() * 14) * 10) / 10 : r() < 0.1 ? 0.2 : 0;
    out[d] = { rain, tmax: Math.round((base + (r() - 0.5) * 8 - (wet ? 3 : 0)) * 10) / 10, sun: Math.round((wet ? r() * 3 : 4 + r() * 6) * 10) / 10 };
  }
  return out;
}

async function geocode(city: string) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it`);
  if (!r.ok) throw new Error('geo');
  const j = (await r.json()) as { results?: { latitude: number; longitude: number; name: string }[] };
  const hit = j.results?.[0];
  if (!hit) throw new Error('Città non trovata');
  return hit;
}


export type LocResult = { ok: boolean; message: string; city?: string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
function locMod(): any | null { try { return require('expo-location'); } catch { return null; } }

/** Ricava città e coordinate dalla posizione. `ask` = chiede il permesso se non è ancora stato deciso. Mai lancia: restituisce un messaggio chiaro. */
export function locateCity(ask: boolean): Promise<LocResult> {
  // se il sistema non risponde (richiesta ignorata) non si resta in attesa all'infinito
  const timeout = new Promise<LocResult>((res) => setTimeout(() => res({ ok: false, message: 'La posizione non risponde: controlla i permessi oppure scrivi la città a mano.' }), ask ? 25000 : 8000));
  return Promise.race([locateCityInner(ask), timeout]);
}

async function locateCityInner(ask: boolean): Promise<LocResult> {
  const L = locMod();
  if (!L) return { ok: false, message: 'La posizione non è disponibile in questa versione dell’app: scrivi la città a mano.' };
  try {
    let perm = await L.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain !== false) perm = await L.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, message: ask ? 'Permesso di posizione non concesso: scrivi la città a mano (puoi attivarlo da Impostazioni > LifePilot > Posizione).' : 'Posizione non autorizzata: scrivi la città a mano.' };
    const pos = await L.getCurrentPositionAsync({ accuracy: L.Accuracy?.Balanced ?? 3 });
    const { latitude, longitude } = pos.coords as { latitude: number; longitude: number };
    let city = '';
    try {
      const rg = (await L.reverseGeocodeAsync({ latitude, longitude })) as { city?: string | null; subregion?: string | null; district?: string | null; region?: string | null }[];
      city = rg?.[0]?.city || rg?.[0]?.subregion || rg?.[0]?.district || rg?.[0]?.region || '';
    } catch { /* su web il geocoding inverso non c'è */ }
    if (!city) city = 'Posizione attuale';
    useContext.getState().set({ city, lat: latitude, lon: longitude, manual: false, error: null, fetchedAt: null });
    return { ok: true, message: `Posizione trovata: ${city}.`, city };
  } catch (e) {
    return { ok: false, message: 'Non riesco a ottenere la posizione' + (Platform.OS === 'web' ? ' dal browser' : '') + (e instanceof Error && e.message ? `: ${e.message}` : '') + '. Scrivi la città a mano.' };
  }
}

/** Città di partenza: quella del biglietto da visita ("Lugano, Svizzera" -> "Lugano"). */
export function defaultCity(): string {
  return (useNet.getState().myCard.residence || '').split(',')[0].trim();
}

export async function refreshWeather(force = false, located = false): Promise<void> {
  const ctx = useContext.getState();
  if (useApp.getState().demo) {
    if (ctx.source !== 'demo' || force) ctx.set({ days: demoWeather(), source: 'demo', fetchedAt: Date.now(), error: null, city: ctx.city || defaultCity() || 'Lugano' });
    return;
  }
  // senza città scelta a mano: prova con la posizione, ma SOLO se il permesso è già stato concesso (all'avvio non si chiede nulla)
  if (!located && !ctx.manual && (force || !ctx.city || !ctx.fetchedAt || Date.now() - ctx.fetchedAt >= 6 * 3600000)) {
    const r = await locateCity(false);
    if (r.ok) return refreshWeather(true, true);
  }
  const ctx2 = useContext.getState();
  const city = ctx2.city || defaultCity();
  if (!city) { ctx2.set({ error: 'Consenti la posizione o scrivi la città per vedere il meteo' }); return; }
  if (!force && ctx2.fetchedAt && Date.now() - ctx2.fetchedAt < 6 * 3600000 && ctx2.source === 'open-meteo') return;
  try {
    let { lat, lon } = ctx2;
    if (lat == null || lon == null || ctx2.city !== city) { const g = await geocode(city); lat = g.latitude; lon = g.longitude; }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max,sunshine_duration&past_days=60&forecast_days=3&timezone=auto`);
    if (!r.ok) throw new Error('meteo');
    const j = (await r.json()) as { daily: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[]; sunshine_duration: (number | null)[] } };
    const days: Record<string, WeatherDay> = {};
    j.daily.time.forEach((d, i) => { days[d] = { rain: j.daily.precipitation_sum[i] ?? 0, tmax: j.daily.temperature_2m_max[i] ?? 0, sun: Math.round(((j.daily.sunshine_duration[i] ?? 0) / 3600) * 10) / 10 }; });
    ctx2.set({ city, lat, lon, days: { ...ctx2.days, ...days }, source: 'open-meteo', fetchedAt: Date.now(), error: null });
  } catch (e) {
    ctx2.set({ error: e instanceof Error && e.message === 'Città non trovata' ? 'Città non trovata: controlla il nome' : 'Meteo non disponibile: serve la connessione' });
  }
}
