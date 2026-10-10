/**
 * Catalogo dei dati che LifePilot gestisce: dove vivono, quanto sono sensibili, chi li può vedere e se si possono condividere.
 * Modulo puro (nessun alias '@/'): è la fonte unica per la schermata "Cosa condivido" e per i test.
 *
 * Modello (vedi docs/privacy-model.md):
 *  - sui server di LifePilot restano SOLO i dati di account (nome, cognome, email, data di nascita e poche altre info);
 *  - tutto il resto vive solo sul telefono; l'utente sceglie se condividerlo, e con chi;
 *  - i dati critici (carte, IBAN, CSV della banca, dati sanitari clinici, documenti fiscali) sono sempre segreti e non hanno interruttore.
 * Il server non esiste ancora: dove un canale di condivisione non è collegato la voce è "predisposta" e non ha effetto reale.
 */

export type Where = 'telefono' | 'account su server' | 'rete pubblica' | 'cifrato end-to-end con l\'altra persona';
export type Sensitivity = 'critico' | 'sensibile' | 'normale' | 'pubblico';
export type Audience = 'nessuno' | 'solo io' | 'persone scelte' | 'tutti' | 'assistente AI';
/** attivo = la scelta ha già un effetto reale nell'app; predisposto = si attiva col server. */
export type Status = 'attivo' | 'predisposto';

export type Option = { id: string; label: string; audience: Audience; shared: boolean; hint: string };

export type GroupId = 'account' | 'profilo' | 'piano' | 'salute' | 'soldi' | 'spostamenti' | 'documenti' | 'comunicazione' | 'network' | 'assistente';
export const GROUP_LABEL: Record<GroupId, string> = {
  account: 'Account', profilo: 'Profilo e biglietto da visita', piano: 'Piano e vita quotidiana', salute: 'Salute', soldi: 'Soldi', spostamenti: 'Spostamenti e luoghi',
  documenti: 'Documenti', comunicazione: 'Chat e messaggi', network: 'LifeNetwork', assistente: 'Assistente e memoria',
};

/**
 * Da dove si legge/scrive la scelta:
 *  own = nello store "sharing"; privacy:<chiave> = vecchio record app.privacy (true = condiviso);
 *  privacyInv:<chiave> = come sopra ma true = privato; card:<campo> = flag show* del biglietto da visita.
 */
export type Link = 'own' | `privacy:${string}` | `privacyInv:${string}` | `card:${'work' | 'phone' | 'email' | 'birth'}`;

export type CatalogItem = {
  id: string;
  label: string;
  group: GroupId;
  icon: string;
  /** esempi di cosa contiene */
  what: string;
  where: Where;
  sensitivity: Sensitivity;
  /** opzioni dalla più privata (prima) alla più aperta; con una sola opzione la voce è bloccata */
  options: Option[];
  default: string;
  link: Link;
  status: Status;
  /** testo mostrato quando la voce non si può cambiare */
  lockedReason?: string;
  /** voce che dovrà viaggiare con crittografia end-to-end (oggi predisposta) */
  e2e?: boolean;
};

const PRIV: Option = { id: 'off', label: 'Solo io', audience: 'solo io', shared: false, hint: 'Resta sul tuo telefono. Nessuno la vede.' };
const mk = (id: string, label: string, audience: Audience, hint: string): Option => ({ id, label, audience, shared: true, hint });
const onOff = (label: string, audience: Audience, hint: string, offHint?: string): Option[] => [offHint ? { ...PRIV, hint: offHint } : PRIV, mk('on', label, audience, hint)];
const secret = (hint = 'Resta sempre sul tuo telefono: non esiste alcun canale che la invii e non si può condividere.'): Option[] => [{ ...PRIV, label: 'Sempre segreta', audience: 'nessuno', hint }];
const SECRET_REASON = 'Dato critico: resta sempre segreto, non c\'è nessun interruttore.';

export const CATALOG: CatalogItem[] = [
  // --- Account (l'unica cosa che resterà sul server) ---
  { id: 'acc_name', label: 'Nome e cognome', group: 'account', icon: 'profile', what: 'Il nome con cui ti registri.', where: 'account su server', sensitivity: 'normale', options: [{ ...mk('on', 'Necessario all\'account', 'solo io', 'Serve a riconoscere il tuo account. Gli altri vedono solo il nome pubblico.'), shared: false }], default: 'on', link: 'own', status: 'predisposto', lockedReason: 'Fa parte dell\'account: non si può togliere.' },
  { id: 'acc_email', label: 'Email', group: 'account', icon: 'send', what: 'L\'email dell\'account.', where: 'account su server', sensitivity: 'sensibile', options: onOff('Sul biglietto da visita', 'persone scelte', 'L\'email compare sul tuo biglietto da visita, per chi lo apre o lo riceve.', 'L\'email serve all\'account ma non compare sul biglietto.'), default: 'off', link: 'card:email', status: 'attivo' },
  { id: 'acc_birth', label: 'Data di nascita', group: 'account', icon: 'calendar', what: 'Data di nascita dell\'account.', where: 'account su server', sensitivity: 'sensibile', options: onOff('Solo l\'anno, sul biglietto', 'persone scelte', 'Sul biglietto compare solo l\'anno di nascita, mai la data completa.', 'La data completa resta nell\'account e non compare sul biglietto.'), default: 'off', link: 'card:birth', status: 'attivo' },
  { id: 'acc_other', label: 'Altre info di account', group: 'account', icon: 'gear', what: 'Lingua, valuta, dispositivi collegati, impostazioni di sicurezza.', where: 'account su server', sensitivity: 'normale', options: [{ ...mk('on', 'Necessarie all\'account', 'solo io', 'Servono a far funzionare l\'account su più dispositivi. Non le vede nessun altro.'), shared: false }], default: 'on', link: 'own', status: 'predisposto', lockedReason: 'Fanno parte dell\'account: non si possono togliere.' },

  // --- Profilo pubblico e biglietto ---
  { id: 'pub_name', label: 'Nome pubblico', group: 'profilo', icon: 'name', what: 'Il nome che gli altri vedono in LifeNetwork e nelle chat.', where: 'rete pubblica', sensitivity: 'pubblico', options: [{ ...PRIV, hint: 'Gli altri ti vedrebbero come "Utente LifePilot". Con il server attivo.' }, mk('on', 'Tutti', 'tutti', 'Il tuo nome pubblico è visibile a chiunque in LifeNetwork.')], default: 'on', link: 'own', status: 'predisposto' },
  { id: 'pub_photo', label: 'Foto del profilo', group: 'profilo', icon: 'image', what: 'La tua immagine del profilo.', where: 'rete pubblica', sensitivity: 'pubblico', options: onOff('Tutti', 'tutti', 'La foto è visibile a chiunque veda il tuo profilo.'), default: 'on', link: 'own', status: 'predisposto' },
  { id: 'pub_profile', label: 'Profilo LifeNetwork', group: 'profilo', icon: 'lifenetwork', what: 'Bio, post, follower e voti.', where: 'rete pubblica', sensitivity: 'pubblico', options: [{ ...PRIV, label: 'Profilo privato', hint: 'Il profilo risulta privato. L\'effetto sugli altri utenti parte col server.' }, mk('on', 'Profilo pubblico', 'tutti', 'Il profilo è visibile a tutti in LifeNetwork.')], default: 'on', link: 'privacyInv:Profilo privato', status: 'predisposto' },
  { id: 'card_work', label: 'Professione e residenza sul biglietto', group: 'profilo', icon: 'briefcase', what: 'Professione e città sul biglietto da visita.', where: 'telefono', sensitivity: 'normale', options: onOff('Persone scelte', 'persone scelte', 'Compaiono sul tuo biglietto da visita, quando lo mostri o lo invii in chat.'), default: 'on', link: 'card:work', status: 'attivo' },
  { id: 'card_phone', label: 'Telefono sul biglietto', group: 'profilo', icon: 'phone', what: 'Il tuo numero di telefono.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'Il numero compare sul biglietto da visita, per chi lo riceve.'), default: 'off', link: 'card:phone', status: 'attivo' },
  { id: 'pub_interests', label: 'Interessi', group: 'profilo', icon: 'sparkle', what: 'Gli interessi che scegli o aggiungi.', where: 'telefono', sensitivity: 'normale', options: onOff('Tutti', 'tutti', 'Gli interessi potranno comparire sul tuo profilo pubblico. Oggi servono solo a personalizzare le proposte sul telefono.'), default: 'on', link: 'own', status: 'predisposto' },
  { id: 'pub_status', label: 'Stato "disponibile"', group: 'profilo', icon: 'dot', what: 'Se sei disponibile a essere contattato.', where: 'telefono', sensitivity: 'normale', options: onOff('Persone scelte', 'persone scelte', 'Chi hai in chat potrà vedere se sei disponibile.'), default: 'on', link: 'own', status: 'predisposto' },

  // --- Piano e vita quotidiana ---
  {
    id: 'plan_agenda', label: 'Impegni e agenda (Plan)', group: 'piano', icon: 'plan', what: 'Titoli, orari, luoghi e dettagli dei tuoi impegni.', where: 'telefono', sensitivity: 'sensibile',
    options: [
      { ...PRIV, label: 'Non condivido', hint: 'Non puoi inviare la tua agenda. Il Plan resta solo sul telefono.' },
      mk('free', 'Solo slot liberi', 'persone scelte', 'Chi scegli vede soltanto quando sei libero. Titoli e impegni non vengono inviati.'),
      mk('busy', 'Occupato / libero', 'persone scelte', 'Chi scegli vede quando sei occupato e quando sei libero, ma non cosa fai.'),
      mk('full', 'Con dettagli', 'persone scelte', 'Chi scegli vede titolo, giorno e ora di ogni impegno e può aggiungerlo al proprio piano.'),
    ],
    default: 'free', link: 'own', status: 'attivo',
  },
  { id: 'plan_tasks', label: 'Task', group: 'piano', icon: 'lifetask', what: 'Le cose da fare e le sotto-attività.', where: 'telefono', sensitivity: 'normale', options: onOff('Persone scelte', 'persone scelte', 'Liste condivise con le persone che scegli (predisposto). Inviare un task in chat resta sempre una tua azione esplicita.'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'plan_notes', label: 'Note', group: 'piano', icon: 'lifenotes', what: 'Il testo delle tue note.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'Note condivise con chi scegli (predisposto). Inviare una nota in chat resta sempre una tua azione esplicita.'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'plan_goals', label: 'Obiettivi', group: 'piano', icon: 'award', what: 'Obiettivi e progressi.', where: 'telefono', sensitivity: 'normale', options: onOff('Persone scelte', 'persone scelte', 'Gli obiettivi potranno essere visti da chi scegli (predisposto).'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'plan_mood', label: 'Umore', group: 'piano', icon: 'smile', what: 'Come ti senti giorno per giorno.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'L\'umore potrà essere visto da chi scegli (predisposto).'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'plan_auto', label: 'Automazioni e preferenze', group: 'piano', icon: 'repeat', what: 'Le tue automazioni e lo stile delle risposte.', where: 'telefono', sensitivity: 'normale', options: secret('Restano sul telefono: non esiste alcun canale di condivisione.'), default: 'off', link: 'own', status: 'attivo', lockedReason: 'Sono impostazioni personali: nessuno può vederle.' },

  // --- Salute ---
  { id: 'health_activity', label: 'Passi, sonno, allenamenti, peso', group: 'salute', icon: 'lifehealth', what: 'Dati di LifeHealth e Apple Health.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Assistente AI', 'assistente AI', 'Un riassunto viene aggiunto alle domande che fai all\'assistente AI, che le elabora su un server.', 'Non viene inviato nulla all\'assistente.'), default: 'off', link: 'privacy:Dati salute', status: 'attivo' },
  { id: 'health_clinical', label: 'Dati sanitari clinici', group: 'salute', icon: 'heart', what: 'Diagnosi, esami, referti, farmaci (se li inserisci in note o documenti).', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },

  // --- Soldi ---
  { id: 'fin_summary', label: 'Riepilogo delle finanze', group: 'soldi', icon: 'lifefinance', what: 'Totali per categoria, budget e andamento (senza i singoli movimenti).', where: 'telefono', sensitivity: 'sensibile', options: onOff('Assistente AI', 'assistente AI', 'Un riepilogo (totali, non i movimenti) viene aggiunto alle domande all\'assistente AI.', 'Non viene inviato nulla all\'assistente.'), default: 'off', link: 'privacy:Dati finanziari', status: 'attivo' },
  { id: 'fin_invest', label: 'Investimenti e watchlist', group: 'soldi', icon: 'chart', what: 'Titoli simulati, ordini, watchlist.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'Il portafoglio potrà essere visto da chi scegli (predisposto).'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'fin_cards', label: 'Carte di credito e IBAN', group: 'soldi', icon: 'lifefinance', what: 'Numeri di carta, scadenze, IBAN.', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },
  { id: 'fin_csv', label: 'CSV e estratti conto della banca', group: 'soldi', icon: 'file', what: 'File importati dalla banca.', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },
  { id: 'fin_accounts', label: 'Conti, saldi e movimenti', group: 'soldi', icon: 'euro', what: 'Ogni singolo movimento, saldo e conto.', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },
  { id: 'fin_tax', label: 'Dichiarazione e documenti fiscali', group: 'soldi', icon: 'file', what: 'Dichiarazione dei redditi e documenti allegati.', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },

  // --- Spostamenti e luoghi ---
  { id: 'loc_live', label: 'Posizione', group: 'spostamenti', icon: 'location', what: 'La tua posizione attuale.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'Segnala che puoi condividere la posizione. Oggi la posizione parte in chat solo quando la invii tu.'), default: 'off', link: 'privacy:Posizione', status: 'predisposto' },
  { id: 'loc_trips', label: 'Viaggi e spostamenti', group: 'spostamenti', icon: 'lifetravel', what: 'Itinerari salvati, città e date di viaggio.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'I viaggi potranno essere visti da chi scegli (predisposto).'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'loc_home', label: 'Città di casa', group: 'spostamenti', icon: 'pin', what: 'La città o zona abituale.', where: 'telefono', sensitivity: 'normale', options: secret('Serve solo a calcolare tragitti e meteo sul telefono.'), default: 'off', link: 'own', status: 'attivo', lockedReason: 'Serve solo ai calcoli sul telefono.' },
  { id: 'loc_search', label: 'Ricerche e cronologia', group: 'spostamenti', icon: 'search', what: 'Le ricerche recenti di persone, luoghi e viaggi.', where: 'telefono', sensitivity: 'sensibile', options: secret('Restano sul telefono: nessun canale le invia.'), default: 'off', link: 'own', status: 'attivo', lockedReason: 'Nessun canale le condivide.' },

  // --- Documenti ---
  { id: 'doc_drive', label: 'Documenti di LifeDrive', group: 'documenti', icon: 'lifedrive', what: 'I file e le cartelle che salvi.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'I file potranno essere condivisi con chi scegli (predisposto). Inviare un file in chat resta una tua azione esplicita.'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'doc_id', label: 'Documenti d\'identità e contratti', group: 'documenti', icon: 'file', what: 'Passaporto, carta d\'identità, contratti firmati.', where: 'telefono', sensitivity: 'critico', options: secret(), default: 'off', link: 'own', status: 'attivo', lockedReason: SECRET_REASON },

  // --- Chat ---
  { id: 'chat_msgs', label: 'Messaggi delle chat', group: 'comunicazione', icon: 'ai', what: 'Messaggi, foto e allegati delle tue conversazioni.', where: 'telefono', sensitivity: 'sensibile', options: [{ ...mk('on', 'Con chi scrivi', 'persone scelte', 'Li vede solo chi è nella conversazione. Con il server attivo viaggeranno cifrati.'), shared: true }], default: 'on', link: 'own', status: 'predisposto', lockedReason: 'Una chat è condivisa per natura con chi partecipa.' },

  // --- LifeNetwork ---
  { id: 'net_posts', label: 'Post, idee e commenti', group: 'network', icon: 'users', what: 'Quello che pubblichi in LifeNetwork.', where: 'rete pubblica', sensitivity: 'pubblico', options: [mk('on', 'Tutti', 'tutti', 'Quello che pubblichi è visibile a tutti. Scegli tu cosa pubblicare.')], default: 'on', link: 'own', status: 'attivo', lockedReason: 'Un post è pubblico per natura: se non vuoi condividerlo, non pubblicarlo.' },
  { id: 'net_follow', label: 'Chi segui e i tuoi follower', group: 'network', icon: 'users', what: 'Elenco di chi segui e di chi ti segue.', where: 'rete pubblica', sensitivity: 'pubblico', options: onOff('Tutti', 'tutti', 'L\'elenco è visibile a chiunque (predisposto).'), default: 'on', link: 'own', status: 'predisposto' },
  { id: 'net_listing', label: 'Annunci di seminari, corsi e servizi', group: 'network', icon: 'briefcase', what: 'Titolo, prezzo e descrizione di ciò che offri.', where: 'rete pubblica', sensitivity: 'pubblico', options: [mk('on', 'Tutti', 'tutti', 'L\'annuncio è visibile a tutti: è fatto per essere trovato.')], default: 'on', link: 'own', status: 'attivo', lockedReason: 'Un annuncio è pubblico per natura.' },
  { id: 'net_enroll', label: 'Iscrizioni a seminari, corsi e sedute', group: 'network', icon: 'calendar', what: 'A cosa ti sei iscritto e le tue prenotazioni.', where: 'cifrato end-to-end con l\'altra persona', sensitivity: 'sensibile', options: [mk('on', 'Solo l\'organizzatore', 'persone scelte', 'Lo vede solo chi organizza. Cifratura end-to-end: predisposta, si attiva col server.')], default: 'on', link: 'own', status: 'predisposto', e2e: true, lockedReason: 'L\'organizzatore deve saperlo; nessun altro lo vede.' },
  { id: 'net_sessions', label: 'Messaggi privati di corsi e sedute', group: 'network', icon: 'ai', what: 'Conversazioni 1-a-1 con docenti, coach e professionisti.', where: 'cifrato end-to-end con l\'altra persona', sensitivity: 'sensibile', options: [mk('on', 'Solo voi due', 'persone scelte', 'Li vedete solo voi due. Cifratura end-to-end: predisposta, si attiva col server.')], default: 'on', link: 'own', status: 'predisposto', e2e: true, lockedReason: 'Una seduta è privata tra voi due.' },
  { id: 'net_docs', label: 'Documenti scambiati in corsi e sedute', group: 'network', icon: 'paperclip', what: 'Materiali, referti e file scambiati con l\'altra persona.', where: 'cifrato end-to-end con l\'altra persona', sensitivity: 'sensibile', options: [mk('on', 'Solo voi due', 'persone scelte', 'Li vedete solo voi due. Cifratura end-to-end: predisposta, si attiva col server.')], default: 'on', link: 'own', status: 'predisposto', e2e: true, lockedReason: 'Un documento scambiato in una seduta è privato tra voi due.' },
  { id: 'net_jobs', label: 'Candidature e lavoro', group: 'network', icon: 'briefcase', what: 'Candidature inviate, CV, test e risposte.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Persone scelte', 'persone scelte', 'Il tuo CV potrà essere visto dalle aziende che scegli (predisposto). Una candidatura la invii sempre tu.'), default: 'off', link: 'own', status: 'predisposto' },
  { id: 'net_points', label: 'LifePoints e movimenti', group: 'network', icon: 'lifepointsPage', what: 'Saldo e storico dei punti.', where: 'telefono', sensitivity: 'normale', options: onOff('Persone scelte', 'persone scelte', 'Il saldo potrà comparire sul profilo (predisposto).'), default: 'off', link: 'own', status: 'predisposto' },

  // --- Assistente ---
  { id: 'ai_memory', label: 'Memoria per l\'assistente AI', group: 'assistente', icon: 'sparkle', what: 'Task, note e obiettivi usati come contesto per le risposte.', where: 'telefono', sensitivity: 'sensibile', options: onOff('Assistente AI', 'assistente AI', 'Task, note e obiettivi sono aggiunti come contesto alle domande, che il server dell\'assistente elabora.', 'L\'assistente risponde senza conoscere i tuoi dati.'), default: 'on', link: 'privacy:AI Memory', status: 'attivo' },
];

export const ITEM_IDS = CATALOG.map((i) => i.id);
export const itemOf = (id: string): CatalogItem | undefined => CATALOG.find((i) => i.id === id);

export const SENSITIVITY_ORDER: Sensitivity[] = ['critico', 'sensibile', 'normale', 'pubblico'];
export const SENSITIVITY_LABEL: Record<Sensitivity, string> = { critico: 'Critici: sempre segreti', sensibile: 'Sensibili', normale: 'Normali', pubblico: 'Pubblici e LifeNetwork' };

/** Voce con una sola opzione: non c'è nulla da scegliere. */
export const isLocked = (i: CatalogItem) => i.options.length === 1;

export type Choices = Record<string, string>;

/** Le scelte iniziali: condivise le cose meno importanti, il resto "solo io", i critici sempre segreti. */
export function defaultChoices(): Choices {
  return Object.fromEntries(CATALOG.map((i) => [i.id, i.default]));
}

export function optionOf(id: string, choices: Choices): Option | undefined {
  const it = itemOf(id);
  if (!it) return undefined;
  return it.options.find((o) => o.id === choices[id]) ?? it.options.find((o) => o.id === it.default);
}

/** Una scelta è valida se la voce e l'opzione esistono e, per i critici, l'opzione non è condivisa. */
export function isValidChoice(id: string, optionId: string): boolean {
  const it = itemOf(id);
  if (!it) return false;
  const o = it.options.find((x) => x.id === optionId);
  if (!o) return false;
  if (it.sensitivity === 'critico' && o.shared) return false;
  return true;
}

export type SetResult = { ok: true; choices: Choices } | { ok: false; error: string; choices: Choices };

export function setChoice(choices: Choices, id: string, optionId: string): SetResult {
  const it = itemOf(id);
  if (!it) return { ok: false, error: 'Voce sconosciuta', choices };
  if (it.sensitivity === 'critico' && it.options.find((o) => o.id === optionId)?.shared !== false) return { ok: false, error: 'Questo dato è critico: resta sempre segreto.', choices };
  if (isLocked(it) && optionId !== it.options[0].id) return { ok: false, error: it.lockedReason ?? 'Questa voce non si può cambiare.', choices };
  if (!isValidChoice(id, optionId)) return { ok: false, error: 'Opzione non valida', choices };
  return { ok: true, choices: { ...choices, [id]: optionId } };
}

/** Completa e ripulisce scelte lette dal disco: voci mancanti = predefinito, valori non validi = predefinito, critici sempre segreti. */
export function normalizeChoices(raw: unknown): Choices {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Choices = {};
  for (const it of CATALOG) {
    const v = src[it.id];
    out[it.id] = typeof v === 'string' && isValidChoice(it.id, v) && (!isLocked(it) || v === it.options[0].id) ? v : it.default;
  }
  return out;
}

export type Summary = { types: number; shared: number; secret: number; critical: number; onServer: number; changed: number };

/** Quante voci sono condivise, quante segrete, quante critiche, quante sul server e quante cambiate dal predefinito. */
export function summarize(choices: Choices): Summary {
  let shared = 0, secret = 0;
  for (const it of CATALOG) { if (optionOf(it.id, choices)?.shared) shared++; else secret++; }
  return {
    types: CATALOG.length, shared, secret,
    critical: CATALOG.filter((i) => i.sensitivity === 'critico').length,
    onServer: CATALOG.filter((i) => i.where === 'account su server').length,
    changed: diffFromDefaults(choices).length,
  };
}

/** Le voci cambiate rispetto al predefinito (solo quelle modificabili). */
export function diffFromDefaults(choices: Choices): string[] {
  return CATALOG.filter((i) => !isLocked(i) && (choices[i.id] ?? i.default) !== i.default).map((i) => i.id);
}
export const isChanged = (id: string, choices: Choices) => diffFromDefaults(choices).includes(id);

/** Tutto privato: ogni voce modificabile passa alla sua opzione più privata (la prima). Le voci bloccate non cambiano. */
export function allPrivate(choices: Choices): Choices {
  const out = { ...choices };
  for (const it of CATALOG) if (!isLocked(it)) out[it.id] = it.options[0].id;
  return out;
}

/** Ricerca per testo e filtro "Solo condivisi". */
export function filterItems(query: string, onlyShared: boolean, choices: Choices): CatalogItem[] {
  const q = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return CATALOG.filter((i) => {
    if (onlyShared && !optionOf(i.id, choices)?.shared) return false;
    if (!q) return true;
    return (i.label + ' ' + i.what + ' ' + GROUP_LABEL[i.group] + ' ' + i.where).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q);
  });
}

export function groupBySensitivity(items: CatalogItem[]): { sensitivity: Sensitivity; items: CatalogItem[] }[] {
  return SENSITIVITY_ORDER.map((s) => ({ sensitivity: s, items: items.filter((i) => i.sensitivity === s) })).filter((g) => g.items.length > 0);
}

// --- Agenda condivisa: il livello massimo scelto limita cosa si può inviare in chat ---
export type AgendaMode = 'liberi' | 'occupato' | 'dettagli';
const AGENDA_RANK: Record<string, number> = { off: 0, free: 1, busy: 2, full: 3 };
const MODE_RANK: Record<AgendaMode, number> = { liberi: 1, occupato: 2, dettagli: 3 };

/** Vero se la modalità richiesta rientra nel livello massimo scelto dall'utente per l'agenda. */
export function agendaAllows(optionId: string | undefined, mode: AgendaMode): boolean {
  return (AGENDA_RANK[optionId ?? 'free'] ?? 1) >= MODE_RANK[mode];
}
/** La modalità più dettagliata consentita (null = agenda non condivisibile). */
export function agendaMaxMode(optionId: string | undefined): AgendaMode | null {
  const r = AGENDA_RANK[optionId ?? 'free'] ?? 1;
  return r === 0 ? null : r === 1 ? 'liberi' : r === 2 ? 'occupato' : 'dettagli';
}

/** Una riga di sintesi sulla destinazione dei dati, mai più ottimistica della realtà. */
export function whereNote(w: Where): string {
  switch (w) {
    case 'telefono': return 'Sul tuo telefono';
    case 'account su server': return 'Account sui nostri server (quando il server sarà attivo)';
    case 'rete pubblica': return 'Rete pubblica LifeNetwork';
    default: return 'Cifrato end-to-end con l\'altra persona (predisposto, si attiva col server)';
  }
}
