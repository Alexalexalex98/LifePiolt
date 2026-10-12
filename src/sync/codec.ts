/**
 * Hook di cifratura del payload (E2E). L'engine passa SEMPRE il contenuto delle modifiche dal codec prima di
 * consegnarlo al transport, e dal codec in uscita quando le riceve.
 *
 * STATO ATTUALE: esiste solo il codec 'identity' (nessuna cifratura). NON implementiamo crittografia fai-da-te.
 * Piano per il codec reale (non ancora scritto):
 *  - chiave utente a 256 bit derivata da password/frase di recupero (KDF memory-hard, es. Argon2id) e custodita in expo-secure-store;
 *  - cifrario AEAD di una libreria verificata (es. XChaCha20-Poly1305 o AES-256-GCM da una libreria standard), nonce casuale per messaggio;
 *  - "ctx" (collezione + id entita') come dati associati autenticati, cosi' un payload non si puo' spostare su un'altra entita';
 *  - id del codec versionato (es. 'xchacha20poly1305-v1') per poter ruotare le chiavi: il server conserva il campo `codec`.
 * Le collezioni con requiresE2E (chat, iscrizioni) NON vengono mai inviate finche' il codec attivo e' 'identity'.
 */
export type CodecCtx = { collection: string; entityId: string };

export interface PayloadCodec {
  /** identificatore salvato su ogni modifica ('identity' = nessuna cifratura) */
  readonly id: string;
  /** true se il payload e' cifrato end-to-end (il server non puo' leggerlo) */
  readonly e2e: boolean;
  encrypt(plain: string, ctx: CodecCtx): Promise<string> | string;
  decrypt(payload: string, ctx: CodecCtx): Promise<string> | string;
}

export const identityCodec: PayloadCodec = {
  id: 'identity',
  e2e: false,
  encrypt: (plain) => plain,
  decrypt: (payload) => payload,
};
