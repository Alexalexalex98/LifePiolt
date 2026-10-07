import { hashStr } from '@/lib/format';
import { dayKeyOf, hhmm, nextOccurrence } from '@/lib/when';
import { useLife } from '@/store/life';
import { useNet, type Community, type Enrollment, type Idea, type Post, type Provider, type Seminar } from '@/store/network';

/** Contenuti d'esempio (solo modalità demo): seminari, servizi e community con descrizioni complete. */

function addEventsSafe(list: { day: string; time: string; title: string; dur?: number; ref?: string }[]) {
  const l = useLife.getState();
  list.forEach((x) => {
    if (x.ref && (useLife.getState().events[x.day] || []).some((e) => e.ref === x.ref)) return;
    l.addEvent(x.day, { time: x.time, title: x.title, ...(x.dur ? { dur: x.dur } : {}), ...(x.ref ? { ref: x.ref } : {}) });
  });
}

const HOUR = 3600000;
const DAY = 24 * HOUR;

/** Timestamp di un giorno relativo a oggi (0 = oggi, 1 = domani, -1 = ieri) all'orario indicato. */
export const at = (dayOffset: number, time: string): number => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, h, m, 0, 0).getTime();
};

export const freeCancel = 'Puoi annullare l\'iscrizione gratuitamente in qualsiasi momento fino all\'inizio: viene tolta anche dal tuo Plan. Non paghi nulla all\'iscrizione.';
export const paidCancel = (price: number) => `Puoi annullare l'iscrizione gratuitamente fino all'inizio. Non paghi nulla ora: i ${price} LP vengono addebitati solo dopo il seminario, quando confermi di aver partecipato. Se non partecipi puoi indicarlo e non paghi.`;

type SeminarSeed = Omit<Seminar, 'cancelPolicy'> & { cancelPolicy?: string };

export function demoSeminars(me: string): Seminar[] {
  const list: SeminarSeed[] = [
    {
      id: 1, title: 'Come leggere un bilancio in 1 ora', host: 'Luca Ferri', price: 0, promoted: false,
      ts: at(-9, '10:00'), startsAt: at(2, '18:00'), durationMin: 60, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 100, joined: 37,
      desc: 'Un\'ora per imparare a leggere un bilancio d\'esercizio senza essere un contabile. Partiamo da un esempio reale di una piccola azienda e guardiamo insieme stato patrimoniale, conto economico e liquidità, capendo quali numeri contano davvero per decidere se un\'azienda è in salute. Non è una consulenza finanziaria e non dà indicazioni di investimento.',
      learn: ['Distinguere attivo, passivo e patrimonio netto', 'Leggere il conto economico: ricavi, costi e margine', 'Capire la differenza tra utile e liquidità', 'Tre indicatori semplici per valutare un\'azienda'],
      audience: 'Imprenditori alle prime armi, freelance, chi lavora in una startup e non ha formazione economica. Non servono conoscenze di base.',
      included: 'Partecipazione al seminario con tempo per le domande; il foglio di lavoro con l\'esempio viene inviato agli iscritti. Nessuna registrazione.', language: 'Italiano',
    },
    {
      id: 2, title: 'Fondamenti di pricing per startup', host: me, price: 25, promoted: true,
      ts: at(-6, '09:30'), startsAt: at(3, '10:00'), durationMin: 90, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 30, joined: 14,
      desc: 'Come scegliere il prezzo di un prodotto o servizio nuovo quando non hai ancora dati. Vediamo tre approcci (costo più margine, valore percepito, confronto con i concorrenti), come testare un prezzo con i primi clienti e gli errori più comuni delle startup. Parto dalla mia esperienza con prodotti hardware e software; il seminario non garantisce risultati di vendita.',
      learn: ['Costruire un primo prezzo partendo dai costi e dal valore per il cliente', 'Impostare un test di prezzo con 10 clienti', 'Quando e come cambiare prezzo senza perdere clienti', 'Prezzi a abbonamento o una tantum: criteri di scelta'],
      audience: 'Fondatori e team di prodotto in fase iniziale che devono definire o rivedere il prezzo. Utile avere già un\'idea di prodotto.',
      included: 'Seminario di 90 minuti con 20 minuti di domande, modello di calcolo del prezzo in foglio di calcolo inviato dopo l\'evento. Nessuna registrazione.', language: 'Italiano',
    },
    {
      id: 3, title: 'Respirazione e gestione dello stress', host: 'Elena F.', price: 0, promoted: true,
      ts: at(-12, '18:00'), startsAt: at(1, '12:30'), durationMin: 45, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 15 minuti prima dell\'inizio', seats: 60, joined: 22,
      desc: 'Una pausa guidata di 45 minuti a metà giornata: spieghiamo in modo semplice come funziona la risposta allo stress e proviamo insieme tre tecniche di respirazione da usare prima di una riunione o quando sale la tensione. È un incontro di benessere generale: non sostituisce una terapia e non è indicato per trattare disturbi clinici.',
      learn: ['Cosa succede al corpo sotto stress', 'Tre esercizi di respirazione da 3-5 minuti', 'Come inserirli nella giornata lavorativa', 'Segnali per cui conviene chiedere aiuto a un professionista'],
      audience: 'Chiunque senta tensione durante la giornata lavorativa. Nessuna esperienza richiesta; si può partecipare da seduti.',
      included: 'Pratica guidata e domande. Nessun materiale da stampare; ti serve solo una sedia e un posto tranquillo.', language: 'Italiano',
    },
    {
      id: 4, title: 'Correre il primo 10km senza infortuni', host: 'Giulia M.', price: 10, promoted: false,
      ts: at(-4, '20:00'), startsAt: at(4, '08:00'), durationMin: 90, mode: 'presenza', place: 'Ritrovo al lungolago, area di partenza (il punto esatto viene indicato agli iscritti)', seats: 15, joined: 9,
      desc: 'Incontro pratico all\'aperto per chi vuole arrivare al primo 10 km in sicurezza. Prima mezz\'ora di spiegazioni su riscaldamento, ritmo e progressione dei carichi, poi una corsa lenta di gruppo di circa 5 km con correzioni sulla tecnica. Non è una visita medica: se hai problemi di salute o dolori ricorrenti chiedi prima il parere del tuo medico.',
      learn: ['Un piano di 8 settimane per passare da 5 a 10 km', 'Riscaldamento e defaticamento essenziali', 'Come scegliere un ritmo sostenibile', 'Segnali da non ignorare per evitare infortuni'],
      audience: 'Persone che corrono già 20-30 minuti di fila e vogliono salire di distanza. Non adatto a chi non ha mai corso.',
      included: 'Accompagnamento del gruppo e il piano di 8 settimane in PDF. Porta scarpe da corsa e acqua; in caso di maltempo forte l\'incontro viene rimandato e gli iscritti ricevono un avviso.', language: 'Italiano',
    },
    {
      id: 5, title: 'Francese conversazionale in 6 settimane', host: 'Sophie M.', price: 20, promoted: true,
      ts: at(-3, '11:00'), startsAt: at(3, '19:00'), durationMin: 60, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 15 minuti prima dell\'inizio', seats: 12, joined: 7,
      desc: 'Incontro introduttivo di 60 minuti al percorso di conversazione in francese di 6 settimane. In questa sessione si presenta il metodo, si fa una breve prova per capire il tuo livello e si conversa in piccolo gruppo su temi quotidiani. Il prezzo indicato copre solo questo incontro: le sessioni successive del percorso si decidono dopo e hanno un prezzo a parte.',
      learn: ['Come funziona il percorso di 6 settimane', 'Frasi e strutture per presentarti e parlare di lavoro e tempo libero', 'Una prima valutazione del tuo livello (da A1 a B1)', 'Un piano di pratica quotidiana da 15 minuti'],
      audience: 'Adulti con francese di base (A1-B1) che vogliono parlare più sciolti. Non adatto a principianti assoluti.',
      included: 'Incontro di gruppo con massimo 12 persone e scheda con le espressioni viste. Non include le sessioni successive del percorso.', language: 'Italiano e francese',
    },
    {
      id: 6, title: 'Come strutturare un pitch investitori', host: 'Marco T.', price: 30, promoted: false,
      ts: at(-2, '16:30'), startsAt: at(5, '17:30'), durationMin: 90, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 40, joined: 18,
      desc: 'Come costruire un pitch deck di 10-12 slide che si capisce in tre minuti: problema, soluzione, mercato, trazione, team e richiesta. Dopo la parte teorica analizziamo dal vivo due pitch inviati dai partecipanti. Racconto la mia esperienza di raccolta pre-seed; non garantisco che il tuo pitch troverà un investitore.',
      learn: ['La struttura in 10 slide e cosa mettere in ciascuna', 'Come presentare la trazione quando hai pochi dati', 'Gli errori che fanno scartare un pitch nei primi minuti', 'Come prepararsi alle domande difficili'],
      audience: 'Fondatori che stanno per incontrare investitori o partecipare a un concorso per startup.',
      included: 'Seminario di 90 minuti, un modello di pitch deck modificabile e la revisione dal vivo di due pitch (inviare la bozza entro il giorno prima). Nessuna registrazione.', language: 'Italiano',
    },
    {
      id: 7, title: 'Nutrizione base per sportivi', host: 'Anna Conti', price: 15, promoted: false,
      ts: at(-1, '09:00'), startsAt: at(6, '18:30'), durationMin: 60, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 15 minuti prima dell\'inizio', seats: 50, joined: 21,
      desc: 'Le basi per organizzare l\'alimentazione se ti alleni 3-5 volte a settimana: macronutrienti, cosa mangiare prima e dopo l\'allenamento, idratazione e integratori più diffusi, con indicazioni generali. È informazione divulgativa, non un piano alimentare personalizzato e non sostituisce il parere di un medico o di un dietista.',
      learn: ['Come ripartire proteine, carboidrati e grassi in una settimana tipo', 'Cosa mangiare prima e dopo l\'allenamento', 'Idratazione: quanto e quando bere', 'Integratori: quali hanno evidenze e quali no'],
      audience: 'Sportivi amatoriali e chi si allena con regolarità. Non adatto a chi ha patologie che richiedono una dieta specifica.',
      included: 'Seminario con domande e una scheda riassuntiva in PDF. Nessun piano personalizzato.', language: 'Italiano',
    },
    {
      id: 8, title: 'Dichiarazione fiscale svizzera per freelance', host: 'Roberto Sala', price: 35, promoted: false,
      ts: at(0, '08:30'), startsAt: at(7, '17:00'), durationMin: 90, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 40, joined: 11,
      desc: 'Guida pratica alla dichiarazione dei redditi per chi lavora come indipendente in Svizzera: quali ricavi e spese indicare, quali deduzioni sono comuni, scadenze e documenti da preparare. Le regole variano da cantone a cantone e cambiano negli anni: è una formazione generale, non una consulenza fiscale personale.',
      learn: ['Differenza tra reddito da indipendente e da dipendente', 'Spese deducibili più comuni e come documentarle', 'Scadenze e proroghe: dove verificarle nel tuo cantone', 'Contributi AVS e previdenza per indipendenti, in breve'],
      audience: 'Freelance e piccoli imprenditori individuali residenti in Svizzera.',
      included: 'Seminario di 90 minuti con domande, checklist dei documenti in PDF. Nessuna consulenza sul tuo caso specifico.', language: 'Italiano',
    },
    {
      id: 9, title: 'Meal prep: organizzare i pasti della settimana', host: 'Anna Conti', price: 12, promoted: false,
      ts: at(-8, '10:00'), startsAt: at(-1, '18:00'), durationMin: 60, mode: 'online', place: 'Videochiamata: il link di accesso è stato inviato agli iscritti', seats: 40, joined: 26,
      desc: 'Come pianificare spesa e pasti della settimana in un\'ora di preparazione: lista della spesa, porzioni, conservazione in frigo e congelatore e tre ricette base che si adattano a gusti diversi. Pensato per risparmiare tempo e ridurre lo spreco alimentare.',
      learn: ['Pianificare una settimana di pasti', 'Fare la spesa con una lista ragionata', 'Conservare correttamente i cibi cotti', 'Tre ricette base riutilizzabili'],
      audience: 'Chiunque voglia organizzarsi meglio in cucina. Nessuna esperienza richiesta.',
      included: 'Seminario con domande e raccolta di ricette in PDF. Nessuna registrazione.', language: 'Italiano',
    },
  ];
  return list.map((s) => ({ ...s, cancelPolicy: s.cancelPolicy ?? (s.price ? paidCancel(s.price) : freeCancel) }));
}

/* ---------- servizi ---------- */
export type ServiceInfo = { desc: string; gets: string[]; durationMin: number; mode: 'online' | 'presenza'; place: string; language: string; forWho: string; cancel: string };
const svcCancel = (price: number) => `Puoi annullare la prenotazione gratuitamente fino all'inizio della sessione e lo slot torna disponibile. Non paghi nulla ora: i ${price} LP vengono addebitati solo dopo la sessione, quando confermi di aver partecipato.`;

export const providerInfo: Record<string, ServiceInfo> = {
  'Alex': { desc: 'Sessioni individuali di coaching per fondatori e freelance che vogliono mettere ordine tra priorità, prodotto e prezzi. Lavoriamo su un tuo obiettivo concreto, con un piano d\'azione da seguire nelle settimane successive. Non è consulenza legale o finanziaria.', gets: ['Un obiettivo chiaro per le prossime 4 settimane', 'Un piano d\'azione scritto, inviato dopo la sessione', 'Feedback diretto sulle tue decisioni di business'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano, English', forWho: 'Fondatori e freelance con un progetto già avviato o in fase di lancio.', cancel: svcCancel(50) },
  'Dr. Elena Rossi': { desc: 'Colloquio individuale di supporto psicologico su stress, ansia da lavoro, equilibrio vita-lavoro e momenti di cambiamento. La prima sessione serve a capire insieme la situazione e a definire se e come proseguire. Non è un servizio di emergenza: in caso di crisi o rischio per la tua sicurezza contatta i servizi di emergenza locali.', gets: ['Un colloquio riservato di 50 minuti', 'Una prima valutazione della situazione', 'Indicazioni su come proseguire (anche con altri professionisti, se serve)'], durationMin: 50, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Adulti che vivono stress o difficoltà quotidiane. Non adatto a situazioni di emergenza.', cancel: svcCancel(40) },
  'Marco Bianchi': { desc: 'Allenamento personale individuale in presenza, con programma su misura in base a livello, obiettivi e tempo disponibile. La prima sessione include una breve valutazione di mobilità e forza. Se hai problemi di salute o infortuni chiedi prima il parere del tuo medico.', gets: ['Una sessione di allenamento guidata di 60 minuti', 'Valutazione iniziale di mobilità e forza', 'Una scheda di allenamento da seguire da solo'], durationMin: 60, mode: 'presenza', place: 'Palestra convenzionata in città (indirizzo comunicato dopo la prenotazione)', language: 'Italiano', forWho: 'Persone che vogliono iniziare o riprendere ad allenarsi, di qualsiasi livello.', cancel: svcCancel(25) },
  'Sophie Martin': { desc: 'Lezione individuale di francese conversazionale, con materiale scelto sui tuoi interessi (lavoro, viaggi, vita quotidiana). Si parla soprattutto in francese, con correzioni sul momento e a fine lezione.', gets: ['60 minuti di conversazione con correzioni', 'Un elenco di parole ed espressioni nuove dopo la lezione', 'Un compito di pratica leggero per la settimana'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Francese e italiano', forWho: 'Studenti di livello A2-C1 che vogliono parlare con più sicurezza.', cancel: svcCancel(15) },
  'Luca Ferri': { desc: 'Sessione di business coaching per chi guida o sta avviando una piccola azienda: strategia, crescita dei clienti, organizzazione del team. Si parte dal tuo caso e si esce con tre azioni concrete da fare entro 30 giorni.', gets: ['Analisi del tuo caso in 60 minuti', 'Tre azioni concrete con scadenza', 'Un follow-up scritto di una pagina'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Imprenditori e responsabili di piccole aziende e startup.', cancel: svcCancel(60) },
  'Anna Conti': { desc: 'Consulto di nutrizione per sportivi e persone attive: revisione delle tue abitudini alimentari e indicazioni pratiche per colazione, pranzi e spuntini. Non sostituisce il parere del medico e non è adatto a patologie che richiedono un piano clinico.', gets: ['Un colloquio di 45 minuti sulle tue abitudini', 'Indicazioni generali per la settimana tipo', 'Una lista di alimenti e porzioni di riferimento'], durationMin: 45, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Persone attive che vogliono mangiare meglio. Non adatto a patologie o disturbi alimentari.', cancel: svcCancel(30) },
  'David Kim': { desc: 'Lezione individuale di inglese conversazionale e per il lavoro (colloqui, riunioni, email). Si adatta al tuo livello e si concentra su ciò che ti serve davvero.', gets: ['60 minuti di conversazione guidata', 'Correzioni di pronuncia e grammatica', 'Vocabolario utile da riutilizzare al lavoro'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Inglese e italiano', forWho: 'Studenti dal livello A2 in su.', cancel: svcCancel(15) },
  'Dr. Paolo Greco': { desc: 'Colloquio di psicoterapia individuale per approfondire difficoltà ricorrenti (ansia, relazioni, autostima). La prima sessione è conoscitiva: serve a capire se il percorso è adatto a te. Una singola sessione non è un percorso terapeutico completo e non è un servizio di emergenza.', gets: ['Un colloquio conoscitivo di 50 minuti', 'Una prima impostazione del lavoro possibile', 'Indicazioni su durata e frequenza di un eventuale percorso'], durationMin: 50, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Adulti che cercano un percorso psicoterapeutico. Non adatto a situazioni di emergenza.', cancel: svcCancel(45) },
  'Martina Colombo': { desc: 'Allenamento personale online in diretta: ti guido via video con esercizi a corpo libero o con attrezzi semplici che hai in casa. Adatto anche a chi ha poco spazio.', gets: ['Una sessione di 45 minuti in diretta', 'Programma adattato allo spazio e agli attrezzi che hai', 'Una scheda di esercizi per la settimana'], durationMin: 45, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Chi vuole allenarsi a casa. Serve un tappetino e uno spazio libero di 2 metri.', cancel: svcCancel(20) },
  'Yuki Tanaka': { desc: 'Lezione individuale di giapponese per principianti e livelli intermedi: hiragana e katakana, frasi di tutti i giorni e conversazione guidata.', gets: ['60 minuti di lezione individuale', 'Materiale di studio in PDF', 'Esercizi di scrittura e ascolto per la settimana'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Giapponese e italiano', forWho: 'Principianti e studenti fino a livello N4.', cancel: svcCancel(18) },
  'Roberto Sala': { desc: 'Consulenza fiscale individuale per freelance e piccoli imprenditori in Svizzera: ti aiuto a capire come impostare la tua dichiarazione e quali documenti raccogliere. Le regole variano da cantone a cantone: la consulenza riguarda il tuo caso ma non sostituisce la verifica con l\'ufficio delle imposte.', gets: ['Un colloquio di 60 minuti sul tuo caso', 'Una checklist dei documenti da preparare', 'Indicazioni su scadenze e deduzioni principali'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano, Deutsch', forWho: 'Freelance e piccoli imprenditori residenti in Svizzera.', cancel: svcCancel(55) },
};

export function providerInfoFor(p: Provider): ServiceInfo {
  return providerInfo[p.name] ?? (p.role === 'Business Coaching' ? providerInfo['Alex'] : undefined) ?? { desc: `${p.role}: sessione individuale prenotabile su LifeNetwork. Il professionista non ha ancora aggiunto una descrizione estesa.`, gets: ['Una sessione individuale'], durationMin: 60, mode: 'online', place: 'Le modalità vengono comunicate dopo la prenotazione', language: 'Italiano', forWho: 'Chiunque sia interessato a questo servizio.', cancel: svcCancel(p.price) };
}

/* ---------- community ---------- */
export const communityInfo: Record<string, { desc: string; rules: string }> = {
  'Founders Svizzera': { desc: 'Community per fondatori e aspiranti fondatori che lavorano in Svizzera: si scambiano esperienze su finanziamento, aspetti legali, assunzioni e ricerca di co-founder. Ci si aiuta con domande concrete e feedback onesti.', rules: 'Tutti i membri possono pubblicare. Pubblica solo contenuti pertinenti al fare impresa in Svizzera. Niente spam o autopromozione ripetuta, niente dati riservati di terzi, rispetto reciproco nei commenti.' },
  'Corridori del lunedì': { desc: 'Gruppo di persone che corrono insieme o si danno consigli: uscite di gruppo aperte a tutti i livelli, risultati, allenamenti e dubbi su infortuni e attrezzatura.', rules: 'Tutti i membri possono pubblicare. Indica sempre luogo e orario quando proponi un\'uscita. I consigli su dolori e infortuni sono esperienze personali e non sostituiscono il medico.' },
  'Français facile': { desc: 'Community per imparare e praticare il francese: consigli di studio, espressioni della settimana, scambi linguistici tra italiano e francese e risorse per ogni livello.', rules: 'Tutti i membri possono pubblicare. Scrivi in italiano o francese. Chiedi sempre prima di inviare messaggi privati per proporre scambi linguistici. Niente pubblicità di corsi a pagamento.' },
  'Mente calma': { desc: 'Spazio dedicato a benessere mentale e gestione dello stress, curato da Elena F.: esercizi pratici, riflessioni e spunti da applicare ogni giorno. Non è un servizio di assistenza psicologica.', rules: 'Solo il proprietario pubblica; i membri possono leggere, mettere mi piace e commentare con rispetto. Per situazioni di emergenza rivolgiti ai servizi di emergenza locali, non ai commenti.' },
};

export function describeCommunity(c: Community): { desc: string; rules: string } {
  const info = communityInfo[c.name];
  const rulesBase = c.openPosting ? 'Tutti i membri possono pubblicare.' : `Solo il proprietario${c.owner && c.owner !== 'system' ? ` (${c.owner})` : ''} può pubblicare; i membri possono leggere, mettere mi piace e commentare.`;
  return {
    desc: c.desc || info?.desc || `Community su ${c.topic}. Il proprietario non ha ancora aggiunto una descrizione.`,
    rules: c.rules ? `${rulesBase} ${c.rules}` : info && !c.desc ? info.rules : `${rulesBase} Rispetta gli altri membri e pubblica solo contenuti pertinenti all'argomento.`,
  };
}

/* ---------- date di pubblicazione coerenti ---------- */
export function stampSeed<T extends { posts: Post[]; communities: Community[]; ideas: Idea[] }>(n: T): { posts: Post[]; communities: Community[]; ideas: Idea[] } {
  const now = Date.now();
  const posts = n.posts.map((p, i) => ({ ...p, ts: now - (i * 11 + 2 + (Math.abs(hashStr(p.text)) % 5)) * HOUR }));
  const communities = n.communities.map((c) => ({
    ...c, ts: now - 40 * DAY, ...(communityInfo[c.name] ?? {}),
    posts: c.posts.map((p, pi) => ({ ...p, ts: now - (pi * 29 + 5 + (Math.abs(hashStr(p.text)) % 12)) * HOUR })),
  }));
  const ideas = n.ideas.map((x, i) => ({ ...x, ts: now - (i * 2 + 1) * DAY - (Math.abs(hashStr(x.title)) % 10) * HOUR }));
  return { posts, communities, ideas };
}

/** Carica seminari, iscrizioni di esempio e collega il Plan (solo demo). Da chiamare dopo aver caricato la rete. */
export function seedMarketplace(me: string) {
  const seminars = demoSeminars(me);
  const past = seminars.find((s) => s.id === 9)!;
  const enrId = 'demo-enr-9';
  const enrollments: Enrollment[] = [{ id: enrId, kind: 'seminar', ref: String(past.id), title: past.title, host: past.host, price: past.price, startsAt: past.startsAt!, durationMin: past.durationMin!, status: 'enrolled', createdAt: at(-4, '12:00') }];
  const st = useNet.getState();
  useNet.setState({ seminars, enrollments, ...stampSeed({ posts: st.posts, communities: st.communities, ideas: st.ideas }) });
  const mine = seminars.find((s) => s.host === me);
  const providers = useNet.getState().providers;
  const anna = providers.find((p) => p.name === 'Anna Conti');
  const annaStart = anna?.slots[0] ? nextOccurrence(anna.slots[0]) : null;
  addEventsSafe([
    { day: dayKeyOf(past.startsAt!), time: hhmm(past.startsAt!), title: 'Seminario: ' + past.title, dur: past.durationMin, ref: enrId },
    ...(mine ? [{ day: dayKeyOf(mine.startsAt!), time: hhmm(mine.startsAt!), title: 'Seminario (relatore): ' + mine.title, dur: mine.durationMin }] : []),
    // un impegno che si sovrappone allo primo slot di Anna Conti, per provare il conflitto sui servizi
    ...(annaStart ? [{ day: dayKeyOf(annaStart), time: '12:00', title: 'Pranzo di lavoro con il fornitore', dur: 60 }] : []),
  ]);
}
