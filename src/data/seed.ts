import { dayKey, genSeries, monthLabelOf, pad2, shortDate, uid } from '@/lib/format';
import type { DriveFile, Goal, Note, Task, Automation, CalEvent } from '@/store/life';
import type { FinMonth, Insight, Bill } from '@/store/finance';

/** Dati d'esempio presi dal prototipo, usati solo se l'utente sceglie "Inizia con dati demo". */

export const demoTasks = (): Task[] => [
  { id: uid(), t: 'Completare architettura prodotto', done: false },
  { id: uid(), t: 'Review dashboard', done: false },
  { id: uid(), t: '30 min di studio', done: false },
];
export const demoGoals = (): Goal[] => [
  { id: uid(), t: 'LifePilot MVP', p: 70 }, { id: uid(), t: 'Tedesco C1', p: 72 }, { id: uid(), t: 'Fitness 4× settimana', p: 75 },
];
export const demoAutomations = (): Automation[] => [
  { id: uid(), t: 'Briefing ogni mattina', on: true }, { id: uid(), t: 'Review settimanale', on: true },
];

const noteTexts: [string, number][] = [
  ["Riunione fornitori AURA rimandata a giovedì alle 15:00. Devo preparare il confronto prezzi tra i tre fornitori PCB e la disponibilità di stock per l'early-bird. Portare anche i dati sui tempi di consegna, perché uno dei tre ha margini molto più stretti degli altri e potrebbe diventare un collo di bottiglia se la campagna va oltre le aspettative.\n\nDa chiedere esplicitamente: garanzie sui tempi di consegna in caso di picco ordini, possibilità di uno stock minimo di sicurezza tenuto in Svizzera, e condizioni di pagamento a 30/60/90 giorni. Portare anche le specifiche aggiornate del sensore per evitare fraintendimenti come l'ultima volta.", 9],
  ['Nome possibile per il secondo prodotto Life: LifeGuard oppure Vero. Da testare con un piccolo sondaggio informale prima di deciderlo. Deve suonare bene sia in italiano che in inglese, e non deve scontrarsi con marchi già registrati in Svizzera o UE.\n\nAltre opzioni emerse durante il brainstorming: LifeShield, Custode, Sentinel. Nessuna convince del tutto. Vero ha il vantaggio di essere corto e facile da pronunciare in più lingue, ma va verificato se il dominio è libero.', 8],
  ["Lista spesa: pane, uova, caffè, frutta, detersivo lavatrice. Passare anche in farmacia per il cambio filtri. Non dimenticare l'acqua frizzante.\n\nSe c'è tempo, passare anche dal ferramenta per le viti che mancano per il supporto del monitor in ufficio, e controllare se hanno ancora la vernice usata l'ultima volta per il locale.", 7],
  ['Bozza ritornello nuova canzone Dæmon: parla di maschere che diventano volti veri. Il tono deve restare cupo ma non teatrale. Provare ad abbassare il registro nella seconda strofa.\n\nIdea per il bridge: un cambio di ritmo più lento, quasi sussurrato, prima di tornare al ritornello con un arrangiamento più pieno. Da provare in studio con la nuova interfaccia audio prima di fissare la struttura definitiva.', 6],
  ["Contatti raccolti alla fiera tech di Zurigo: tre potenziali investitori interessati ad AURA e un fornitore di sensori più economico del nostro attuale. Da richiamare entro fine settimana, prima che si raffreddi l'interesse.\n\nUno dei tre investitori lavora già con altre startup hardware svizzere e potrebbe portare anche contatti utili per la parte di produzione, non solo capitale. Da preparare un pitch deck aggiornato prima della chiamata.", 5],
  ["Promemoria: rinnovo assicurazione del locale Élite Caffè scade il 30 settembre. Chiedere anche un preventivo aggiornato con la nuova polizza per i danni da terzi.\n\nConfrontare almeno due-tre offerte diverse prima di rinnovare automaticamente con lo stesso broker: l'anno scorso il premio è salito senza una spiegazione chiara, vale la pena verificare se conviene cambiare.", 4],
  ['Feedback dei beta tester su LifePilot: apprezzano molto il calendario collegato alle finanze, ma vogliono notifiche push vere. Due persone hanno chiesto una modalità offline.\n\nUn tester ha anche segnalato che la dashboard è troppo densa su schermi piccoli e vorrebbe poter nascondere le card che non usa. Da tenere in considerazione per la prossima iterazione del prototipo.', 3],
  ['Idee regalo compleanno: cuffie da studio, un buono per un corso di fotografia, oppure qualcosa legato alla musica. Decidere entro la prossima settimana.\n\nSe si opta per le cuffie, meglio chiedere prima quale modello usa già in studio per non regalarne uno doppione. Il corso di fotografia potrebbe essere l\'opzione più originale delle tre.', 2],
  ['Appunti dal colloquio con il potenziale socio per il reparto hardware: esperienza in elettronica di consumo, disponibile part-time da novembre. Chiedere referenze prima di procedere.\n\nBuona impressione generale, ma serve capire meglio le aspettative economiche prima di fare una proposta concreta. Da programmare un secondo incontro con anche qualcun altro del team presente.', 1],
  ["Libri da leggere quest'anno: un libro sul trading di materie prime, una biografia imprenditoriale, e qualcosa di narrativa per staccare. Iniziare da quello più corto.\n\nChiedere consiglio anche a chi lavora già nel trading per capire se ci sono testi più tecnici e aggiornati rispetto ai classici che si trovano di solito nelle liste generiche online.", 0],
];
export const demoNotes = (): Note[] => noteTexts.map(([text, ago]) => ({ id: uid(), text, date: shortDate(ago) }));

const driveRows: [string, string, string, number][] = [
  ['Contratto locazione.pdf', '1.2 MB', 'Documenti', 8], ['Referto analisi sangue.pdf', '340 KB', 'Salute', 6], ['Ricevuta settembre.jpg', '2.1 MB', 'Ricevute', 4],
  ['Foto locale Élite Caffè.jpg', '3.4 MB', 'Foto', 5], ['Pitch deck AURA v3.pdf', '5.6 MB', 'Business', 7], ['Foto team fiera Zurigo.jpg', '2.8 MB', 'Foto', 4],
  ['Fattura fornitore PCB.pdf', '210 KB', 'Ricevute', 8], ['Referto cassa malati.pdf', '180 KB', 'Salute', 3],
  ['Foto vetrina Élite Caffè estate.jpg', '2.9 MB', 'Foto', 15], ['Foto prototipo AURA v2.jpg', '4.1 MB', 'Foto', 14], ['Foto backstage shooting Dæmon.jpg', '3.7 MB', 'Foto', 13],
  ['Foto riunione team Life SA.jpg', '2.4 MB', 'Foto', 12], ['Foto stand fiera tech Zurigo.jpg', '3.1 MB', 'Foto', 4], ['Foto lago Lugano tramonto.jpg', '5.2 MB', 'Foto', 11],
  ['Foto pranzo con investitori.jpg', '2.6 MB', 'Foto', 4], ['Foto sopralluogo nuovo locale.jpg', '3.9 MB', 'Foto', 10], ['Foto packaging AURA campione.jpg', '2.2 MB', 'Foto', 9],
  ['Foto serata lancio Élite Caffè.jpg', '4.5 MB', 'Foto', 2], ['Foto viaggio Zermatt.jpg', '6.1 MB', 'Foto', 1], ['Foto studio registrazione.jpg', '3.3 MB', 'Foto', 5],
  ['Foto weekend in famiglia.jpg', '2.7 MB', 'Foto', 0],
];
export const demoDrive = (): DriveFile[] => driveRows.map(([n, s, folder, ago]) => ({ id: uid(), n, s, folder, date: shortDate(ago) }));

export const demoEvents = (): Record<string, CalEvent[]> => ({
  [dayKey()]: [
    { time: '09:00', title: 'Allenamento' }, { time: '11:30', title: 'Meeting team' },
    { time: '14:00', title: 'Deep work' }, { time: '18:30', title: 'Review giornata' },
  ],
});

export const demoHealth = () => ({
  series: {
    sleep: genSeries('sleep', 7.2, 14, 0.08).map((v, i, a) => (i >= a.length - 3 ? Math.max(v, 7.1) : v)),
    hr: genSeries('hr', 58, 14, 0.05),
    steps: genSeries('steps', 8200, 14, 0.25).map((v, i, a) => (i >= a.length - 3 ? Math.max(v, 10200) : v)),
    weight: genSeries('weight', 78, 14, 0.012),
    stress: genSeries('stress', 35, 14, 0.3),
    hrv: genSeries('hrv', 54, 14, 0.08),
    mindful: genSeries('mindful', 8, 14, 0.4),
  },
  workouts: [
    { id: uid(), type: 'Corsa', date: shortDate(1), duration: 32, calories: 310 },
    { id: uid(), type: 'Palestra', date: shortDate(3), duration: 55, calories: 420 },
    { id: uid(), type: 'Yoga', date: shortDate(5), duration: 25, calories: 120 },
  ],
  mindSessions: [
    { id: uid(), type: 'Respirazione', date: shortDate(1), duration: 5 },
    { id: uid(), type: 'Meditazione', date: shortDate(4), duration: 10 },
  ],
  moods: [{ date: shortDate(1), mood: 'Calmo' }, { date: shortDate(3), mood: 'Stressato' }, { date: shortDate(5), mood: 'Felice' }],
});

function monthAgo(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}
const mv = (d: Date, day: number, label: string, amount: number) => ({ date: `${pad2(day)}/${pad2(d.getMonth() + 1)}`, label, amount });

export const demoMonths = (): FinMonth[] => {
  const m0 = monthAgo(0), m1 = monthAgo(1), m2 = monthAgo(2);
  const today = new Date().getDate();
  const cur = [
    mv(m0, 1, 'Stipendio', 6500), mv(m0, 3, 'Affitto', -1528), mv(m0, 5, 'Cassa malati', -458.4), mv(m0, 7, 'Alimentari/Casa', -152.8),
    mv(m0, 7, 'Alimentari/Casa', -152.8), mv(m0, 9, 'Abbigliamento', -191), mv(m0, 10, 'Viaggio estero', -305.6), mv(m0, 12, 'Fondo emergenza', -382),
    mv(m0, 13, 'Abbonamenti', -95.5), mv(m0, 14, 'Altro', -553.9),
  ].filter((x) => parseInt(x.date) <= Math.max(today, 1));
  return [
    { label: monthLabelOf(m0), start: 11600, locked: false, movements: cur },
    {
      label: monthLabelOf(m1), start: 9700, locked: true,
      movements: [mv(m1, 1, 'Stipendio', 6500), mv(m1, 4, 'Affitto', -1840), mv(m1, 6, 'Cassa malati', -552), mv(m1, 8, 'Alimentari/Casa', -368), mv(m1, 11, 'Abbigliamento', -230), mv(m1, 13, 'Viaggio estero', -368), mv(m1, 16, 'Fondo emergenza', -460), mv(m1, 19, 'Abbonamenti', -115), mv(m1, 22, 'Altro', -667)],
    },
    {
      label: monthLabelOf(m2), start: 7500, locked: true,
      movements: [mv(m2, 1, 'Stipendio', 6500), mv(m2, 3, 'Affitto', -1720), mv(m2, 5, 'Cassa malati', -516), mv(m2, 7, 'Alimentari/Casa', -344), mv(m2, 9, 'Abbigliamento', -215), mv(m2, 12, 'Viaggio estero', -344), mv(m2, 15, 'Fondo emergenza', -430), mv(m2, 18, 'Abbonamenti', -107.5), mv(m2, 21, 'Altro', -623.5)],
    },
  ];
};

export const demoInsights = (): Insight[] => [
  { id: 1, title: 'Abbonamento poco usato: Apple TV', detail: 'Non lo usi da 2 mesi.', saving: '67.24 CHF nei prossimi 7 mesi', dismissed: false },
  { id: 2, title: 'Shopping impulsivo: Amazon', detail: 'Hai speso più del solito questo mese.', saving: '125 CHF nei prossimi 2 mesi', dismissed: false },
];
export const demoBills = (): Bill[] => [
  { id: uid(), name: 'Affitto', amount: 1450, freq: 'monthly' }, { id: uid(), name: 'Cassa malati', amount: 310, freq: 'monthly' },
  { id: uid(), name: 'Abbonamento SBB', amount: 185, freq: 'yearly' },
];
