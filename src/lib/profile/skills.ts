/**
 * Competenze dichiarate e verificabili. Modulo PURO, testato in tests/profileSkills.test.mjs.
 *
 * Niente curriculum: contano le competenze, e TUTTE quelle dichiarate devono essere vere. Chi assume può chiedere una
 * verifica su qualunque competenza dichiarata (sul profilo pubblico o, per i candidati, con il flusso "ulteriori verifiche"
 * di Lavoro). Stati:
 *  - declared      dichiarata, nessuna prova;
 *  - in_verification  richiesta di verifica inviata/accettata, esito non ancora arrivato;
 *  - verified_test verificata da un test (punteggio >= CONFIRM_MIN) con punteggio e data;
 *  - verified_live verificata dal vivo da un'azienda in colloquio (punteggio >= CONFIRM_MIN);
 *  - unconfirmed   "non confermata": ultimo esito sotto soglia, oppure verifica richiesta e rifiutata.
 * Soglia: CONFIRM_MIN = 50 su 100 (il livello "Base" di hiring.levelOf). Sotto, la competenza resta visibile ma è segnalata
 * come non confermata; il profilo mostra "N su M competenze verificate". Dichiarare competenze che non si possiedono è
 * sanzionabile (segnalazioni e riduzione di affidabilità: vedi docs/profile.md).
 */

export const CONFIRM_MIN = 50;
export const MAX_DECLARED = 30;
export const MAX_ON_CARD = 5;
export const HONESTY_NOTICE = 'Dichiara solo ciò che sai fare: chi assume può chiedere una verifica su tutto.';

export type SkillStatus = 'declared' | 'in_verification' | 'verified_test' | 'verified_live' | 'unconfirmed';
export const SKILL_STATUS_LABEL: Record<SkillStatus, string> = {
  declared: 'Dichiarata', in_verification: 'In verifica', verified_test: 'Verificata da test', verified_live: 'Verificata dal vivo', unconfirmed: 'Non verificata',
};
export type Declared = { id: string; label: string; declaredAt: number };
export type ReqStatus = 'requested' | 'accepted' | 'declined';
export type VerifRequest = { id: string; skill: string; by: string; to: string; createdAt: number; status: ReqStatus; respondedAt?: number; note?: string; appId?: string };
export type Evidence = { test?: { score: number; ts: number; provisional?: boolean }; live?: { score: number; ts: number } };
export type SkillState = { id: string; label: string; status: SkillStatus; score?: number; ts?: number; open?: VerifRequest; declinedBy?: string };

export function statusOf(ev: Evidence | undefined, reqs: VerifRequest[]): Omit<SkillState, 'id' | 'label'> {
  const items = [
    ev?.test && !ev.test.provisional ? { kind: 'test' as const, score: ev.test.score, ts: ev.test.ts } : null,
    ev?.live ? { kind: 'live' as const, score: ev.live.score, ts: ev.live.ts } : null,
  ].filter((x): x is { kind: 'test' | 'live'; score: number; ts: number } => !!x).sort((a, b) => b.ts - a.ts);
  const latest = items[0];
  const open = reqs.filter((r) => r.status !== 'declined' && (!latest || r.createdAt > latest.ts)).sort((a, b) => b.createdAt - a.createdAt)[0];
  const declined = reqs.filter((r) => r.status === 'declined' && (!latest || (r.respondedAt ?? r.createdAt) > latest.ts)).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (open) return { status: 'in_verification', open, score: latest?.score, ts: latest?.ts };
  if (latest) {
    if (latest.score >= CONFIRM_MIN) return { status: latest.kind === 'live' ? 'verified_live' : 'verified_test', score: latest.score, ts: latest.ts };
    return { status: 'unconfirmed', score: latest.score, ts: latest.ts };
  }
  if (declined) return { status: 'unconfirmed', declinedBy: declined.by };
  return { status: 'declared' };
}

export function skillStates(declared: Declared[], evidence: Record<string, Evidence>, reqs: VerifRequest[]): SkillState[] {
  return declared.map((d) => ({ id: d.id, label: d.label, ...statusOf(evidence[d.id], reqs.filter((r) => r.skill === d.id)) }));
}
export const isVerified = (s: SkillStatus) => s === 'verified_test' || s === 'verified_live';
export function quota(states: SkillState[]): { verified: number; total: number; text: string } {
  const verified = states.filter((s) => isVerified(s.status)).length;
  return { verified, total: states.length, text: states.length ? `${verified} su ${states.length} competenze verificate` : 'Nessuna competenza dichiarata' };
}
/** Competenze per il biglietto: solo dichiarate dall'utente, max 5, prima le verificate. */
export function cardSkills(states: SkillState[], chosen: string[] | undefined): SkillState[] {
  const pool = chosen?.length ? chosen.map((id) => states.find((s) => s.id === id)).filter((s): s is SkillState => !!s) : [...states].sort((a, b) => Number(isVerified(b.status)) - Number(isVerified(a.status)));
  return pool.slice(0, MAX_ON_CARD);
}

export function validateDeclare(label: string, declared: Declared[]): string | null {
  const l = label.trim();
  if (l.length < 2) return 'Scrivi il nome della competenza.';
  if (l.length > 40) return 'Nome troppo lungo (massimo 40 caratteri).';
  if (declared.length >= MAX_DECLARED) return 'Hai raggiunto il massimo di competenze dichiarate.';
  if (declared.some((d) => d.label.trim().toLowerCase() === l.toLowerCase() || d.id.toLowerCase() === l.toLowerCase())) return 'Hai già dichiarato questa competenza.';
  return null;
}

/** Chi può chiedere una verifica: chiunque tranne il titolare; una sola richiesta aperta per competenza e richiedente. */
export function requestBlockReason(by: string, to: string, skill: string, reqs: VerifRequest[]): string | null {
  if (!by || !to) return 'Richiesta non valida.';
  if (by === to) return 'Non puoi chiedere una verifica a te stesso.';
  if (reqs.some((r) => r.by === by && r.to === to && r.skill === skill && r.status !== 'declined')) return 'Hai già una richiesta aperta per questa competenza.';
  return null;
}
export function respond(r: VerifRequest, accept: boolean, now: number): VerifRequest | null {
  if (r.status !== 'requested') return null;
  return { ...r, status: accept ? 'accepted' : 'declined', respondedAt: now };
}
