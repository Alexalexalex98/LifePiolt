/** Elenco di tutto quello che si può fare con LifePilot. Ogni voce apre la funzione (page) o la prova con un comando all'assistente (cmd). */
export type Feature = { title: string; text: string; page?: string; cmd?: string };
export type FeatureGroup = { id: string; title: string; tagline: string; icon: string; color: string; items: Feature[] };

export const featureGroups: FeatureGroup[] = [
  {
    id: 'oggi', title: 'Oggi', tagline: 'Cosa fare adesso, senza pensarci', icon: 'home', color: '#7bb8e0',
    items: [
      { title: 'Come ti senti', text: 'Un check-in al giorno: LifePilot lo confronta con meteo, sonno, impegni e spese per capire cosa ti fa stare meglio.', page: 'mood' },
      { title: 'Cosa faccio ora?', text: 'Ti dice il task più importante e perché: urgenza, scadenza e legame con i tuoi appuntamenti.', cmd: 'cosa devo fare adesso?' },
      { title: 'Life Score e Dashboard', text: 'Un punteggio unico su salute, mente, finanze e crescita, con trend, previsioni e correlazioni. Tutto è cliccabile.', page: 'home' },
    ],
  },
  {
    id: 'piano', title: 'Piano, task e obiettivi', tagline: 'Organizza giorni e mesi', icon: 'plan', color: '#7be0b0',
    items: [
      { title: 'Calendario e impegni', text: 'Aggiungi impegni, promemoria, ripetizioni e segna quelli importanti.', page: 'plan' },
      { title: 'Pianifica il mese per me', text: 'Riempie il Plan nel tuo orario di lavoro con task e abitudini, lasciando slot liberi. Vedi l’anteprima e decidi tu.', cmd: 'pianificami il mese' },
      { title: 'Task, urgenze e scomposizione', text: 'Segna i task urgenti, scomponili in passi con ore stimate e programmali nel piano.', page: 'lifetask' },
      { title: 'Obiettivi e automazioni', text: 'Segui l’avanzamento e controlla ogni automazione dal Profilo.', page: 'plan' },
      { title: 'Avvisi di sovrapposizione', text: 'Ogni volta che un impegno si scontra con un altro: cambi giorno, sposti o tieni entrambi.', page: 'plan' },
    ],
  },
  {
    id: 'assistente', title: 'Assistente e Theia', tagline: 'Parla, lui fa', icon: 'ai', color: '#b96bff',
    items: [
      { title: 'Comandi in italiano, senza AI', text: '"Aggiungi riunione al piano", "sposta", "elimina", "segna fatto": capisce, chiede ciò che manca e ti fa annullare tutto.', page: 'ai' },
      { title: 'Scegli tu', text: 'Dì "scegli tu" e l’algoritmo trova il momento migliore nel tuo calendario.', cmd: 'aggiungi call al piano' },
      { title: 'Chat per argomento', text: 'Una chat Generale con tutto e cartelle che si creano da sole (finanze, musica, arte…). Cercabili come in ChatGPT.', page: 'ai' },
      { title: 'Theia sullo schermo', text: 'Tocca il pulsante, trascina sull’area che ti interessa e chiedi. La conversazione viene archiviata nella sezione giusta.', page: 'ai' },
      { title: 'Report dai tuoi dati', text: 'Analisi dettagliata di finanze, salute e umore con una frase.', cmd: 'analisi delle mie finanze' },
    ],
  },
  {
    id: 'salute', title: 'Salute e mente', tagline: 'Corpo e mente sotto controllo', icon: 'lifehealth', color: '#ff9d9d',
    items: [
      { title: 'LifeHealth', text: 'Sonno, battito, passi, peso, stress, allenamenti e mindfulness: a mano o da Apple Health e Apple Watch.', page: 'lifehealth' },
      { title: 'Valori ottimali e spiegazioni', text: 'Per ogni misura vedi il valore di riferimento, cosa significa e come migliorarla.', page: 'home' },
      { title: 'Analisi dell’umore', text: 'Grafico dello storico incrociato con pioggia, impegni e finanze, con i fattori che lo alzano o lo abbassano.', page: 'mood' },
    ],
  },
  {
    id: 'finanze', title: 'Finanze', tagline: 'Soldi chiari, tasse comprese', icon: 'lifefinance', color: '#e0c97b',
    items: [
      { title: 'Movimenti, budget e categorie', text: 'Entrate e uscite, bollette, abbonamenti e linee guida in base allo stipendio.', page: 'lifefinance' },
      { title: 'Costi tipici di una persona', text: 'Aggiungi in un colpo solo le spese normali (affitto, cassa malati, trasporti…) con importi modificabili.', page: 'lifefinance' },
      { title: 'Previsioni e fondo emergenza', text: 'Stima dei mesi successivi e accantonamenti.', page: 'lifeforecast' },
      { title: 'Azioni e portafoglio', text: 'Watchlist, ordini e portafoglio per allenarti.', page: 'stocks' },
      { title: 'Dichiarazione fiscale guidata', text: 'Carichi i documenti richiesti, li controlla e solo allora spunta la voce.', page: 'taxdecl' },
    ],
  },
  {
    id: 'network', title: 'LifeNetwork', tagline: 'Community, seminari, servizi, lavoro', icon: 'lifenetwork', color: '#7c93c9',
    items: [
      { title: 'Community e post', text: 'Entra nelle community, apri i post, ingrandisci foto e video, commenta e dona LifePoints.', page: 'lifenetwork' },
      { title: 'Seminari e servizi', text: 'Ti iscrivi prima, finisce nel Plan con avviso di conflitto e paghi in LifePoints solo dopo l’evento.', page: 'lifenetwork' },
      { title: 'Voti onesti', text: 'Puoi votare solo chi hai davvero incontrato: niente partecipazione, niente voto.', page: 'lifenetwork' },
      { title: 'Lavoro con test di competenze', text: 'Chi assume crea test personalizzati (domande, grafici, file, prova pratica a tempo); tu mostri cosa sai fare, non un CV.', page: 'lifenetwork' },
      { title: 'LifePoints', text: 'Il tuo saldo, i premi e i pagamenti ricevuti.', page: 'lifepointsPage' },
    ],
  },
  {
    id: 'chat', title: 'Chat e collaborazione', tagline: 'Condividi e sceglie un tocco', icon: 'send', color: '#5fd0c4',
    items: [
      { title: 'Agenda con privacy', text: 'Condividi i titoli, solo occupato/libero oppure solo gli slot liberi, scegliendo le fasce orarie (niente mattina, niente sera).', page: 'messagesPage' },
      { title: 'Un tocco e va nel calendario', text: 'Scegli un orario, un impegno o uno slot libero nella chat e finisce nel tuo Plan, con avviso se si sovrappone.', page: 'messagesPage' },
      { title: 'Task, note, sondaggi, posizione, contatti', text: 'Task creati o caricati da file, note, sondaggi, luoghi e contatti condivisi in chat.', page: 'messagesPage' },
      { title: 'Vocali, foto, video, documenti', text: 'Allegati, risposte, reazioni, messaggi a tempo e chat di gruppo.', page: 'messagesPage' },
    ],
  },
  {
    id: 'vita', title: 'Note, file e viaggi', tagline: 'Tutto il resto della vita', icon: 'lifenotes', color: '#e0a67b',
    items: [
      { title: 'LifeNotes', text: 'Note veloci, anche dalla chat dell’assistente.', page: 'lifenotes' },
      { title: 'LifeDrive', text: 'Documenti, ricevute e referti in cartelle automatiche.', page: 'lifedrive' },
      { title: 'LifeTravel', text: 'Vacanze, voli, hotel e itinerario sui giorni che scegli nel Plan.', page: 'lifetravel' },
    ],
  },
  {
    id: 'controllo', title: 'Controllo e privacy', tagline: 'Decidi sempre tu', icon: 'settings', color: '#8e98a8',
    items: [
      { title: 'Cosa sa di te', text: 'Vedi e modifichi obiettivi, automazioni, preferenze e memoria; cancelli quello che vuoi.', page: 'profile' },
      { title: 'Profilo privato e foto', text: 'Rendi privato il profilo o cambia foto anche dalla chat dell’assistente.', cmd: 'rendi privato il mio profilo' },
      { title: 'Impostazioni', text: 'Notifiche, aspetto, sicurezza, accessibilità, lingue e integrazioni.', page: 'settings' },
    ],
  },
];

export const featureCount = featureGroups.reduce((s, g) => s + g.items.length, 0);

/* ---------- guida a piccoli pezzi ---------- */
export type FlatFeature = Feature & { groupId: string; groupTitle: string; color: string; icon: string };
export const allFeatures: FlatFeature[] = featureGroups.flatMap((g) => g.items.map((f) => ({ ...f, groupId: g.id, groupTitle: g.title, color: g.color, icon: g.icon })));

/** Giorni (dal primo avvio) in cui la guida completa compare all'apertura. */
export const FULL_GUIDE_DAYS = 3;

const DAY = 86400000;
/** Numero progressivo del giorno di calendario LOCALE (cambia a mezzanotte, non ogni 24 ore). */
export function dayIndex(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Una funzione diversa ogni giorno, a salti per variare area (stesso risultato per tutto il giorno). */
export function featureOfDay(ts: number = Date.now()): FlatFeature {
  const n = allFeatures.length;
  const stride = gcd(7, n) === 1 ? 7 : 1;
  return allFeatures[(((dayIndex(ts) * stride) % n) + n) % n];
}

/**
 * Cosa mostrare all'apertura dell'app:
 * - primi FULL_GUIDE_DAYS giorni: guida completa;
 * - poi: solo se "showOnOpen" è attivo, e solo la funzione del giorno (una al giorno, non a ogni apertura);
 * - altrimenti niente (la guida completa resta riapribile dalla Home).
 */
export function guideMode(p: { firstSeenAt: number | null; now: number; showOnOpen: boolean; lastBiteDay?: number | null }): 'full' | 'bite' | 'none' {
  if (p.firstSeenAt == null) return 'full';
  if (dayIndex(p.now) - dayIndex(p.firstSeenAt) < FULL_GUIDE_DAYS) return 'full';
  if (p.showOnOpen && p.lastBiteDay !== dayIndex(p.now)) return 'bite';
  return 'none';
}
