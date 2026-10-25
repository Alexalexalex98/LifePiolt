import { dayKey, genSeries, monthLabelOf, pad2, shortDate, uid } from '@/lib/format';
import type { DriveFile, Goal, Note, Task, Automation, CalEvent } from '@/store/life';
import type { FinMonth, Insight, Bill, Movement } from '@/store/finance';

/** Dati d'esempio presi dal prototipo, usati solo se l'utente sceglie "Inizia con dati demo". */

const daysAgoKey = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const doneCounts = [0, 2, 1, 3, 0, 1, 2, 4, 1, 2, 3, 2, 0, 1, 3, 2, 4, 1, 3, 2, 3, 4]; // andamento in crescita
export const demoDoneTasks = (): Task[] => {
  const out: Task[] = [];
  const names = ['Rispondere alle email', 'Prenotare il tavolo per sabato', 'Controllare il budget del mese', 'Allenamento', 'Studiare spagnolo', 'Preparare la riunione', 'Mettere in ordine la scrivania', 'Pagare le bollette', 'Sistemare le note', 'Pianificare la settimana'];
  doneCounts.forEach((c, i) => { for (let k = 0; k < c; k++) out.push({ id: uid(), t: names[out.length % names.length], done: true, doneAt: daysAgoKey(doneCounts.length - 1 - i) }); });
  return out;
};
export const demoTasks = (): Task[] => [
  { id: uid(), t: 'Fare la spesa', done: false },
  { id: uid(), t: 'Prenotare il dentista', done: false },
  { id: uid(), t: 'Rinnovare l’assicurazione auto', done: false },
  { id: uid(), t: 'Preparare la riunione di lunedì', done: false },
];
const goalHist = (end: number, start: number) => Array.from({ length: 15 }, (_, i) => ({ d: daysAgoKey(14 - i), p: Math.round(start + ((end - start) * i) / 14) }));
export const demoGoals = (): Goal[] => [
  { id: uid(), t: 'Correre 10 km', p: 70, hist: goalHist(70, 52) }, { id: uid(), t: 'Imparare lo spagnolo', p: 72, hist: goalHist(72, 70) },
  { id: uid(), t: 'Risparmiare per le vacanze', p: 75, hist: goalHist(75, 60) }, { id: uid(), t: 'Leggere 12 libri', p: 50, hist: goalHist(50, 38) },
];
export const demoAutomations = (): Automation[] => [
  { id: uid(), t: 'Riepilogo ogni mattina', on: true }, { id: uid(), t: 'Bilancio settimanale', on: true },
];

const noteTexts: [string, number][] = [
  ["Riunione di lunedì alle 9:30: portare i numeri del mese e la lista delle cose rimaste aperte. Preparare tre slide al massimo e le domande da fare al responsabile sul calendario delle ferie.\n\nDa ricordare: confermare con Marco chi presenta la parte sul nuovo orario, e stampare l'ordine del giorno per chi non porta il portatile.", 9],
  ['Ricetta pasta al limone: 320 g di spaghetti, 2 limoni (buccia e succo), 40 g di burro, parmigiano, pepe nero. Sciogliere il burro, aggiungere la buccia, mantecare con un mestolo di acqua di cottura.\n\nVariante veloce per la sera: aggiungere una manciata di rucola e qualche gamberetto. Pronta in 15 minuti, piace anche ai bambini.', 8],
  ["Lista spesa: pane, uova, caffè, frutta, detersivo lavatrice. Passare anche in farmacia per il cambio filtri. Non dimenticare l'acqua frizzante.\n\nSe c'è tempo, passare anche dal ferramenta per le viti che mancano per la mensola del salotto, e controllare se hanno ancora la vernice usata l'ultima volta.", 7],
  ['Idee per le vacanze estive: Lisbona per una settimana a luglio, oppure il Portogallo del sud con un po\' di mare. Controllare i voli con anticipo e vedere se conviene un appartamento invece dell\'hotel.\n\nBudget indicativo: voli 450 CHF in due, alloggio 90 CHF a notte, 60 CHF al giorno per mangiare e muoversi. Decidere entro fine mese per prenotare a un buon prezzo.', 6],
  ["Spagnolo, parole della settimana: la sobremesa (il tempo a tavola dopo mangiato), quedar (darsi appuntamento), echar de menos (sentire la mancanza). Ripassare 10 minuti ogni sera.\n\nPer la prossima lezione: preparare tre frasi per ordinare al ristorante e una breve presentazione di sé. Provare a guardare un episodio di una serie con i sottotitoli in spagnolo.", 5],
  ["Promemoria: rinnovo dell'assicurazione auto in scadenza il 30 del mese. Chiedere un preventivo aggiornato e confrontarlo con almeno altre due offerte prima di rinnovare in automatico.\n\nL'anno scorso il premio è salito senza una spiegazione chiara: vale la pena controllare se conviene cambiare, o almeno chiedere uno sconto per gli anni senza incidenti.", 4],
  ['Programma corsa verso i 10 km: tre uscite a settimana, una lunga la domenica. Questa settimana 6 km piano, 5 km a ritmo medio, 8 km lungo il lago.\n\nSe il ginocchio dà fastidio, ridurre la distanza e fare stretching dopo. Comprare le scarpe nuove prima della gara di primavera e provarle su qualche uscita corta.', 3],
  ["Idee regalo per il compleanno di Giulia: un buono per un corso di cucina, un libro di ricette, oppure una gita in giornata sul lago. Decidere entro la prossima settimana.\n\nPer la mamma: una pianta da balcone e una cena insieme. Per Tommaso: il libro sulla corsa in montagna che aveva guardato in libreria.", 2],
  ["Appunti dalla visita medica: tutto nella norma, ripetere le analisi del sangue tra sei mesi. Consigliato camminare almeno 30 minuti al giorno e bere più acqua durante il lavoro in ufficio.\n\nChiedere alla cassa malati se il controllo dal dentista è coperto in parte, e conservare la ricevuta della visita.", 1],
  ["Libri da leggere quest'anno: un romanzo storico, una biografia, un giallo per l'estate e qualcosa sul sonno e le abitudini. Iniziare da quello più corto.\n\nObiettivo: 12 libri in dodici mesi, quindi uno al mese. Tenere il libro sul comodino e il telefono in un'altra stanza, così la lettura prima di dormire diventa un'abitudine.", 0],
];
export const demoNotes = (): Note[] => noteTexts.map(([text, ago]) => ({ id: uid(), text, date: shortDate(ago) }));

const driveRows: [string, string, string, number][] = [
  ['Contratto di affitto.pdf', '1.2 MB', 'Documenti', 8], ['Referto analisi sangue.pdf', '340 KB', 'Salute', 6], ['Ricevuta settembre.jpg', '2.1 MB', 'Ricevute', 4],
  ['Foto cena di famiglia.jpg', '3.4 MB', 'Foto', 5], ['Preventivo assicurazione auto.pdf', '260 KB', 'Documenti', 7], ['Contratto di lavoro.pdf', '480 KB', 'Lavoro', 9],
  ['Fattura dentista.pdf', '210 KB', 'Ricevute', 8], ['Referto cassa malati.pdf', '180 KB', 'Salute', 3],
  ['Foto terrazza in estate.jpg', '2.9 MB', 'Foto', 15], ['Foto gita sul lago.jpg', '4.1 MB', 'Foto', 14], ['Foto mezza maratona.jpg', '3.7 MB', 'Foto', 13],
  ['Foto pranzo con i colleghi.jpg', '2.4 MB', 'Foto', 12], ['Foto escursione in montagna.jpg', '3.1 MB', 'Foto', 4], ['Foto lago Lugano tramonto.jpg', '5.2 MB', 'Foto', 11],
  ['Foto compleanno di Giulia.jpg', '2.6 MB', 'Foto', 4], ['Foto casa nuova.jpg', '3.9 MB', 'Foto', 10], ['Foto torta fatta in casa.jpg', '2.2 MB', 'Foto', 9],
  ['Foto serata con gli amici.jpg', '4.5 MB', 'Foto', 2], ['Foto viaggio Zermatt.jpg', '6.1 MB', 'Foto', 1], ['Foto domenica al parco.jpg', '3.3 MB', 'Foto', 5],
  ['Foto weekend in famiglia.jpg', '2.7 MB', 'Foto', 0],
];
/** Nessun file o foto finta: LifeDrive mostra solo quello che carichi tu. I nomi servono a ripulire i file di prova rimasti da versioni precedenti. */
export const demoDrive = (): DriveFile[] => [];
const DEMO_DRIVE_NAMES = new Set(driveRows.map((r) => r[0]));
export const isFakeDriveFile = (f: { n: string; uri?: string }): boolean => !f.uri && DEMO_DRIVE_NAMES.has(f.n);

/** Plan dei prossimi 7 giorni: impegni quotidiani con fasce libere evidenti (pomeriggi e sere in parte vuoti). */
export const demoEvents = (): Record<string, CalEvent[]> => {
  const k = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };
  return {
    [k(0)]: [
      { time: '09:00', title: 'Allenamento' }, { time: '11:30', title: 'Riunione di team' },
      { time: '14:00', title: 'Lavoro concentrato' }, { time: '18:30', title: 'Bilancio della giornata' },
    ],
    [k(1)]: [
      { time: '08:00', title: 'Colazione con Marta' }, { time: '10:00', title: 'Visita medica' },
      { time: '12:00', title: 'Pranzo con Marco T.' }, { time: '15:00', title: 'Preparare la riunione di lunedì', dur: 90 },
      { time: '19:30', title: 'Cena in famiglia', dur: 120 },
    ],
    [k(2)]: [
      { time: '09:30', title: 'Corsa lungo il lago e colazione', dur: 120 }, { time: '11:30', title: 'Telefonata all’assicurazione' },
      { time: '14:30', title: 'Visita a un appartamento', dur: 90 }, { time: '20:30', title: 'Cena con Giulia', dur: 90 },
    ],
    [k(3)]: [
      { time: '08:00', title: 'Allenamento' }, { time: '13:00', title: 'Pranzo in famiglia', dur: 90 }, { time: '16:00', title: 'Spesa e commissioni' },
    ],
    [k(4)]: [
      { time: '11:30', title: 'Brunch con Tommaso', dur: 90 }, { time: '17:00', title: 'Studio dello spagnolo', dur: 60 },
    ],
    [k(5)]: [
      { time: '09:00', title: 'Allenamento' }, { time: '10:30', title: 'Riunione di team', dur: 90 },
      { time: '14:00', title: 'Lavoro concentrato', dur: 120 }, { time: '20:00', title: 'Telefonata ai genitori', dur: 30 },
    ],
    [k(6)]: [
      { time: '09:30', title: 'Colloquio con il responsabile', dur: 90 }, { time: '15:00', title: 'Appuntamento in banca' }, { time: '19:00', title: 'Partita a calcetto', dur: 90 },
    ],
    [k(7)]: [
      { time: '09:00', title: 'Allenamento' }, { time: '11:00', title: 'Bilancio della settimana' },
      { time: '14:00', title: 'Dentista' }, { time: '17:30', title: 'Aperitivo con i colleghi', dur: 90 },
    ],
  };
};

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

/** Costi di una persona sola in Svizzera (CHF, stipendio demo 3500). Le etichette seguono il formato "Categoria · dettaglio" del budget. */
type Spec = [day: number, label: string, amount: number];
const monthSpecs = (k: number): Spec[] => {
  // k = 0 mese corrente, 1 scorso, 2 due mesi fa: piccole variazioni realistiche
  const spesa = [[112.35, 98.9, 121.2, 99.6], [108.1, 103.45, 116.8, 94.3], [119.6, 91.75, 109.9, 101.2]][k];
  const el = [62, 58.4, 71.2][k];
  const extra: Spec[][] = [
    [], // mese corrente: solo le voci già avvenute
    [[13, 'Abbigliamento · Zara', 79.9], [24, 'Altro · Regalo compleanno', 45]],
    [[11, 'Abbigliamento · Scarpe running', 99], [19, 'Viaggio estero · Treno e hotel Milano', 136], [26, 'Altro · Visita dentista', 90]],
  ];
  return [
    [1, 'Stipendio', 3500], [2, 'Affitto', 1450], [3, 'Cassa malati', 480], [3, 'Abbonamenti · Palestra', 69],
    [4, 'Alimentari/Casa · Coop', spesa[0]], [5, 'Altro · Imposte accantonate', 150], [5, 'Fondo emergenza', 150],
    [6, 'Abbonamenti · Netflix', 15.9], [6, 'Abbonamenti · Spotify', 12.95], [7, 'Abbonamenti · Abbonamento trasporti', 85],
    [8, 'Alimentari/Casa · Elettricità', el], [9, 'Alimentari/Casa · Internet e telefono', 79],
    [11, 'Alimentari/Casa · Migros', spesa[1]], [12, 'Altro · Ristorante con amici', 42.5], [15, 'Altro · Benzina e parcheggi', 44.2],
    [18, 'Alimentari/Casa · Coop', spesa[2]], [19, 'Altro · Cinema e aperitivi', 54.3], [21, 'Alimentari/Casa · Assicurazione RC e economia domestica', 16],
    [22, 'Altro · Cena fuori', 56.8], [23, 'Alimentari/Casa · Migros', spesa[3]], [27, 'Altro · Trasporti e commissioni', 32.4],
    ...extra[k],
  ];
};

export const demoMonths = (): FinMonth[] => {
  const today = new Date().getDate();
  const build = (n: number): Movement[] => {
    const d = monthAgo(n);
    return monthSpecs(n)
      .filter(([day]) => n > 0 || day <= Math.max(today, 1))
      .sort((x, y) => x[0] - y[0])
      .map(([day, label, amount]) => mv(d, day, label, label === 'Stipendio' ? amount : -amount));
  };
  const mov = [build(0), build(1), build(2)];
  const net = (l: Movement[]) => l.reduce((a, x) => a + x.amount, 0);
  // sul conto ci sono 6000 CHF a oggi: si risale all'indietro, mese per mese
  const s0 = Math.round(6000 - net(mov[0])), s1 = Math.round(s0 - net(mov[1])), s2 = Math.round(s1 - net(mov[2]));
  return [
    { label: monthLabelOf(monthAgo(0)), start: s0, locked: false, movements: mov[0] },
    { label: monthLabelOf(monthAgo(1)), start: s1, locked: true, movements: mov[1] },
    { label: monthLabelOf(monthAgo(2)), start: s2, locked: true, movements: mov[2] },
  ];
};

export const demoInsights = (): Insight[] => [
  { id: 1, title: 'Abbonamento poco usato: Apple TV', detail: 'Non lo usi da 2 mesi.', saving: '67.24 CHF nei prossimi 7 mesi', dismissed: false },
  { id: 2, title: 'Shopping impulsivo: Amazon', detail: 'Hai speso più del solito questo mese.', saving: '125 CHF nei prossimi 2 mesi', dismissed: false },
];
export const demoBills = (): Bill[] => [
  { id: uid(), name: 'Affitto', amount: 1450, freq: 'monthly' }, { id: uid(), name: 'Cassa malati', amount: 480, freq: 'monthly' },
  { id: uid(), name: 'Elettricità', amount: 62, freq: 'monthly' }, { id: uid(), name: 'Internet e telefono', amount: 79, freq: 'monthly' },
  { id: uid(), name: 'Assicurazione RC e economia domestica', amount: 190, freq: 'yearly' }, { id: uid(), name: 'Serafe (canone radio-TV)', amount: 335, freq: 'yearly' },
  { id: uid(), name: 'Abbonamento trasporti', amount: 85, freq: 'monthly' }, { id: uid(), name: 'Abbonamento SBB metà-prezzo', amount: 185, freq: 'yearly' },
  { id: uid(), name: 'Palestra', amount: 69, freq: 'monthly' }, { id: uid(), name: 'Netflix', amount: 15.9, freq: 'monthly' }, { id: uid(), name: 'Spotify', amount: 12.95, freq: 'monthly' },
  { id: uid(), name: 'Imposte accantonate', amount: 150, freq: 'monthly' }, { id: uid(), name: 'Benzina o trasporti', amount: 60, freq: 'monthly' },
];
