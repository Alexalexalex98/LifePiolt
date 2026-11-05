/** Persone e HR (modulo PURO, nessun alias '@/'): ferie residue, assenze, anzianità, scadenze di contratto e prova, valutazione dei candidati, formazione e certificati. */
export type Profile = { hired_on: string | null; contract: 'indeterminato' | 'determinato' | 'apprendistato' | 'stage' | 'collaborazione'; contract_end: string | null; weekly_hours: number | null; vacation_days: number | null; phone: string; emergency: string; hr_notes?: string };
export type AbsenceRow = { user_id: string; kind: 'ferie' | 'permesso' | 'malattia' | 'altro'; from_day: string; to_day: string; status: string };
export const CONTRACT_LABEL: Record<Profile['contract'], string> = { indeterminato: 'Tempo indeterminato', determinato: 'Tempo determinato', apprendistato: 'Apprendistato', stage: 'Stage', collaborazione: 'Collaborazione' };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

/** Giorni lavorativi (lunedì–venerdì) tra due date, estremi inclusi. */
export function workdays(from: string, to: string): number {
  let n = 0; const d = new Date(from + 'T12:00:00'); const e = new Date(to + 'T12:00:00');
  for (let i = 0; d <= e && i < 800; i++) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}
const overlapDays = (a: AbsenceRow, y: number): number => { const s = a.from_day < `${y}-01-01` ? `${y}-01-01` : a.from_day, e = a.to_day > `${y}-12-31` ? `${y}-12-31` : a.to_day; return s <= e ? workdays(s, e) : 0; };
/** Ferie dell'anno: spettanti, già prese (approvate), richieste in attesa e residue; più malattia e permessi. */
export function balance(profile: Pick<Profile, 'vacation_days'> | null, abs: AbsenceRow[], year: number): { total: number | null; taken: number; pending: number; left: number | null; sick: number; leave: number } {
  const sum = (kind: AbsenceRow['kind'], status: string) => abs.filter((a) => a.kind === kind && a.status === status).reduce((x, a) => x + overlapDays(a, year), 0);
  const total = profile?.vacation_days ?? null; const taken = sum('ferie', 'approved'), pending = sum('ferie', 'requested');
  return { total, taken, pending, left: total == null ? null : total - taken - pending, sick: sum('malattia', 'approved'), leave: sum('permesso', 'approved') };
}
/** Da quanto lavora qui: «2 anni e 3 mesi», «5 mesi», «meno di un mese». */
export function tenure(hired: string | null, today: string): string {
  if (!hired || hired > today) return '';
  const a = new Date(hired + 'T12:00:00'), b = new Date(today + 'T12:00:00'); let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--;
  if (m < 1) return 'meno di un mese'; const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} ${y === 1 ? 'anno' : 'anni'}` : '', r ? `${r} ${r === 1 ? 'mese' : 'mesi'}` : ''].filter(Boolean).join(' e ');
}
export type HrAlert = { kind: 'contract' | 'probation' | 'anniversary'; day: string; text: string };
/** Scadenze da non dimenticare: fine del contratto a termine, fine del periodo di prova (3 mesi dall'assunzione), anniversario di lavoro. */
export function profileAlerts(p: Profile | null, today: string, days = 60): HrAlert[] {
  if (!p) return []; const out: HrAlert[] = []; const lim = addDays(today, days);
  if (p.contract !== 'indeterminato' && p.contract_end && p.contract_end >= today && p.contract_end <= lim) out.push({ kind: 'contract', day: p.contract_end, text: 'Scade il contratto: rinnovare o chiudere' });
  if (p.hired_on) {
    const pe = new Date(p.hired_on + 'T12:00:00'); pe.setMonth(pe.getMonth() + 3); const pd = iso(pe);
    if (pd >= today && pd <= addDays(today, 30)) out.push({ kind: 'probation', day: pd, text: 'Finisce il periodo di prova' });
    const an = new Date(p.hired_on + 'T12:00:00'); an.setFullYear(Number(today.slice(0, 4))); const ad = iso(an); if (p.hired_on < today.slice(0, 4) + '-01-01' && ad >= today && ad <= addDays(today, 30)) out.push({ kind: 'anniversary', day: ad, text: 'Anniversario di lavoro' });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/* ---------- candidati ---------- */
export type CStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export const CSTAGES: { id: CStage; label: string }[] = [{ id: 'new', label: 'Nuovo' }, { id: 'screening', label: 'Prima selezione' }, { id: 'interview', label: 'Colloquio' }, { id: 'offer', label: 'Offerta' }, { id: 'hired', label: 'Assunto' }, { id: 'rejected', label: 'Non scelto' }];
export const CRITERIA = ['Competenze', 'Esperienza', 'Comunicazione', 'Motivazione', 'Affidabilità'] as const;
export type Cand = { id: string; name: string; role: string; stage: CStage; scores: Record<string, number>; interview_at: string | null };
/** Punteggio da 0 a 5: media dei criteri valutati (quelli vuoti non contano). null se non è stato valutato niente. */
export function candidateScore(scores: Record<string, number>): number | null {
  const v = Object.values(scores).filter((x) => x >= 1 && x <= 5); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}
/** I candidati ancora in gara, dal migliore: i non valutati in fondo. */
export function rankCandidates<T extends Cand>(list: T[], role?: string): T[] {
  return list.filter((c) => c.stage !== 'hired' && c.stage !== 'rejected' && (!role || c.role === role)).sort((a, b) => (candidateScore(b.scores) ?? -1) - (candidateScore(a.scores) ?? -1) || a.name.localeCompare(b.name));
}
export const pipelineCounts = (list: Cand[]): Record<CStage, number> => Object.fromEntries(CSTAGES.map((s) => [s.id, list.filter((c) => c.stage === s.id).length])) as Record<CStage, number>;
export const nextCStage = (s: CStage): CStage | null => { const o: CStage[] = ['new', 'screening', 'interview', 'offer', 'hired']; const i = o.indexOf(s); return i >= 0 && i < o.length - 1 ? o[i + 1]! : null; };
export const upcomingInterviews = (list: Cand[], nowMs: number): Cand[] => list.filter((c) => c.interview_at && new Date(c.interview_at).getTime() >= nowMs && c.stage !== 'rejected' && c.stage !== 'hired').sort((a, b) => a.interview_at!.localeCompare(b.interview_at!));
export const declineText = (name: string, role: string, from: string): string => `Gentile ${name},\n\nla ringraziamo per l'interesse e per il tempo dedicato alla selezione${role ? ` per la posizione di ${role}` : ''}. Dopo un'attenta valutazione abbiamo scelto di proseguire con un altro profilo.\nConserveremo il suo curriculum e la contatteremo se si presentassero opportunità in linea con la sua esperienza.\n\nLe auguriamo il meglio per il suo percorso.\nCordiali saluti\n${from}`;
export const offerText = (name: string, role: string, start: string, from: string): string => `Gentile ${name},\n\nè con piacere che le proponiamo la posizione di ${role || '[ruolo]'}${start ? ` con inizio il ${start}` : ''}. Le condizioni (contratto, orario, retribuzione) sono nel documento allegato.\nPuò confermare la sua accettazione rispondendo a questo messaggio.\n\nCordiali saluti\n${from}`;

/* ---------- formazione e valutazioni ---------- */
export type Training = { id: string; title: string; kind: 'corso' | 'certificato' | 'obbligatoria'; done_on: string | null; expires_on: string | null };
export function trainingAlerts(list: Training[], today: string, days = 60): { t: Training; state: 'scaduto' | 'in scadenza' }[] {
  const lim = addDays(today, days);
  return list.filter((t) => t.expires_on && t.expires_on <= lim).map((t) => ({ t, state: (t.expires_on! < today ? 'scaduto' : 'in scadenza') as 'scaduto' | 'in scadenza' })).sort((a, b) => a.t.expires_on!.localeCompare(b.t.expires_on!));
}
export const goalsProgress = (goals: { t: string; done: boolean }[]): number => (goals.length ? Math.round((goals.filter((g) => g.done).length / goals.length) * 100) : 0);
export const periodNow = (today: string): string => `${today.slice(0, 4)}-S${Number(today.slice(5, 7)) <= 6 ? 1 : 2}`;
