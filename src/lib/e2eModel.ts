/**
 * Modello della crittografia end-to-end (E2E) di LifePilot. Modulo puro, senza dipendenze.
 *
 * STATO ONESTO: oggi la cifratura end-to-end NON è attiva. Non c'è un server, quindi nessun messaggio o documento viaggia in rete.
 * Questo file descrive cosa sarà cifrato, come saranno gestite le chiavi e cosa NON sarà coperto, così il server potrà essere
 * collegato senza cambiare il modello. Piano tecnico completo: docs/e2e-plan.md.
 */

/** Falso finché non esistono server + libreria crittografica + test. Tutte le etichette in app dipendono da questo valore. */
export const E2E_ACTIVE = false;

/** Etichetta onesta da mostrare accanto a seminari, corsi e sedute. */
export const E2E_LABEL_PREPARED = 'Cifratura end-to-end: predisposta, si attiva col server';
export const E2E_LABEL_ACTIVE = 'Cifrato end-to-end: solo voi due potete leggerlo';
export const e2eLabel = (active: boolean = E2E_ACTIVE) => (active ? E2E_LABEL_ACTIVE : E2E_LABEL_PREPARED);

export type E2eObjectKind = 'seminario' | 'corso' | 'seduta' | 'messaggio-seduta' | 'documento-scambiato';
export type E2eObject = { kind: E2eObjectKind; label: string; scope: 'gruppo' | '1-a-1'; why: string };

/** Cosa viaggerà cifrato end-to-end (tutto il resto di LifeNetwork è pubblico per scelta). */
export const E2E_OBJECTS: E2eObject[] = [
  { kind: 'seminario', label: 'Seminari (contenuti riservati ai partecipanti)', scope: 'gruppo', why: 'Il materiale e la chat di un seminario sono per chi si è iscritto.' },
  { kind: 'corso', label: 'Corsi (materiali e chat)', scope: 'gruppo', why: 'Come i seminari, ma con più incontri.' },
  { kind: 'seduta', label: 'Sedute e servizi 1-a-1', scope: '1-a-1', why: 'Coaching, consulenze, terapie: la conversazione è solo tra due persone.' },
  { kind: 'messaggio-seduta', label: 'Messaggi privati delle sedute', scope: '1-a-1', why: 'Messaggi scambiati prima e dopo una seduta.' },
  { kind: 'documento-scambiato', label: 'Documenti scambiati', scope: '1-a-1', why: 'Referti, contratti, materiali inviati all\'altra persona.' },
];
export const isE2eKind = (k: string): k is E2eObjectKind => E2E_OBJECTS.some((o) => o.kind === k);

/** Primitive consigliate (vedi docs/e2e-plan.md per la scelta della libreria). */
export const KEY_MODEL = {
  identity: { sign: 'Ed25519', agree: 'X25519', per: 'dispositivo', storage: 'chiave privata nel portachiavi del telefono (expo-secure-store), mai sul server' },
  server: 'Riceve e distribuisce solo chiavi PUBBLICHE firmate. Non vede mai chiavi private né testo in chiaro.',
  session: { per: 'conversazione o seduta', agreement: 'X25519 tra le chiavi dei due dispositivi', cipher: 'XChaCha20-Poly1305 (o NaCl secretbox)', keyDerivation: 'HKDF-SHA-256 dal segreto condiviso, con id della conversazione come contesto' },
  groups: 'Per seminari e corsi: una chiave di gruppo cifrata separatamente per ogni dispositivo dei partecipanti; si cambia quando qualcuno esce.',
  serverSees: ['chi scrive a chi (mittente e destinatario)', 'quando e quanto è grande il messaggio', 'il testo cifrato (illeggibile)'],
} as const;

export const MULTI_DEVICE = [
  'Ogni dispositivo ha le sue chiavi; l\'account ne elenca le chiavi pubbliche.',
  'Un messaggio viene cifrato una volta per ciascun dispositivo del destinatario (e dei tuoi altri dispositivi).',
  'Aggiungere un dispositivo richiede l\'approvazione da uno già fidato (codice o QR): senza, il nuovo dispositivo non legge la cronologia.',
  'Togliere un dispositivo cambia le chiavi di sessione da quel momento in poi.',
];

export const RECOVERY = [
  'Perdere il telefono senza altri dispositivi fidati significa perdere la cronologia cifrata: non esiste una chiave "di riserva" sul server.',
  'Opzionale in futuro: chiave di recupero di 24 parole da conservare tu, oppure backup cifrato con password (il server non la conosce).',
  'Un nuovo telefono riparte con nuove chiavi: i contatti vedranno un avviso "il numero di sicurezza è cambiato".',
];

export const NOT_COVERED = [
  'Metadati: il server sa chi parla con chi, quando e quanto.',
  'I backup del telefono (iCloud, Google) possono contenere i dati in chiaro: dipende dalle impostazioni del sistema.',
  'Il file di backup di LifePilot oggi è un JSON non cifrato: chi lo ottiene lo legge.',
  'Un telefono sbloccato o con malware: la cifratura protegge il tragitto, non lo schermo.',
  'Screenshot e inoltri fatti dall\'altra persona.',
  'Seminari pubblici e annunci: sono pubblici per scelta.',
];

// --- Numero di sicurezza ---------------------------------------------------------------------------------------------

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 in puro TypeScript, solo per calcolare impronte da mostrare (non per proteggere segreti). */
export function sha256(bytes: Uint8Array): Uint8Array {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000));
  dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  h.forEach((v, i) => odv.setUint32(i * 4, v));
  return out;
}

const utf8 = (s: string): Uint8Array => {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
};
export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const sha256Hex = (s: string) => toHex(sha256(utf8(s)));

/**
 * Numero di sicurezza di una coppia di persone: 30 cifre in 6 gruppi da 5, uguale per entrambe se le chiavi pubbliche sono quelle giuste.
 * Si confronta a voce o con il QR: se differisce, qualcuno sta in mezzo (o una persona ha cambiato dispositivo).
 * Le chiavi pubbliche sono stringhe (es. base64) e l'ordine non conta.
 */
export function safetyNumber(publicKeyA: string, publicKeyB: string): string {
  const [x, y] = [publicKeyA, publicKeyB].sort();
  const digest = sha256(utf8('lifepilot-safety-v1|' + x + '|' + y));
  // ogni blocco da 5 byte diventa 5 cifre decimali
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = (digest[i * 5] * 2 ** 32 + digest[i * 5 + 1] * 2 ** 24 + digest[i * 5 + 2] * 2 ** 16 + digest[i * 5 + 3] * 2 ** 8 + digest[i * 5 + 4]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups.join(' ');
}

/** Verdetto da mostrare per una conversazione. */
export type E2eState = { active: boolean; verified: boolean; label: string; detail: string };
export function conversationState(opts: { verified?: boolean } = {}): E2eState {
  if (!E2E_ACTIVE) return { active: false, verified: false, label: E2E_LABEL_PREPARED, detail: 'Oggi questa conversazione resta sul tuo telefono: non viaggia in rete, quindi non c\'è nulla da cifrare. Quando il server sarà attivo verrà cifrata end-to-end.' };
  return { active: true, verified: !!opts.verified, label: E2E_LABEL_ACTIVE, detail: opts.verified ? 'Hai verificato il numero di sicurezza.' : 'Per essere sicuro, confronta il numero di sicurezza con l\'altra persona.' };
}
