import { hoursOf, upcoming } from '@/lib/shifts';
import { useLife } from '@/store/life';
import { useShifts } from '@/store/shifts';
import { NOTE_LABEL, useWellbeing } from '@/store/wellbeing';
import type { Analysis, Series } from '@/lib/analytics';
import type { Context } from './score';

const MED = /\b(medic[oa]|dottor\w*|dott\.|visita|psicolog\w*|psichiatr\w*|terapi\w*|ospedale|pronto soccorso|cardiolog\w*|dermatolog\w*|fisioterap\w*|analisi del sangue|esame|dentista)\b/i;
const num = (v: number, dec = 1) => String(Math.round(v * 10 ** dec) / 10 ** dec).replace('.', ',');
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

/** Il CONTESTO: non misura come stai, spiega il perché dei numeri. Lavoro, soldi, obiettivi, meteo, visite mediche e quello che hai raccontato in chat (solo con il consenso). */
export function buildLifeContext(series: Series[], list: Analysis[], today: string, now = Date.now()): Context[] {
  const out: Context[] = [];
  const by: Record<string, Analysis> = {};
  list.forEach((a) => { by[a.def.id] = a; });
  try {
    const week = upcoming(useShifts.getState().shifts, now, 7);
    const h = week.reduce((s, o) => s + hoursOf(o), 0);
    const open = useLife.getState().tasks.filter((t) => !t.done);
    const late = open.filter((t) => t.due && t.due < today).length;
    const bits = [week.length ? `${week.length} turni nei prossimi 7 giorni (${num(h, 0)} ore)` : '', late ? `${late} task in ritardo` : '', open.length >= 12 ? `${open.length} task aperti` : ''].filter(Boolean);
    if (bits.length) out.push({ id: 'lavoro', label: 'Lavoro', text: bits.join(', ') + '.' });
  } catch { /* senza lavoro */ }
  const money: string[] = [];
  const late = by.billsLate; if (late && late.latest.v > 0) money.push(`${Math.round(late.latest.v)} bollette scadute da pagare`);
  const run = by.runway; if (run && run.latest.v < 1.5) money.push(`i soldi che hai coprono ${num(run.latest.v)} mesi di spese`);
  const sav = by.savings; if (sav && sav.latest.v < 0) money.push('questo mese spendi più di quanto entra');
  if (money.length) out.push({ id: 'soldi', label: 'Situazione economica', text: money.join(', ') + '.' });
  const goals = useLife.getState().goals;
  if (goals.length) out.push({ id: 'obiettivi', label: 'Obiettivi', text: `${goals.length} obiettivi, avanzamento medio ${Math.round(avg(goals.map((g) => g.p)))}%.` });
  const w = (id: string) => (series.find((s) => s.def.id === id)?.pts ?? []).filter((p) => p.d <= today).slice(-7).map((p) => p.v);
  const rain = w('rain'), sun = w('sun');
  if (rain.length >= 4 && rain.filter((v) => v >= 1).length >= 4) out.push({ id: 'meteo', label: 'Meteo', text: `Ha piovuto in ${rain.filter((v) => v >= 1).length} degli ultimi ${rain.length} giorni: il tempo grigio pesa su umore ed energia.` });
  else if (sun.length >= 4 && avg(sun) < 2) out.push({ id: 'meteo', label: 'Meteo', text: 'Pochissimo sole negli ultimi giorni: può pesare su umore ed energia.' });
  try {
    const cutLo = new Date(now - 14 * 86400000).toISOString().slice(0, 10), cutHi = new Date(now + 14 * 86400000).toISOString().slice(0, 10);
    const med = Object.entries(useLife.getState().events).flatMap(([d, l]) => (d >= cutLo && d <= cutHi ? l.filter((e) => MED.test(e.title ?? '')).map((e) => `${e.title} (${d})`) : []));
    if (med.length) out.push({ id: 'visite', label: 'Visite e appuntamenti di cura', text: med.slice(0, 3).join('; ') + '.' });
  } catch { /* senza agenda */ }
  const wb = useWellbeing.getState();
  if (wb.consent) for (const n of wb.notes.slice(0, 6)) out.push({ id: `nota-${n.id}`, label: NOTE_LABEL[n.kind], text: n.note });
  return out;
}
