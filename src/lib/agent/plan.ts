/** Dalla risposta dell'AI ai passi da eseguire (modulo PURO, nessun alias '@/'): estrae il JSON, tiene solo azioni e parametri validi. */
export type Step = { action: string; params: Record<string, unknown> };
export type Plan = { steps: Step[]; reply?: string; ask?: string; fallback?: 'files' | 'chat' };

const MAX_STEPS = 8;
/** Legge la risposta dell'AI (anche dentro un blocco di codice) e la rende un piano sicuro: azioni sconosciute scartate, al massimo 8 passi. */
export function parsePlan(raw: string, known: Set<string>): Plan | null {
  const m = /\{[\s\S]*\}/.exec(raw ?? ''); if (!m) return null;
  let j: unknown; try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j || typeof j !== 'object') return null; const o = j as Record<string, unknown>;
  const steps: Step[] = [];
  if (Array.isArray(o.steps)) for (const s of o.steps.slice(0, MAX_STEPS)) { const x = s as Record<string, unknown>; const a = typeof x?.action === 'string' ? x.action : ''; if (known.has(a)) steps.push({ action: a, params: x.params && typeof x.params === 'object' && !Array.isArray(x.params) ? (x.params as Record<string, unknown>) : {} }); }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 600) : undefined);
  const fb = o.fallback === 'files' || o.fallback === 'chat' ? o.fallback : undefined;
  return { steps, reply: str(o.reply), ask: str(o.ask), fallback: fb };
}
export const isYes = (s: string) => /^\s*(si|sì|ok|okay|certo|conferma|confermo|vai|procedi|fallo|fai pure|va bene)(?![A-Za-zÀ-ÿ])/i.test(s);
export const isNo = (s: string) => /^\s*(no|annulla|lascia|stop|ferma|non farlo|niente)(?![A-Za-zÀ-ÿ])/i.test(s);

const WD = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
/** L'istruzione per l'AI: chi è, che giorno è, chi c'è nel workspace e quali azioni può chiedere. Solo nomi: nessun dato di clienti, documenti o stipendi. */
export function buildPrompt(o: { today: string; myName: string; people: { name: string; position?: string }[]; projects: string[]; templates: string[]; actions: string; request: string; history?: string[] }): string {
  const d = new Date(o.today + 'T12:00:00');
  return [
    'Sei Theia Lavoro, l\'assistente che esegue i compiti dentro il workspace di un\'azienda. Trasforma la richiesta in azioni da eseguire. Non spiegare: rispondi SOLO con un oggetto JSON.',
    `Oggi è ${WD[d.getDay()]} ${o.today}. L'utente si chiama ${o.myName}. Le date nei parametri sono sempre YYYY-MM-DD e le ore HH:MM (calcola tu «domani», «venerdì», «tra due settimane»).`,
    `Persone del workspace: ${o.people.map((p) => (p.position ? `${p.name} (${p.position})` : p.name)).join('; ') || 'nessuna'}.`,
    `Progetti: ${o.projects.join('; ') || 'nessuno'}. Modelli di progetto: ${o.templates.join('; ')}.`,
    'Azioni disponibili (nome(parametri); * = obbligatorio):', o.actions, '',
    'Formato: {"steps":[{"action":"nome","params":{...}}],"reply":"una frase breve per l\'utente"}.',
    'Puoi mettere più passi nell\'ordine giusto. Usa i nomi come li scrive l\'utente (li cerco io). Non inventare dati che l\'utente non ha detto: se manca qualcosa di essenziale rispondi {"steps":[],"ask":"la domanda da fare"}.',
    'Se la richiesta è una domanda sul CONTENUTO di documenti o file caricati rispondi {"steps":[],"fallback":"files"}. Se è solo una chiacchierata o una domanda generale rispondi {"steps":[],"fallback":"chat"}.',
    ...(o.history?.length ? ['', 'Ultimi messaggi:', ...o.history] : []), '', `Richiesta: ${o.request}`,
  ].join('\n');
}

/** Richieste semplici che non hanno bisogno dell'AI. */
export function offlineSteps(q: string): Step[] | null {
  const n = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\b(cosa|che cosa|quali?)\b.*\b(ho|devo|c e|abbiamo)\b.*\b(oggi|adesso)\b/.test(n) || /^(agenda|riepilogo|briefing) (di )?oggi/.test(n)) return [{ action: 'today_summary', params: {} }];
  if (/\b(pianifica|organizza|metti)\b.*\b(miei|mie|i miei)\b.*\b(task|attivita|compiti)\b/.test(n)) return [{ action: 'plan_my_tasks', params: {} }];
  if (/\b(avvisa|sollecita|ricorda)\b.*\b(ritard|chi e in ritardo)/.test(n)) return [{ action: 'alert_late', params: {} }];
  return null;
}

