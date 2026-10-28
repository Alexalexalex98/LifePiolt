/**
 * Programma di allenamento scritto da Theia (modulo PURO e testabile). L'AI intervista l'utente, poi scrive il programma in un
 * blocco [[ALLENAMENTO {...}]]; qui lo si legge, lo si controlla e lo si trasforma in una scheda dell'app con esercizi
 * dell'archivio (o esercizi nuovi descritti dall'AI). Non e' una scheda di un preparatore: ogni voce si puo' cambiare.
 */
import type { Equip, Goal, Level, Muscle, Place, Program, Session, Step } from './data.ts';
import { ALL_EXERCISES, makeCustom, type ExerciseX } from './exerciseDb.ts';

export type AiWorkoutResult = { program: Program | null; custom: ExerciseX[]; fresh: boolean; warnings: string[] };

const RE = /\[\[\s*ALLENAMENTO\s*:?\s*(\{[\s\S]*?\})\s*\]\]/i;
export function extractWorkout(reply: string): { text: string; json: unknown | null; broken: boolean } {
  const m = RE.exec(reply);
  if (!m) return { text: reply, json: null, broken: /\[\[\s*ALLENAMENTO/i.test(reply) };
  const text = reply.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
  try { return { text, json: JSON.parse(m[1]), broken: false }; } catch { return { text, json: null, broken: true }; }
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = <T extends string>(v: unknown, all: readonly T[], dflt: T): T => { const n = norm(String(v ?? '')); return all.find((x) => norm(x) === n) ?? dflt; };

const GOALS: Goal[] = ['dimagrire', 'tonificare', 'massa', 'forza', 'resistenza', 'mobilità', 'salute'];
const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzato'];
const PLACES: Place[] = ['casa', 'palestra', 'piscina'];
const MUSCLES: Muscle[] = ['gambe', 'glutei', 'petto', 'schiena', 'spalle', 'braccia', 'core', 'corpo intero', 'cardio', 'mobilità'];
const EQUIPS: Equip[] = ['nessuno', 'manubri', 'elastico', 'palestra', 'piscina'];

/** L'esercizio dell'archivio (o dell'utente) con quel nome: tutte le parole importanti devono esserci. */
export function findExercise(name: string, mine: ExerciseX[] = []): ExerciseX | undefined {
  const q = norm(name); const words = q.split(' ').filter((w) => w.length >= 3);
  if (!words.length) return undefined;
  const all = [...mine, ...ALL_EXERCISES];
  const exact = all.find((e) => norm(e.name) === q); if (exact) return exact;
  const cands = all.filter((e) => { const hay = norm(e.name).split(' '); return words.every((w) => hay.some((h) => h === w || h.startsWith(w) || w.startsWith(h) && h.length >= 4)); });
  return cands.sort((a, b) => a.name.length - b.name.length)[0];
}

/** Legge il programma. `mine` = esercizi gia' creati dall'utente; `id` = scheda da aggiornare (altrimenti ne nasce una nuova). */
export function parseAiWorkout(json: unknown, mine: ExerciseX[] = [], id?: string): AiWorkoutResult {
  const warnings: string[] = []; const custom: ExerciseX[] = [];
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const list = Array.isArray(o.sessioni) ? o.sessioni : Array.isArray(o.sessions) ? o.sessions : [];
  const sessions: Session[] = [];
  for (const s of list.slice(0, 7)) {
    const ss = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const rows = Array.isArray(ss.es) ? ss.es : Array.isArray(ss.esercizi) ? ss.esercizi : [];
    const steps: Step[] = [];
    for (const r of rows.slice(0, 14)) {
      const rr = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const name = str(rr.n ?? rr.nome, 60); if (!name) continue;
      const sets = num(rr.s ?? rr.serie); const reps = num(rr.r ?? rr.rip); const secs = num(rr.t ?? rr.secondi); const rest = num(rr.rec ?? rr.recupero);
      if (sets == null || sets < 1 || sets > 10 || ((reps == null || reps < 1 || reps > 100) && (secs == null || secs < 5 || secs > 3600))) { warnings.push(`serie non valide per ${name}`); continue; }
      let ex = findExercise(name, [...mine, ...custom]);
      if (!ex) {
        const made = makeCustom({ name, muscle: pick(rr.m, MUSCLES, 'corpo intero'), equip: pick(rr.a, EQUIPS, 'nessuno'), how: str(rr.come ?? rr.how, 400), timed: secs != null && (reps == null) }, `ai-${norm(name).replace(/ /g, '-').slice(0, 40)}`);
        if (!made) { warnings.push(`esercizio non valido: ${name}`); continue; }
        custom.push(made); ex = made;
      }
      const step: Step = { ex: ex.id, sets: Math.round(sets), rest: rest != null && rest >= 0 && rest <= 600 ? Math.round(rest) : 60 };
      if (secs != null && secs >= 5 && (reps == null || ex.timed)) step.secs = Math.round(secs); else step.reps = Math.round(reps as number);
      steps.push(step);
    }
    if (steps.length) sessions.push({ name: str(ss.n ?? ss.nome, 60) || `Sessione ${sessions.length + 1}`, steps });
  }
  if (!sessions.length) return { program: null, custom: [], fresh: o.nuovo === true, warnings };
  const days = num(o.giorni ?? o.days);
  const program: Program = {
    id: id ?? `ai-${Date.now().toString(36)}`, name: str(o.titolo ?? o.title, 60) || 'Il tuo programma', tagline: str(o.note ?? o.tagline, 120) || 'Creato con Theia',
    goal: pick(o.obiettivo ?? o.goal, GOALS, 'salute'), level: pick(o.livello ?? o.level, LEVELS, 'principiante'), place: pick(o.luogo ?? o.place, PLACES, 'casa'),
    days: days != null && days >= 1 && days <= 7 ? Math.round(days) : Math.min(7, Math.max(2, sessions.length)), weeks: Math.min(52, Math.max(2, Math.round(num(o.settimane ?? o.weeks) ?? 8))), sessions,
    specialty: 'Creato con Theia', ...(str(o.note, 600) ? { why: str(o.note, 600) } : {}), ...(str(o.attenzione ?? o.caution, 300) ? { caution: str(o.attenzione ?? o.caution, 300) } : {}),
  };
  return { program, custom, fresh: o.nuovo === true, warnings };
}

/** Il programma in poche righe, da mostrare all'AI quando l'utente vuole cambiarlo. */
export function workoutSummary(p: Program | undefined, mine: ExerciseX[] = []): string {
  if (!p) return '';
  const nm = (id: string) => [...mine, ...ALL_EXERCISES].find((e) => e.id === id)?.name ?? id;
  return `«${p.name}» (${p.goal}, ${p.level}, ${p.place}, ${p.days} giorni, ${p.weeks} settimane)\n${p.sessions.map((s) => `${s.name}: ${s.steps.map((x) => `${nm(x.ex)} ${x.sets}×${x.secs ? `${x.secs}s` : x.reps}`).join(', ')}`).join('\n')}`.slice(0, 3500);
}

const TALK = /\b(programma di allenamento|programma allenamento|scheda (?:di )?allenamento|scheda palestra|piano di allenamento|piano allenamento|allenamento|allenarmi|allenarsi|esercizi|workout|andare in palestra|mettere massa|tonificare|scheda)\b/i;
const EDIT = /\b(cambia|cambiami|sostituisci|togli|metti|aggiungi|sistema|modifica|non mi piace|non voglio|niente|rifai|meno|più|piu|troppo)\b/i;
export function workoutTalk(question: string, recentUser: string[], hasProgram: boolean): boolean {
  if (TALK.test(question)) return true;
  if (recentUser.slice(-4).some((x) => TALK.test(x))) return true;
  return hasProgram && EDIT.test(question) && /\b(esercizio|esercizi|serie|ripetizioni|sessione|giorno|scheda|programma|allenamento)\b/i.test(question);
}

export type WorkoutContext = { body?: string; goal?: string; place?: string; days?: number; minutes?: number; needs?: string[]; current?: string };
export function workoutPrompt(c: WorkoutContext): string {
  const known = [c.body ? `dati dell'utente: ${c.body}` : '', c.goal ? `obiettivo indicato: ${c.goal}` : '', c.place ? `dove si allena: ${c.place}` : '', c.days ? `giorni a settimana: ${c.days}` : '', c.minutes ? `minuti a sessione: ${c.minutes}` : '', c.needs?.length ? `bisogni: ${c.needs.join(', ')}` : ''].filter(Boolean).join('; ');
  return `PROGRAMMA DI ALLENAMENTO (la conversazione e' su questo): parla con l'utente come un personal trainer attento ma prudente. Prima capisci bene la situazione con domande, poi scrivi il programma.
Fase 1 - domande (da 2 a 5 per messaggio, numerate, MAI tutte insieme, salta quelle di cui hai gia' la risposta): obiettivo (dimagrire, tonificare, mettere massa, forza, resistenza, mobilita', stare meglio) e entro quando, esperienza (da quanto si allena, che livello), dove si allena (casa, palestra, piscina) e con quali attrezzi (niente, manubri, elastici, macchine), quanti giorni a settimana e quanti minuti per sessione, dolori, infortuni, operazioni o problemi (schiena, ginocchia, spalle, cuore, pressione, gravidanza), esercizi che non vuole o non puo' fare, lavoro (sedentario o in piedi), sport che pratica, e se mancano peso, altezza ed eta'.
Fase 2 - quando hai le risposte essenziali (obiettivo, livello, dove, giorni a settimana, dolori o limiti) NON chiedere altro: scrivi in 1-2 frasi cosa hai capito e poi, a fine risposta, il programma in UN solo blocco su una riga: [[ALLENAMENTO {"nuovo":true,"titolo":"...","obiettivo":"dimagrire|tonificare|massa|forza|resistenza|mobilità|salute","livello":"principiante|intermedio|avanzato","luogo":"casa|palestra|piscina","giorni":numero,"settimane":numero,"note":"come progredire, in 2 frasi","attenzione":"una frase di prudenza sui limiti dell'utente","sessioni":[{"n":"Giorno A · Gambe e core","es":[{"n":"nome dell'esercizio","s":serie,"r":ripetizioni,"t":secondi (al posto di r per gli esercizi a tempo),"rec":secondi di recupero,"m":"gambe|glutei|petto|schiena|spalle|braccia|core|corpo intero|cardio|mobilità","a":"nessuno|manubri|elastico|palestra|piscina","come":"come si esegue in una frase"}]}]}]]. Una sessione per ogni giorno di allenamento diverso (2-6 sessioni, che poi si ripetono), 4-8 esercizi per sessione, riscaldamento e defaticamento inclusi come esercizi di mobilita', nomi di esercizi comuni (squat, affondi, flessioni, plank, rematore...), mai esercizi che l'utente non puo' fare, serie e ripetizioni adatte al livello. JSON valido, senza commenti, senza a-capo dentro i testi. Mai scrivere il programma a parole nel messaggio: lo vede l'utente come file.
Fase 3 - se l'utente vuole cambiare qualcosa (un esercizio, piu' o meno giorni, piu' difficile, piu' corto, un dolore nuovo): rispondi in breve e scrivi il blocco [[ALLENAMENTO {...}]] con il programma COMPLETO aggiornato, senza "nuovo" (sostituisce quello attuale); con "nuovo":true solo se vuole un programma diverso e separato.
Non rifare domande gia' fatte; con dolori seri, infortuni recenti, gravidanza o patologie cardiache resta prudente e consiglia in una frase di sentire anche il medico o un fisioterapista.${known ? `\nCosa gia' si sa: ${known}.` : ''}${c.current ? `\nProgramma attuale dell'utente (per i cambi):\n${c.current}` : '\nL\'utente non ha ancora un programma fatto con te.'}`;
}
