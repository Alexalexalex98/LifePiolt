import { computeTrust, type Trust } from '@/lib/hiring';
import { donationStreak, ratingFor, receivedLPFor } from '@/lib/network';
import { profileOf } from '@/store/jobs';
import { useNet } from '@/store/network';

/** Indice di affidabilità di una persona, costruito solo da segnali che l'app conosce. */
export function trustFor(name: string, me: string): Trust {
  const net = useNet.getState();
  const r = ratingFor(name);
  const sum = Object.entries(r.counts).reduce((s, [star, n]) => s + Number(star) * (n as number), 0);
  const p = profileOf(name);
  return computeTrust({
    ratingSum: sum, ratingCount: r.count, receivedLP: receivedLPFor(name), reports: net.reports[name] || 0,
    identityVerified: name === me ? net.identity.verified : null,
    traitScores: p.traits, consistency: p.consistency, streak: name === me ? donationStreak() : 0,
  });
}
