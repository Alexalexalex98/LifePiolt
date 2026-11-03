/** Diario del benessere mentale da condividere con psicologi, medici o nutrizionisti (modulo PURO): un riepilogo leggibile (HTML per il PDF) e un CSV. Lo sceglie l'utente, nessun invio automatico. */
export type MoodRow = { day?: string; date: string; mood: string; energy?: number; functioning?: number; alcohol?: number };
export type ExRow = { ts: number; title: string; answers: string };
export type ResultRow = { ts: number; kind: string; score: number; max: number; label: string };
export type NoteRow = { ts: number; kind: string; note: string };
export type DiaryInput = { name?: string; from: number; to: number; moods: MoodRow[]; exercises: ExRow[]; results: ResultRow[]; notes?: NoteRow[]; sleepAvg?: number };

const d = (ts: number) => { const x = new Date(ts); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const csvEsc = (s: string) => (/[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const ENERGY = ['', 'esausto/a', 'stanco/a', 'così così', 'carico/a', 'pieno/a di energia'];
const FUNC = ['', 'per niente', 'con fatica', 'abbastanza', 'bene', 'benissimo'];
const ALC: Record<number, string> = { 0: 'niente', 1: 'poco', 2: 'parecchio', [-1]: 'non risposto' };
const KIND: Record<string, string> = { who5: 'WHO-5 (benessere)', phq9: 'PHQ-9 (umore)' };
const inRange = (ts: number, i: DiaryInput) => ts >= i.from && ts <= i.to;
const dayTs = (m: MoodRow) => (m.day ? Date.parse(m.day) : Date.parse(m.date)) || 0;

export function moodSummary(moods: MoodRow[]): { n: number; top: [string, number][] } {
  const c: Record<string, number> = {}; moods.forEach((m) => { c[m.mood] = (c[m.mood] ?? 0) + 1; });
  return { n: moods.length, top: Object.entries(c).sort((a, b) => b[1] - a[1]) };
}

export function diaryCsv(i: DiaryInput): string {
  const rows: string[] = ['Tipo,Data,Dettaglio 1,Dettaglio 2,Dettaglio 3'];
  i.moods.filter((m) => inRange(dayTs(m), i)).forEach((m) => rows.push(['Umore', d(dayTs(m)), csvEsc(m.mood), csvEsc(ENERGY[m.energy ?? 0] ?? ''), csvEsc(FUNC[m.functioning ?? 0] ?? '')].join(',')));
  i.exercises.filter((e) => inRange(e.ts, i)).forEach((e) => rows.push(['Esercizio', d(e.ts), csvEsc(e.title), csvEsc(e.answers), ''].join(',')));
  i.results.filter((r) => inRange(r.ts, i)).forEach((r) => rows.push(['Questionario', d(r.ts), csvEsc(KIND[r.kind] ?? r.kind), `${r.score}/${r.max}`, csvEsc(r.label)].join(',')));
  (i.notes ?? []).filter((n) => inRange(n.ts, i)).forEach((n) => rows.push(['Nota', d(n.ts), csvEsc(n.kind), csvEsc(n.note), ''].join(',')));
  return rows.join('\n');
}

export function diaryHtml(i: DiaryInput): string {
  const moods = i.moods.filter((m) => inRange(dayTs(m), i)).sort((a, b) => dayTs(a) - dayTs(b));
  const ex = i.exercises.filter((e) => inRange(e.ts, i)).sort((a, b) => a.ts - b.ts);
  const res = i.results.filter((r) => inRange(r.ts, i)).sort((a, b) => a.ts - b.ts);
  const notes = (i.notes ?? []).filter((n) => inRange(n.ts, i)).sort((a, b) => a.ts - b.ts);
  const sum = moodSummary(moods);
  const table = (head: string[], rows: string[][]) => rows.length ? `<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="muted">Nessun dato in questo periodo.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1b1f27;margin:28px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #d8dde6;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d8dde6;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f3f8}.muted{color:#6b7482;font-size:12px}.box{background:#f6f7fb;border-radius:8px;padding:10px;font-size:12px;margin-top:10px}
</style></head><body>
<h1>Diario del benessere</h1>
<p class="muted">${i.name ? `${esc(i.name)} · ` : ''}dal ${d(i.from)} al ${d(i.to)} · creato con LifePilot il ${d(Date.now())}</p>
<h2>In breve</h2>
<p>Check-in dell'umore: <b>${sum.n}</b>${sum.top.length ? ` · più frequenti: ${sum.top.slice(0, 3).map(([m, c]) => `${esc(m)} (${c})`).join(', ')}` : ''}${i.sleepAvg != null ? ` · sonno medio ultime notti: <b>${String(Math.round(i.sleepAvg * 10) / 10).replace('.', ',')} ore</b>` : ''} · esercizi svolti: <b>${ex.length}</b></p>
<h2>Umore, energia e funzionamento</h2>${table(['Data', 'Umore', 'Energia', 'Fare le cose di ogni giorno', 'Alcol'], moods.map((m) => [d(dayTs(m)), m.mood, ENERGY[m.energy ?? 0] ?? '', FUNC[m.functioning ?? 0] ?? '', m.alcohol != null ? ALC[m.alcohol] ?? '' : '']))}
<h2>Questionari</h2>${table(['Data', 'Questionario', 'Punteggio', 'Esito'], res.map((r) => [d(r.ts), KIND[r.kind] ?? r.kind, `${r.score}/${r.max}`, r.label]))}
<h2>Esercizi svolti</h2>${table(['Data', 'Esercizio', 'Risposte scritte'], ex.map((e) => [d(e.ts), e.title, e.answers]))}
${notes.length ? `<h2>Note scelte dall'utente</h2>${table(['Data', 'Tipo', 'Nota'], notes.map((n) => [d(n.ts), n.kind, n.note]))}` : ''}
<div class="box">Questo riepilogo è stato scritto dalla persona con l'app e non è una diagnosi. I questionari orientano, non diagnosticano. Per qualunque valutazione serve un professionista.</div>
</body></html>`;
}
