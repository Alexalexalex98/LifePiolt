/**
 * Analisi fondamentale (modulo PURO): dai dati di bilancio che hai (scritti a mano o in arrivo da un fornitore di dati)
 * calcola multipli, margini, solidità e un valore stimato con scenario di flussi di cassa.
 * I numeri di bilancio NON li inventiamo: se un dato manca, l'indicatore resta vuoto e lo diciamo.
 * Importi assoluti in milioni, valori «per azione» e prezzo nella stessa valuta del titolo.
 */
export type Facts = {
  eps?: number; bvps?: number; fcfps?: number; dps?: number;
  revenue?: number; netIncome?: number; opIncome?: number; equity?: number; debt?: number; cash?: number; interest?: number;
  revGrowth?: number; epsGrowth?: number; /** % */ roe?: number;
  /** vecchi campi inseriti a mano */ pe?: number; div?: number;
};
export const FACT_FIELDS: { key: keyof Facts; label: string; group: 'Valutazione' | 'Redditività' | 'Crescita' | 'Solidità'; hint: string }[] = [
  { key: 'eps', label: 'Utile per azione', group: 'Valutazione', hint: 'EPS, in valuta' },
  { key: 'bvps', label: 'Patrimonio per azione', group: 'Valutazione', hint: 'valore contabile per azione' },
  { key: 'fcfps', label: 'Flusso di cassa libero per azione', group: 'Valutazione', hint: 'FCF per azione' },
  { key: 'dps', label: 'Dividendo per azione', group: 'Valutazione', hint: 'annuo' },
  { key: 'revenue', label: 'Ricavi (milioni)', group: 'Redditività', hint: 'ultimo anno' },
  { key: 'opIncome', label: 'Utile operativo (milioni)', group: 'Redditività', hint: 'EBIT' },
  { key: 'netIncome', label: 'Utile netto (milioni)', group: 'Redditività', hint: 'ultimo anno' },
  { key: 'equity', label: 'Patrimonio netto (milioni)', group: 'Redditività', hint: 'capitale proprio' },
  { key: 'revGrowth', label: 'Crescita ricavi % annua', group: 'Crescita', hint: 'media degli ultimi anni' },
  { key: 'epsGrowth', label: 'Crescita utili % annua', group: 'Crescita', hint: 'media degli ultimi anni' },
  { key: 'debt', label: 'Debito totale (milioni)', group: 'Solidità', hint: 'finanziario' },
  { key: 'cash', label: 'Liquidità (milioni)', group: 'Solidità', hint: 'cassa e equivalenti' },
  { key: 'interest', label: 'Interessi pagati (milioni)', group: 'Solidità', hint: 'ultimo anno' },
];
const r2 = (n: number) => Math.round(n * 100) / 100;
const ok = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const pos = (n: number | undefined): n is number => ok(n) && n > 0;

export type Metrics = {
  pe: number | null; earningsYield: number | null; pb: number | null; pfcf: number | null; divYield: number | null; payout: number | null; peg: number | null;
  grossless: null; opMargin: number | null; netMargin: number | null; roe: number | null; debtEquity: number | null; netDebt: number | null; coverage: number | null; graham: number | null; grahamRatio: number | null;
};
const n = (v: number | null) => (v === null || !Number.isFinite(v) ? null : r2(v));
/** Multipli, margini e solidità dal prezzo e dai dati. */
export function metrics(price: number, f: Facts): Metrics {
  const eps = f.eps, pe = pos(eps) && price > 0 ? price / eps : pos(f.pe) ? f.pe : null;
  const gr = pos(f.eps) && pos(f.bvps) ? Math.sqrt(22.5 * f.eps * f.bvps) : null;
  return {
    pe: n(pe), earningsYield: pos(eps) && price > 0 ? n((eps / price) * 100) : null,
    pb: pos(f.bvps) && price > 0 ? n(price / f.bvps) : null, pfcf: pos(f.fcfps) && price > 0 ? n(price / f.fcfps) : null,
    divYield: ok(f.dps) && f.dps >= 0 && price > 0 && f.dps > 0 ? n((f.dps / price) * 100) : pos(f.div) ? f.div : null,
    payout: pos(f.dps) && pos(eps) ? n((f.dps / eps) * 100) : null,
    peg: pe !== null && pos(f.epsGrowth) ? n(pe / f.epsGrowth) : null,
    grossless: null,
    opMargin: pos(f.revenue) && ok(f.opIncome) ? n((f.opIncome / f.revenue) * 100) : null,
    netMargin: pos(f.revenue) && ok(f.netIncome) ? n((f.netIncome / f.revenue) * 100) : null,
    roe: pos(f.equity) && ok(f.netIncome) ? n((f.netIncome / f.equity) * 100) : ok(f.roe) ? f.roe : null,
    debtEquity: pos(f.equity) && ok(f.debt) ? n(f.debt / f.equity) : null,
    netDebt: ok(f.debt) && ok(f.cash) ? n(f.debt - f.cash) : null,
    coverage: pos(f.interest) && ok(f.opIncome) ? n(f.opIncome / f.interest) : null,
    graham: gr === null ? null : n(gr), grahamRatio: gr !== null && gr > 0 && price > 0 ? n(price / gr) : null,
  };
}

/** Valori tipici (indicativi) del rapporto prezzo/utili per settore: servono per dare un contesto, cambiano nel tempo. */
export const TYPICAL_PE: Record<string, [number, number]> = {
  Tecnologia: [22, 35], Software: [28, 50], Semiconduttori: [18, 35], Banche: [8, 14], Finanza: [12, 20], Pagamenti: [20, 32], Salute: [15, 26], Energia: [8, 15],
  Commercio: [18, 30], 'Beni di consumo': [18, 26], Bevande: [20, 27], Ristorazione: [20, 28], Auto: [6, 15], Industria: [16, 24], Difesa: [16, 24], Aerospazio: [18, 30],
  Telecomunicazioni: [8, 14], Intrattenimento: [18, 32], Media: [8, 15], Viaggi: [16, 28], Logistica: [12, 20], Abbigliamento: [18, 28], Lusso: [20, 32], Sicurezza: [40, 80],
};
export const typicalPe = (sector: string): [number, number] => TYPICAL_PE[sector] ?? [12, 25];

export type Pillar = { id: 'valutazione' | 'redditivita' | 'crescita' | 'solidita'; label: string; score: number | null; verdict: string; points: string[]; used: number };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lin = (v: number, bad: number, good: number) => clamp01((v - bad) / (good - bad)) * 100;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const verdictOf = (s: number | null, hi: string, mid: string, lo: string) => (s === null ? 'dati mancanti' : s >= 66 ? hi : s >= 40 ? mid : lo);

/** Quattro «pagelle» da 0 a 100 dai dati che ci sono. Non sono un voto al titolo: dicono dove il bilancio è forte o debole. */
export function pillars(price: number, f: Facts, sector = ''): Pillar[] {
  const m = metrics(price, f);
  const [lo, hi] = typicalPe(sector);
  const val: number[] = [], valP: string[] = [];
  if (m.pe !== null) { val.push(m.pe <= lo ? 90 : m.pe >= hi * 1.4 ? 15 : lin(hi - m.pe, -hi * 0.4, hi - lo) * 0.8 + 10); valP.push(`P/E ${m.pe}: ${m.pe < lo ? 'sotto' : m.pe > hi ? 'sopra' : 'dentro'} i valori tipici del settore (${lo}–${hi})`); }
  if (m.peg !== null) { val.push(m.peg < 1 ? 85 : m.peg < 2 ? 55 : 20); valP.push(`PEG ${m.peg}: ${m.peg < 1 ? 'prezzo basso rispetto alla crescita' : m.peg < 2 ? 'equilibrato' : 'prezzo alto rispetto alla crescita'}`); }
  if (m.pb !== null) { val.push(m.pb < 1.5 ? 80 : m.pb < 4 ? 55 : 25); valP.push(`P/B ${m.pb}: ${m.pb < 1.5 ? 'vicino al valore dei beni' : m.pb < 4 ? 'nella norma' : 'il prezzo vale molte volte il patrimonio'}`); }
  if (m.pfcf !== null) { val.push(m.pfcf < 15 ? 85 : m.pfcf < 30 ? 55 : 25); valP.push(`Prezzo/flusso di cassa ${m.pfcf}: ${m.pfcf < 15 ? 'conveniente' : m.pfcf < 30 ? 'nella norma' : 'caro'}`); }
  if (m.grahamRatio !== null) { val.push(m.grahamRatio < 1 ? 90 : m.grahamRatio < 1.5 ? 60 : 25); valP.push(`Prezzo/numero di Graham ${m.grahamRatio}: ${m.grahamRatio < 1 ? 'sotto il valore «prudente»' : 'sopra il valore «prudente»'}`); }
  const prof: number[] = [], profP: string[] = [];
  if (m.netMargin !== null) { prof.push(lin(m.netMargin, 0, 20)); profP.push(`Margine netto ${m.netMargin}%: su 100 di ricavi restano ${m.netMargin} di utile`); }
  if (m.opMargin !== null) { prof.push(lin(m.opMargin, 0, 25)); profP.push(`Margine operativo ${m.opMargin}%`); }
  if (m.roe !== null) { prof.push(lin(m.roe, 0, 20)); profP.push(`ROE ${m.roe}%: ${m.roe >= 15 ? 'il capitale rende bene' : m.roe >= 8 ? 'rendimento medio del capitale' : 'il capitale rende poco'}`); }
  const gro: number[] = [], groP: string[] = [];
  if (ok(f.revGrowth)) { gro.push(lin(f.revGrowth, -5, 15)); groP.push(`Ricavi ${f.revGrowth >= 0 ? '+' : ''}${f.revGrowth}% l’anno`); }
  if (ok(f.epsGrowth)) { gro.push(lin(f.epsGrowth, -5, 20)); groP.push(`Utili ${f.epsGrowth >= 0 ? '+' : ''}${f.epsGrowth}% l’anno`); }
  const sol: number[] = [], solP: string[] = [];
  if (m.debtEquity !== null) { sol.push(m.debtEquity <= 0.5 ? 90 : m.debtEquity <= 1.5 ? 60 : m.debtEquity <= 3 ? 30 : 10); solP.push(`Debito/capitale ${m.debtEquity}: ${m.debtEquity <= 0.5 ? 'basso' : m.debtEquity <= 1.5 ? 'moderato' : 'alto'}`); }
  if (m.netDebt !== null) { sol.push(m.netDebt <= 0 ? 95 : 50); solP.push(m.netDebt <= 0 ? 'Più liquidità che debiti: posizione netta positiva' : `Debito netto ${m.netDebt} milioni`); }
  if (m.coverage !== null) { sol.push(m.coverage >= 8 ? 95 : m.coverage >= 3 ? 65 : m.coverage >= 1.5 ? 35 : 10); solP.push(`Copertura degli interessi ${m.coverage}x: ${m.coverage >= 8 ? 'molto ampia' : m.coverage >= 3 ? 'adeguata' : 'stretta'}`); }
  const mk = (id: Pillar['id'], label: string, xs: number[], pts: string[], hi: string, mid: string, lo: string): Pillar => { const s = avg(xs); return { id, label, score: s, verdict: verdictOf(s, hi, mid, lo), points: pts, used: xs.length }; };
  return [
    mk('valutazione', 'Prezzo', val, valP, 'prezzo interessante', 'prezzo nella norma', 'prezzo impegnativo'),
    mk('redditivita', 'Redditività', prof, profP, 'molto redditizia', 'redditività media', 'poco redditizia'),
    mk('crescita', 'Crescita', gro, groP, 'in forte crescita', 'crescita moderata', 'crescita debole'),
    mk('solidita', 'Solidità', sol, solP, 'bilancio solido', 'bilancio nella media', 'bilancio fragile'),
  ];
}
export const completeness = (f: Facts) => { const keys = FACT_FIELDS.map((x) => x.key); return { have: keys.filter((k) => ok(f[k])).length, total: keys.length }; };

export type Dcf = { fair: number; marginOfSafety: number; years: number[] } | null;
/** Valore stimato scontando i flussi di cassa futuri: cinque anni di crescita `g`%, poi crescita `tg`%, sconto `r`%. */
export function dcf(fcfps: number | undefined, g: number, r: number, tg: number, price: number): Dcf {
  if (!pos(fcfps) || r <= tg || r <= 0) return null;
  const years: number[] = [];
  let pv = 0, cf = fcfps;
  for (let y = 1; y <= 5; y++) { cf *= 1 + g / 100; years.push(r2(cf)); pv += cf / (1 + r / 100) ** y; }
  const terminal = (cf * (1 + tg / 100)) / ((r - tg) / 100);
  pv += terminal / (1 + r / 100) ** 5;
  const fair = r2(pv);
  return { fair, marginOfSafety: price > 0 && fair > 0 ? r2(((fair - price) / fair) * 100) : 0, years };
}
/** Tabella di sensibilità: valore stimato al variare di sconto e crescita. */
export function dcfGrid(fcfps: number | undefined, g: number, r: number, tg: number, price: number) {
  return [-1, 0, 1].map((dr) => [-2, 0, 2].map((dg) => dcf(fcfps, g + dg, r + dr, tg, price)?.fair ?? null));
}
