/** Benessere sul lavoro (modulo PURO, nessun alias '@/'): carico e stanchezza dai TUOI impegni, pause, esercizi brevi, disconnessione fuori orario, umore.
 *  Tutto si calcola sul telefono e serve solo a chi lo usa: non è mai un giudizio sulle persone e non va mai al team. */
export type Span = [string, string];
export type Schedule = Record<string, Span[]>;
export type Ev = { time: string; title: string; dur?: number; team?: string };
export type TaskLite = { due?: string; done?: boolean; team?: string };
const toMin = (t: string): number => { const [h, m] = t.split(':'); return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0); };
export const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const timed = (e: Ev) => /^\d{1,2}:\d{2}$/.test(e.time) && (e.dur ?? 60) < 1440;
const spansOf = (s: Schedule, day: string): [number, number][] => (s[String(new Date(day + 'T12:00:00').getDay())] ?? []).map(([a, b]): [number, number] => [toMin(a), toMin(b)]).filter(([a, b]) => b > a);
export const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));

/** È fuori dall'orario di lavoro? (giorno libero = fuori) */
export const outsideHours = (s: Schedule, day: string, min: number): boolean => !spansOf(s, day).some(([a, b]) => min >= a && min < b);

export type DayStats = { day: string; workEvents: number; meetingMin: number; extraMin: number; longestStretch: number; noBreak: boolean };
/** Dati di un giorno dai tuoi impegni di lavoro (quelli con workspace). `extraMin` = minuti fuori dall'orario; `longestStretch` = minuti di fila senza una pausa di almeno 10. */
export function dayStats(events: Ev[], s: Schedule, day: string): DayStats {
  const work = events.filter((e) => e.team && timed(e)).map((e) => [toMin(e.time), toMin(e.time) + (e.dur ?? 60)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const spans = spansOf(s, day);
  let extra = 0;
  for (const [a, b] of work) { let inside = 0; for (const [x, y] of spans) inside += Math.max(0, Math.min(b, y) - Math.max(a, x)); extra += (b - a) - inside; }
  let longest = 0; let cur = 0; let end = -1e9; let start = 0;
  for (const [a, b] of work) { if (a - end >= 10) { start = a; } cur = b - start; end = Math.max(end, b); longest = Math.max(longest, cur); }
  return { day, workEvents: work.length, meetingMin: work.reduce((n, [a, b]) => n + (b - a), 0), extraMin: extra, longestStretch: longest, noBreak: longest >= 180 };
}

export type Signal = { id: string; level: 'attenzione' | 'alto'; title: string; why: string; tip: string };
export type Load = { level: 'ok' | 'attenzione' | 'alto'; signals: Signal[]; days: DayStats[]; extraWeekMin: number; overdue: number };
/** Segnali di sovraccarico negli ultimi giorni e per oggi. Sempre con un consiglio gentile, mai un giudizio. */
export function workLoad(byDay: Record<string, Ev[]>, s: Schedule, tasks: TaskLite[], today: string, span = 7): Load {
  const days = lastDays(today, span).map((d) => dayStats(byDay[d] ?? [], s, d));
  const t = days[days.length - 1]!;
  const extraWeek = days.reduce((n, d) => n + d.extraMin, 0);
  const overdue = tasks.filter((x) => x.team && !x.done && x.due && x.due < today).length;
  const soon = tasks.filter((x) => x.team && !x.done && x.due && x.due >= today && x.due <= addDays(today, 2)).length;
  const sig: Signal[] = [];
  if (extraWeek >= 300) sig.push({ id: 'extra-week', level: 'alto', title: 'Molte ore fuori orario', why: `Negli ultimi ${span} giorni hai ${Math.round(extraWeek / 60)} ore di impegni fuori dal tuo orario.`, tip: 'Sposta qualcosa o chiedi di rivedere gli orari: il riposo conta quanto il lavoro.' });
  else if (extraWeek >= 120) sig.push({ id: 'extra-week', level: 'attenzione', title: 'Qualche ora fuori orario', why: `Ci sono ${Math.round(extraWeek / 60)} ore fuori dal tuo orario negli ultimi ${span} giorni.`, tip: 'Prova a recuperarle con una sera libera.' });
  if (t.extraMin >= 60) sig.push({ id: 'extra-today', level: 'attenzione', title: 'Oggi finisci fuori orario', why: `Hai ${t.extraMin} minuti di impegni fuori dall'orario di oggi.`, tip: 'Se puoi, sposta il più piccolo a domani.' });
  if (t.noBreak) sig.push({ id: 'stretch', level: 'alto', title: 'Riunioni una dietro l\'altra', why: `Oggi hai ${Math.round(t.longestStretch / 60 * 10) / 10} ore di fila senza una pausa.`, tip: 'Metti 10 minuti di pausa tra gli incontri: puoi farlo con «Pause nel Plan».' });
  if (t.meetingMin >= 300) sig.push({ id: 'meetings', level: 'attenzione', title: 'Giornata piena di incontri', why: `Oggi hai ${Math.round(t.meetingMin / 60)} ore tra riunioni e impegni.`, tip: 'Lascia un po\' di spazio per il lavoro da fare in silenzio.' });
  if (overdue >= 3) sig.push({ id: 'overdue', level: overdue >= 6 ? 'alto' : 'attenzione', title: 'Task che si accumulano', why: `Hai ${overdue} task di lavoro scaduti.`, tip: 'Scegli i due più importanti e rimanda o delega gli altri.' });
  if (soon >= 8) sig.push({ id: 'soon', level: 'attenzione', title: 'Molte scadenze vicine', why: `Hai ${soon} task di lavoro in scadenza nei prossimi 3 giorni.`, tip: 'Guarda se qualcuno si può spostare di qualche giorno.' });
  const level = sig.some((x) => x.level === 'alto') || sig.length >= 3 ? 'alto' : sig.length ? 'attenzione' : 'ok';
  return { level, signals: sig, days, extraWeekMin: extraWeek, overdue };
}

/* ---------- pause ---------- */
export type Brk = { time: string; kind: 'stand' | 'water' | 'eyes'; dur: number; title: string };
/** Pause suggerite dentro l'orario di lavoro, solo dove non c'è già un impegno: ogni ~50 minuti ti alzi, ogni ~2 ore bevi, gli occhi riposano ogni ora. */
export function breakPlan(events: Ev[], s: Schedule, day: string, everyMin = 50): Brk[] {
  const busy = events.filter(timed).map((e) => [toMin(e.time), toMin(e.time) + (e.dur ?? 60)] as [number, number]);
  const out: Brk[] = []; let n = 0;
  for (const [a, b] of spansOf(s, day)) {
    for (let t = Math.ceil((a + everyMin) / 5) * 5; t + 5 <= b - 10; t += everyMin + 5) {
      if (busy.some(([x, y]) => t < y + 2 && t + 5 > x - 2)) continue;
      n++;
      const kind: Brk['kind'] = n % 2 === 0 ? 'water' : 'stand';
      out.push({ time: fromMin(t), kind, dur: 5, title: kind === 'water' ? 'Pausa: bevi un bicchiere d\'acqua' : 'Pausa: alzati e muoviti' });
    }
  }
  return out;
}

/* ---------- esercizi brevi ---------- */
export type Exercise = { id: string; title: string; area: 'collo' | 'spalle' | 'polsi' | 'occhi' | 'schiena' | 'gambe' | 'respiro'; seconds: number; steps: string[]; note?: string };
export const EXERCISES: Exercise[] = [
  { id: 'collo', title: 'Collo sciolto', area: 'collo', seconds: 60, steps: ['Siediti dritto, spalle morbide.', 'Porta l\'orecchio destro verso la spalla e resta 15 secondi.', 'Torna al centro e ripeti a sinistra.', 'Abbassa piano il mento verso il petto per 15 secondi.'] },
  { id: 'spalle', title: 'Spalle giù', area: 'spalle', seconds: 45, steps: ['Alza le spalle verso le orecchie e stringi 3 secondi.', 'Lasciale cadere di colpo.', 'Fai 5 cerchi all\'indietro con le spalle.'] },
  { id: 'polsi', title: 'Polsi e mani', area: 'polsi', seconds: 60, steps: ['Stendi il braccio con il palmo in alto.', 'Con l\'altra mano tira piano le dita verso il basso per 15 secondi.', 'Cambia mano.', 'Chiudi e apri le mani 10 volte.'], note: 'Se senti formicolio o dolore, fermati e parlane con il medico.' },
  { id: 'occhi', title: 'Occhi riposati (20-20-20)', area: 'occhi', seconds: 30, steps: ['Stacca lo sguardo dallo schermo.', 'Guarda qualcosa lontano, almeno a 6 metri, per 20 secondi.', 'Batti le palpebre dieci volte lentamente.'] },
  { id: 'schiena', title: 'Schiena che si allunga', area: 'schiena', seconds: 60, steps: ['In piedi, intreccia le mani sopra la testa.', 'Allungati verso l\'alto e piegati piano a destra, poi a sinistra, 10 secondi per lato.', 'Metti le mani sui fianchi e inarca delicatamente la schiena indietro per 5 secondi.'] },
  { id: 'torsione', title: 'Torsione sulla sedia', area: 'schiena', seconds: 60, steps: ['Siediti di lato, i piedi a terra.', 'Gira il busto a destra tenendo lo schienale, 20 secondi.', 'Cambia lato.'] },
  { id: 'gambe', title: 'Gambe in movimento', area: 'gambe', seconds: 90, steps: ['In piedi, appoggiati alla scrivania.', 'Fai 10 sedute lente, come per sederti sulla sedia.', 'Sali sulle punte dei piedi 10 volte.', 'Cammina sul posto mezzo minuto.'] },
  { id: 'respiro', title: 'Respiro che calma', area: 'respiro', seconds: 60, steps: ['Siediti comodo, mani sulle gambe.', 'Inspira dal naso contando fino a 4.', 'Espira lentamente dalla bocca contando fino a 6.', 'Ripeti per un minuto.'] },
];
export const exerciseFor = (kind: Brk['kind']): Exercise => EXERCISES.find((e) => e.id === (kind === 'water' ? 'respiro' : kind === 'eyes' ? 'occhi' : 'collo'))!;
/** Un esercizio che cambia ogni giorno, così non è sempre lo stesso. */
export const exerciseOfDay = (day: string): Exercise => EXERCISES[Math.abs([...day].reduce((n, c) => n + c.charCodeAt(0), 0)) % EXERCISES.length]!;

/* ---------- umore al lavoro ---------- */
export type WorkMood = { day: string; v: 1 | 2 | 3 | 4 | 5; note?: string };
export const MOOD_LABELS: Record<number, string> = { 1: 'Faticoso', 2: 'Pesante', 3: 'Così così', 4: 'Bene', 5: 'Molto bene' };
/** Confronta, solo per te, l'umore nei giorni più carichi e negli altri. Serve almeno una settimana di dati: prima non dice nulla. */
export function moodVsLoad(moods: WorkMood[], loadOf: (day: string) => number, threshold = 300): { hint: string | null; n: number } {
  if (moods.length < 6) return { hint: null, n: moods.length };
  const hi = moods.filter((m) => loadOf(m.day) >= threshold); const lo = moods.filter((m) => loadOf(m.day) < threshold);
  if (hi.length < 2 || lo.length < 2) return { hint: null, n: moods.length };
  const avg = (l: WorkMood[]) => l.reduce((n, m) => n + m.v, 0) / l.length;
  const d = avg(lo) - avg(hi);
  if (d >= 0.7) return { hint: 'Nei giorni più pieni di incontri ti senti un po\' più stanco. Proteggere le pause può aiutare.', n: moods.length };
  if (d <= -0.7) return { hint: 'Nei giorni pieni stai bene: probabilmente ti piace quando c\'è movimento.', n: moods.length };
  return { hint: 'Il tuo umore non cambia molto con il carico: bene così.', n: moods.length };
}
export const moodAverage = (moods: WorkMood[], days: string[]): number | null => { const l = moods.filter((m) => days.includes(m.day)); return l.length ? Math.round((l.reduce((n, m) => n + m.v, 0) / l.length) * 10) / 10 : null; };
