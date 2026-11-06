/** Guide di riordino passo-passo (modulo PURO). Ogni passo è breve e si può fermare quando si vuole. */
export type GuideStep = { text: string; minutes: number; tip?: string };
export type Guide = { id: string; title: string; intro: string; room: string; steps: GuideStep[] };
export const GUIDES: Guide[] = [
  { id: 'guardaroba', title: 'Il guardaroba', intro: 'Tieni quello che usi e ti sta bene. Il resto trova una nuova casa.', room: 'camera', steps: [
    { text: 'Prepara quattro scatole o sacchi: tengo, regalo, riparo, butto', minutes: 5 }, { text: 'Svuota un solo cassetto o un solo ripiano sul letto', minutes: 5, tip: 'Un pezzo alla volta: non svuotare tutto l\'armadio.' },
    { text: 'Per ogni capo chiediti: l\'ho messo nell\'ultimo anno? Mi sta bene?', minutes: 15 }, { text: 'Metti i capi da tenere piegati in verticale, in modo da vederli tutti', minutes: 10 }, { text: 'Porta fuori subito il sacco da regalare e quello da buttare', minutes: 5, tip: 'Se resta in casa, ricomincia il disordine.' }, { text: 'Fai la foto del dopo e passa al ripiano successivo quando vuoi', minutes: 2 }] },
  { id: 'documenti', title: 'Documenti e carte', intro: 'Pochi posti chiari: da pagare, da tenere, da archiviare.', room: 'studio', steps: [
    { text: 'Raccogli tutte le carte sparse in un solo posto', minutes: 10 }, { text: 'Fai tre mucchi: da fare (scadenze), da archiviare, da buttare', minutes: 15 }, { text: 'Butta pubblicità e carte scadute; strappa quelle con dati personali', minutes: 10 }, { text: 'Metti i documenti importanti in una cartella con etichetta (casa, salute, lavoro, tasse)', minutes: 15, tip: 'Le fatture e i documenti fiscali si conservano per anni: se hai dubbi tienili.' }, { text: 'Fotografa o scansiona i documenti che ti servono sempre e salvali in LifeDrive', minutes: 15 }, { text: 'Segna nel Plan le scadenze che hai trovato', minutes: 5 }] },
  { id: 'cucina', title: 'Cucina e dispensa', intro: 'Meno cose, tutto a portata di mano, niente scadenze dimenticate.', room: 'cucina', steps: [
    { text: 'Svuota un solo ripiano della dispensa', minutes: 5 }, { text: 'Controlla le scadenze e butta quello che è scaduto', minutes: 10 }, { text: 'Raggruppa per tipo: pasta, scatolette, dolci, spezie', minutes: 10 }, { text: 'Sposta davanti quello che scade prima', minutes: 5 }, { text: 'Scrivi in LifeFitness → Frigo e spesa cosa manca', minutes: 5 }] },
  { id: 'bagno', title: 'Bagno e armadietto', intro: 'Solo quello che usi davvero, farmaci e cosmetici in ordine.', room: 'bagno', steps: [
    { text: 'Svuota l\'armadietto sul bordo del lavandino', minutes: 3 }, { text: 'Butta prodotti scaduti o finiti (per i farmaci scaduti usa la farmacia)', minutes: 10 }, { text: 'Raggruppa: igiene, farmaci, trucco, pulizia', minutes: 5 }, { text: 'Rimetti dentro solo quello che usi: il resto in una scatola', minutes: 7 }] },
  { id: 'cassetti', title: 'Il cassetto dei misteri', intro: 'Un solo cassetto, venti minuti: anche questo si può vincere.', room: 'soggiorno', steps: [
    { text: 'Svuota il cassetto su un tavolo', minutes: 3 }, { text: 'Butta quello che è rotto, vuoto o che non sai a cosa serva', minutes: 8 }, { text: 'Raggruppa le cose simili (cavi, pile, chiavi, penne)', minutes: 6 }, { text: 'Rimetti dentro con dei piccoli contenitori', minutes: 5 }] },
  { id: 'scrivania', title: 'La scrivania', intro: 'Un piano libero aiuta a iniziare a lavorare.', room: 'studio', steps: [
    { text: 'Togli tutto dal piano, tranne il computer', minutes: 3 }, { text: 'Pulisci il piano', minutes: 3 }, { text: 'Rimetti solo quello che usi ogni giorno', minutes: 5 }, { text: 'Il resto in un cassetto o in una scatola con etichetta', minutes: 8 }] },
  { id: 'ingresso', title: 'Ingresso e scarpe', intro: 'Un posto per le cose che entrano ed escono ogni giorno.', room: 'ingresso', steps: [
    { text: 'Prendi tutte le scarpe e le giacche che sono nell\'ingresso', minutes: 5 }, { text: 'Tieni fuori solo le cose di questa stagione', minutes: 8 }, { text: 'Decidi un posto fisso per chiavi, borsa e posta', minutes: 5 }] },
  { id: 'giochi', title: 'Giochi e cameretta', intro: 'Con i bambini: si fa insieme, si fa giocando.', room: 'cameretta', steps: [
    { text: 'Fai partire una canzone: finché dura, si raccolgono i giochi', minutes: 4 }, { text: 'Metti in una scatola i giochi rotti o troppo piccoli', minutes: 6 }, { text: 'Un contenitore per tipo: costruzioni, peluche, macchinine', minutes: 8 }, { text: 'Fai scegliere al bambino 3 giochi da regalare', minutes: 5 }] },
];
export const guideMinutes = (g: Guide): number => g.steps.reduce((n, s) => n + s.minutes, 0);
export const guideOf = (id: string): Guide | undefined => GUIDES.find((g) => g.id === id);
export const stepsDone = (g: Guide, done: number[]): number => Math.round((done.filter((i) => i >= 0 && i < g.steps.length).length / g.steps.length) * 100);
