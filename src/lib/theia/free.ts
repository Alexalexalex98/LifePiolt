/**
 * Domande libere sui tuoi dati (modulo PURO): l'AI sceglie QUALI calcolatori servono (vede solo i nomi, non i tuoi dati), il telefono li esegue,
 * poi l'AI scrive la risposta usando solo i numeri calcolati. Ogni numero del testo viene controllato: se non viene dai calcoli, la risposta si rifà una volta
 * e, se ancora non torna, si mostrano i fatti così come sono. L'AI è iniettata (`llm`), così tutto si prova senza rete.
 */
import { upcoming } from '../shifts.ts';
import { addDay, dayKeyOf, fmtMoney, fmtNum, humanDay, unverifiedNumbers, type Fact, type Snap } from './core.ts';
import { radar } from './radar.ts';

export type ToolOut = { facts: Fact[]; missing?: string };
export type Tool = { name: string; desc: string; args?: string; run: (s: Snap, a: Record<string, unknown>) => ToolOut };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v: unknown, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const r1 = (n: number) => Math.round(n * 10) / 10;
const noFin = (): ToolOut => ({ facts: [], missing: 'Non ci sono dati sui movimenti: serve un estratto conto o qualche movimento.' });

export const TOOLS: Tool[] = [
  { name: 'mese', desc: 'Entrate, uscite, risparmio, saldo e stima del saldo a fine mese del mese in corso', run: (s) => {
    const f = s.finance; if (!f) return noFin();
    const src = 'movimenti del mese';
    const facts: Fact[] = [{ label: 'entrate del mese', value: Math.round(f.income), unit: s.currency, source: src }, { label: 'uscite del mese', value: Math.round(f.expense), unit: s.currency, source: src }, { label: 'risparmiato', value: Math.round(f.saved), unit: s.currency, source: src }, { label: 'saldo attuale', value: Math.round(f.end), unit: s.currency, source: src }];
    if (f.partial && f.projectionEnd != null) facts.push({ label: 'saldo stimato a fine mese', value: Math.round(f.projectionEnd), unit: s.currency, source: 'stima dal ritmo di spesa (non una certezza)' }, { label: 'giorni passati', value: f.day, source: 'calendario' }, { label: 'giorni del mese', value: f.daysInMonth, source: 'calendario' });
    return { facts };
  } },
  { name: 'categoria', desc: 'Quanto hai speso questo mese in una categoria di spesa', args: 'nome (testo, es. "ristoranti")', run: (s, a) => {
    const f = s.finance; if (!f) return noFin();
    const q = norm(String(a.nome ?? ''));
    const c = f.topCats.find((x) => q && (norm(x.n).includes(q) || q.includes(norm(x.n))));
    if (!c) return { facts: [], missing: `Non trovo la categoria «${String(a.nome ?? '')}». Quelle che ho: ${f.topCats.map((x) => x.n).join(', ') || 'nessuna'}.` };
    const tot = f.topCats.reduce((t, x) => t + x.v, 0);
    return { facts: [{ label: `speso in ${c.n}`, value: Math.round(c.v), unit: s.currency, source: 'movimenti del mese' }, ...(tot > 0 ? [{ label: `quota di ${c.n} sul totale delle spese`, value: Math.round((c.v / tot) * 100), unit: '%', source: 'calcolo sui movimenti del mese' }] : [])] };
  } },
  { name: 'categorie_top', desc: 'Le categorie dove spendi di più questo mese', args: 'n (quante, di base 3)', run: (s, a) => {
    const f = s.finance; if (!f) return noFin();
    return { facts: f.topCats.slice(0, num(a.n, 3, 1, 8)).map((c) => ({ label: `speso in ${c.n}`, value: Math.round(c.v), unit: s.currency, source: 'movimenti del mese' })) };
  } },
  { name: 'confronto_mese', desc: 'Come sono cambiate entrate e uscite rispetto al mese scorso, e le categorie che sono cresciute o calate di più', run: (s) => {
    const f = s.finance; if (!f) return noFin();
    if (!f.prev) return { facts: [], missing: 'Non ho il mese scorso per fare il confronto.' };
    const facts: Fact[] = [{ label: 'uscite questo mese', value: Math.round(f.expense), unit: s.currency, source: 'movimenti del mese' }, { label: 'uscite mese scorso', value: Math.round(f.prev.expense), unit: s.currency, source: `movimenti di ${f.prev.label}` }, { label: 'differenza uscite', value: Math.round(f.expense - f.prev.expense), unit: s.currency, source: 'calcolo' }];
    if (f.prev.expense > 0) facts.push({ label: 'variazione uscite', value: Math.round(((f.expense - f.prev.expense) / f.prev.expense) * 100), unit: '%', source: 'calcolo' });
    const d = (f.deltas ?? []).filter((x) => x.prev > 0 || x.v > 0).map((x) => ({ ...x, diff: x.v - x.prev })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
    d.forEach((x) => facts.push({ label: `differenza in ${x.n} rispetto al mese scorso`, value: Math.round(x.diff), unit: s.currency, source: 'calcolo' }));
    if (f.partial) facts.push({ label: 'nota', value: 'il mese in corso non è finito: il confronto è parziale', source: 'calendario' });
    return { facts };
  } },
  { name: 'se_spendo', desc: 'Cosa succede al saldo stimato di fine mese se spendi un importo in più', args: 'importo (numero)', run: (s, a) => {
    const f = s.finance; if (!f) return noFin();
    if (f.projectionEnd == null) return { facts: [], missing: 'Il mese è chiuso o non ho abbastanza dati per stimare il saldo di fine mese.' };
    const x = num(a.importo, NaN, 0, 1e9);
    if (!Number.isFinite(x)) return { facts: [], missing: 'Non ho capito quale importo.' };
    return { facts: [{ label: 'saldo stimato a fine mese adesso', value: Math.round(f.projectionEnd), unit: s.currency, source: 'stima dal ritmo di spesa' }, { label: 'importo in più', value: Math.round(x), unit: s.currency, source: 'la tua domanda' }, { label: 'saldo stimato dopo quella spesa', value: Math.round(f.projectionEnd - x), unit: s.currency, source: 'calcolo (stima, non una certezza)' }] };
  } },
  { name: 'agenda', desc: 'Impegni in agenda di un giorno o dei prossimi 7 giorni', args: 'giorno ("oggi", "domani", "settimana" oppure AAAA-MM-GG)', run: (s, a) => {
    const today = dayKeyOf(s.now);
    const g = String(a.giorno ?? 'oggi');
    if (g === 'settimana') {
      const facts: Fact[] = [];
      for (let i = 0; i < 7; i++) { const k = addDay(today, i); const n = (s.events[k] ?? []).length; if (n) facts.push({ label: `impegni ${humanDay(k, today)}`, value: n, source: 'agenda' }); }
      return facts.length ? { facts } : { facts: [{ label: 'impegni nei prossimi giorni controllati', value: 0, source: 'agenda' }, { label: 'giorni controllati', value: 7, source: 'agenda' }] };
    }
    const key = g === 'domani' ? addDay(today, 1) : /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : today;
    const list = [...(s.events[key] ?? [])].sort((x, y) => x.time.localeCompare(y.time));
    return { facts: [{ label: `numero di impegni ${humanDay(key, today)}`, value: list.length, source: 'agenda' }, ...list.slice(0, 8).map((e) => ({ label: `impegno ${humanDay(key, today)}`, value: `${e.time} ${e.title}`, source: 'agenda' }))] };
  } },
  { name: 'turni', desc: 'I prossimi turni di lavoro con giorno, orario e durata', args: 'n (quanti, di base 3)', run: (s, a) => {
    if (!s.shifts.length) return { facts: [], missing: 'Non hai ancora inserito turni di lavoro.' };
    const list = upcoming(s.shifts, s.now, 60).slice(0, num(a.n, 3, 1, 8));
    const today = dayKeyOf(s.now);
    return { facts: list.flatMap((o) => [{ label: `turno «${o.shift.name}»`, value: `${humanDay(o.date, today)} ${new Date(o.startTs).toTimeString().slice(0, 5)}-${new Date(o.endTs).toTimeString().slice(0, 5)}`, source: 'turni' } as Fact, { label: `durata del turno «${o.shift.name}» ${humanDay(o.date, today)}`, value: r1((o.endTs - o.startTs) / 3600000), unit: 'h', source: 'turni' } as Fact]) };
  } },
  { name: 'carico_turni', desc: 'Quante ore di turno hai nei prossimi giorni', args: 'giorni (di base 7)', run: (s, a) => {
    if (!s.shifts.length) return { facts: [], missing: 'Non hai ancora inserito turni di lavoro.' };
    const days = num(a.giorni, 7, 1, 31);
    const end = s.now + days * 86400000;
    const list = upcoming(s.shifts, s.now, days).filter((o) => o.startTs < end);
    const hours = list.reduce((t, o) => t + (Math.min(o.endTs, end) - Math.max(o.startTs, s.now)) / 3600000, 0);
    return { facts: [{ label: 'turni nel periodo', value: list.length, source: 'turni' }, { label: 'ore di turno nel periodo', value: r1(hours), unit: 'h', source: 'turni' }, { label: 'giorni considerati', value: days, source: 'la tua domanda' }] };
  } },
  { name: 'task', desc: 'Task aperti, per oggi e scaduti, con i titoli dei primi', run: (s) => {
    const today = dayKeyOf(s.now);
    const open = s.tasks.filter((t) => !t.done);
    const late = open.filter((t) => t.due && t.due < today);
    return { facts: [{ label: 'task aperti', value: open.length, source: 'task' }, { label: 'task per oggi', value: open.filter((t) => t.due === today).length, source: 'task' }, { label: 'task scaduti', value: late.length, source: 'task' }, ...late.slice(0, 3).map((t) => ({ label: 'task scaduto', value: t.t, source: 'task' }))] };
  } },
  { name: 'sonno', desc: 'Ore dormite nelle ultime notti, media e debito di sonno rispetto a 8 ore', args: 'giorni (di base 7)', run: (s, a) => {
    if (!s.sleep.length) return { facts: [], missing: 'Non ho dati sul sonno: serve Apple Health o un inserimento a mano.' };
    const list = s.sleep.slice(-num(a.giorni, 7, 1, 30));
    const avg = list.reduce((t, x) => t + x.hours, 0) / list.length;
    const debt = list.reduce((t, x) => t + Math.max(0, 8 - x.hours), 0);
    return { facts: [{ label: 'notti considerate', value: list.length, source: 'sonno' }, { label: 'ore dormite in media', value: r1(avg), unit: 'h', source: 'sonno' }, { label: 'ultima notte', value: r1(list[list.length - 1].hours), unit: 'h', source: 'sonno' }, { label: 'ore di sonno mancanti rispetto a 8 per notte', value: r1(debt), unit: 'h', source: 'calcolo su 8 ore a notte' }, { label: 'obiettivo di sonno usato', value: 8, unit: 'h', source: 'valore standard, non personalizzato' }] };
  } },
  { name: 'passi', desc: 'Passi degli ultimi giorni: media, totale e ultimo giorno', args: 'giorni (di base 7)', run: (s, a) => {
    if (!s.steps.length) return { facts: [], missing: 'Non ho dati sui passi: serve Apple Health o un inserimento a mano.' };
    const list = s.steps.slice(-num(a.giorni, 7, 1, 30));
    const tot = list.reduce((t, x) => t + x.v, 0);
    return { facts: [{ label: 'giorni considerati', value: list.length, source: 'passi' }, { label: 'passi in media al giorno', value: Math.round(tot / list.length), source: 'passi' }, { label: 'passi in totale', value: Math.round(tot), source: 'passi' }, { label: 'passi dell\'ultimo giorno registrato', value: Math.round(list[list.length - 1].v), source: 'passi' }] };
  } },
  { name: 'oggi_cibo_acqua', desc: 'Acqua e calorie segnate oggi', run: (s) => {
    const facts: Fact[] = [];
    if (s.water) facts.push({ label: 'acqua segnata oggi', value: Math.round(s.water.todayMl / 100) / 10, unit: 'L', source: 'acqua segnata' }, { label: 'obiettivo acqua', value: Math.round(s.water.goalMl / 100) / 10, unit: 'L', source: 'stima dal peso' });
    if (s.kcal) { facts.push({ label: 'calorie segnate oggi', value: Math.round(s.kcal.today), unit: 'kcal', source: 'pasti segnati' }); if (s.kcal.target) facts.push({ label: 'obiettivo calorie', value: Math.round(s.kcal.target), unit: 'kcal', source: 'stima da età, peso e obiettivo' }); }
    return facts.length ? { facts } : { facts: [], missing: 'Non ho dati su pasti e acqua di oggi.' };
  } },
  { name: 'avvisi', desc: 'Gli avvisi del radar: cosa sta per succedere (budget, conflitti agenda-turni, sonno prima di un turno presto, task scaduti)', run: (s) => {
    const r = radar(s);
    return r.length ? { facts: r.slice(0, 5).flatMap((p) => [{ label: 'avviso', value: p.title, source: 'radar di Theia' } as Fact, ...p.facts]) } : { facts: [{ label: 'avvisi attivi', value: 0, source: 'radar di Theia' }] };
  } },
];
const BY = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export type Plan = { scope: 'dati' | 'altro'; calls: { tool: string; args: Record<string, unknown> }[]; ask?: string };

/** Il catalogo per l'AI: solo nomi e descrizioni, nessun dato tuo. */
export const catalogText = () => TOOLS.map((t) => `- ${t.name}${t.args ? ` (${t.args})` : ''}: ${t.desc}`).join('\n');

export function planPrompt(question: string): string {
  return `Sei il pianificatore di Theia, l'assistente di un'app personale. Non rispondi alla domanda: scegli quali CALCOLATORI servono per rispondere con i dati dell'utente.
Calcolatori disponibili:
${catalogText()}

Rispondi SOLO con un oggetto JSON, senza altro testo:
{"scope":"dati"|"altro","calls":[{"tool":"nome","args":{}}],"ask":"domanda di chiarimento, solo se manca un'informazione indispensabile"}
Regole: "scope":"dati" se la domanda riguarda i dati personali dell'utente (soldi, agenda, turni, task, salute, cibo); "altro" se è una domanda generica o di cultura (allora "calls" è vuoto). Usa al massimo 4 calcolatori. Non inventare calcolatori. Date: usa "oggi", "domani" o "settimana".
Domanda dell'utente: ${question}`;
}

/** Legge la risposta dell'AI: tollera testo attorno e blocchi di codice. Solo calcolatori che esistono. */
export function parsePlan(reply: string): Plan | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { scope?: unknown; calls?: unknown; ask?: unknown };
    const scope = o.scope === 'altro' ? 'altro' : o.scope === 'dati' ? 'dati' : null;
    if (!scope) return null;
    const calls = (Array.isArray(o.calls) ? o.calls : []).flatMap((c) => {
      const x = c as { tool?: unknown; args?: unknown };
      return typeof x.tool === 'string' && BY[x.tool] ? [{ tool: x.tool, args: (x.args && typeof x.args === 'object' ? x.args : {}) as Record<string, unknown> }] : [];
    }).slice(0, 4);
    return { scope, calls, ask: typeof o.ask === 'string' && o.ask.trim() ? o.ask.trim().slice(0, 240) : undefined };
  } catch { return null; }
}

export function runPlan(plan: Plan, s: Snap): { facts: Fact[]; missing: string[]; used: string[]; sources: string[] } {
  const facts: Fact[] = [], missing: string[] = [], used: string[] = [];
  for (const c of plan.calls) {
    const out = BY[c.tool].run(s, c.args);
    used.push(c.tool); facts.push(...out.facts); if (out.missing) missing.push(out.missing);
  }
  return { facts, missing, used, sources: [...new Set(facts.map((f) => f.source))] };
}

const factLine = (f: Fact) => `${f.label}: ${typeof f.value === 'number' ? fmtNum(f.value, Number.isInteger(f.value) ? 0 : 1) : f.value}${f.unit ? ' ' + f.unit : ''}`;

export function answerPrompt(question: string, facts: Fact[], missing: string[], wrong: string[] = []): string {
  return `Sei Theia. Rispondi in italiano, in modo chiaro e breve (al massimo 5 righe), alla domanda dell'utente usando SOLO i fatti qui sotto.
REGOLE: usa solo numeri, orari e nomi che compaiono nei fatti, scritti uguali (ad esempio «1.234», «06:00»); non fare altri calcoli e non arrotondare in modo diverso; non aggiungere cifre tue. Se i fatti non bastano per rispondere, dillo chiaramente e di' cosa manca. Se un valore è una stima, scrivi che è una stima. Non dare consigli medici, legali o finanziari: puoi indicare cosa osservare e lasciare la scelta all'utente. Nessun elenco puntato lungo, nessun emoji.${wrong.length ? `\nATTENZIONE: nella risposta precedente c'erano numeri non presenti nei fatti (${wrong.join(', ')}). Riscrivila senza di essi.` : ''}
FATTI:
${facts.map(factLine).join('\n') || '(nessuno)'}${missing.length ? `\nDATI MANCANTI:\n${missing.join('\n')}` : ''}
DOMANDA: ${question}`;
}

/** Se l'AI non c'è o non passa la verifica: i fatti, così come sono, in italiano semplice. */
export function renderFallback(facts: Fact[], missing: string[]): string {
  const lines = facts.map((f) => `• ${factLine(f)}`);
  return [facts.length ? `Ecco cosa risulta dai tuoi dati:\n${lines.join('\n')}` : '', ...missing].filter(Boolean).join('\n\n') || 'Non ho dati per rispondere a questa domanda.';
}

/** Senza AI (non collegata o senza consenso): un piano a parole chiave, così le domande più comuni hanno comunque i loro fatti. Poi si mostrano i fatti, senza testo scritto dall'AI. */
export function guessPlan(question: string, snap: Snap): Plan | null {
  const q = norm(question);
  const calls: Plan['calls'] = [];
  const add = (tool: string, args: Record<string, unknown> = {}) => { if (!calls.some((c) => c.tool === tool)) calls.push({ tool, args }); };
  const cat = snap.finance?.topCats.find((c) => q.includes(norm(c.n)));
  if (/(spes|uscit|speso)/.test(q)) { if (cat) add('categoria', { nome: cat.n }); else add('mese'); if (/(rispetto|scors|piu|meno|cresc|aument|cala)/.test(q)) add('confronto_mese'); }
  if (/(saldo|resta|fine mese|entrat|risparm|stipendio)/.test(q)) add('mese');
  const spend = q.match(/(\d+(?:[.,]\d+)?)\s*(?:chf|franchi|euro|€)/);
  if (spend && /(posso|permett|conviene|se spend)/.test(q)) add('se_spendo', { importo: Number(spend[1].replace(',', '.')) });
  if (/\bturn/.test(q)) { add('turni'); if (/(ore|quanto|settimana|carico)/.test(q)) add('carico_turni', { giorni: 7 }); }
  if (/(impegn|agenda|libero|libera|appuntament)/.test(q)) add('agenda', { giorno: /domani/.test(q) ? 'domani' : /(settimana|prossimi giorni)/.test(q) ? 'settimana' : 'oggi' });
  if (/(task|scadenz|da fare)/.test(q)) add('task');
  if (/(sonn|dorm)/.test(q)) add('sonno');
  if (/(\bpassi\b|camminat)/.test(q)) add('passi');
  if (/(acqua|calorie|mangiat|pasti)/.test(q)) add('oggi_cibo_acqua');
  if (/(avvis|attenzione|problem|nota)/.test(q)) add('avvisi');
  return calls.length ? { scope: 'dati', calls: calls.slice(0, 4) } : null;
}

/** Come askFree ma senza AI: piano a parole chiave e fatti mostrati così come sono. */
export function askFreeOffline(question: string, snap: Snap): FreeResult {
  const plan = guessPlan(question, snap);
  if (!plan) return { kind: 'outside' };
  const run = runPlan(plan, snap);
  return { kind: 'fallback', text: renderFallback(run.facts, run.missing), facts: run.facts, sources: run.sources, why: 'senza AI' };
}

export type FreeResult =
  | { kind: 'answer'; text: string; facts: Fact[]; sources: string[]; verified: true }
  | { kind: 'fallback'; text: string; facts: Fact[]; sources: string[]; why: string }
  | { kind: 'clarify'; text: string }
  | { kind: 'outside' };

/** Parole che fanno pensare a una domanda sui dati personali: evita di chiamare l'AI per saluti e chiacchiere. */
export function looksLikeDataQuestion(text: string): boolean {
  const q = norm(text);
  if (q.length < 8) return false;
  const topic = /(sold|spes|saldo|budget|entrat|uscit|risparm|bolletta|stipendio|turn|impegn|agenda|appuntament|task|scadenz|sonn|dorm|pass|camminat|acqua|calorie|pasti|mangiat|allenament|peso|umore|libero|libera|settimana|mese)/.test(q);
  const ask = text.includes('?') || /(quant|quand|quali|quale|cosa|che |perche|come |confront|rispetto|media|totale|posso|conviene|riesco|se spend|e se|sono in|ho abbastanza|mi resta|mi basta|prevision)/.test(q);
  return topic && ask;
}

/** Il giro completo. `llm` manda un testo all'AI e restituisce la risposta. Lancia se l'AI non risponde: chi chiama decide cosa dire. */
export async function askFree(question: string, snap: Snap, llm: (prompt: string) => Promise<string>): Promise<FreeResult> {
  const plan = parsePlan(await llm(planPrompt(question)));
  if (!plan || plan.scope === 'altro') return { kind: 'outside' };
  if (plan.ask && !plan.calls.length) return { kind: 'clarify', text: plan.ask };
  if (!plan.calls.length) return { kind: 'outside' };
  const run = runPlan(plan, snap);
  if (!run.facts.length) return { kind: 'fallback', text: renderFallback([], run.missing), facts: [], sources: [], why: 'dati mancanti' };
  let wrong: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = (await llm(answerPrompt(question, run.facts, run.missing, wrong))).trim();
    wrong = unverifiedNumbers(reply, run.facts);
    if (reply && !wrong.length) return { kind: 'answer', text: reply, facts: run.facts, sources: run.sources, verified: true };
  }
  return { kind: 'fallback', text: renderFallback(run.facts, run.missing), facts: run.facts, sources: run.sources, why: `numeri non verificati: ${wrong.join(', ')}` };
}
export { fmtMoney };
