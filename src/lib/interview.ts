/**
 * Colloquio conoscitivo in videochiamata e sblocco del contatto (LifeNetwork Lavoro). Modulo PURO, testabile con node.
 *
 * Principio: prima si misurano le competenze, poi (e solo se l'azienda invita e il candidato accetta) c'e' un colloquio in
 * videochiamata. Fino alla risposta alla chiamata l'azienda conosce SOLO il nome (nome + iniziale del cognome).
 * Il contatto si sblocca nel momento in cui il candidato RISPONDE alla chiamata, e resta visibile solo se il candidato lo consente.
 *
 * Macchina a stati:
 *   (candidatura inviata: submitted/shortlist, senza `iv`)
 *   -> invited_interview -> accepted | declined | expired | proposed_other
 *   proposed_other -> accepted (l'azienda accetta la fascia) | nuovo invito
 *   accepted -> calling (chiama l'AZIENDA, dalla finestra di 10 min prima fino alla fine) -> connected (SBLOCCO) | missed
 *   missed -> calling (riprova entro RETRY_MIN) | not_held ("Colloquio non avvenuto", si puo' riproporre)
 *   connected -> done (esito: avanti / non avanti)
 *
 * Nessuna dipendenza da React/Expo: gli import sono relativi.
 */
import { t } from '../i18n/core.ts';
import type { FileRef, Question } from '../data/skillBank.ts';
import type { Answer, TestResult } from './hiring.ts';

export const MIN = 60000;
export const HOUR = 3600000;
export const SLOT_MIN_COUNT = 1;
export const SLOT_MAX_COUNT = 3;
export const SLOT_DURATIONS = [15, 20, 30, 45, 60] as const;
/** L'invito scade dopo 72 ore o all'inizio dell'ultima fascia proposta, se prima. */
export const INVITE_TTL_H = 72;
/** L'azienda puo' chiamare da 10 minuti prima dell'inizio fino alla fine della fascia. */
export const CALL_EARLY_MIN = 10;
/** La chiamata squilla 45 secondi. */
export const RING_MS = 45000;
/** Dopo il primo tentativo l'azienda puo' riprovare per 15 minuti (mai oltre la fine della fascia). */
export const RETRY_MIN = 15;

export type Slot = { start: number; durationMin: number };
export type InterviewStage = 'invited_interview' | 'accepted' | 'declined' | 'expired' | 'proposed_other' | 'calling' | 'connected' | 'missed' | 'not_held' | 'done';
/** Cosa il candidato sceglie di sbloccare alla risposta (default: niente oltre al canale della videochiamata). '' = non condiviso. */
export type Share = { fullName: boolean; email: string; phone: string };
export type Contact = { fullName?: string; email?: string; phone?: string };
export const NO_SHARE: Share = { fullName: false, email: '', phone: '' };
export type OutcomeResult = 'next' | 'rejected';
export type Outcome = { result: OutcomeResult; reasons: string[]; note: string; at: number };
export type LogEv = { ts: number; ev: 'invited' | 'accepted' | 'declined' | 'proposed' | 'counter_ok' | 'expired' | 'call' | 'call_declined' | 'missed' | 'unlock' | 'keep_on' | 'keep_off' | 'outcome' | 'not_held' | 'share'; a?: string };

export type Interview = {
  stage: InterviewStage;
  slots: Slot[];
  /** fuso orario e lingua del colloquio, dichiarati dall'azienda */
  tz: string;
  lang: string;
  message: string;
  invitedAt: number;
  expiresAt: number;
  round: number;
  chosen?: Slot;
  counter?: Slot;
  declineReason?: string;
  share: Share;
  attempts: number;
  firstCallAt?: number;
  ringUntil?: number;
  unlockedAt?: number;
  contact?: Contact;
  /** consenso a mantenere il contatto dopo il colloquio: null = non ancora deciso */
  keep: boolean | null;
  outcome?: Outcome;
  log: LogEv[];
};

/* ---------- nome: l'unica identita' visibile prima del colloquio ---------- */
/**
 * Forma piu' minimale: nome di battesimo + iniziale del cognome ("Alex Stefanovic" -> "Alex S.").
 * Se c'e' una sola parola resta quella. Se e' gia' abbreviato ("Giulia M.") resta com'e'.
 */
export function displayName(full: string): string {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const ini = last.replace(/\.$/, '')[0];
  return `${parts[0]} ${ini.toUpperCase()}.`;
}

/* ---------- fasce orarie ---------- */
export const slotEnd = (s: Slot) => s.start + s.durationMin * MIN;
export const callWindow = (s: Slot) => ({ opens: s.start - CALL_EARLY_MIN * MIN, closes: slotEnd(s) });

/** Errore leggibile o null. */
export function validateSlots(slots: Slot[], now: number): string | null {
  if (slots.length < SLOT_MIN_COUNT) return t('Scegli almeno una fascia oraria');
  if (slots.length > SLOT_MAX_COUNT) return t('Al massimo {0} fasce orarie', SLOT_MAX_COUNT);
  for (const s of slots) {
    if (!Number.isFinite(s.start) || s.start <= now) return t('Le fasce devono essere nel futuro');
    if (!(s.durationMin >= 10 && s.durationMin <= 120)) return t('La durata va da 10 a 120 minuti');
  }
  if (new Set(slots.map((s) => s.start)).size !== slots.length) return t('Due fasce hanno lo stesso orario');
  return null;
}

/** Fasce che si sovrappongono a un impegno gia' presente (per avvisare, non per bloccare). */
export const overlaps = (a: Slot, b: Slot) => a.start < slotEnd(b) && b.start < slotEnd(a);

export function createInvite(input: { slots: Slot[]; tz: string; lang: string; message?: string; now: number; round?: number; log?: LogEv[] }): Interview | null {
  if (validateSlots(input.slots, input.now)) return null;
  const slots = [...input.slots].sort((a, b) => a.start - b.start);
  const last = slots[slots.length - 1].start;
  return {
    stage: 'invited_interview', slots, tz: input.tz, lang: input.lang, message: (input.message ?? '').trim().slice(0, 300),
    invitedAt: input.now, expiresAt: Math.min(input.now + INVITE_TTL_H * HOUR, last), round: input.round ?? 1,
    share: { ...NO_SHARE }, attempts: 0, keep: null, log: [...(input.log ?? []), { ts: input.now, ev: 'invited', a: String(slots.length) }],
  };
}

const push = (iv: Interview, ev: LogEv): Interview => ({ ...iv, log: [...iv.log, ev] });

/* ---------- scadenze (si applicano "pigramente" quando si guarda lo stato) ---------- */
export const retryUntil = (iv: Interview): number | null => {
  if (!iv.chosen || iv.firstCallAt == null) return null;
  return Math.min(slotEnd(iv.chosen), iv.firstCallAt + RETRY_MIN * MIN);
};

/** Applica le scadenze al tempo `now`. Restituisce lo stesso oggetto se nulla cambia. */
export function settle(iv: Interview, now: number): Interview {
  let cur = iv;
  if (cur.stage === 'invited_interview' && now > cur.expiresAt) cur = push({ ...cur, stage: 'expired' }, { ts: cur.expiresAt, ev: 'expired' });
  if (cur.stage === 'proposed_other' && cur.counter && now >= cur.counter.start) cur = push({ ...cur, stage: 'expired' }, { ts: cur.counter.start, ev: 'expired' });
  if (cur.stage === 'calling' && cur.ringUntil != null && now > cur.ringUntil) cur = push({ ...cur, stage: 'missed', ringUntil: undefined }, { ts: cur.ringUntil, ev: 'missed' });
  if (cur.stage === 'missed') {
    const until = retryUntil(cur);
    if (until != null && now > until) cur = push({ ...cur, stage: 'not_held' }, { ts: until, ev: 'not_held' });
  }
  if (cur.stage === 'accepted' && cur.chosen && now > slotEnd(cur.chosen)) cur = push({ ...cur, stage: 'not_held' }, { ts: slotEnd(cur.chosen), ev: 'not_held' });
  return cur;
}

/* ---------- transizioni: null = non consentita ---------- */
export function accept(iv: Interview, idx: number, share: Share, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'invited_interview') return null;
  const slot = cur.slots[idx];
  if (!slot || slot.start <= now) return null;
  return push({ ...cur, stage: 'accepted', chosen: slot, share: cleanShare(share) }, { ts: now, ev: 'accepted', a: String(slot.start) });
}

export function propose(iv: Interview, slot: Slot, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'invited_interview') return null;
  if (validateSlots([slot], now)) return null;
  return push({ ...cur, stage: 'proposed_other', counter: slot }, { ts: now, ev: 'proposed', a: String(slot.start) });
}

/** L'azienda accetta la fascia proposta dal candidato. */
export function acceptCounter(iv: Interview, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'proposed_other' || !cur.counter) return null;
  return push({ ...cur, stage: 'accepted', chosen: cur.counter, counter: undefined }, { ts: now, ev: 'counter_ok', a: String(cur.counter.start) });
}

/** Il candidato rifiuta (senza conseguenze sul profilo) prima della chiamata. */
export function decline(iv: Interview, reason: string, now: number): Interview | null {
  const cur = settle(iv, now);
  if (!(cur.stage === 'invited_interview' || cur.stage === 'proposed_other' || cur.stage === 'accepted' || cur.stage === 'missed')) return null;
  return push({ ...cur, stage: 'declined', declineReason: reason.trim().slice(0, 200) || undefined }, { ts: now, ev: 'declined' });
}

/** Nuovo invito dell'azienda dopo "non avvenuto", scaduto o con proposta del candidato. */
export function reinvite(iv: Interview, input: { slots: Slot[]; tz: string; lang: string; message?: string }, now: number): Interview | null {
  const cur = settle(iv, now);
  if (!(cur.stage === 'not_held' || cur.stage === 'expired' || cur.stage === 'proposed_other')) return null;
  const next = createInvite({ ...input, now, round: cur.round + 1, log: cur.log });
  if (!next) return null;
  return { ...next, share: cur.share, keep: null };
}

/* ---------- chiamata ---------- */
export type CanCall = { ok: boolean; reason?: 'not_accepted' | 'too_early' | 'too_late' | 'ringing' | 'retry_over' | 'connected' };

/** L'azienda puo' chiamare solo dopo l'accettazione, dalla finestra di 10 minuti prima fino alla fine. Il candidato non chiama mai. */
export function canCall(iv: Interview, now: number): CanCall {
  const cur = settle(iv, now);
  if (cur.stage === 'calling') return { ok: false, reason: 'ringing' };
  if (cur.stage === 'connected' || cur.stage === 'done') return { ok: false, reason: 'connected' };
  if (cur.stage !== 'accepted' && cur.stage !== 'missed') return { ok: false, reason: cur.stage === 'not_held' ? 'too_late' : 'not_accepted' };
  if (!cur.chosen) return { ok: false, reason: 'not_accepted' };
  const w = callWindow(cur.chosen);
  if (now < w.opens) return { ok: false, reason: 'too_early' };
  if (now > w.closes) return { ok: false, reason: 'too_late' };
  if (cur.stage === 'missed') { const u = retryUntil(cur); if (u != null && now > u) return { ok: false, reason: 'retry_over' }; }
  return { ok: true };
}

export function startCall(iv: Interview, now: number): Interview | null {
  const cur = settle(iv, now);
  if (!canCall(cur, now).ok) return null;
  return push({ ...cur, stage: 'calling', attempts: cur.attempts + 1, firstCallAt: cur.firstCallAt ?? now, ringUntil: now + RING_MS }, { ts: now, ev: 'call', a: String(cur.attempts + 1) });
}

/** Il candidato rifiuta la chiamata in arrivo: niente sblocco. */
export function declineCall(iv: Interview, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'calling') return null;
  return push({ ...cur, stage: 'missed', ringUntil: undefined }, { ts: now, ev: 'call_declined' });
}

/** L'azienda annulla la chiamata mentre squilla. */
export function cancelCall(iv: Interview, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'calling') return null;
  return push({ ...cur, stage: 'missed', ringUntil: undefined }, { ts: now, ev: 'missed' });
}

export const cleanShare = (s: Share): Share => ({ fullName: !!s.fullName, email: (s.email ?? '').trim(), phone: (s.phone ?? '').trim() });
export const shareCount = (s: Share) => (s.fullName ? 1 : 0) + (s.email.trim() ? 1 : 0) + (s.phone.trim() ? 1 : 0);

/** Costruisce il contatto da sbloccare: SOLO cio' che il candidato ha scelto. */
export function buildContact(share: Share, fullName: string): Contact {
  const c: Contact = {};
  if (share.fullName) c.fullName = fullName;
  if (share.email.trim()) c.email = share.email.trim();
  if (share.phone.trim()) c.phone = share.phone.trim();
  return c;
}

/**
 * IL MOMENTO DELLO SBLOCCO: il candidato risponde alla chiamata. Solo da `calling` e solo mentre squilla.
 * Il contatto e' preso dalla scelta fatta (e modificabile fino a questo istante).
 */
export function answerCall(iv: Interview, fullName: string, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage !== 'calling' || cur.ringUntil == null || now > cur.ringUntil) return null;
  const contact = buildContact(cur.share, fullName);
  return push({ ...cur, stage: 'connected', ringUntil: undefined, unlockedAt: now, contact, keep: null }, { ts: now, ev: 'unlock', a: [contact.fullName ? 'nome' : '', contact.email ? 'email' : '', contact.phone ? 'telefono' : ''].filter(Boolean).join(',') });
}

/** Cambia cosa sbloccare: possibile fino alla risposta alla chiamata. */
export function setShare(iv: Interview, share: Share, now: number): Interview | null {
  const cur = settle(iv, now);
  if (cur.stage === 'connected' || cur.stage === 'done' || cur.stage === 'declined' || cur.stage === 'expired' || cur.stage === 'not_held') return null;
  const s = cleanShare(share);
  return push({ ...cur, share: s }, { ts: now, ev: 'share', a: String(shareCount(s)) });
}

/** "Mantieni il mio contatto per questa azienda": si/no, revocabile in ogni momento. */
export function setKeep(iv: Interview, keep: boolean, now: number): Interview | null {
  if (iv.stage !== 'connected' && iv.stage !== 'done') return null;
  if (iv.keep === keep) return iv;
  return push({ ...iv, keep }, { ts: now, ev: keep ? 'keep_on' : 'keep_off' });
}

export const OUTCOME_REASONS = ['Competenze adatte al ruolo', 'Ottima comunicazione', 'Servono più competenze', 'Altro profilo più adatto', 'Ruolo già coperto'] as const;

/** Esito dopo il colloquio: avanti / non avanti, con feedback strutturato breve. */
export function finish(iv: Interview, result: OutcomeResult, reasons: string[], note: string, now: number): Interview | null {
  if (iv.stage !== 'connected') return null;
  const outcome: Outcome = { result, reasons: reasons.slice(0, 3), note: note.trim().slice(0, 300), at: now };
  return push({ ...iv, stage: 'done', outcome }, { ts: now, ev: 'outcome', a: result });
}

/* ---------- chi vede cosa ---------- */
/** Contatto visibile all'azienda: solo in connected/done e solo con consenso attivo. */
export function contactVisible(iv: Interview | undefined | null): boolean {
  if (!iv || iv.unlockedAt == null || !iv.contact) return false;
  if (iv.stage === 'connected') return iv.keep !== false;
  if (iv.stage === 'done') return iv.keep === true;
  return false;
}

export type CompanyView = { name: string; contact: Contact | null; fullNameVisible: boolean };
/** L'identita' che l'azienda vede: il NOME sempre; il contatto solo se sbloccato e consentito. */
export function companyView(candidateFull: string, iv: Interview | undefined | null): CompanyView {
  if (!contactVisible(iv)) return { name: displayName(candidateFull), contact: null, fullNameVisible: false };
  const c = iv!.contact!;
  return { name: c.fullName || displayName(candidateFull), contact: { ...c }, fullNameVisible: !!c.fullName };
}

export type Visibility = { name: true; scores: true; answers: true; photo: false; city: false; social: false; contact: boolean };
export const visibilityOf = (iv: Interview | undefined | null): Visibility => ({ name: true, scores: true, answers: true, photo: false, city: false, social: false, contact: contactVisible(iv) });

/* ---------- stato per il candidato / etichette ---------- */
export type CandidateStatus = 'evaluating' | 'shortlist' | 'invited' | 'proposed' | 'scheduled' | 'calling' | 'shared' | 'not_held' | 'declined' | 'expired' | 'concluded' | 'rejected';

export function candidateStatus(appStatus: string, iv: Interview | undefined | null): CandidateStatus {
  if (appStatus === 'rejected') return 'rejected';
  if (!iv) return appStatus === 'shortlist' ? 'shortlist' : 'evaluating';
  switch (iv.stage) {
    case 'invited_interview': return 'invited';
    case 'proposed_other': return 'proposed';
    case 'accepted': return 'scheduled';
    case 'calling': return 'calling';
    case 'connected': return contactVisible(iv) ? 'shared' : 'scheduled';
    case 'missed': return 'scheduled';
    case 'not_held': return 'not_held';
    case 'declined': return 'declined';
    case 'expired': return 'expired';
    case 'done': return 'concluded';
  }
}

export function candidateStatusLabel(s: CandidateStatus): string {
  switch (s) {
    case 'evaluating': return t('In valutazione');
    case 'shortlist': return t('In valutazione · nei preferiti');
    case 'invited': return t('Invitato al colloquio');
    case 'proposed': return t('Hai proposto un’altra fascia');
    case 'scheduled': return t('Colloquio fissato');
    case 'calling': return t('Chiamata in arrivo');
    case 'shared': return t('Contatto condiviso');
    case 'not_held': return t('Colloquio non avvenuto');
    case 'declined': return t('Invito rifiutato');
    case 'expired': return t('Invito scaduto');
    case 'concluded': return t('Concluso');
    case 'rejected': return t('Non selezionato');
  }
}

/** Etichetta per l'azienda. */
export function companyStatusLabel(appStatus: string, iv: Interview | undefined | null): string {
  if (appStatus === 'rejected') return t('Non selezionato');
  if (!iv) return appStatus === 'shortlist' ? t('Nei preferiti') : t('Ricevuta');
  switch (iv.stage) {
    case 'invited_interview': return t('Invito inviato');
    case 'proposed_other': return t('Ha proposto un’altra fascia');
    case 'accepted': return t('Colloquio fissato');
    case 'calling': return t('Chiamata in corso');
    case 'connected': return t('Colloquio in corso');
    case 'missed': return t('Chiamata senza risposta');
    case 'not_held': return t('Colloquio non avvenuto');
    case 'declined': return t('Invito rifiutato');
    case 'expired': return t('Invito scaduto');
    case 'done': return iv.outcome?.result === 'next' ? t('Colloquio concluso · avanti') : t('Colloquio concluso · non avanti');
  }
}

/** Stati in cui l'azienda puo' (ri)invitare. */
export const canInvite = (appStatus: string, iv: Interview | undefined | null): boolean => appStatus !== 'rejected' && (!iv || iv.stage === 'not_held' || iv.stage === 'expired' || iv.stage === 'proposed_other');

/* ---------- testi di consenso (prima di candidarsi) ---------- */
export const consentSees = () => t('Vedrà: il tuo nome, i punteggi per competenza, le tue risposte e i risultati dei test.');
export const consentNotSees = () => t('Non vedrà: foto, contatti, storia lavorativa.');
export const consentWhen = () => t('Il tuo contatto verrà condiviso solo se accetti un colloquio e rispondi alla videochiamata, e solo ciò che scegli tu.');

/** Elenco leggibile dei dati sbloccati. */
export function contactText(c: Contact | null | undefined): string {
  if (!c) return '';
  const parts = [c.fullName, c.email, c.phone].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : t('nessun contatto extra: solo il canale della videochiamata');
}

/* ---------- cronologia per il candidato: "cosa ha visto l'azienda e quando" ---------- */
export type TimelineItem = { ts: number; title: string; sees?: string };

export function candidateTimeline(input: { submittedAt: number; candidateFull: string; iv?: Interview | null; fmt: (ts: number) => string; checks?: { askedAt: number; title: string; status: string }[] }): TimelineItem[] {
  const { iv, fmt } = input;
  const out: TimelineItem[] = [{ ts: input.submittedAt, title: t('Candidatura inviata'), sees: t('L’azienda vede: il tuo nome ({0}), i punteggi per competenza e le tue risposte.', displayName(input.candidateFull)) }];
  (input.checks ?? []).forEach((c) => out.push({ ts: c.askedAt, title: t('Verifica richiesta: {0}', c.title), sees: t('Nessun dato nuovo: l’azienda vedrà solo il risultato della verifica.') }));
  (iv?.log ?? []).forEach((e) => {
    switch (e.ev) {
      case 'invited': out.push({ ts: e.ts, title: iv && iv.round > 1 ? t('Nuovo invito al colloquio') : t('Invito al colloquio ricevuto'), sees: t('Nessun dato condiviso: l’azienda conosce solo il tuo nome.') }); break;
      case 'accepted': out.push({ ts: e.ts, title: t('Hai accettato il colloquio: {0}', fmt(Number(e.a))), sees: t('Nessun dato condiviso finché non rispondi alla chiamata.') }); break;
      case 'proposed': out.push({ ts: e.ts, title: t('Hai proposto un’altra fascia: {0}', fmt(Number(e.a))) }); break;
      case 'counter_ok': out.push({ ts: e.ts, title: t('L’azienda ha accettato la tua fascia: {0}', fmt(Number(e.a))) }); break;
      case 'declined': out.push({ ts: e.ts, title: t('Hai rifiutato l’invito'), sees: t('Nessun dato condiviso. Nessuna conseguenza sul tuo profilo.') }); break;
      case 'expired': out.push({ ts: e.ts, title: t('Invito scaduto'), sees: t('Nessun dato condiviso.') }); break;
      case 'call': out.push({ ts: e.ts, title: t('L’azienda ti ha chiamato (tentativo {0})', e.a ?? '1') }); break;
      case 'call_declined': out.push({ ts: e.ts, title: t('Hai rifiutato la chiamata'), sees: t('Nessun dato condiviso.') }); break;
      case 'missed': out.push({ ts: e.ts, title: t('Chiamata senza risposta'), sees: t('Nessun dato condiviso.') }); break;
      case 'not_held': out.push({ ts: e.ts, title: t('Colloquio non avvenuto'), sees: t('Nessun dato condiviso.') }); break;
      case 'unlock': out.push({ ts: e.ts, title: t('Contatto sbloccato durante il colloquio'), sees: t('Condiviso con l’azienda: {0}.', contactText(iv?.contact ?? null)) }); break;
      case 'keep_on': out.push({ ts: e.ts, title: t('Hai scelto di mantenere il contatto') }); break;
      case 'keep_off': out.push({ ts: e.ts, title: t('Hai revocato il consenso'), sees: t('Il contatto è di nuovo nascosto all’azienda.') }); break;
      case 'outcome': out.push({ ts: e.ts, title: e.a === 'next' ? t('Esito: si va avanti') : t('Esito: non si va avanti') }); break;
      default: break;
    }
  });
  return out.sort((a, b) => a.ts - b.ts);
}

/* ---------- ulteriori verifiche ---------- */
export type CheckKind = 'test' | 'practical' | 'live';
export type CheckStatus = 'requested' | 'accepted' | 'declined' | 'done' | 'not_done';
export type CheckPractical = { instructions: string; deliverables: string; files: FileRef[]; limitMin: number };
export type FurtherCheck = {
  id: string; kind: CheckKind; title: string; skill: string; askedAt: number; status: CheckStatus;
  /** test: domande della banca + domande create dall'azienda */
  questionIds: string[]; custom: Question[]; timeLimitMin: number;
  practical?: CheckPractical;
  /** dal vivo: domande da porre in colloquio e annotazioni PRIVATE dell'azienda (il candidato non le vede) */
  liveQuestions: string[]; privateNotes: string; liveScore?: number;
  startedAt?: number; doneAt?: number; answers: Answer[]; openScores: Record<string, number>; result?: TestResult;
  note?: string; files?: FileRef[]; late?: boolean;
};

export const CHECK_KIND_LABEL: Record<CheckKind, () => string> = { test: () => t('Test aggiuntivo'), practical: () => t('Prova pratica'), live: () => t('Verifica dal vivo') };
export const checkStatusLabel = (c: FurtherCheck): string => {
  if (c.status === 'requested') return t('In attesa di risposta');
  if (c.status === 'accepted') return c.kind === 'live' ? t('Da svolgere durante il colloquio') : t('Accettata');
  if (c.status === 'declined') return t('Verifica non effettuata');
  if (c.status === 'not_done') return t('Verifica non effettuata');
  return c.kind === 'live' ? t('Svolta dal vivo') : t('Svolta');
};

/** Il candidato accetta o rifiuta (rifiutare non lo penalizza; l'azienda la vede come "verifica non effettuata"). */
export function respondCheck(c: FurtherCheck, accept: boolean, now: number): FurtherCheck | null {
  if (c.status !== 'requested') return null;
  return { ...c, status: accept ? 'accepted' : 'declined', startedAt: accept && c.kind === 'practical' ? now : c.startedAt };
}

/** Media dei punteggi per competenza di piu' risultati (test + verifiche): ogni risultato pesa uguale. null se nessuno. */
export function mergedScores(results: (Record<string, number | null> | undefined)[]): Record<string, number | null> {
  const acc: Record<string, number[]> = {};
  const keys = new Set<string>();
  results.forEach((r) => r && Object.entries(r).forEach(([k, v]) => { keys.add(k); if (v != null) (acc[k] ??= []).push(v); }));
  const out: Record<string, number | null> = {};
  keys.forEach((k) => { out[k] = acc[k]?.length ? Math.round(acc[k].reduce((s, x) => s + x, 0) / acc[k].length) : null; });
  return out;
}

/** La richiesta non puo' contenere campi per documenti personali: l'app non li offre; qui si filtra anche il testo libero. */
const FORBIDDEN = /(?<![\p{L}])(cv|curriculum|curricul[ao]|resume|diplom[ai]|certificat[io]|passaporto|carta d['’ ]identit[àa]|foto(grafia)?|et[àa]|data di nascita|indirizzo di casa|stato civile)(?![\p{L}])/iu;
export const asksForPersonalDocs = (text: string): boolean => FORBIDDEN.test(text ?? '');
