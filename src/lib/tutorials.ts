/**
 * Tutorial di ogni sezione (modulo PURO). Ognuno spiega le funzioni principali di quella pagina; compare la prima volta che la apri,
 * si può saltare (da solo o tutti insieme) e si riprende quando vuoi dalle Impostazioni.
 */
import type { TourStep } from './tour.ts';

export type SectionTutorial = { id: string; /** rotta della pagina (come pageFromPath) */ page: string; title: string; icon: string; short: string; /** parte da solo la prima volta */ auto: boolean; steps: TourStep[] };

const s = (id: string, title: string, text: string, bullets?: string[], cta?: TourStep['cta']): TourStep => ({ id, title, text, ...(bullets ? { bullets } : {}), ...(cta ? { cta } : {}) });

export const TUTORIALS: SectionTutorial[] = [
  {
    id: 'sec-home', page: 'home', title: 'Dashboard', icon: 'home', short: 'La situazione di oggi a colpo d\'occhio', auto: false,
    steps: [
      s('a', 'La situazione, a colpo d\'occhio', 'In alto vedi come ti senti e il quadro di oggi. Sotto, una riga per ogni cosa importante: ogni pallino ha un colore (verde bene, giallo attenzione, rosso da guardare).'),
      s('b', 'Le tue sezioni', 'Prossima cosa in programma, prenotati ai tuoi seminari e servizi, commenti ai tuoi post, investimenti, salute, finanze, umore, task e LifePoints. Tocca una riga per entrare nei dettagli.'),
      s('c', 'Da guardare', 'Theia ti segnala al massimo due cose, spiegando cosa ha osservato, quanto è affidabile e perché te lo dice ora.', ['Tocca per aprire le opzioni', '«Non mi interessa» e quell\'argomento compare meno', '«Personalizza» per scegliere di cosa vuoi sentir parlare']),
      s('d', 'Approfondimento', 'Punteggio, indicatori, correlazioni e report settimanale sono in fondo, in «Approfondimento»: li apri solo se vuoi più dettagli.'),
    ],
  },
  {
    id: 'sec-plan', page: 'plan', title: 'Piano', icon: 'calendar', short: 'Impegni, task, vacanze e agenda', auto: true,
    steps: [
      s('a', 'Il tuo calendario', 'Passa tra Mese, Settimana ed Elenco. Ogni impegno ha un colore deciso da Theia in base all\'urgenza; tocca un giorno per vedere gli impegni sotto.'),
      s('b', 'Aggiungere e spostare', 'Apri un giorno e aggiungi un impegno con titolo e ora. Se due impegni si sovrappongono te lo dico e ti faccio scegliere: tenere entrambi o spostarne uno guardando il calendario.'),
      s('c', 'Task e timer', 'Qui vedi i primi task da fare; «Vedi tutti i task» apre l\'elenco completo. Il pulsante play di un task apre la concentrazione: scegli quanto lavorare, le pause arrivano da sole.'),
      s('d', 'Vacanze e agenda', '«Pianifica le vacanze» apre un calendario per selezionare i giorni (come su Booking). L\'Agenda, in alto, è una pagina per ogni giorno con le ore.', ['Le vacanze occupano tutta la giornata e te lo ricordo quando fissi qualcosa']),
    ],
  },
  {
    id: 'sec-ai', page: 'ai', title: 'Theia', icon: 'ai', short: 'L\'assistente: scrivi o detta', auto: true,
    steps: [
      s('a', 'Scrivi come parli', 'Theia capisce comandi semplici e li esegue sul tuo telefono, senza consumare AI esterna: meno energia, meno server da raffreddare.', ['«aggiungi dentista giovedì alle 10»', '«cosa devo fare adesso?»', '«riepilogo della giornata»']),
      s('b', 'Voce e allegati', 'Il microfono registra e invia sempre il tuo vocale nella chat; dove è disponibile lo trascrive. Con la graffetta allega foto, file, posizione, contatti, note o impegni.'),
      s('c', 'Cartelle per argomento', 'Le conversazioni si raccolgono per argomento (task, piano, finanze...). Cerca nella lente in alto, e il tasto lingua cambia la lingua del singolo messaggio.'),
    ],
  },
  {
    id: 'sec-lifetask', page: 'lifetask', title: 'Task', icon: 'tasks', short: 'Cose da fare, urgenze e concentrazione', auto: true,
    steps: [
      s('a', 'Aggiungi e scomponi', '«+ Task» crea una cosa da fare; se è grande Theia la scompone in passi con le ore stimate.'),
      s('b', 'Urgenze e scadenze', 'Il triangolo segna un task urgente (compare per primo e nella notifica fissa), il calendario imposta la scadenza.'),
      s('c', 'Concentrazione', 'Con play scegli solo il tempo totale: 25 minuti di lavoro, 5 di pausa; dopo 125 minuti di lavoro la pausa è di 15. Puoi fermarti, riprendere o segnare il task come finito.'),
    ],
  },
  {
    id: 'sec-lifenotes', page: 'lifenotes', title: 'Note', icon: 'note', short: 'Appunti veloci e ordinati', auto: true,
    steps: [
      s('a', 'Appunti veloci', 'Scrivi una nota in pochi secondi; si ordinano da sole per contenuto e si ritrovano con la ricerca.'),
      s('b', 'Condividile', 'Una nota può finire in una chat come scheda, e chi la riceve la aggiunge alle sue note con un tocco.'),
    ],
  },
  {
    id: 'sec-lifehealth', page: 'lifehealth', title: 'Salute', icon: 'lifehealth', short: 'Sonno, movimento, battito e stress', auto: true,
    steps: [
      s('a', 'Registra o collega', 'Inserisci a mano sonno, passi o peso, oppure collega Apple Health e Apple Watch: i dati restano sul tuo telefono.'),
      s('b', 'Capire come stai', 'Ogni indicatore ha un valore ottimale, un andamento e una previsione, con un pallino di stato. Con pochi giorni di dati non faccio stime.'),
      s('c', 'Cosa influenza cosa', 'Le correlazioni mostrano ad esempio come il sonno si muove con l\'umore: sono associazioni, non cause.'),
    ],
  },
  {
    id: 'sec-mood', page: 'mood', title: 'Umore e contesto', icon: 'mood', short: 'Il tuo umore confrontato con il resto', auto: true,
    steps: [
      s('a', 'Un tocco al giorno', 'Segna come ti senti: lo confronto con meteo, impegni, sonno, spese e movimento.'),
      s('b', 'I fattori', 'Il grafico mostra cosa tende a esserci nei giorni buoni e in quelli difficili; più giorni registri, più è affidabile.'),
    ],
  },
  {
    id: 'sec-lifefinance', page: 'lifefinance', title: 'Finanze', icon: 'lifefinance', short: 'Spese, bollette, budget, fisco e investimenti', auto: true,
    steps: [
      s('a', 'Spese e budget', 'Aggiungi una spesa o importa l\'estratto conto da CSV. Imposta un budget per categoria: ti avviso quando una sfora.'),
      s('b', 'Bollette', 'Carica una bolletta o una fattura: leggo importo e scadenza e le metto nel Piano come promemoria.'),
      s('c', 'Fisco e previsioni', '«Dichiarazione fiscale» controlla i documenti e ha anche il rendiconto dei LifePoints; «Previsioni future» stima come andranno i mesi.'),
      s('d', 'Investimenti', 'In «Stock» segui i titoli, il portafoglio e i movimenti (simulazione): nella Dashboard vedi solo come vanno oggi.'),
    ],
  },
  {
    id: 'sec-lifetravel', page: 'lifetravel', title: 'Viaggi', icon: 'lifetravel', short: 'Vacanze e itinerari sui tuoi giorni liberi', auto: true,
    steps: [
      s('a', 'Scegli una destinazione', 'Ti propongo un itinerario giorno per giorno sui giorni liberi del Piano.'),
      s('b', 'Date e Piano', 'Le date scelte diventano vacanze nel Piano: occupano tutta la giornata e ti avviso se fissi altro.'),
    ],
  },
  {
    id: 'sec-lifedrive', page: 'lifedrive', title: 'LifeDrive', icon: 'file', short: 'File e foto in cartelle ordinate', auto: true,
    steps: [
      s('a', 'Carica e ordina', 'Carica file o foto: li metto nella cartella giusta (documenti, ricevute, bollette, salute, lavoro).'),
      s('b', 'Condividi con le persone', 'Apri un file e tocca «Condividi con una persona»: scegli la chat e il file parte. Se qualcuno ti chiede dei documenti, li mandi uno alla volta da LifeDrive.'),
    ],
  },
  {
    id: 'sec-lifenetwork', page: 'lifenetwork', title: 'LifeNetwork', icon: 'lifenetwork', short: 'Post, marketplace, community, idee e lavoro', auto: true,
    steps: [
      s('a', 'Le sezioni', 'Home, Post, Marketplace, Community, Idee e Lavoro. Puoi guardare senza pubblicare nulla: tu decidi cosa condividere.'),
      s('b', 'Marketplace', 'Seminari, servizi e prodotti scelti in base ai tuoi interessi. Si paga solo in LifePoints, alla prenotazione: restano bloccati fino alla fine e poi vanno a chi li ha offerti.'),
      s('c', 'Recensioni', 'Su ogni seminario, servizio o LifeClub leggi le recensioni e, dopo aver partecipato, lasci la tua con stelle e motivazione.'),
      s('d', 'Pubblica e crea', 'Pubblica post, idee che altri possono sostenere con LifePoints, seminari e servizi. Le attività creano la loro pagina e gli annunci dei prodotti.'),
    ],
  },
  {
    id: 'sec-payments', page: 'payments', title: 'Pagamenti', icon: 'coin', short: 'QR, invio e movimenti in LifePoints', auto: true,
    steps: [
      s('a', 'Il tuo QR', 'In «Ricevi» c\'è il tuo QR: chi lo scansiona ti paga in LifePoints da qualsiasi parte del mondo, senza commissioni.'),
      s('b', 'Invia', 'Scansiona un QR, incolla un codice o scegli una persona; puoi anche inviare dalla chat con la persona.'),
      s('c', 'Movimenti', 'Tutti i pagamenti ricevuti e inviati, con data e messaggio.'),
    ],
  },
  {
    id: 'sec-lifepointsPage', page: 'lifepointsPage', title: 'LifePoints', icon: 'coin', short: 'Saldo, giornalieri, rendiconto e ritiro', auto: true,
    steps: [
      s('a', 'Il saldo', 'Nell\'app si paga solo con LifePoints. Il denaro entra solo per essere convertito in LifePoints.'),
      s('b', 'Giornalieri e streak', 'Ogni giorno puoi donare un LifePoint; la streak conta i giorni di fila.'),
      s('c', 'Rendiconto e ritiro', 'Il rendiconto serve per la dichiarazione fiscale. Il ritiro in denaro ha una commissione del 5% (spiegata prima) e si sblocca per i giornalieri ricevuti da 1000 persone diverse.'),
    ],
  },
  {
    id: 'sec-profile', page: 'profile', title: 'Profilo', icon: 'profile', short: 'Te, la tua reputazione e le tue pagine', auto: true,
    steps: [
      s('a', 'Il tuo profilo', 'Foto, post, pillole e statistiche; «Modifica profilo» cambia ogni sezione, come su Instagram. L\'icona con il segno di spunta indica l\'identità verificata.'),
      s('b', 'Recensioni e voti', 'Vedi voti e motivazioni che hai ricevuto; sugli altri profili si vedono solo voti e recensioni. Ogni corso o seminario ha la sua valutazione, che pesa un terzo.'),
      s('c', 'Pagine e cariche', 'Crea la pagina di un\'attività: sul profilo compare con la tua carica (Titolare, Fondatore, CEO...) e puoi collegare altre persone con la loro carica.'),
      s('d', 'Altro', '«Altro» apre tutto il resto: LifeClub, attività collegate, biglietto da visita, negozio e impostazioni di condivisione.'),
    ],
  },
  {
    id: 'sec-messagesPage', page: 'messagesPage', title: 'Messaggi', icon: 'comment', short: 'Chat con strumenti per lavorare insieme', auto: true,
    steps: [
      s('a', 'Chat e gruppi', 'Scrivi a una persona o crea un gruppo; fissa, silenzia o archivia le chat dall\'elenco.'),
      s('b', 'Strumenti', 'Con la graffetta condividi i tuoi impegni (solo occupato/libero, se vuoi), task, note, proposte di orari, inviti, sondaggi e file.', ['Servizio a pagamento: prezzo, data e prenotazione direttamente in chat', 'Richiedi documenti: chi li riceve li manda uno alla volta']),
      s('c', 'Vocali e LifePoints', 'Tieni premuto il microfono per un vocale. Dal menu della persona puoi inviarle LifePoints.'),
    ],
  },
  {
    id: 'sec-settings', page: 'settings', title: 'Impostazioni', icon: 'gear', short: 'Lingua, notifiche, privacy e dati', auto: true,
    steps: [
      s('a', 'Lingua e aspetto', 'Scegli tra 12 lingue, il tema e le opzioni di accessibilità.'),
      s('b', 'Notifiche', 'Promemoria degli impegni, orario di partenza e «Urgenti sempre in vista»: una notifica fissa con gli impegni e i task urgenti di oggi.'),
      s('c', 'Privacy e dati', 'Cosa condividi e con chi, backup e cancellazione dei dati. Qui riprendi anche i tutorial di ogni sezione.'),
    ],
  },
];

export const tutorialById = (id: string): SectionTutorial | undefined => TUTORIALS.find((t) => t.id === id);
export const tutorialForPage = (page: string): SectionTutorial | undefined => TUTORIALS.find((t) => t.page === page);
export const isSectionTutorial = (id: string | null | undefined): boolean => !!id && id.startsWith('sec-');
/** Il tutorial da far partire da solo aprendo `page`: la prima volta, se non sono stati disattivati. */
export function autoTutorialFor(page: string, seen: string[], off: boolean): SectionTutorial | null {
  if (off) return null;
  const t = tutorialForPage(page);
  return t && t.auto && !seen.includes(t.id) ? t : null;
}
