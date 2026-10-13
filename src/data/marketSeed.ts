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
export const paidCancel = (price: number) => `Paghi ${price} LP al momento dell'iscrizione. Puoi disdire fino a 24 ore prima e ti rimborsiamo tutto; puoi sempre riprogrammare.`;

type SeminarSeed = Omit<Seminar, 'cancelPolicy'> & { cancelPolicy?: string };

export function demoSeminars(me: string): Seminar[] {
  const list: SeminarSeed[] = [
    {
      id: 1, title: 'Dormire meglio: la routine della sera', host: 'Luca Ferri', price: 0, promoted: false,
      ts: at(-9, '10:00'), startsAt: at(2, '18:00'), durationMin: 60, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 100, joined: 37,
      desc: 'Un\'ora per capire come funziona il sonno e costruire una routine della sera semplice: orari, luce, schermi, cena e piccoli rituali che aiutano ad addormentarsi. Partiamo da esempi reali ed errori comuni. È informazione generale: non sostituisce il parere del medico e non è indicata per trattare disturbi del sonno.',
      learn: ['Cosa succede al corpo mentre dormi', 'Orari, luce e schermi: cosa conta davvero', 'Una routine della sera di 30 minuti', 'Quando conviene parlarne con il medico'],
      audience: 'Chiunque dorme poco o male, o si sveglia stanco. Non servono conoscenze di base.',
      included: 'Partecipazione al seminario con tempo per le domande; la scheda con la routine della sera viene inviata agli iscritti. Nessuna registrazione.', language: 'Italiano',
    },
    {
      id: 2, title: 'Organizzare il budget familiare in 3 passi', host: me, price: 25, promoted: true,
      ts: at(-6, '09:30'), startsAt: at(3, '10:00'), durationMin: 90, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 30, joined: 14,
      desc: 'Come mettere ordine nelle spese di casa: entrate, spese fisse, spese variabili e quanto mettere da parte ogni mese. Vediamo un metodo in tre passi con l\'esempio di una famiglia, come ridurre bollette e abbonamenti e come tenere traccia di tutto senza complicarsi la vita. Parlo dalla mia esperienza personale: non è una consulenza finanziaria.',
      learn: ['Separare spese fisse e spese variabili', 'Decidere una cifra da risparmiare ogni mese', 'Tre trucchi per ridurre bollette e abbonamenti', 'Controllare il budget in 10 minuti a settimana'],
      audience: 'Famiglie, coppie e chi vive da solo e vuole capire dove vanno i soldi. Non servono conoscenze di base.',
      included: 'Seminario di 90 minuti con 20 minuti di domande, modello di budget in foglio di calcolo inviato dopo l\'evento. Nessuna registrazione.', language: 'Italiano',
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
      id: 6, title: 'Primo soccorso: i gesti che salvano', host: 'Marco Bianchi', price: 30, promoted: false,
      ts: at(-2, '16:30'), startsAt: at(5, '17:30'), durationMin: 120, mode: 'presenza', place: 'Sala corsi del centro sportivo, Lugano (l\'indirizzo esatto viene indicato agli iscritti)', seats: 16, joined: 12,
      desc: 'Corso pratico di primo soccorso per la vita di tutti i giorni: come valutare una situazione, chiamare i soccorsi e gestire una ferita, un soffocamento o un malore in attesa dell\'ambulanza. Si prova con manichini e materiale di esercitazione. È un corso introduttivo: non rilascia certificazioni ufficiali.',
      learn: ['Chiamare il 144 e cosa dire', 'La posizione laterale di sicurezza', 'Manovre di base per il soffocamento', 'Gestire ferite, ustioni e distorsioni'],
      audience: 'Adulti, genitori e chiunque voglia sapere cosa fare in un\'emergenza. Nessuna esperienza richiesta.',
      included: 'Corso di 2 ore con materiale pratico e una scheda riassuntiva in PDF. Non rilascia certificati ufficiali.', language: 'Italiano',
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
      id: 8, title: 'Dichiarazione fiscale svizzera passo per passo', host: 'Roberto Sala', price: 35, promoted: false,
      ts: at(0, '08:30'), startsAt: at(7, '17:00'), durationMin: 90, mode: 'online', place: 'Videochiamata: il link di accesso arriva agli iscritti 30 minuti prima dell\'inizio', seats: 40, joined: 11,
      desc: 'Guida pratica alla dichiarazione dei redditi per chi lavora come dipendente in Svizzera: quali documenti raccogliere, quali deduzioni sono comuni (trasporti, spese mediche, previdenza), scadenze e proroghe. Le regole variano da cantone a cantone e cambiano negli anni: è una formazione generale, non una consulenza fiscale personale.',
      learn: ['Documenti da preparare prima di iniziare', 'Deduzioni più comuni e come documentarle', 'Scadenze e proroghe: dove verificarle nel tuo cantone', 'Previdenza e contributi, in breve'],
      audience: 'Dipendenti, coppie e famiglie residenti in Svizzera.',
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
const svcCancel = (price: number) => `Paghi ${price} LP al momento della prenotazione. Puoi disdire fino a 24 ore prima con rimborso intero e lo slot torna disponibile; puoi sempre riprogrammare.`;

export const providerInfo: Record<string, ServiceInfo> = {
  'Alex': { desc: 'Allenamento alla corsa con un piano su misura: partiamo dal tuo livello e dal tuo obiettivo (5 o 10 km, o semplicemente correre con più piacere) e proviamo insieme riscaldamento, ritmo e tecnica. Se hai problemi di salute o dolori ricorrenti chiedi prima il parere del tuo medico.', gets: ['Una sessione di 45 minuti di corsa guidata', 'Consigli su ritmo, respirazione e tecnica', 'Un piano di allenamento di 4 settimane da seguire'], durationMin: 45, mode: 'presenza', place: 'Ritrovo sul lungolago (il punto esatto viene indicato dopo la prenotazione)', language: 'Italiano, English', forWho: 'Chi vuole iniziare a correre o aumentare la distanza, a qualsiasi livello.', cancel: svcCancel(20) },
  'Dr. Elena Rossi': { desc: 'Colloquio individuale di supporto psicologico su stress, ansia da lavoro, equilibrio vita-lavoro e momenti di cambiamento. La prima sessione serve a capire insieme la situazione e a definire se e come proseguire. Non è un servizio di emergenza: in caso di crisi o rischio per la tua sicurezza contatta i servizi di emergenza locali.', gets: ['Un colloquio riservato di 50 minuti', 'Una prima valutazione della situazione', 'Indicazioni su come proseguire (anche con altri professionisti, se serve)'], durationMin: 50, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Adulti che vivono stress o difficoltà quotidiane. Non adatto a situazioni di emergenza.', cancel: svcCancel(40) },
  'Marco Bianchi': { desc: 'Allenamento personale individuale in presenza, con programma su misura in base a livello, obiettivi e tempo disponibile. La prima sessione include una breve valutazione di mobilità e forza. Se hai problemi di salute o infortuni chiedi prima il parere del tuo medico.', gets: ['Una sessione di allenamento guidata di 60 minuti', 'Valutazione iniziale di mobilità e forza', 'Una scheda di allenamento da seguire da solo'], durationMin: 60, mode: 'presenza', place: 'Palestra convenzionata in città (indirizzo comunicato dopo la prenotazione)', language: 'Italiano', forWho: 'Persone che vogliono iniziare o riprendere ad allenarsi, di qualsiasi livello.', cancel: svcCancel(25) },
  'Sophie Martin': { desc: 'Lezione individuale di francese conversazionale, con materiale scelto sui tuoi interessi (lavoro, viaggi, vita quotidiana). Si parla soprattutto in francese, con correzioni sul momento e a fine lezione.', gets: ['60 minuti di conversazione con correzioni', 'Un elenco di parole ed espressioni nuove dopo la lezione', 'Un compito di pratica leggero per la settimana'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Francese e italiano', forWho: 'Studenti di livello A2-C1 che vogliono parlare con più sicurezza.', cancel: svcCancel(15) },
  'Luca Ferri': { desc: 'Consulto individuale di coaching del sonno: analizziamo le tue abitudini serali, gli orari e l\'ambiente della camera, e costruiamo insieme una routine realistica. Non è una visita medica e non sostituisce il parere del medico in caso di disturbi del sonno.', gets: ['Analisi delle tue abitudini in 60 minuti', 'Una routine della sera su misura', 'Un follow-up scritto di una pagina'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Adulti che dormono poco o male e vogliono provare cambiamenti pratici. Non adatto a disturbi che richiedono una cura medica.', cancel: svcCancel(35) },
  'Anna Conti': { desc: 'Consulto di nutrizione per sportivi e persone attive: revisione delle tue abitudini alimentari e indicazioni pratiche per colazione, pranzi e spuntini. Non sostituisce il parere del medico e non è adatto a patologie che richiedono un piano clinico.', gets: ['Un colloquio di 45 minuti sulle tue abitudini', 'Indicazioni generali per la settimana tipo', 'Una lista di alimenti e porzioni di riferimento'], durationMin: 45, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Persone attive che vogliono mangiare meglio. Non adatto a patologie o disturbi alimentari.', cancel: svcCancel(30) },
  'David Kim': { desc: 'Lezione individuale di inglese conversazionale e per il lavoro (colloqui, riunioni, email). Si adatta al tuo livello e si concentra su ciò che ti serve davvero.', gets: ['60 minuti di conversazione guidata', 'Correzioni di pronuncia e grammatica', 'Vocabolario utile da riutilizzare al lavoro'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Inglese e italiano', forWho: 'Studenti dal livello A2 in su.', cancel: svcCancel(15) },
  'Dr. Paolo Greco': { desc: 'Colloquio di psicoterapia individuale per approfondire difficoltà ricorrenti (ansia, relazioni, autostima). La prima sessione è conoscitiva: serve a capire se il percorso è adatto a te. Una singola sessione non è un percorso terapeutico completo e non è un servizio di emergenza.', gets: ['Un colloquio conoscitivo di 50 minuti', 'Una prima impostazione del lavoro possibile', 'Indicazioni su durata e frequenza di un eventuale percorso'], durationMin: 50, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Adulti che cercano un percorso psicoterapeutico. Non adatto a situazioni di emergenza.', cancel: svcCancel(45) },
  'Martina Colombo': { desc: 'Allenamento personale online in diretta: ti guido via video con esercizi a corpo libero o con attrezzi semplici che hai in casa. Adatto anche a chi ha poco spazio.', gets: ['Una sessione di 45 minuti in diretta', 'Programma adattato allo spazio e agli attrezzi che hai', 'Una scheda di esercizi per la settimana'], durationMin: 45, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Chi vuole allenarsi a casa. Serve un tappetino e uno spazio libero di 2 metri.', cancel: svcCancel(20) },
  'Yuki Tanaka': { desc: 'Lezione individuale di giapponese per principianti e livelli intermedi: hiragana e katakana, frasi di tutti i giorni e conversazione guidata.', gets: ['60 minuti di lezione individuale', 'Materiale di studio in PDF', 'Esercizi di scrittura e ascolto per la settimana'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Giapponese e italiano', forWho: 'Principianti e studenti fino a livello N4.', cancel: svcCancel(18) },
  'Roberto Sala': { desc: 'Consulenza fiscale individuale per privati e famiglie in Svizzera: ti aiuto a capire come impostare la tua dichiarazione e quali documenti raccogliere. Le regole variano da cantone a cantone: la consulenza riguarda il tuo caso ma non sostituisce la verifica con l\'ufficio delle imposte.', gets: ['Un colloquio di 60 minuti sul tuo caso', 'Una checklist dei documenti da preparare', 'Indicazioni su scadenze e deduzioni principali'], durationMin: 60, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano, Deutsch', forWho: 'Dipendenti, coppie e famiglie residenti in Svizzera.', cancel: svcCancel(55) },
  'Laura Neri': { desc: 'Lezione di yoga pensata per la schiena: movimenti dolci per sciogliere collo e zona lombare, respirazione e posture da ripetere a casa. Adatta anche a chi lavora molto seduto. Non sostituisce il parere del medico se hai dolori persistenti.', gets: ['Una lezione di 50 minuti in diretta', 'Una sequenza di 10 minuti da fare ogni giorno', 'Consigli per sedersi meglio alla scrivania'], durationMin: 50, mode: 'online', place: 'Videochiamata: il link arriva dopo la prenotazione', language: 'Italiano', forWho: 'Chi ha la schiena rigida o lavora seduto. Serve un tappetino e uno spazio libero di 2 metri.', cancel: svcCancel(22) },
};

export function providerInfoFor(p: Provider): ServiceInfo {
  return useNet.getState().serviceInfo?.[p.name] ?? providerInfo[p.name] ?? (p.role === 'Allenamento alla corsa' ? providerInfo['Alex'] : undefined) ?? { desc: `${p.role}: sessione individuale prenotabile su LifeNetwork. Il professionista non ha ancora aggiunto una descrizione estesa.`, gets: ['Una sessione individuale'], durationMin: 60, mode: 'online', place: 'Le modalità vengono comunicate dopo la prenotazione', language: 'Italiano', forWho: 'Chiunque sia interessato a questo servizio.', cancel: svcCancel(p.price) };
}

/* ---------- community ---------- */
export const communityInfo: Record<string, { desc: string; rules: string }> = {
  'Cucina veloce': { desc: 'Community per chi ha poco tempo ma vuole mangiare bene: ricette da meno di 30 minuti, idee per la cena con quello che c\'è in frigo, trucchi per organizzare la spesa e i pasti della settimana.', rules: 'Tutti i membri possono pubblicare. Indica sempre gli ingredienti principali e i tempi quando condividi una ricetta. Niente spam o pubblicità, rispetto reciproco nei commenti.' },
  'Corsa a Lugano': { desc: 'Gruppo di persone che corrono insieme o si danno consigli: uscite di gruppo aperte a tutti i livelli, risultati, allenamenti e dubbi su infortuni e attrezzatura.', rules: 'Tutti i membri possono pubblicare. Indica sempre luogo e orario quando proponi un\'uscita. I consigli su dolori e infortuni sono esperienze personali e non sostituiscono il medico.' },
  'Français facile': { desc: 'Community per imparare e praticare il francese: consigli di studio, espressioni della settimana, scambi linguistici tra italiano e francese e risorse per ogni livello.', rules: 'Tutti i membri possono pubblicare. Scrivi in italiano o francese. Chiedi sempre prima di inviare messaggi privati per proporre scambi linguistici. Niente pubblicità di corsi a pagamento.' },
  'Mente calma': { desc: 'Spazio dedicato a benessere mentale e gestione dello stress, curato da Elena F.: esercizi pratici, riflessioni e spunti da applicare ogni giorno. Non è un servizio di assistenza psicologica.', rules: 'Solo il proprietario pubblica; i membri possono leggere, mettere mi piace e commentare con rispetto. Per situazioni di emergenza rivolgiti ai servizi di emergenza locali, non ai commenti.' },
  'Genitori di Zurigo': { desc: 'Community per mamme e papà di Zurigo e dintorni: consigli pratici, scambio di vestiti e giochi, idee per il fine settimana con i bambini e indirizzi utili (pediatri, asili, parchi).', rules: 'Tutti i membri possono pubblicare. Niente foto di bambini senza il consenso dei genitori. I consigli sulla salute sono esperienze personali e non sostituiscono il pediatra.' },
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
  // partecipanti al mio seminario (id 2): li vede solo chi lo organizza
  const mySem = seminars.find((x) => x.host === me && x.price > 0);
  if (mySem) useNet.setState({ participants: { [`seminar:${mySem.id}`]: [['Giulia Moretti', -6, '18:20'], ['Marco Valli', -5, '09:05'], ['Elena Serra', -4, '21:40'], ['Tommaso V.', -2, '12:10'], ['Federica L.', -1, '16:30']].map(([name, d, h]) => ({ name: name as string, paid: mySem.price, paidAt: at(d as number, h as string) })) } });
  // prenotazioni al mio servizio e contributi alle mie idee (solo demo): li vede chi li ha creati
  const prev = useNet.getState().participants ?? {};
  const svc = ['Giulia Moretti', 'Marco Valli', 'Luca Bernasconi'].map((name, i) => ({ name, paid: 40, paidAt: at(-(i + 1) * 2, '17:00'), startsAt: at(i + 1, '18:30'), durationMin: 45 }));
  const ideaParts: Record<string, { name: string; paid: number; paidAt: number }[]> = {};
  for (const idea of useNet.getState().ideas.filter((x) => x.author === me)) {
    const names = ['Elena Serra', 'Tommaso V.', 'Federica L.', 'Nadia P.', 'Sophie K.'];
    const base = Math.max(5, Math.round((idea.raised || 100) / names.length / 5) * 5);
    ideaParts[`idea:${idea.id}`] = names.map((name, i) => ({ name, paid: base + (i % 2) * 5, paidAt: at(-(i + 1), '19:30') }));
  }
  useNet.setState({ participants: { ...prev, [`service:${me}`]: svc, ...ideaParts } });
  const mine = seminars.find((s) => s.host === me);
  const providers = useNet.getState().providers;
  const anna = providers.find((p) => p.name === 'Anna Conti');
  const annaStart = anna?.slots[0] ? nextOccurrence(anna.slots[0]) : null;
  addEventsSafe([
    { day: dayKeyOf(past.startsAt!), time: hhmm(past.startsAt!), title: 'Seminario: ' + past.title, dur: past.durationMin, ref: enrId },
    ...(mine ? [{ day: dayKeyOf(mine.startsAt!), time: hhmm(mine.startsAt!), title: 'Seminario (relatore): ' + mine.title, dur: mine.durationMin }] : []),
    // un impegno che si sovrappone allo primo slot di Anna Conti, per provare il conflitto sui servizi
    ...(annaStart ? [{ day: dayKeyOf(annaStart), time: '12:00', title: 'Pranzo con una collega', dur: 60 }] : []),
  ]);
}
