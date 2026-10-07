/**
 * Banca di prove per i test di LifeNetwork Lavoro.
 * Le domande a scelta si correggono da sole; quelle "aperte" le valuta chi assume;
 * quelle "scenario" assegnano un punteggio a ogni risposta (giudizio situazionale).
 * Sono prove di esempio scritte per LifePilot: il datore di lavoro può aggiungerne di proprie.
 */
export type QKind = 'mc' | 'scenario' | 'open' | 'number';
export type QOption = { t: string; score: number };
export type Question = {
  id: string;
  skill: string;
  kind: QKind;
  prompt: string;
  options?: QOption[];
  /** per 'number': risposta esatta e tolleranza relativa (0.02 = ±2%) */
  answer?: number;
  tol?: number;
  /** per 'open': criteri mostrati a chi valuta */
  rubric?: string;
  /** tratto misurato (solo domande di atteggiamento) */
  trait?: Trait;
  secs?: number;
};
export type Trait = 'affidabilita' | 'onesta' | 'collaborazione';

export const skills: { id: string; label: string; icon: string; desc: string }[] = [
  { id: 'vendite', label: 'Vendite e negoziazione', icon: '🤝', desc: 'Capire il cliente, gestire obiezioni e prezzo.' },
  { id: 'analisi', label: 'Analisi dei numeri', icon: '📊', desc: 'Percentuali, medie, lettura di dati e margini.' },
  { id: 'scrittura', label: 'Comunicazione scritta', icon: '✍️', desc: 'Email chiare, tono giusto, sintesi.' },
  { id: 'problem', label: 'Problem solving e logica', icon: '🧩', desc: 'Ragionamento, sequenze, priorità tecniche.' },
  { id: 'clienti', label: 'Assistenza clienti', icon: '🎧', desc: 'Empatia, soluzioni, gestione dei reclami.' },
  { id: 'organizzazione', label: 'Organizzazione e priorità', icon: '🗂️', desc: 'Gestire tempo, scadenze e imprevisti.' },
];
export const skillLabel = (id: string) => skills.find((s) => s.id === id)?.label ?? id;

export const traitLabel: Record<Trait, string> = { affidabilita: 'Affidabilità', onesta: 'Onestà e trasparenza', collaborazione: 'Collaborazione' };

const mc = (id: string, skill: string, prompt: string, opts: string[], correct: number, secs = 60): Question => ({
  id, skill, kind: 'mc', prompt, secs, options: opts.map((t, i) => ({ t, score: i === correct ? 100 : 0 })),
});
const sc = (id: string, skill: string, prompt: string, opts: [string, number][], trait?: Trait, secs = 75): Question => ({
  id, skill, kind: 'scenario', prompt, secs, trait, options: opts.map(([t, score]) => ({ t, score })),
});
const num = (id: string, skill: string, prompt: string, answer: number, tol = 0.01, secs = 90): Question => ({ id, skill, kind: 'number', prompt, answer, tol, secs });
const open = (id: string, skill: string, prompt: string, rubric: string, secs = 240): Question => ({ id, skill, kind: 'open', prompt, rubric, secs });

export const bank: Question[] = [
  // ---- vendite ----
  sc('v1', 'vendite', 'Un cliente dice: “Il vostro prodotto è bello ma costa troppo”. Cosa fai per prima cosa?', [
    ['Offro subito uno sconto del 15%', 20], ['Chiedo cosa sta confrontando e cosa è per lui il valore più importante', 100], ['Gli spiego che la qualità si paga', 35], ['Lo lascio pensarci e lo richiamo tra un mese', 25]]),
  sc('v2', 'vendite', 'Hai quasi chiuso, ma il cliente chiede una funzione che non esiste. Come rispondi?', [
    ['Dico che arriverà presto, così chiudiamo', 0], ['Spiego con chiarezza cosa c’è e cosa no, e propongo l’alternativa migliore', 100], ['Cambio argomento sul prezzo', 15], ['Rinuncio alla vendita', 30]]),
  mc('v3', 'vendite', 'Quale domanda è più utile all’inizio di una trattativa?', ['Quanto budget avete?', 'Che problema volete risolvere e cosa succede se non lo risolvete?', 'Conoscete i nostri concorrenti?', 'Quando potete firmare?'], 1),
  num('v4', 'vendite', 'Vendi 40 abbonamenti a 75 CHF/mese. Offri il 10% di sconto sul totale. Quanto incassi al mese?', 2700, 0.005),
  open('v5', 'vendite', 'Scrivi in 4-6 righe come presenteresti a un negozio di quartiere un software di prenotazioni che costa 49 CHF/mese.', 'Parte dal bisogno del cliente, benefici concreti, nessuna promessa falsa, chiusura con un passo successivo chiaro.'),

  // ---- analisi ----
  num('a1', 'analisi', 'Il fatturato passa da 80’000 a 92’000 CHF. Di quanti punti percentuali è cresciuto?', 15, 0.01),
  mc('a2', 'analisi', 'Le vendite mensili sono 10, 12, 11, 40, 12. Quale valore descrive meglio il mese “tipico”?', ['La media (17)', 'La mediana (12)', 'Il massimo (40)', 'Il totale (85)'], 1),
  num('a3', 'analisi', 'Prezzo di vendita 120 CHF, costo 78 CHF. Qual è il margine in percentuale sul prezzo di vendita?', 35, 0.01),
  mc('a4', 'analisi', 'Un’azienda dice: “Con la nostra app il 90% degli utenti è soddisfatto”. Il sondaggio è stato fatto a 10 utenti scelti dall’azienda. Cosa pensi?', ['È un dato molto solido', 'Campione piccolo e scelto: il dato dice poco', 'Il 90% è sempre sospetto', 'Non si può ragionare sulle percentuali'], 1),
  num('a5', 'analisi', 'Un negozio ha 3 casse. Ognuna serve 24 clienti all’ora. Quanti clienti servono in 2 ore e 30 minuti?', 180, 0.005),

  // ---- scrittura ----
  mc('s1', 'scrittura', 'Quale oggetto di email è più efficace per un collega molto impegnato?', ['Info', 'Urgentissimo!!!', 'Approvazione preventivo Rossi entro giovedì 12', 'Ciao, hai un minuto?'], 2),
  mc('s2', 'scrittura', 'Quale frase è più chiara?', ['Si provvederà quanto prima a effettuare le opportune verifiche del caso.', 'Controllo il problema oggi e ti scrivo entro le 17.', 'Verrà fatto il possibile.', 'Il problema è in carico.'], 1),
  sc('s3', 'scrittura', 'Un cliente ti scrive arrabbiato in maiuscolo. Come inizi la risposta?', [['“Capisco la frustrazione, mi dispiace per il disagio. Ecco cosa faccio subito:”', 100], ['“La informo che il regolamento prevede…”', 25], ['“Non c’è bisogno di scrivere in maiuscolo.”', 0], ['“Risolveremo.”', 40]]),
  open('s4', 'scrittura', 'Riscrivi in modo più chiaro e cortese: “Non ho ricevuto i documenti, senza quelli non posso procedere, fate presto.”', 'Chiede cosa serve e entro quando, tono cortese ma diretto, nessuna accusa, massimo 4 righe.', 180),
  open('s5', 'scrittura', 'Riassumi in 3 righe: “La riunione di ieri ha deciso di spostare il lancio al 14 marzo perché i test hanno trovato due errori nel pagamento. Marta correggerà gli errori entro il 5, Luca riscriverà le istruzioni, il budget resta invariato.”', 'Include nuova data, motivo, chi fa cosa, budget; senza dettagli inutili.', 180),

  // ---- problem solving ----
  mc('p1', 'problem', 'Completa la sequenza: 2, 6, 12, 20, 30, ?', ['38', '40', '42', '44'], 2),
  mc('p2', 'problem', 'Tutti i tecnici sono reperibili. Alcuni reperibili lavorano di notte. Quale conclusione è certa?', ['Tutti i tecnici lavorano di notte', 'Alcuni tecnici lavorano di notte', 'Nessuna delle precedenti è certa', 'I tecnici non lavorano di giorno'], 2),
  num('p3', 'problem', 'Un rubinetto riempie una vasca in 6 ore, un altro in 3 ore. Aperti insieme, in quante ore la riempiono?', 2, 0.01),
  sc('p4', 'problem', 'Il sito non carica per alcuni utenti da 10 minuti. Qual è il primo passo più sensato?', [['Riavvio tutto subito', 25], ['Verifico a chi succede (dove, quando, cosa cambiato di recente) prima di toccare qualcosa', 100], ['Avviso tutti i clienti che c’è un guasto grave', 20], ['Aspetto, tanto si risolve da solo', 5]]),
  mc('p5', 'problem', 'Hai 8 monete uguali all’aspetto, una è più pesante. Con una bilancia a due piatti, qual è il numero minimo di pesate che garantisce di trovarla?', ['1', '2', '3', '4'], 1),

  // ---- assistenza clienti ----
  sc('c1', 'clienti', 'Un cliente ha ricevuto un prodotto difettoso e chiede il rimborso. La policy dice 14 giorni; lui è al giorno 17. Cosa fai?', [
    ['Rifiuto: la policy è chiara', 30], ['Ascolto, mi scuso, spiego la policy e cerco con il responsabile una soluzione ragionevole (sostituzione o buono)', 100], ['Rimborso subito senza chiedere nulla', 45], ['Lo rimbalzo a un altro reparto', 5]], undefined),
  sc('c2', 'clienti', 'Non sai rispondere alla domanda tecnica di un cliente. Cosa fai?', [['Provo a indovinare per non sembrare impreparato', 0], ['Dico che non lo so con certezza, mi informo e gli do una data in cui risponderò', 100], ['Gli dico di cercare online', 15], ['Cambio argomento', 10]]),
  mc('c3', 'clienti', 'Quale frase mostra più empatia?', ['Non è colpa nostra.', 'Capisco che sia fastidioso: vediamo subito come sistemarlo.', 'Lo dice anche il contratto.', 'Altri clienti non hanno questo problema.'], 1),
  sc('c4', 'clienti', 'Hai 5 richieste in coda e un cliente al telefono molto prolisso. Come ti comporti?', [['Lo interrompo e riaggancio', 0], ['Riepilogo cosa ho capito, fisso il passo successivo e gentilmente chiudo', 100], ['Lo lascio parlare per ore', 20], ['Gli passo un collega a caso', 15]]),
  open('c5', 'clienti', 'Un cliente scrive: “Il corriere ha lasciato il pacco sotto la pioggia e ora è rovinato. Pessimo servizio.” Scrivi la tua risposta.', 'Riconosce il danno, si scusa senza scaricare colpe, propone una soluzione concreta e un tempo, tono umano.'),

  // ---- organizzazione ----
  sc('o1', 'organizzazione', 'Hai tre cose: report per domani alle 9 (2 ore), una email non urgente (10 minuti), una richiesta del capo “per oggi” (1 ora). Hai 4 ore. Come ti organizzi?', [
    ['Faccio prima l’email, poi vedo', 15], ['Richiesta del capo, report di domani, poi l’email se avanza tempo', 100], ['Faccio solo il report', 40], ['Aspetto di avere più energia', 0]]),
  mc('o2', 'organizzazione', 'Un compito richiede 3 ore. Scade venerdì. Oggi è lunedì e hai molto tempo. La strategia migliore è…', ['Aspettare giovedì: lavoro meglio sotto pressione', 'Fissare ora un blocco di tempo e chiedere feedback prima di venerdì', 'Farlo in 20 minuti al giorno senza pianificare', 'Delegarlo'], 1),
  sc('o3', 'organizzazione', 'A metà giornata un imprevisto ti ruba 2 ore. Cosa fai?', [['Resto fino a notte senza dire niente', 25], ['Ricalcolo le priorità, avviso chi dipende da me e sposto ciò che si può', 100], ['Faccio tutto di fretta', 20], ['Lascio indietro cose a caso', 10]]),
  num('o4', 'organizzazione', 'Una riunione dura 45 minuti e coinvolge 6 persone. Quante ore-persona costa?', 4.5, 0.01),
  mc('o5', 'organizzazione', 'Qual è il criterio più utile per decidere cosa fare per primo?', ['Ciò che è più piacevole', 'Ciò che è urgente e importante', 'Ciò che è più facile', 'Ciò che chiede chi urla di più'], 1),

  // ---- atteggiamento (misurano i tratti) ----
  sc('t1', 'atteggiamento', 'Hai promesso un lavoro per venerdì ma capisci che non ce la farai. Cosa fai?', [['Aspetto venerdì e vedo', 0], ['Avviso subito chi aspetta, spiego il motivo e propongo una nuova data realistica', 100], ['Consegno qualcosa di incompleto senza dirlo', 10], ['Dico che è colpa di altri', 0]], 'affidabilita'),
  sc('t2', 'atteggiamento', 'Nessuno controlla il tuo lavoro, ma sai che una parte non è perfetta. Cosa fai?', [['Lo consegno così, nessuno se ne accorge', 5], ['Lo sistemo o dichiaro il limite a chi lo riceve', 100], ['Dico che è perfetto', 0], ['Lo consegno e spero', 15]], 'affidabilita'),
  sc('t3', 'atteggiamento', 'Arrivi in ritardo a una riunione importante per colpa tua. Cosa dici?', [['Una scusa credibile', 10], ['Mi scuso e dico che è stata colpa mia, poi mi metto in pari', 100], ['Non dico nulla', 30], ['Dico che c’era traffico (non è vero)', 0]], 'affidabilita'),
  sc('t4', 'atteggiamento', 'Scopri di aver commesso un errore che costa 300 CHF all’azienda e nessuno l’ha notato. Cosa fai?', [['Aspetto che emerga', 0], ['Lo dico subito al responsabile con una proposta per rimediare', 100], ['Lo correggo di nascosto e non dico nulla', 40], ['Do la colpa a un collega', 0]], 'onesta'),
  sc('t5', 'atteggiamento', 'Un cliente ti chiede se potete consegnare in 2 giorni. Sai che di solito ne servono 5. Cosa rispondi?', [['Sì, tanto poi vediamo', 0], ['No, di solito servono 5 giorni; posso vedere se esiste una soluzione urgente', 100], ['Forse', 25], ['Sì e poi mi invento un ritardo', 0]], 'onesta'),
  sc('t6', 'atteggiamento', 'Un collega ti chiede di firmare un rapporto ore che non è del tutto esatto: “tanto lo fanno tutti”. Cosa fai?', [['Firmo, non voglio problemi', 5], ['Rifiuto con tatto e propongo di correggerlo insieme', 100], ['Firmo ma lo dico a qualcuno dopo', 20], ['Lo denuncio davanti a tutti senza parlargli', 30]], 'onesta'),
  sc('t7', 'atteggiamento', 'Un collega è in difficoltà con una scadenza e tu hai tempo libero. Cosa fai?', [['Non mi riguarda', 20], ['Gli chiedo se serve una mano e mi accordo su cosa fare', 100], ['Faccio il lavoro senza dirgli nulla e poi lo racconto a tutti', 35], ['Lo dico al capo per metterlo in cattiva luce', 0]], 'collaborazione'),
  sc('t8', 'atteggiamento', 'Una tua idea viene criticata in riunione. Come reagisci?', [['Mi arrabbio e difendo l’idea a oltranza', 10], ['Ascolto le critiche, chiedo esempi e integro ciò che ha senso', 100], ['Taccio per sempre', 30], ['Cambio argomento', 20]], 'collaborazione'),
  sc('t9', 'atteggiamento', 'Il team ha successo grazie al lavoro di tutti, ma il capo ringrazia solo te. Cosa fai?', [['Prendo il merito', 0], ['Ringrazio e nomino chi ha contribuito', 100], ['Non dico nulla', 40], ['Lo dico in privato solo a uno', 35]], 'collaborazione'),
];

export const traits: Trait[] = ['affidabilita', 'onesta', 'collaborazione'];
export const questionById = (id: string, extra: Question[] = []) => bank.find((q) => q.id === id) ?? extra.find((q) => q.id === id);
export const questionsFor = (skill: string) => bank.filter((q) => q.skill === skill);
