import { fmtDate, formatMoney } from '@/i18n/format';
import { plainAmount, type Pricing } from '@/lib/club';

export const money = (n: number, currency = 'CHF') => formatMoney(n, { currency, decimals: Number.isInteger(n) ? 0 : 2 });
export const perMonth = (p: Pricing) => money(p.monthly, p.currency);
export const dayLong = (ts?: number) => (ts ? fmtDate(ts, { day: 'numeric', month: 'long' }) : '');
export { plainAmount };
