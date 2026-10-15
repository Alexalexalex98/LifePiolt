/** Consigli di vita di Theia che compaiono ogni tanto nella Home, raggruppati per categoria. Se ne apprezzi uno, quella categoria esce più spesso. */
export type QuoteCat = 'Costanza' | 'Calma' | 'Relazioni' | 'Salute' | 'Coraggio' | 'Denaro' | 'Tempo' | 'Gratitudine';
export type Quote = { id: string; cat: QuoteCat; text: string };

const RAW: Record<QuoteCat, string[]> = {
  Costanza: ['Il progresso non è lineare: anche un piccolo passo oggi conta.', 'Non devi vedere tutta la scala, basta il primo gradino.', 'Ciò che fai ogni giorno pesa più di ciò che fai ogni tanto.', 'Cominciare male è meglio che non cominciare: si corregge strada facendo.', 'Una buona abitudine è un voto che dai ogni giorno alla persona che vuoi diventare.'],
  Calma: ['Respira: la maggior parte delle urgenze può aspettare cinque minuti.', 'Non tutto richiede una risposta subito. A volte la risposta migliore è dormirci su.', 'Una cosa alla volta: la mente lavora meglio quando non deve tenere tutto insieme.', 'Il silenzio non è tempo perso, è spazio per capire cosa ti serve.', 'Se oggi non è andata come speravi, domani è un foglio nuovo.'],
  Relazioni: ['Una domanda sincera vale più di cento consigli non richiesti.', 'Ascoltare davvero è uno dei regali più rari che puoi fare.', 'Scrivi a chi ti è venuto in mente oggi: probabilmente ne sarà contento.', 'Le persone ricordano come le hai fatte sentire, più di quello che hai detto.', 'Chiedere scusa presto costa meno che portarsi dietro il silenzio.'],
  Salute: ['Dormire bene non è un lusso: è la base di tutto il resto.', 'Una camminata di venti minuti cambia la giornata più di quanto pensi.', 'Bevi un bicchiere d’acqua adesso, poi continua quello che stavi facendo.', 'Il corpo ascolta quello che gli dai: movimento, sonno e cibo vero.', 'Prendersi cura di sé non è egoismo: è la condizione per aiutare gli altri.'],
  Coraggio: ['Fare una cosa con un po’ di paura è l’unico modo per farla davvero.', 'Un no ricevuto oggi è meglio di un sì mai chiesto.', 'Non serve essere pronti: serve cominciare e imparare per strada.', 'Gli errori sono la prova che ci hai provato.', 'Quello che temi spesso è più piccolo quando lo guardi in faccia.'],
  Denaro: ['Ciò che risparmi con calma oggi ti compra tranquillità domani.', 'Segnare le spese per un mese insegna più di mille consigli.', 'Prima di comprare, aspetta ventiquattro ore: se lo vuoi ancora, allora vale.', 'Un piccolo fondo per gli imprevisti toglie metà delle preoccupazioni.', 'Investi prima in ciò che ti fa crescere: competenze, salute, relazioni.'],
  Tempo: ['Il tempo che dedichi a ciò che conta non è mai sprecato.', 'Decidi le tre cose che contano oggi: il resto è un di più.', 'Meno cose, fatte meglio: la giornata ringrazia.', 'Proteggi un’ora al giorno solo per te, senza schermi.', 'Non cercare il tempo libero: mettilo in agenda come ogni altro impegno.'],
  Gratitudine: ['Pensa a tre cose buone di oggi, anche piccole: cambia lo sguardo con cui finisci la giornata.', 'Dire grazie a qualcuno costa trenta secondi e dura molto di più.', 'Quello che già hai è stato, un tempo, quello che desideravi.', 'Un caffè buono, una chiacchierata, una giornata di sole: contare le piccole cose è un allenamento.', 'Ringrazia chi ti ha aiutato senza che tu l’abbia notato.'],
};

export const QUOTE_CATS = Object.keys(RAW) as QuoteCat[];
export const QUOTES: Quote[] = QUOTE_CATS.flatMap((cat) => RAW[cat].map((text, i) => ({ id: `${cat}:${i}`, cat, text })));

/** Peso di una categoria: base 1, +2 per ogni consiglio apprezzato (massimo +10). */
export const catWeight = (likes: Record<string, number> | undefined, cat: string) => 1 + Math.min(10, (likes?.[cat] ?? 0) * 2);

/** Sceglie `n` consigli diversi, con più probabilità per le categorie apprezzate. Deterministico a parità di `seed`. */
export function pickQuotes(likes: Record<string, number> | undefined, n: number, seed: number): Quote[] {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pool = QUOTES.slice();
  const out: Quote[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, q) => a + catWeight(likes, q.cat), 0);
    let r = rnd() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= catWeight(likes, pool[i].cat); if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Quanti consigli mostrare: 2 di base, fino a 6 se ne apprezzi molti. */
export const quoteCount = (likes: Record<string, number> | undefined) => 2 + Math.min(4, Object.values(likes ?? {}).reduce((a, b) => a + Math.max(0, b), 0));

/** Aggiorna i "mi piace" per categoria (mai sotto zero). */
export function toggleQuoteLike(likes: Record<string, number> | undefined, liked: string[] | undefined, q: Quote): { likes: Record<string, number>; liked: string[]; on: boolean } {
  const has = (liked ?? []).includes(q.id);
  const cur = likes?.[q.cat] ?? 0;
  return {
    on: !has,
    liked: has ? (liked ?? []).filter((x) => x !== q.id) : [...(liked ?? []), q.id],
    likes: { ...(likes ?? {}), [q.cat]: Math.max(0, cur + (has ? -1 : 1)) },
  };
}
