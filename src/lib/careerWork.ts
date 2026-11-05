/** Carriera e crescita (modulo PURO, nessun alias '@/'): obiettivi trimestrali (OKR), mappa delle competenze, diario dei risultati, curriculum e lettera
 *  adatti a un annuncio, preparazione ai colloqui e alla trattativa di stipendio. Tutto sul telefono di chi lo usa: è la tua carriera, non del datore di lavoro. */
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- obiettivi trimestrali ---------- */
export type KR = { id: string; t: string; target: number; current: number; unit?: string };
export type Objective = { id: string; title: string; quarter: string; krs: KR[]; note?: string };
export const quarterOf = (day: string): string => `${day.slice(0, 4)}-T${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
export const quarterLabel = (q: string): string => `${q.slice(5).replace('T', '')}° trimestre ${q.slice(0, 4)}`;
export function quarterRange(q: string): [string, string] { const y = Number(q.slice(0, 4)); const n = Number(q.slice(6)); const m = (n - 1) * 3; const a = new Date(y, m, 1, 12); const b = new Date(y, m + 3, 0, 12); return [iso(a), iso(b)]; }
export const krProgress = (k: KR): number => (k.target > 0 ? Math.max(0, Math.min(1, k.current / k.target)) : 0);
export const objProgress = (o: Objective): number => (o.krs.length ? Math.round((o.krs.reduce((n, k) => n + krProgress(k), 0) / o.krs.length) * 100) : 0);
/** Quanta strada del trimestre è passata (0–100), per capire se sei in linea. */
export function quarterElapsed(q: string, today: string): number { const [a, b] = quarterRange(q); const t = new Date(today + 'T12:00:00').getTime(); const s = new Date(a + 'T12:00:00').getTime(); const e = new Date(b + 'T12:00:00').getTime(); return Math.round(Math.max(0, Math.min(1, (t - s) / (e - s))) * 100); }
export function okrStatus(o: Objective, today: string): { state: 'avanti' | 'in linea' | 'indietro' | 'finito'; text: string } {
  const p = objProgress(o); const e = quarterElapsed(o.quarter, today);
  if (p >= 100) return { state: 'finito', text: 'Obiettivo raggiunto. Ottimo lavoro!' };
  if (p >= e + 10) return { state: 'avanti', text: `Sei avanti: ${p}% fatto contro ${e}% del tempo.` };
  if (p >= e - 15) return { state: 'in linea', text: `Sei in linea: ${p}% fatto, ${e}% del trimestre passato.` };
  return { state: 'indietro', text: `Serve una spinta: ${p}% fatto, ${e}% del trimestre passato. Scegli il risultato più vicino e parti da lì.` };
}

/* ---------- competenze ---------- */
export type Skill = { id: string; name: string; level: number; target: number };
export type Course = { id: string; title: string; status: 'da fare' | 'in corso' | 'finito'; due?: string; skill?: string };
export const LEVELS = ['Non ancora', 'Base', 'Buono', 'Solido', 'Esperto', 'Punto di riferimento'];
export const skillGap = (s: Skill): number => Math.max(0, s.target - s.level);
/** Prima le competenze dove manca più strada; a pari merito quelle con target più alto. */
export const gapsOf = (list: Skill[]): Skill[] => list.filter((s) => skillGap(s) > 0).sort((a, b) => skillGap(b) - skillGap(a) || b.target - a.target);
export const strengthsOf = (list: Skill[]): Skill[] => list.filter((s) => s.level >= 4).sort((a, b) => b.level - a.level);
export const SKILL_SUGGEST: Record<string, string[]> = {
  direzione: ['Strategia', 'Decisioni', 'Comunicazione con i soci', 'Gestione del cambiamento'],
  management: ['Guidare un team', 'Dare feedback', 'Pianificazione', 'Gestione dei conflitti', 'Delega'],
  hr: ['Selezione del personale', 'Colloqui', 'Diritto del lavoro', 'Ascolto', 'Formazione'],
  amministrazione: ['Contabilità', 'Budget e previsioni', 'Excel avanzato', 'Fiscalità', 'Controllo di gestione'],
  commerciale: ['Trattativa', 'Ascolto del cliente', 'Presentazioni', 'CRM', 'Previsione delle vendite'],
  marketing: ['Scrittura', 'Analisi dei dati', 'Social media', 'Brand', 'SEO'],
  it: ['Programmazione', 'Sicurezza', 'Cloud', 'Documentazione', 'Lavoro in team'],
  legale: ['Contratti', 'Privacy (GDPR e LPD)', 'Scrittura chiara', 'Negoziazione'],
  operations: ['Gestione dei fornitori', 'Organizzazione', 'Controllo qualità', 'Logistica'],
  supporto: ['Organizzazione', 'Comunicazione', 'Strumenti d\'ufficio', 'Gestione del tempo'],
  esterni: ['Comunicazione', 'Puntualità'],
};
export const suggestSkills = (area: string, have: Skill[]): string[] => (SKILL_SUGGEST[area] ?? SKILL_SUGGEST['supporto']!).filter((n) => !have.some((s) => norm(s.name) === norm(n)));

/* ---------- risultati e feedback ---------- */
export type Result = { id: string; day: string; text: string; impact?: 'soldi' | 'tempo' | 'cliente' | 'qualità' | 'team'; metric?: string };
export type Feedback = { id: string; day: string; from: string; text: string; kind: 'positivo' | 'crescita' };
export const IMPACTS: Result['impact'][] = ['soldi', 'tempo', 'cliente', 'qualità', 'team'];
export const resultsSince = (list: Result[], from: string): Result[] => list.filter((r) => r.day >= from).sort((a, b) => b.day.localeCompare(a.day));
/** Task di lavoro finiti di recente che non sono ancora nel diario: li propone, non li aggiunge da solo. */
export function suggestFromTasks(done: { t: string; doneAt?: string; team?: string }[], logged: Result[], today: string, days = 30): { t: string; day: string }[] {
  const from = addDays(today, -days); const have = new Set(logged.map((r) => norm(r.text)));
  return done.filter((x) => x.team && x.doneAt && x.doneAt.slice(0, 10) >= from && !have.has(norm(`Ho completato: ${x.t}`))).map((x) => ({ t: x.t, day: x.doneAt!.slice(0, 10) })).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 8);
}
/** Un risultato scritto nel modo che piace nei colloqui: cosa ho fatto + effetto. */
export const resultLine = (r: Result): string => `${r.text}${r.metric ? ` (${r.metric})` : ''}`;
export function reviewSummary(res: Result[], fb: Feedback[], from: string, to: string): string {
  const r = res.filter((x) => x.day >= from && x.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  const f = fb.filter((x) => x.day >= from && x.day <= to && x.kind === 'positivo');
  const lines = [`RISULTATI dal ${from} al ${to}`, '', ...(r.length ? r.map((x) => `• ${x.day} · ${resultLine(x)}`) : ['• (ancora nessuno: aggiungi cosa hai ottenuto)'])];
  if (f.length) lines.push('', 'COSA HANNO DETTO DI ME', ...f.map((x) => `• ${x.from}: «${x.text}»`));
  return lines.join('\n');
}

/* ---------- curriculum e lettera ---------- */
export type CvInput = { name: string; headline: string; contact?: string; summary?: string; experience?: string; skills: Skill[]; results: Result[]; courses: Course[] };
const STOP = new Set('della delle degli dello dell alla alle agli allo con per tra fra che chi non una uno gli dei del dal dai nel nei sul sui sua suo sono siamo cerchiamo ricerchiamo candidato candidata ruolo posizione azienda team lavoro anni esperienza offriamo richiesto richiesta requisiti the and for with you our are'.split(' '));
/** Parole chiave di un annuncio: le competenze trovate e le parole che tornano più spesso. */
export function adKeywords(ad: string, skills: Skill[]): { matched: Skill[]; missing: string[] } {
  const t = norm(ad); const matched = skills.filter((s) => s.level >= 2 && t.includes(norm(s.name)));
  const words = new Map<string, number>(); for (const w of t.match(/[a-z]{5,}/g) ?? []) if (!STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
  const known = norm(skills.map((s) => s.name).join(' '));
  const missing = [...words.entries()].filter(([w, n]) => n >= 2 && !known.includes(w)).sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 6);
  return { matched, missing };
}
export function buildCv(c: CvInput, ad?: string): string {
  const k = ad ? adKeywords(ad, c.skills) : null;
  const order = (l: Skill[]) => (k ? [...l].sort((a, b) => Number(k.matched.includes(b)) - Number(k.matched.includes(a)) || b.level - a.level) : [...l].sort((a, b) => b.level - a.level));
  const skills = order(c.skills.filter((s) => s.level >= 2));
  const out = [c.name.toUpperCase(), c.headline, c.contact ?? '', ''];
  if (c.summary?.trim()) out.push('PROFILO', c.summary.trim(), '');
  if (skills.length) out.push('COMPETENZE', skills.map((s) => `${s.name} (${LEVELS[s.level]})`).join(' · '), '');
  if (c.experience?.trim()) out.push('ESPERIENZA', c.experience.trim(), '');
  const top = [...c.results].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6);
  if (top.length) out.push('RISULTATI', ...top.map((r) => `• ${resultLine(r)}`), '');
  const done = c.courses.filter((x) => x.status === 'finito');
  if (done.length) out.push('FORMAZIONE', ...done.map((x) => `• ${x.title}`), '');
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
export function coverLetter(i: { name: string; company: string; role: string; matched: Skill[]; results: Result[] }): string {
  const sk = i.matched.slice(0, 3).map((s) => s.name.toLowerCase());
  const best = i.results[0];
  return [`Gentile ${i.company || '[azienda]'},`, '', `mi candido per il ruolo di ${i.role || '[ruolo]'}.`, sk.length ? `Le mie competenze in ${sk.join(', ')} rispondono a ciò che cercate.` : 'Credo che la mia esperienza possa essere utile al vostro team.', best ? `Un esempio recente: ${resultLine(best)}.` : '', '', 'Sarei felice di raccontarvi di più in un colloquio.', '', 'Cordiali saluti,', i.name].filter((l, n, a) => !(l === '' && a[n - 1] === '')).join('\n');
}

/* ---------- colloquio e stipendio ---------- */
export type Q = { id: string; kind: 'colloquio' | 'stipendio'; q: string; tip: string };
export const QUESTIONS: Q[] = [
  { id: 'presenta', kind: 'colloquio', q: 'Mi parli di lei.', tip: 'Tre frasi: chi sei adesso, cosa hai fatto di buono, cosa cerchi.' },
  { id: 'perche', kind: 'colloquio', q: 'Perché vuole lavorare con noi?', tip: 'Parla di cosa conosci dell\'azienda e di come ti ci vedi.' },
  { id: 'forza', kind: 'colloquio', q: 'Qual è il suo punto di forza?', tip: 'Scegline uno e dai un esempio vero dal tuo diario dei risultati.' },
  { id: 'debole', kind: 'colloquio', q: 'Qual è un suo punto da migliorare?', tip: 'Onesto e concreto: dici cosa stai facendo per migliorare.' },
  { id: 'difficile', kind: 'colloquio', q: 'Mi racconti una situazione difficile e come l\'ha affrontata.', tip: 'Metodo STAR: situazione, compito, azione, risultato.' },
  { id: 'conflitto', kind: 'colloquio', q: 'Come gestisce un disaccordo con un collega?', tip: 'Ascolto, fatti, soluzione condivisa. Porta un caso reale.' },
  { id: 'errore', kind: 'colloquio', q: 'Mi parli di un errore e di cosa ha imparato.', tip: 'Non cercare scuse: cosa hai cambiato dopo.' },
  { id: 'cinque', kind: 'colloquio', q: 'Dove si vede tra cinque anni?', tip: 'Crescita legata al ruolo, non una promessa vaga.' },
  { id: 'domande', kind: 'colloquio', q: 'Ha domande per noi?', tip: 'Preparane due: sul team e su come si misura il successo del ruolo.' },
  { id: 'cifra', kind: 'stipendio', q: 'Quali sono le sue aspettative economiche?', tip: 'Dai un intervallo, con il valore che vuoi come minimo, e motiva con i risultati.' },
  { id: 'meno', kind: 'stipendio', q: 'Possiamo offrirle meno di quanto chiede.', tip: 'Chiedi cosa pesa nella differenza e proponi altre voci: ferie, formazione, orari, bonus.' },
  { id: 'aumento', kind: 'stipendio', q: 'Perché dovremmo darle un aumento?', tip: 'Elenca 3 risultati con numeri e cosa è cambiato rispetto a un anno fa.' },
];
export function salaryRange(i: { current?: number; target: number; offer?: number }): { ask: [number, number]; walkAway: number; lines: string[] } {
  const lo = Math.round(i.target / 100) * 100; const hi = Math.round((i.target * 1.1) / 100) * 100;
  const walk = Math.round(Math.max(i.current ?? 0, i.offer ?? 0, i.target * 0.92) / 100) * 100;
  const lines = [`Parti da ${hi}: lascia spazio per trattare.`, `Il tuo obiettivo vero è ${lo}.`, `Sotto ${walk} chiedi altre voci (ferie, formazione, orari, bonus) o prenditi tempo per pensarci.`];
  if (i.offer && i.offer < lo) lines.push(`L'offerta (${i.offer}) è ${Math.round(((lo - i.offer) / lo) * 100)}% sotto il tuo obiettivo: puoi rispondere con calma e chiedere di rivederla.`);
  return { ask: [lo, hi], walkAway: walk, lines };
}
export const NEGOTIATION_STEPS = ['Raccogli i tuoi risultati: numeri e date.', 'Guarda cosa guadagna chi fa lo stesso lavoro nella tua zona.', 'Scegli tre cifre: quella di partenza, quella che vuoi, quella sotto cui non vai.', 'Chiedi un momento dedicato, non una chiacchierata veloce.', 'Dì la cifra per prima e poi stai zitto: lascia rispondere.', 'Se non è un sì, chiedi cosa serve per arrivarci e quando ne riparlate.'];
export const answeredRatio = (qs: Q[], answers: Record<string, string>) => (qs.length ? Math.round((qs.filter((q) => (answers[q.id] ?? '').trim().length >= 20).length / qs.length) * 100) : 0);
