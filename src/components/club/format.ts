import { fmtDate, fmtInt } from '@/i18n/format';
import { plainAmount, type Pricing } from '@/lib/club';

/** Nell'app si paga solo con LifePoints: nessuna valuta reale. */
export const money = (n: number, _currency?: string) => `${Number.isInteger(n) ? fmtInt(n) : (Math.round(n * 100) / 100).toFixed(2)} LP`;
export const perMonth = (p: Pricing) => money(p.monthly, p.currency);
export const dayLong = (ts?: number) => (ts ? fmtDate(ts, { day: 'numeric', month: 'long' }) : '');
export { plainAmount };
