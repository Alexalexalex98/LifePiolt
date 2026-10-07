import { dayKey, hashStr, mulberry32 } from '@/lib/format';
import { useApp } from '@/store/app';
import { useContext, type WeatherDay } from '@/store/context';
import { useNet } from '@/store/network';

/**
 * Meteo giornaliero per confrontarlo con umore, sonno, impegni e spese.
 * Fonte: Open-Meteo (gratuita, senza chiave): previsioni + ultimi 60 giorni. Si usa la città, non la posizione GPS.
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

/** Città di partenza: quella del biglietto da visita ("Lugano, Svizzera" -> "Lugano"). */
export function defaultCity(): string {
  return (useNet.getState().myCard.residence || '').split(',')[0].trim();
}

export async function refreshWeather(force = false): Promise<void> {
  const ctx = useContext.getState();
  if (useApp.getState().demo) {
    if (ctx.source !== 'demo' || force) ctx.set({ days: demoWeather(), source: 'demo', fetchedAt: Date.now(), error: null, city: ctx.city || defaultCity() || 'Lugano' });
    return;
  }
  const city = ctx.city || defaultCity();
  if (!city) { ctx.set({ error: 'Scegli la città per vedere il meteo' }); return; }
  if (!force && ctx.fetchedAt && Date.now() - ctx.fetchedAt < 6 * 3600000 && ctx.source === 'open-meteo') return;
  try {
    let { lat, lon } = ctx;
    if (lat == null || lon == null || ctx.city !== city) { const g = await geocode(city); lat = g.latitude; lon = g.longitude; }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max,sunshine_duration&past_days=60&forecast_days=3&timezone=auto`);
    if (!r.ok) throw new Error('meteo');
    const j = (await r.json()) as { daily: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[]; sunshine_duration: (number | null)[] } };
    const days: Record<string, WeatherDay> = {};
    j.daily.time.forEach((d, i) => { days[d] = { rain: j.daily.precipitation_sum[i] ?? 0, tmax: j.daily.temperature_2m_max[i] ?? 0, sun: Math.round(((j.daily.sunshine_duration[i] ?? 0) / 3600) * 10) / 10 }; });
    ctx.set({ city, lat, lon, days: { ...ctx.days, ...days }, source: 'open-meteo', fetchedAt: Date.now(), error: null });
  } catch (e) {
    ctx.set({ error: e instanceof Error && e.message === 'Città non trovata' ? 'Città non trovata: controlla il nome' : 'Meteo non disponibile: serve la connessione' });
  }
}
