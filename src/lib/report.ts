import { Platform } from 'react-native';

import { confirmCorrelation, addDays, todayStr } from '@/lib/analytics';
import { collect, computeDashboard } from '@/lib/analyticsData';
import { alertsFor } from '@/lib/budgetState';
import { buildReportHtml, type ReportData, type ReportMetric } from '@/lib/reportHtml';
import { movementsToDated } from '@/lib/recurring';
import { categoryOf, monthNet, useFin } from '@/store/finance';
import { healthMeta, pointsOf, useHealth, type Metric } from '@/store/health';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';

export { buildReportHtml } from '@/lib/reportHtml';

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmtNum = (v: number, dec: number) => (Math.round(v * 10 ** dec) / 10 ** dec).toString().replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const wdNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** Raccoglie dall'app i dati degli ultimi 7 giorni (oggi incluso) e dei 7 successivi per gli impegni. */
export function gatherReportData(): ReportData {
  const to = todayStr();
  const from = addDays(to, -6);
  const prevFrom = addDays(to, -13), prevTo = addDays(to, -7);
  const h = useHealth.getState();

  const health: ReportMetric[] = [];
  (['sleep', 'steps', 'hr', 'hrv', 'exercise', 'mindful', 'weight'] as Metric[]).forEach((m) => {
    const pts = pointsOf(h, m);
    const cur = pts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v);
    if (!cur.length) return;
    const prev = pts.filter((p) => p.d >= prevFrom && p.d <= prevTo).map((p) => p.v);
    const meta = healthMeta[m];
    const a = avg(cur)!, b = avg(prev);
    const delta = b != null ? `${a - b >= 0 ? '+' : ''}${fmtNum(a - b, meta.dec)} rispetto alla settimana prima` : null;
    health.push({ label: `${meta.label} (media)`, value: `${fmtNum(a, meta.dec)}${meta.unit ? ' ' + meta.unit : ''}`, delta });
  });

  const series = collect(to);
  const moodPts = (series.find((s) => s.def.id === 'mood')?.pts ?? []).filter((p) => p.d >= from && p.d <= to);
  const byDay = (d: string) => wdNames[new Date(d + 'T00:00:00').getDay()];
  const sortedMood = moodPts.slice().sort((a, b) => b.v - a.v);
  const mood = moodPts.length ? { avg: avg(moodPts.map((p) => p.v)), days: moodPts.length, best: byDay(sortedMood[0].d), worst: byDay(sortedMood[sortedMood.length - 1].d) } : null;

  const fin = useFin.getState();
  const week = movementsToDated(fin.months).filter((m) => m.date >= from && m.date <= to);
  const income = week.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const spent = -week.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
  const cats = new Map<string, number>();
  week.filter((m) => m.amount < 0).forEach((m) => { const c = categoryOf(m.label, fin.categories); cats.set(c, (cats.get(c) ?? 0) - m.amount); });
  const top = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, amount]) => ({ name, amount }));
  const finance = { income, spent, net: income - spent, top, monthNet: fin.months[0] ? monthNet(fin.months[0]) : null, alerts: alertsFor(fin).filter((a) => a.level === 'over').map((a) => a.text) };

  const life = useLife.getState();
  const done: string[] = [];
  life.tasks.forEach((t) => {
    if (t.doneAt && t.doneAt >= from && t.doneAt <= to) done.push(t.t);
    t.subtasks?.forEach((s) => { if (s.doneAt && s.doneAt >= from && s.doneAt <= to) done.push(`${t.t} · ${s.t}`); });
  });
  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done)).length;

  let past = 0;
  Object.entries(life.events).forEach(([d, l]) => { if (d >= from && d <= to) past += l.length; });
  const upcoming: ReportData['events']['upcoming'] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(to, i);
    (life.events[d] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)).forEach((e) => upcoming.push({ day: d, time: e.time, title: e.title }));
  }

  let correlations: ReportData['correlations'] = [];
  try {
    const dash = computeDashboard();
    correlations = dash.corrs.slice(0, 4).map((c) => {
      const a = series.find((s) => s.def.id === c.a.id), b = series.find((s) => s.def.id === c.b.id);
      const conf = a && b ? confirmCorrelation(a, b, c.lag) : null;
      return { sentence: c.sentence, detail: `r = ${c.r.toFixed(2)} su ${c.n} giorni`, status: conf ? (conf.status === 'confermata' ? 'confermata nel tempo' : conf.status === 'incerta' ? 'ancora incerta' : 'non si ripete') : undefined };
    });
  } catch { /* il report esce comunque senza correlazioni */ }

  return { name: useApp.getState().account.name || undefined, from, to, health, mood, finance, tasks: { done, open }, events: { past, upcoming }, correlations, generatedAt: new Date().toISOString() };
}

export type ReportResult = { ok: boolean; message: string };

/** Crea il PDF (telefono: expo-print + expo-sharing) o apre la stampa del browser (web: window.print). */
export async function exportWeeklyReport(): Promise<ReportResult> {
  let html: string;
  try { html = buildReportHtml(gatherReportData()); }
  catch (e) { return { ok: false, message: 'Non riesco a preparare il report: ' + (e instanceof Error ? e.message : String(e)) }; }
  if (Platform.OS === 'web') {
    try {
      const doc = (globalThis as unknown as { document?: Document }).document;
      if (!doc) return { ok: false, message: 'Stampa non disponibile in questo ambiente.' };
      const frame = doc.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      doc.body.appendChild(frame);
      frame.srcdoc = html;
      await new Promise<void>((res) => { frame.onload = () => res(); setTimeout(res, 800); });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60000);
      return { ok: true, message: 'Scegli “Salva come PDF” nella finestra di stampa.' };
    } catch {
      return { ok: false, message: 'Non riesco ad aprire la stampa del browser.' };
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Print = require('expo-print') as typeof import('expo-print');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Report della settimana' });
      return { ok: true, message: 'Report pronto: scegli dove salvarlo o condividerlo.' };
    }
    await Print.printAsync({ html });
    return { ok: true, message: 'Report pronto per la stampa.' };
  } catch (e) {
    return { ok: false, message: 'Non riesco a creare il PDF: ' + (e instanceof Error ? e.message : String(e)) };
  }
}
