import type { BillingPlan, Pricing } from './types.ts';

export const MAX_MONTHLY = 500;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Normalizza i prezzi inseriti dal creatore. */
export function sanitizePricing(p: Partial<Pricing>, currency = 'LP'): Pricing {
  const monthly = Math.min(MAX_MONTHLY, Math.max(0, r2(Number(p.monthly) || 0)));
  return {
    monthly,
    currency: p.currency || currency,
    trialDays: monthly > 0 ? Math.min(30, Math.max(0, Math.round(Number(p.trialDays) || 0))) : 0,
    yearlyDiscountPct: monthly > 0 ? Math.min(50, Math.max(0, Math.round(Number(p.yearlyDiscountPct) || 0))) : 0,
  };
}

/** Prezzo annuale = 12 mesi meno lo sconto. */
export function yearlyPrice(p: Pricing): number {
  return r2(p.monthly * 12 * (1 - p.yearlyDiscountPct / 100));
}

/** Prezzo medio al mese del piano annuale. */
export const yearlyPerMonth = (p: Pricing) => r2(yearlyPrice(p) / 12);

export const hasYearly = (p: Pricing) => p.monthly > 0 && p.yearlyDiscountPct > 0;

export const priceOf = (p: Pricing, plan: BillingPlan) => (plan === 'annuale' ? yearlyPrice(p) : p.monthly);

/** Cifra senza decimali se intera: 12 -> "12", 12.5 -> "12.50". */
export function plainAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Quota del creatore dopo commissione (demo: la commissione reale e' definita dal provider/contratto). */
export const PLATFORM_FEE_PCT = 15;
export function creatorNet(gross: number, feePct = PLATFORM_FEE_PCT): number {
  return r2(gross * (1 - feePct / 100));
}

/** Guadagno mensile dimostrativo: abbonati premium x quota, al netto della commissione. */
export function monthlyRevenue(p: Pricing, premiumMembers: number, yearlyShare = 0): { gross: number; fee: number; net: number } {
  const perSub = p.monthly * (1 - yearlyShare) + yearlyPerMonth(p) * yearlyShare;
  const gross = r2(perSub * premiumMembers);
  const net = creatorNet(gross);
  return { gross, fee: r2(gross - net), net };
}
