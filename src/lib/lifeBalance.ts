/**
 * «La tua vita in un dato»: un unico punteggio (0-100) che mette insieme tutti i dati che l'app ha già (sonno, movimento, cuore, stress, mente,
 * cibo, soldi, organizzazione) e lo scompone in categorie, dicendo dove sei carente, perché e come migliorare. Modulo PURO: lavora sulle analisi
 * del motore (`computeDashboard().list`). Sono indicazioni generali, non un parere medico.
 */
import { attainment, type Analysis } from './analytics.ts';

export type BalanceLevel = 'ok' | 'attenzione' | 'carenza';
export type BalanceLine = { label: string; value: string; goal?: string; trend?: string; level: BalanceLevel };
export type BalanceCat = {
  id: string; label: string; /** da cosa è fatta (spiegazione breve) */ about: string; /** come si calcola, in parole semplici */ how: string; /** valori di riferimento */ ref: string; /** quanto pesa sul punteggio complessivo (1 = normale) */ weight: number;
  score: number; level: BalanceLevel; lines: BalanceLine[]; /** perché il punteggio è questo */ why: string; /** cosa fare, dal più utile */ tips: string[];
};
export type Balance = { score: number | null; level: BalanceLevel; headline: string; cats: BalanceCat[]; weakest: BalanceCat[]; missing: string[] };

export const levelOf = (score: number): BalanceLevel => (score >= 75 ? 'ok' : score >= 50 ? 'attenzione' : 'carenza');

type CatDef = { id: string; label: string; about: string; how: string; ref: string; metrics: string[]; weight: number };
export const CATS: CatDef[] = [
  { id: 'sonno', label: 'Sonno', about: 'Quanto dormi, in media, rispetto alle 7-9 ore consigliate.', how: 'Media delle ultime 7 notti. 100 se stai tra 7 e 9 ore, più ti allontani, più scende.', ref: '7-9 ore a notte.', metrics: ['sleep'], weight: 1.5 },
  { id: 'movimento', label: 'Movimento', about: 'Passi, minuti di esercizio, calorie attive e allenamenti.', how: 'Per ogni dato (passi, distanza, piani, esercizio, energia attiva, allenamenti) si confronta la media di 7 giorni con l\'obiettivo. Il punteggio è la media dei dati che hai.', ref: '10.000 passi, 30 minuti di esercizio, 400 kcal attive, 3 allenamenti a settimana.', metrics: ['steps', 'distance', 'flights', 'exercise', 'energy', 'training'], weight: 1.5 },
  { id: 'cuore', label: 'Cuore e recupero', about: 'Battito a riposo, HRV, ossigeno e forma fisica: dicono quanto il corpo recupera.', how: 'Media di 7 giorni di battito a riposo (più basso è meglio), HRV, ossigeno e respiri al minuto rispetto ai valori sani. Servono dati da orologio o inseriti a mano.', ref: 'Ossigeno 95-100%, respiri 12-20 al minuto. Battito e HRV migliorano nel tempo.', metrics: ['hr', 'hrv', 'vo2', 'spo2', 'resp'], weight: 1.0 },
  { id: 'stress', label: 'Stress', about: 'Livello di stress stimato da battito e HRV.', how: 'Media di 7 giorni dello stress (0-100, stimato da battito e HRV o inserito da te). 100 se resta sotto 45 (sopra, il punteggio scende).', ref: 'Sotto 45 su 100.', metrics: ['stress'], weight: 1.2 },
  { id: 'mente', label: 'Mente e umore', about: 'Umore dei check-in e minuti di mindfulness.', how: 'Umore dei tuoi check-in (da 1 a 5) rispetto a 3,5 e minuti di mindfulness al giorno rispetto a 10: media dei due.', ref: 'Umore almeno 3,5 su 5 e 10 minuti di mindfulness al giorno.', metrics: ['mood', 'mindful'], weight: 1.2 },
  { id: 'relazioni', label: 'Relazioni', about: 'Con quante persone parli ogni giorno: le relazioni sono tra i fattori che pesano di più sul benessere e sulla salute a lungo termine.', how: 'Media di 7 giorni delle persone con cui parli ogni giorno: quelle a cui scrivi nelle chat e, se vuoi, quelle che inserisci a mano. Obiettivo: almeno 3 al giorno.', ref: 'Almeno 3 persone al giorno.', metrics: ['social'], weight: 1.0 },
  { id: 'cibo', label: 'Alimentazione', about: 'Qualità di quello che mangi (calorie, proteine, fibre, zuccheri, sale).', how: 'Punteggio di qualità dei pasti registrati in LifeFitness (calorie, proteine, fibre, zuccheri, grassi saturi, sale — il cibo spazzatura lo abbassa), rispetto a 85.', ref: '85 su 100 o più.', metrics: ['diet'], weight: 0.9 },
  { id: 'soldi', label: 'Soldi e serenità', about: 'Risparmio, saldo e spese: i soldi pesano sulla testa più di quanto sembri.', how: 'Tasso di risparmio degli ultimi mesi rispetto al 20% del reddito, insieme a saldo e spese del mese.', ref: 'Risparmio almeno il 20% di quanto entra.', metrics: ['savings', 'balance', 'spending', 'dailyspend'], weight: 0.6 },
];

const num = (v: number, dec: number) => String(Math.round(v * 10 ** dec) / 10 ** dec).replace('.', ',');
const val = (a: Analysis) => (a.def.period === 'day' ? a.avg7 : a.latest.v);

function trendText(a: Analysis): string | undefined {
  if (a.deltaPct == null || !a.significant) return undefined;
  if (Math.abs(a.deltaPct) < 5) return 'stabile rispetto alla settimana scorsa';
  const up = a.deltaPct > 0;
  const good = a.def.better === 'down' ? !up : a.def.better === 'range' || a.def.better === 'none' ? undefined : up;
  const how = up ? 'in aumento' : 'in calo';
  return `${how} del ${Math.round(Math.abs(a.deltaPct))}% rispetto alla settimana scorsa${good === undefined ? '' : good ? ' (bene)' : ' (da guardare)'}`;
}

function goalText(a: Analysis): string | undefined {
  const d = a.def;
  if (d.better === 'range' && d.range) return `${num(d.range[0], d.dec)}-${num(d.range[1], d.dec)} ${d.unit}`;
  if (d.target == null) return undefined;
  return `${d.better === 'down' ? 'al massimo' : 'almeno'} ${num(d.target, d.dec)} ${d.unit}`;
}

/** Cosa fare per ogni metrica quando è sotto la soglia (o fuori dall'intervallo). Frasi brevi e concrete. */
const TIPS: Record<string, { low?: string[]; high?: string[] }> = {
  sleep: {
    low: ['Fissa un orario per andare a letto e uno per alzarti, anche nel weekend: la regolarità conta quanto le ore.', 'Spegni gli schermi 30-60 minuti prima di dormire e tieni la camera fresca e buia.', 'Niente caffeina dopo le 14 e pasti pesanti a ridosso della notte.'],
    high: ['Dormire molto più di 9 ore in modo costante può indicare stanchezza accumulata: guarda anche stress e movimento.'],
  },
  steps: { low: ['Aggiungi una camminata di 15-20 minuti dopo pranzo: sono circa 2.000 passi.', 'Prendi le scale e scendi una fermata prima: i piccoli tratti si sommano.'] },
  exercise: { low: ['Punta a 30 minuti di movimento al giorno, anche spezzati in 3 da 10.', 'Metti un allenamento fisso in agenda e scegli quello che ti piace davvero.'] },
  energy: { low: ['Più movimento nella giornata fa salire le calorie attive: alterna lavoro seduto e pause in piedi.'] },
  training: { low: ['Prova 3 allenamenti a settimana, anche corti: meglio costanti che pesanti e rari.'] },
  hr: { high: ['Un battito a riposo alto può dipendere da stress, poco sonno, caffeina o poco allenamento: lavora prima su sonno e movimento leggero costante.'] },
  hrv: { low: ['La HRV sale con sonno regolare, allenamento aerobico moderato e respirazione lenta: prova 5 minuti di respiro lento ogni sera.', 'Meno alcol e cene tardive aiutano il recupero notturno.'] },
  vo2: { low: ['La forma aerobica migliora con 2-3 uscite a settimana di cammino veloce, corsa leggera o bici.'] },
  distance: { low: ['Una camminata veloce di 30-40 minuti sono circa 3-4 km: aggiungila alla routine.'] },
  flights: { low: ['Scegli le scale al posto dell\'ascensore quando puoi: ogni piano conta.'] },
  resp: { high: ['Un respiro più veloce a riposo può dipendere da stress o poco allenamento: prova 5 minuti di respiro lento.'], low: ['Un respiro molto lento a riposo va guardato insieme al resto: se hai sintomi, parlane con il medico.'] },
  spo2: { low: ['Un livello di ossigeno basso va controllato: se è ripetuto o hai sintomi, parlane con il medico.'] },
  stress: { high: ['Fai 3-5 minuti di respirazione lenta (4 secondi dentro, 6 fuori) nei momenti di picco.', 'Blocca nel Plan almeno una pausa vera al giorno, senza telefono.', 'Scrivi in «Mente» che pensiero ti pesa di più e scegli un solo passo piccolo.', 'Muoviti: una camminata riduce la tensione più di scrollare il telefono.'] },
  mood: { low: ['Fai il check-in dell\'umore ogni giorno: aiuta a vedere cosa lo alza o lo abbassa.', 'Pianifica una cosa piacevole al giorno, anche piccola, e una persona da sentire questa settimana.'] },
  mindful: { low: ['Bastano 5-10 minuti al giorno di respiro o meditazione: scegli un orario fisso, per esempio dopo il caffè.'] },
  diet: { low: ['Aumenta verdura, legumi e frutta intera; riduci bibite, dolci e fritti.', 'Registra i pasti per qualche giorno: l\'Approfondimento in LifeFitness ti dice quali nutrienti ti mancano.'] },
  savings: { low: ['Metti da parte una quota fissa appena entra lo stipendio, prima di spendere.', 'Controlla gli abbonamenti che non usi.'] },
  balance: { low: ['Rivedi le spese variabili del mese: il saldo è in calo più del previsto.'] },
  spending: { high: ['Guarda la categoria di spesa che cresce di più e fissa un tetto per le prossime due settimane.'] },
  dailyspend: { high: ['Scegli due giorni a settimana «a spesa zero» per riportare la media giornaliera giù.'] },
  social: { low: ['Scrivi o chiama oggi una persona a cui tieni: bastano due minuti.', 'Fissa nel Plan un caffè o una passeggiata con qualcuno questa settimana.', 'Le relazioni contano molto: anche poche persone, ma sentite spesso, fanno la differenza.'] },
  tasks: { low: ['Scegli ogni mattina le 3 cose che contano e fai prima la più difficile.', 'Spezza le task grandi in passi da 10 minuti.'] },
};

const lowSide = (a: Analysis) => (a.def.better === 'down' ? false : a.def.better === 'range' && a.def.range ? val(a) > a.def.range[1] ? false : true : true);

function lineOf(a: Analysis): BalanceLine {
  const s = attainment(a.def, val(a));
  const level: BalanceLevel = s == null ? (a.status === 'bad' ? 'carenza' : a.status === 'warn' ? 'attenzione' : 'ok') : levelOf(s);
  return { label: a.def.label, value: `${num(val(a), a.def.dec)} ${a.def.unit}`.trim() + (a.def.period === 'day' ? ' (media 7 giorni)' : ''), goal: goalText(a), trend: trendText(a), level };
}

/** Costruisce il quadro: categorie con i dati che ci sono, punteggio complessivo, i punti deboli in ordine. */
export function buildBalance(list: Analysis[]): Balance {
  const by: Record<string, Analysis> = {};
  list.forEach((a) => { by[a.def.id] = a; });
  const cats: BalanceCat[] = [];
  const missing: string[] = [];
  const weights: Record<string, number> = {};
  for (const c of CATS) {
    const items = c.metrics.map((m) => by[m]).filter((a): a is Analysis => !!a && a.ageDays <= 14);
    const scored = items.map((a) => ({ a, s: attainment(a.def, val(a)) })).filter((x): x is { a: Analysis; s: number } => x.s != null);
    if (!scored.length) { missing.push(c.label); continue; }
    const score = Math.round(scored.reduce((x, y) => x + y.s, 0) / scored.length);
    const weak = [...scored].sort((p, q) => p.s - q.s).filter((x) => x.s < 75);
    const tips: string[] = [];
    for (const w of weak) { const t = TIPS[w.a.def.id]; const set = t ? (lowSide(w.a) ? t.low ?? t.high : t.high ?? t.low) : undefined; if (set) tips.push(...set.slice(0, w.s < 50 ? 3 : 2)); }
    if (!weak.length) tips.push('Sei in linea: mantieni le abitudini che stai già seguendo.');
    const lines = items.map(lineOf);
    const worst = weak[0];
    const why = worst
      ? `${worst.a.def.label} è il punto più debole: ${num(val(worst.a), worst.a.def.dec)} ${worst.a.def.unit}${goalText(worst.a) ? ` contro un obiettivo di ${goalText(worst.a)}` : ''}.`
      : 'Tutti i dati di questa categoria sono nei valori consigliati.';
    cats.push({ id: c.id, label: c.label, about: c.about, how: c.how, ref: c.ref, weight: c.weight, score, level: levelOf(score), lines, why, tips: [...new Set(tips)].slice(0, 6) });
    weights[c.id] = c.weight;
  }
  if (!cats.length) return { score: null, level: 'attenzione', headline: 'Non ho ancora abbastanza dati: collega Apple Health o registra sonno, umore e pasti per qualche giorno.', cats: [], weakest: [], missing };
  const wsum = cats.reduce((x, c) => x + weights[c.id], 0);
  const score = Math.round(cats.reduce((x, c) => x + c.score * weights[c.id], 0) / wsum);
  const weakest = [...cats].filter((c) => c.score < 75).sort((a, b) => a.score - b.score);
  const names = weakest.slice(0, 2).map((c) => c.label.toLowerCase());
  const headline = !weakest.length
    ? 'La tua vita è in equilibrio: tutte le categorie sono nei valori consigliati.'
    : `Il punto più debole è ${names[0]}${names[1] ? `, poi ${names[1]}` : ''}: lavorare lì è ciò che alza di più il punteggio.`;
  return { score, level: levelOf(score), headline, cats, weakest, missing };
}
