import { dayKey, hashStr, mulberry32, shortDate } from '../lib/format';
import { demoWeather } from '../lib/weather';

/** Check-in d'esempio (solo demo): l'umore dipende un po' da pioggia e giorno della settimana, con rumore. */
export function demoMoods(days = 55) {
  const w = demoWeather(dayKey(), days + 5);
  const out: { date: string; mood: string; day: string }[] = [];
  for (let i = days - 1; i >= 1; i--) { // oggi resta da registrare: così si prova il check-in
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = dayKey(d);
    if (i > 0 && mulberry32(hashStr('skip' + key))() < 0.12) continue; // qualche giorno senza check-in
    const r = mulberry32(hashStr('mood' + key));
    const wk = d.getDay();
    const score = 3.6 + ((w[key]?.rain ?? 0) >= 1 ? -0.9 : 0.1) + ((w[key]?.sun ?? 5) >= 6 ? 0.3 : 0) + (wk === 0 || wk === 6 ? 0.3 : wk === 1 ? -0.3 : 0) + (r() - 0.5) * 1.1;
    const mood = score >= 4.5 ? 'Felice' : score >= 3.7 ? 'Calmo' : score >= 2.9 ? 'Neutro' : score >= 2.3 ? 'Stressato' : score >= 1.6 ? 'Triste' : 'Arrabbiato';
    out.push({ date: shortDate(i), mood, day: key });
  }
  return out.reverse();
}
