/**
 * Identità verificata e attività (organizzazioni / aziende) collegate a una persona. Modulo PURO, testato in tests/profileIdentity.test.mjs.
 *
 * ONESTÀ: la verifica reale di un documento richiede un server e un fornitore KYC (es. Onfido, Stripe Identity, Veriff) e
 * conformità GDPR / nLPD. Oggi l'app crea soltanto la RICHIESTA in stato "in attesa di verifica" sul telefono; la conferma
 * simulata esiste solo in modalità demo ed è etichettata "Anteprima". Foto e documento non vengono salvati: restano in memoria
 * temporanea finché la schermata è aperta e si scartano all'invio o alla chiusura.
 */

export type IdStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type DocType = 'id_card' | 'passport' | 'permit';
export const DOC_LABEL: Record<DocType, string> = { id_card: 'Carta d’identità', passport: 'Passaporto', permit: 'Permesso di soggiorno' };
export const DOC_SIDES: Record<DocType, ('front' | 'back')[]> = { id_card: ['front', 'back'], permit: ['front', 'back'], passport: ['front'] };
export const STATUS_LABEL: Record<IdStatus, string> = { none: 'Non verificato', pending: 'In attesa di verifica', verified: 'Identità verificata', rejected: 'Verifica respinta' };
export const REJECT_REASONS = ['Foto poco leggibile', 'Documento scaduto', 'Nome diverso da quello dell’account', 'Documento non supportato'] as const;

export type IdentityRecord = { status: IdStatus; doc?: DocType; submittedAt?: number; resolvedAt?: number; reason?: string; selfie?: boolean; preview?: boolean };
export const EMPTY_IDENTITY: IdentityRecord = { status: 'none' };

/** Conferma che esistano le foto richieste (solo conteggio: le immagini non si conservano). */
export function missingSides(doc: DocType, got: Partial<Record<'front' | 'back', boolean>>): ('front' | 'back')[] {
  return DOC_SIDES[doc].filter((s) => !got[s]);
}

export function submitRequest(doc: DocType, got: Partial<Record<'front' | 'back', boolean>>, selfie: boolean, now: number, preview = false): IdentityRecord | null {
  if (missingSides(doc, got).length) return null;
  return { status: 'pending', doc, submittedAt: now, selfie, preview };
}
/** Risposta del fornitore KYC (o simulazione demo). */
export function resolveRequest(rec: IdentityRecord, ok: boolean, now: number, reason = ''): IdentityRecord {
  if (rec.status !== 'pending') return rec;
  return ok ? { ...rec, status: 'verified', resolvedAt: now, reason: undefined } : { ...rec, status: 'rejected', resolvedAt: now, reason: reason || REJECT_REASONS[0] };
}

export type Action = 'browse' | 'chat' | 'like' | 'comment' | 'follow' | 'post' | 'vote' | 'sell' | 'offer' | 'club' | 'business' | 'receiveLP';
/**
 * Cosa sblocca cosa. L'uso base dell'app (piano, task, salute, finanze, chat) non dipende MAI dall'identità: solo LifeNetwork pubblico.
 *  - non verificato / respinto: LifeNetwork resta chiuso (serve almeno inviare il documento); le chat private funzionano;
 *  - in attesa (documento inviato): LifeNetwork si apre in modalità leggera: guardare, mettere mi piace, seguire, commentare, pubblicare post;
 *  - verificato: tutto (votare, vendere, offrire servizi e seminari, aprire un LifeClub, creare attività, ricevere LifePoint).
 */
export const UNLOCKS: Record<IdStatus, Action[]> = {
  none: ['chat'],
  rejected: ['chat'],
  pending: ['chat', 'browse', 'like', 'comment', 'follow', 'post'],
  verified: ['chat', 'browse', 'like', 'comment', 'follow', 'post', 'vote', 'sell', 'offer', 'club', 'business', 'receiveLP'],
};
export const can = (status: IdStatus, a: Action): boolean => UNLOCKS[status].includes(a);
export const ACTION_LABEL: Record<Action, string> = { browse: 'Guardare', chat: 'Scrivere in chat', like: 'Mettere mi piace', comment: 'Commentare', follow: 'Seguire', post: 'Pubblicare post', vote: 'Votare', sell: 'Vendere', offer: 'Offrire servizi e seminari', club: 'Aprire un LifeClub', business: 'Creare un’attività', receiveLP: 'Ricevere LifePoint' };
export function lockedReason(status: IdStatus, a: Action): string | null {
  if (can(status, a)) return null;
  if (status === 'pending') return 'Il documento è in verifica: potrai farlo appena è confermato.';
  return 'Per farlo serve verificare la tua identità con un documento.';
}

/* ---------- attività ---------- */
export type BizKind = 'attivita' | 'associazione' | 'azienda' | 'scuola' | 'altro';
export const BIZ_KIND_LABEL: Record<BizKind, string> = { attivita: 'Attività', associazione: 'Associazione', azienda: 'Azienda', scuola: 'Scuola', altro: 'Altro' };
export type BizContacts = { email?: string; phone?: string; web?: string; showEmail: boolean; showPhone: boolean; showWeb: boolean };
export type Business = { id: string; owner: string; name: string; kind: BizKind; desc: string; color: string; logo?: string; contacts: BizContacts; createdAt: number; /** l'utente può togliere l'attività dal proprio profilo (non l'esistenza dell'attività) */ hiddenOnProfile?: boolean };

export function validateBusiness(b: Pick<Business, 'name' | 'kind'>): string | null {
  if (b.name.trim().length < 2) return 'Scrivi il nome dell’attività.';
  if (!(b.kind in BIZ_KIND_LABEL)) return 'Scegli il tipo di attività.';
  return null;
}
/** Il titolare è SEMPRE mostrato nella pagina dell'attività e non si può oscurare. */
export const OWNER_HIDEABLE = false;
export function ownerLine(owner: string): string { return `di ${owner}`; }
export function businessView(b: Business, ownerVerified: boolean) {
  return { title: b.name, owner: b.owner, ownerLine: ownerLine(b.owner), ownerVerified, ownerHidden: false as const, subtitle: BIZ_KIND_LABEL[b.kind] };
}
/** Contatti pubblici: solo quelli che il titolare ha scelto di mostrare e che non sono vuoti. */
export function publicContacts(c: BizContacts): { kind: 'email' | 'phone' | 'web'; value: string }[] {
  const out: { kind: 'email' | 'phone' | 'web'; value: string }[] = [];
  if (c.showEmail && c.email?.trim()) out.push({ kind: 'email', value: c.email.trim() });
  if (c.showPhone && c.phone?.trim()) out.push({ kind: 'phone', value: c.phone.trim() });
  if (c.showWeb && c.web?.trim()) out.push({ kind: 'web', value: c.web.trim() });
  return out;
}
/** Elenco sul profilo: il proprietario vede tutto (con indicazione di quelle tolte); gli altri solo quelle non tolte. */
export function businessesOnProfile(list: Business[], profile: string, viewerIsOwner: boolean): Business[] {
  return list.filter((b) => b.owner === profile && (viewerIsOwner || !b.hiddenOnProfile));
}
/** Offerta di lavoro: collega l'attività del titolare con lo stesso nome dell'azienda. */
export function businessForJob(list: Business[], job: { owner: string; company: string }): Business | null {
  const n = job.company.trim().toLowerCase();
  return list.find((b) => b.owner === job.owner && b.name.trim().toLowerCase() === n) ?? null;
}
export const BIZ_COLORS = ['#6c8cff', '#e0866b', '#4fb58a', '#c9a24a', '#a46bd6', '#4fa7c9', '#d65f8a', '#6b7280'] as const;
