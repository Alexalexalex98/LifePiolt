/**
 * Report settimanale: genera l'HTML (poi convertito in PDF). Funzione PURA e testata: nessun accesso agli store.
 * Tutto il testo dinamico è sottoposto a escape per evitare HTML iniettato da nomi/descrizioni.
 */
import { getActive, t } from '../i18n/core.ts';

export type ReportMetric = { label: string; value: string; delta?: string | null; note?: string };
export type ReportData = {
  name?: string;
  from: string; to: string; // ISO
  health: ReportMetric[];
  mood: { avg: number | null; days: number; best?: string | null; worst?: string | null } | null;
  finance: { income: number; spent: number; net: number; top: { name: string; amount: number }[]; monthNet: number | null; alerts: string[] } | null;
  tasks: { done: string[]; open: number };
  events: { past: number; upcoming: { day: string; time: string; title: string }[] };
  correlations: { sentence: string; detail: string; status?: string }[];
  generatedAt: string; // ISO datetime
};

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const chf = (n: number) => (n < 0 ? '-' : '') + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const wdShort = () => [t('dom'), t('lun'), t('mar'), t('mer'), t('gio'), t('ven'), t('sab')];
const dayLabel = (iso: string) => `${wdShort()[new Date(iso + 'T00:00:00').getDay()]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

const section = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;
const empty = (t: string) => `<p class="muted">${esc(t)}</p>`;

export function buildReportHtml(d: ReportData): string {
  const health = d.health.length
    ? `<table>${d.health.map((m) => `<tr><td>${esc(m.label)}</td><td class="r"><b>${esc(m.value)}</b></td><td class="r muted">${esc(m.delta ?? '')}</td></tr>`).join('')}</table>`
    : empty(t('Nessun dato di salute questa settimana. Collega Apple Health o registra i dati a mano.'));
  const mood = d.mood && d.mood.days > 0
    ? `<p>${t('Umore medio {0} su 5,', `<b>${d.mood.avg != null ? d.mood.avg.toFixed(1).replace('.', ',') : '—'}</b>`)} ${d.mood.days === 1 ? t('1 giorno registrato') : t('{0} giorni registrati', d.mood.days)}.</p>${d.mood.best ? `<p class="muted">${t('Giorno migliore: {0}', esc(d.mood.best))}${d.mood.worst && d.mood.worst !== d.mood.best ? ` · ${t('più difficile: {0}', esc(d.mood.worst))}` : ''}.</p>` : ''}`
    : empty(t('Nessun check-in dell’umore questa settimana.'));
  const fin = d.finance && (d.finance.income || d.finance.spent)
    ? `<table><tr><td>${t('Entrate')}</td><td class="r"><b>${chf(d.finance.income)} CHF</b></td></tr><tr><td>${t('Uscite')}</td><td class="r"><b>${chf(d.finance.spent)} CHF</b></td></tr><tr><td>${t('Saldo della settimana')}</td><td class="r"><b>${d.finance.net >= 0 ? '+' : ''}${chf(d.finance.net)} CHF</b></td></tr>${d.finance.monthNet != null ? `<tr><td>${t('Saldo del mese in corso')}</td><td class="r">${d.finance.monthNet >= 0 ? '+' : ''}${chf(d.finance.monthNet)} CHF</td></tr>` : ''}</table>${d.finance.top.length ? `<p class="muted">${t('Dove sono andate le spese: {0}', d.finance.top.map((x) => `${esc(x.name)} ${chf(x.amount)} CHF`).join(' · '))}</p>` : ''}${d.finance.alerts.map((a) => `<p class="warn">${esc(a)}</p>`).join('')}`
    : empty(t('Nessun movimento questa settimana.'));
  const tasks = d.tasks.done.length
    ? `<p>${d.tasks.done.length === 1 ? t('<b>1</b> task completato') : t('<b>{0}</b> task completati', d.tasks.done.length)}${d.tasks.open ? ', ' + t('{0} ancora aperti', d.tasks.open) : ''}.</p><ul>${d.tasks.done.slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${d.tasks.done.length > 15 ? `<p class="muted">${t('e altri {0}…', d.tasks.done.length - 15)}</p>` : ''}`
    : empty(d.tasks.open ? t('Nessun task completato; {0} ancora aperti.', d.tasks.open) : t('Nessun task completato.'));
  const events = `<p>${d.events.past === 1 ? t('1 impegno nella settimana appena passata.') : t('{0} impegni nella settimana appena passata.', d.events.past)}</p>` + (d.events.upcoming.length
    ? `<p class="muted">${t('Prossimi 7 giorni:')}</p><table>${d.events.upcoming.slice(0, 20).map((e) => `<tr><td>${esc(dayLabel(e.day))} ${esc(e.time)}</td><td>${esc(e.title)}</td></tr>`).join('')}</table>`
    : empty(t('Nessun impegno nei prossimi 7 giorni.')));
  const corr = d.correlations.length
    ? `<ul>${d.correlations.map((c) => `<li>${esc(c.sentence)}<br><span class="muted">${esc(c.detail)}${c.status ? ` · ${esc(c.status)}` : ''}</span></li>`).join('')}</ul><p class="muted">${t('Sono associazioni statistiche tra i tuoi dati, non cause.')}</p>`
    : empty(t('Ancora nessun legame statisticamente solido tra i tuoi dati: servono più giorni.'));
  return `<!doctype html><html lang="${getActive()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t('Report della settimana')}</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1b2430;margin:28px;font-size:14px;line-height:1.45}
h1{font-size:24px;margin:0 0 2px}h2{font-size:16px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid #dfe5ee}
.sub{color:#6b7686;margin:0 0 6px}.muted{color:#6b7686}.warn{color:#a15c00}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid #eef1f6;vertical-align:top}.r{text-align:right}ul{margin:6px 0;padding-left:20px}li{margin:3px 0}section{break-inside:avoid}
.foot{margin-top:26px;color:#8a94a3;font-size:11px}
</style></head><body>
<h1>${t('Report della settimana')}</h1>
<p class="sub">${d.name ? esc(d.name) + ' · ' : ''}${dmy(d.from)} – ${dmy(d.to)}</p>
${section(t('Salute'), health)}${section(t('Umore'), mood)}${section(t('Finanze'), fin)}${section(t('Task completati'), tasks)}${section(t('Impegni'), events)}${section(t('Cosa influenza cosa'), corr)}
<p class="foot">${t('Generato da LifePilot il {0}. I dati vengono dai tuoi dispositivi e dalle tue registrazioni; non è un parere medico né una consulenza finanziaria.', esc(dmy(d.generatedAt.slice(0, 10))))}</p>
</body></html>`;
}
