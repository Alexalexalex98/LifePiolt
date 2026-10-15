/** LifePay: il portafoglio dell'app. Si paga solo in LifePoints; le cripto si possono cambiare in LifePoints (mai il contrario nell'app). */
export type Asset = 'BTC' | 'ETH' | 'USDC' | 'SOL';
export const ASSETS: { id: Asset; name: string; decimals: number }[] = [
  { id: 'BTC', name: 'Bitcoin', decimals: 6 }, { id: 'ETH', name: 'Ether', decimals: 5 }, { id: 'USDC', name: 'USD Coin', decimals: 2 }, { id: 'SOL', name: 'Solana', decimals: 3 },
];
/** Tassi DIMOSTRATIVI (LifePoints per 1 unità): in produzione arrivano da un fornitore autorizzato. */
export const DEMO_RATES: Record<Asset, number> = { BTC: 64000, ETH: 3100, USDC: 1, SOL: 150 };
export const CONVERT_FEE = 0.01;
export const MIN_LP = 1;

export type Quote = { ok: true; lp: number; fee: number; gross: number } | { ok: false; reason: string };

export function quote(asset: Asset, amount: number, balance: number, rates: Record<Asset, number> = DEMO_RATES): Quote {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'Inserisci una quantità valida' };
  if (amount > balance + 1e-12) return { ok: false, reason: 'Non hai abbastanza ' + asset };
  const rate = rates[asset];
  if (!rate || rate <= 0) return { ok: false, reason: 'Tasso non disponibile' };
  const gross = amount * rate;
  const fee = gross * CONVERT_FEE;
  const lp = Math.floor((gross - fee) * 100) / 100;
  if (lp < MIN_LP) return { ok: false, reason: 'Importo troppo piccolo: minimo ' + MIN_LP + ' LP' };
  return { ok: true, lp, fee: Math.round(fee * 100) / 100, gross: Math.round(gross * 100) / 100 };
}

export type Holdings = Partial<Record<Asset, number>>;
export function applyConversion(h: Holdings | undefined, asset: Asset, amount: number): Holdings {
  const left = Math.max(0, (h?.[asset] ?? 0) - amount);
  return { ...(h ?? {}), [asset]: Math.round(left * 1e8) / 1e8 };
}

/** Codice da mostrare alla cassa: scade dopo 60 secondi e cambia a ogni minuto (il link contiene un contatore, non dati personali). */
export function payToken(now: number, windowMs = 60000): number { return Math.floor(now / windowMs); }
