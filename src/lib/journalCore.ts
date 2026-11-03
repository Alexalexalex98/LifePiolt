/**
 * Diario personale (modulo PURO): una pagina per giorno, e un'analisi fatta SUL TELEFONO (parole, non diagnosi)
 * di stato d'animo, temi e tono delle relazioni. Theia non risponde al diario: lo legge solo per l'analisi.
 */
export type Seg = { id: string; ts: number; text: string; via: 'typed' | 'voice' };
export type JEntry = { day: string; segs: Seg[]; updated: number };
export type Tone = { valence: number; mood: string; words: number };
export type PersonTone = { who: string; mentions: number; valence: number };
export type DayAnalysis = Tone & { day: string; themes: string[]; people: PersonTone[]; care: boolean };
export type PeriodAnalysis = {
  from: string; to: string; days: number; written: number; words: number;
  avg: number; mood: string; trend: 'su' | 'giù' | 'stabile' | 'poco';
  best?: DayAnalysis; worst?: DayAnalysis;
  themes: { theme: string; days: number; valence: number }[];
  people: PersonTone[]; care: boolean; daily: DayAnalysis[];
};

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date | number = new Date()): string => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const addDays = (key: string, n: number): string => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y!, m! - 1, d! + n)); };
export const dayLabel = (key: string): string => { const [y, m, d] = key.split('-').map(Number); return new Date(y!, m! - 1, d!).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
export const entryText = (e: JEntry | undefined): string => (e?.segs ?? []).map((s) => s.text.trim()).filter(Boolean).join('\n\n');
const stem = (w: string) => w.toLowerCase().normalize('NFC');

/* ---- parole e pesi (italiano): positivo > 0, negativo < 0. Si confrontano come inizio parola. ---- */
const POS: [string, number][] = [['felic', 2], ['content', 1.5], ['sereno', 2], ['serena', 2], ['sereni', 1.5], ['tranquill', 1.5], ['bene', 1.2], ['benissimo', 2], ['ottim', 1.8], ['bell', 1], ['meraviglios', 2], ['fantastic', 2], ['grat', 1.5], ['orgogli', 1.8], ['amo', 1.5], ['amor', 1.2], ['ador', 1.5], ['sorris', 1.5], ['rid', 1], ['divert', 1.5], ['entusias', 2], ['energi', 1], ['riposat', 1.5], ['fiduci', 1.5], ['speran', 1.2], ['sollev', 1.5], ['calm', 1.5], ['rilassat', 1.5], ['soddisf', 1.8], ['riuscit', 1.2], ['successo', 1.5], ['abbracci', 1.5], ['gioia', 2], ['pace', 1.2], ['motivat', 1.5], ['forte', 1], ['leggero', 1], ['leggera', 1], ['migliorat', 1.2], ['orgoglio', 1.8]];
const NEG: [string, number][] = [['triste', -2], ['tristezz', -2], ['giù', -1.5], ['depress', -2.5], ['ansi', -2], ['preoccupat', -1.5], ['preoccupazion', -1.5], ['paura', -2], ['spavent', -2], ['panico', -2.5], ['stress', -1.8], ['stanc', -1.2], ['esaust', -2], ['sfinit', -2], ['distrutt', -2], ['arrabbiat', -1.8], ['rabbia', -2], ['furios', -2], ['nervos', -1.5], ['irritat', -1.5], ['frustrat', -1.8], ['delus', -1.8], ['solo', -1], ['sola', -1], ['solitudin', -2], ['vuot', -1.8], ['piang', -1.8], ['pianto', -1.8], ['male', -1.3], ['malissimo', -2.2], ['peggio', -1.5], ['orribil', -2], ['terribil', -2], ['odio', -2.2], ['colpa', -1.5], ['vergogn', -1.8], ['inutil', -2], ['fallimento', -2.2], ['fallit', -1.8], ['sbagliat', -1.2], ['dolor', -1.8], ['insonnia', -2], ['non dorm', -1.8], ['angoscia', -2.5], ['agitat', -1.5], ['sopraffatt', -2.2], ['disperat', -2.5], ['litig', -1.8], ['discuss', -1.2], ['senza speranza', -2.5], ['non ce la faccio', -2.5], ['pesante', -1.2], ['pesa', -1.2]];
const NEGATORS = /^(non|mai|niente|nessun[oa]?|senza)$/;
const INTENS: Record<string, number> = { molto: 1.4, tanto: 1.4, davvero: 1.3, troppo: 1.4, super: 1.4, estremamente: 1.6, abbastanza: 1.1, poco: 0.6, un_po: 0.7 };

export const THEMES: Record<string, string[]> = {
  lavoro: ['lavor', 'ufficio', 'capo', 'collega', 'colleghi', 'riunione', 'cliente', 'clienti', 'progetto', 'scadenza', 'stipendio', 'turno', 'turni'],
  famiglia: ['mamma', 'papà', 'padre', 'madre', 'fratell', 'sorell', 'figli', 'figlio', 'figlia', 'nonn', 'genitor', 'famiglia', 'zio', 'zia', 'cugin'],
  coppia: ['marito', 'moglie', 'compagn', 'fidanzat', 'ragazzo', 'ragazza', 'partner', 'amore', 'relazione', 'ex '],
  amicizie: ['amic', 'amica', 'amici', 'uscit', 'serata', 'compagnia'],
  sonno: ['dorm', 'sonno', 'insonnia', 'sveglia', 'incubo', 'riposo', 'notte'],
  salute: ['salute', 'dolor', 'medic', 'dottor', 'visita', 'febbre', 'malat', 'mal di', 'farmac', 'terapia', 'psicolog', 'psichiatr'],
  soldi: ['soldi', 'bollett', 'affitto', 'mutuo', 'spese', 'debit', 'stipendio', 'conto', 'pagare'],
  ansia: ['ansi', 'panico', 'agitat', 'preoccup', 'paura', 'angoscia', 'tensione'],
  corpo: ['palestra', 'allenament', 'corsa', 'camminat', 'yoga', 'cibo', 'mangi', 'peso', 'dieta'],
  studio: ['esame', 'studi', 'universit', 'scuola', 'lezione', 'tesi', 'compito'],
};
export const THEME_LABEL: Record<string, string> = { lavoro: 'Lavoro', famiglia: 'Famiglia', coppia: 'Coppia', amicizie: 'Amicizie', sonno: 'Sonno', salute: 'Salute', soldi: 'Soldi', ansia: 'Ansia e preoccupazioni', corpo: 'Corpo e movimento', studio: 'Studio' };

/** Persone e relazioni nominate: etichetta → radici. */
export const PEOPLE: Record<string, string[]> = {
  'Partner': ['marito', 'moglie', 'compagn', 'fidanzat', 'partner', 'ragazzo mio', 'ragazza mia'],
  'Mamma': ['mamma', 'madre', 'mia madre'], 'Papà': ['papà', 'padre', 'mio padre'],
  'Figli': ['figli', 'figlio', 'figlia', 'bambin'], 'Fratelli e sorelle': ['fratell', 'sorell'],
  'Amici': ['amic', 'amica', 'amici'], 'Colleghi e capo': ['collega', 'colleghi', 'capo', 'responsabile'],
  'Ex': ['mio ex', 'mia ex', ' ex '],
};

/** Parole che indicano un possibile pericolo: l'app non fa diagnosi, ma mostra dove trovare aiuto. */
const CARE = /(suicid|ammazzar|togliermi la vita|farmi del male|non voglio più vivere|voglio morire|meglio se non ci fossi|autolesion)/i;
export const careNeeded = (text: string): boolean => CARE.test(text);

export const MOODS = ['molto giù', 'giù', 'così così', 'sereno', 'bene', 'molto bene'];
export function moodWord(v: number): string { return v <= -0.6 ? MOODS[0]! : v <= -0.2 ? MOODS[1]! : v < 0.15 ? MOODS[2]! : v < 0.4 ? MOODS[3]! : v < 0.7 ? MOODS[4]! : MOODS[5]!; }

const sentences = (t: string): string[] => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const tokens = (s: string): string[] => s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** Valore di una frase da −1 a 1 (con negazioni e intensificatori entro due parole). */
export function sentenceValence(s: string): { v: number; hits: number } {
  const w = tokens(s); let sum = 0; let hits = 0;
  const low = ` ${w.join(' ')} `;
  for (const [k, val] of NEG) if (k.includes(' ') && low.includes(` ${k}`)) { sum += val; hits++; }
  w.forEach((tk, i) => {
    let val = 0;
    for (const [k, x] of POS) if (!k.includes(' ') && tk.startsWith(k)) { val = x; break; }
    if (!val) for (const [k, x] of NEG) if (!k.includes(' ') && tk.startsWith(k)) { val = x; break; }
    if (!val) return;
    const prev = [w[i - 1], w[i - 2]].filter(Boolean) as string[];
    if (prev.some((p) => NEGATORS.test(p))) val = -val * 0.8;
    const mult = prev.map((p) => INTENS[p]).find((x) => x); if (mult) val *= mult;
    sum += val; hits++;
  });
  if (!hits) return { v: 0, hits: 0 };
  return { v: Math.max(-1, Math.min(1, sum / Math.max(2, Math.sqrt(hits) * 2.2))), hits };
}

export function toneOf(text: string): Tone {
  const ss = sentences(text); let tot = 0; let n = 0;
  ss.forEach((s) => { const r = sentenceValence(s); if (r.hits) { tot += r.v; n++; } });
  const valence = n ? Math.max(-1, Math.min(1, tot / n)) : 0;
  return { valence: Math.round(valence * 100) / 100, mood: moodWord(valence), words: tokens(text).length };
}
export function themesOf(text: string): string[] {
  const low = ` ${text.toLowerCase()} `;
  return Object.entries(THEMES).filter(([, ks]) => ks.some((k) => low.includes(k.startsWith(' ') || k.endsWith(' ') ? k : k))).map(([t]) => t);
}
export function peopleOf(text: string): PersonTone[] {
  const out: Record<string, { m: number; s: number; h: number }> = {};
  for (const s of sentences(text)) {
    const low = ` ${s.toLowerCase()} `; const r = sentenceValence(s);
    for (const [who, ks] of Object.entries(PEOPLE)) if (ks.some((k) => low.includes(k))) { const o = out[who] ?? (out[who] = { m: 0, s: 0, h: 0 }); o.m++; if (r.hits) { o.s += r.v; o.h++; } }
  }
  return Object.entries(out).map(([who, o]) => ({ who, mentions: o.m, valence: o.h ? Math.round((o.s / o.h) * 100) / 100 : 0 })).sort((a, b) => b.mentions - a.mentions);
}
export function analyzeDay(e: JEntry): DayAnalysis {
  const t = entryText(e);
  return { day: e.day, ...toneOf(t), themes: themesOf(t), people: peopleOf(t), care: careNeeded(t) };
}

/** Analisi di un periodo: media dell'umore, andamento, temi ricorrenti e tono delle relazioni. */
export function analyzePeriod(entries: JEntry[], from: string, to: string): PeriodAnalysis {
  const inR = entries.filter((e) => e.day >= from && e.day <= to && entryText(e).trim()).sort((a, b) => a.day.localeCompare(b.day));
  const daily = inR.map(analyzeDay);
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  const withMood = daily.filter((d) => d.words >= 3);
  const avg = withMood.length ? withMood.reduce((a, d) => a + d.valence, 0) / withMood.length : 0;
  let trend: PeriodAnalysis['trend'] = 'poco';
  if (withMood.length >= 4) { const h = Math.floor(withMood.length / 2); const a = withMood.slice(0, h), b = withMood.slice(-h); const m = (x: DayAnalysis[]) => x.reduce((s, d) => s + d.valence, 0) / x.length; const diff = m(b) - m(a); trend = diff > 0.12 ? 'su' : diff < -0.12 ? 'giù' : 'stabile'; }
  const th: Record<string, { n: number; s: number }> = {};
  daily.forEach((d) => d.themes.forEach((t) => { const o = th[t] ?? (th[t] = { n: 0, s: 0 }); o.n++; o.s += d.valence; }));
  const pp: Record<string, { m: number; s: number; c: number }> = {};
  daily.forEach((d) => d.people.forEach((p) => { const o = pp[p.who] ?? (pp[p.who] = { m: 0, s: 0, c: 0 }); o.m += p.mentions; o.s += p.valence * p.mentions; o.c += p.mentions; }));
  const sorted = [...withMood].sort((a, b) => a.valence - b.valence);
  return {
    from, to, days, written: inR.length, words: daily.reduce((a, d) => a + d.words, 0), avg: Math.round(avg * 100) / 100, mood: moodWord(avg), trend,
    best: sorted.length ? sorted[sorted.length - 1] : undefined, worst: sorted.length ? sorted[0] : undefined,
    themes: Object.entries(th).map(([theme, o]) => ({ theme, days: o.n, valence: Math.round((o.s / o.n) * 100) / 100 })).sort((a, b) => b.days - a.days).slice(0, 6),
    people: Object.entries(pp).map(([who, o]) => ({ who, mentions: o.m, valence: Math.round((o.s / o.c) * 100) / 100 })).sort((a, b) => b.mentions - a.mentions).slice(0, 6),
    care: daily.some((d) => d.care), daily,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmy = (k: string) => k.split('-').reverse().join('/');
const CSS = `body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1b1f27;margin:28px;line-height:1.5}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px;border-bottom:1px solid #d8dde6;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d8dde6;padding:5px 7px;text-align:left}th{background:#f1f3f8}.muted{color:#6b7482;font-size:12px}.box{border:1px solid #d8dde6;background:#f7f8fb;border-radius:8px;padding:10px;font-size:12px;margin-top:18px}.day{page-break-inside:avoid;margin:14px 0}.day h3{font-size:13px;margin:0 0 4px;text-transform:capitalize}p{margin:0 0 6px;white-space:pre-wrap}`;
const tone = (v: number) => (v > 0.15 ? 'positivo' : v < -0.15 ? 'difficile' : 'neutro');

/** SOLO l'analisi (niente testo del diario): è quello che si manda al medico o allo psicologo. */
export function analysisHtml(a: PeriodAnalysis, name?: string): string {
  const th = a.themes.map((t) => `<tr><td>${esc(THEME_LABEL[t.theme] ?? t.theme)}</td><td>${t.days} giorni</td><td>${tone(t.valence)}</td></tr>`).join('');
  const pe = a.people.map((p) => `<tr><td>${esc(p.who)}</td><td>${p.mentions}</td><td>${tone(p.valence)}</td></tr>`).join('');
  const tr = a.trend === 'su' ? 'in miglioramento' : a.trend === 'giù' ? 'in peggioramento' : a.trend === 'stabile' ? 'stabile' : 'troppo pochi giorni per dirlo';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<h1>Analisi del diario</h1><p class="muted">${name ? `${esc(name)} · ` : ''}dal ${dmy(a.from)} al ${dmy(a.to)} · creata con LifePilot il ${dmy(dayKey())}</p>
<h2>In breve</h2><p>Giorni scritti: <b>${a.written}</b> su ${a.days} · stato d'animo medio: <b>${esc(a.mood)}</b> · andamento: <b>${tr}</b>.</p>
${a.worst && a.best ? `<p class="muted">Giorno più difficile: ${dmy(a.worst.day)} (${esc(a.worst.mood)}) · giorno migliore: ${dmy(a.best.day)} (${esc(a.best.mood)}).</p>` : ''}
<h2>Temi ricorrenti</h2>${th ? `<table><tr><th>Tema</th><th>Quanto</th><th>Tono</th></tr>${th}</table>` : '<p class="muted">Nessun tema ricorrente.</p>'}
<h2>Relazioni</h2>${pe ? `<table><tr><th>Persona</th><th>Citazioni</th><th>Tono</th></tr>${pe}</table>` : '<p class="muted">Nessuna relazione citata.</p>'}
<h2>Giorno per giorno</h2><table><tr><th>Data</th><th>Stato d'animo</th></tr>${a.daily.map((d) => `<tr><td>${dmy(d.day)}</td><td>${esc(d.mood)}</td></tr>`).join('')}</table>
<div class="box">Questa analisi è stata fatta dall'app contando parole e temi: è un'indicazione, non una diagnosi. Il testo del diario non è incluso: lo condivide solo la persona, se vuole.</div></body></html>`;
}
/** Il diario intero, pagina per pagina: solo se la persona sceglie di condividerlo. */
export function diaryBookHtml(entries: JEntry[], from: string, to: string, name?: string): string {
  const list = entries.filter((e) => e.day >= from && e.day <= to && entryText(e).trim()).sort((a, b) => a.day.localeCompare(b.day));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<h1>Diario</h1><p class="muted">${name ? `${esc(name)} · ` : ''}dal ${dmy(from)} al ${dmy(to)} · condiviso dalla persona il ${dmy(dayKey())}</p>
${list.map((e) => `<div class="day"><h3>${esc(dayLabel(e.day))}</h3><p>${esc(entryText(e))}</p></div>`).join('') || '<p class="muted">Nessuna pagina in questo periodo.</p>'}
<div class="box">Testi scritti o dettati dalla persona. Non è una valutazione clinica.</div></body></html>`;
}
export const periodOf = (days: number, now = new Date()): { from: string; to: string } => ({ from: addDays(dayKey(now), -(days - 1)), to: dayKey(now) });
