/**
 * Report settimanale: genera l'HTML (poi convertito in PDF). Funzione PURA e testata: nessun accesso agli store.
 * Tutto il testo dinamico è sottoposto a escape per evitare HTML iniettato da nomi/descrizioni.
 */
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
const wd = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const dayLabel = (iso: string) => `${wd[new Date(iso + 'T00:00:00').getDay()]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

const section = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;
const empty = (t: string) => `<p class="muted">${esc(t)}</p>`;

export function buildReportHtml(d: ReportData): string {
  const health = d.health.length
    ? `<table>${d.health.map((m) => `<tr><td>${esc(m.label)}</td><td class="r"><b>${esc(m.value)}</b></td><td class="r muted">${esc(m.delta ?? '')}</td></tr>`).join('')}</table>`
    : empty('Nessun dato di salute questa settimana. Collega Apple Health o registra i dati a mano.');
  const mood = d.mood && d.mood.days > 0
    ? `<p>Umore medio <b>${d.mood.avg != null ? d.mood.avg.toFixed(1).replace('.', ',') : '—'}</b> su 5, ${d.mood.days} ${d.mood.days === 1 ? 'giorno registrato' : 'giorni registrati'}.</p>${d.mood.best ? `<p class="muted">Giorno migliore: ${esc(d.mood.best)}${d.mood.worst && d.mood.worst !== d.mood.best ? ` · più difficile: ${esc(d.mood.worst)}` : ''}.</p>` : ''}`
    : empty('Nessun check-in dell’umore questa settimana.');
  const fin = d.finance && (d.finance.income || d.finance.spent)
    ? `<table><tr><td>Entrate</td><td class="r"><b>${chf(d.finance.income)} CHF</b></td></tr><tr><td>Uscite</td><td class="r"><b>${chf(d.finance.spent)} CHF</b></td></tr><tr><td>Saldo della settimana</td><td class="r"><b>${d.finance.net >= 0 ? '+' : ''}${chf(d.finance.net)} CHF</b></td></tr>${d.finance.monthNet != null ? `<tr><td>Saldo del mese in corso</td><td class="r">${d.finance.monthNet >= 0 ? '+' : ''}${chf(d.finance.monthNet)} CHF</td></tr>` : ''}</table>${d.finance.top.length ? `<p class="muted">Dove sono andate le spese: ${d.finance.top.map((t) => `${esc(t.name)} ${chf(t.amount)} CHF`).join(' · ')}</p>` : ''}${d.finance.alerts.map((a) => `<p class="warn">${esc(a)}</p>`).join('')}`
    : empty('Nessun movimento questa settimana.');
  const tasks = d.tasks.done.length
    ? `<p><b>${d.tasks.done.length}</b> ${d.tasks.done.length === 1 ? 'task completato' : 'task completati'}${d.tasks.open ? `, ${d.tasks.open} ancora aperti` : ''}.</p><ul>${d.tasks.done.slice(0, 15).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${d.tasks.done.length > 15 ? `<p class="muted">e altri ${d.tasks.done.length - 15}…</p>` : ''}`
    : empty(d.tasks.open ? `Nessun task completato; ${d.tasks.open} ancora aperti.` : 'Nessun task completato.');
  const events = `<p>${d.events.past} ${d.events.past === 1 ? 'impegno' : 'impegni'} nella settimana appena passata.</p>` + (d.events.upcoming.length
    ? `<p class="muted">Prossimi 7 giorni:</p><table>${d.events.upcoming.slice(0, 20).map((e) => `<tr><td>${esc(dayLabel(e.day))} ${esc(e.time)}</td><td>${esc(e.title)}</td></tr>`).join('')}</table>`
    : empty('Nessun impegno nei prossimi 7 giorni.'));
  const corr = d.correlations.length
    ? `<ul>${d.correlations.map((c) => `<li>${esc(c.sentence)}<br><span class="muted">${esc(c.detail)}${c.status ? ` · ${esc(c.status)}` : ''}</span></li>`).join('')}</ul><p class="muted">Sono associazioni statistiche tra i tuoi dati, non cause.</p>`
    : empty('Ancora nessun legame statisticamente solido tra i tuoi dati: servono più giorni.');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report della settimana</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1b2430;margin:28px;font-size:14px;line-height:1.45}
h1{font-size:24px;margin:0 0 2px}h2{font-size:16px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid #dfe5ee}
.sub{color:#6b7686;margin:0 0 6px}.muted{color:#6b7686}.warn{color:#a15c00}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid #eef1f6;vertical-align:top}.r{text-align:right}ul{margin:6px 0;padding-left:20px}li{margin:3px 0}section{break-inside:avoid}
.foot{margin-top:26px;color:#8a94a3;font-size:11px}
</style></head><body>
<h1>Report della settimana</h1>
<p class="sub">${d.name ? esc(d.name) + ' · ' : ''}${dmy(d.from)} – ${dmy(d.to)}</p>
${section('Salute', health)}${section('Umore', mood)}${section('Finanze', fin)}${section('Task completati', tasks)}${section('Impegni', events)}${section('Cosa influenza cosa', corr)}
<p class="foot">Generato da LifePilot il ${esc(dmy(d.generatedAt.slice(0, 10)))}. I dati vengono dai tuoi dispositivi e dalle tue registrazioni; non è un parere medico né una consulenza finanziaria.</p>
</body></html>`;
}
