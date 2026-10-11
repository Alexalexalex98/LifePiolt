import { computeFit, computeTrust, type Fit } from '@/lib/hiring';
import { mergedScores } from '@/lib/interview';
import { trustFor } from '@/lib/trust';
import { profileOf, type Application, type Job } from '@/store/jobs';

/** Punteggi per competenza di una candidatura: test + ulteriori verifiche svolte (ogni risultato pesa uguale). */
export function scoresOfApplication(app: Application): Record<string, number | null> {
  const extra = (app.checks ?? []).filter((c) => c.status === 'done' && c.result).map((c) => c.result!.skillScores);
  return extra.length ? mergedScores([app.result.skillScores, ...extra]) : app.result.skillScores;
}

/**
 * Indice di atteggiamento di una candidatura: SOLO dalle risposte del test (scenari e coerenza).
 * Non usa voti, LifePoints, segnalazioni né altri segnali del profilo pubblico di LifeNetwork: l'azienda non li vede.
 */
export function attitudeOfApplication(app: Application) {
  return computeTrust({ ratingSum: 0, ratingCount: 0, receivedLP: 0, reports: 0, identityVerified: null, traitScores: app.result.traits, consistency: app.result.consistency, streak: 0 });
}

/** Adeguatezza di una candidatura inviata a un'offerta (competenze + atteggiamento nel test). */
export function fitOfApplication(job: Job, app: Application, _me?: string): Fit & { trust: number | null } {
  const trust = attitudeOfApplication(app).score;
  return { ...computeFit(job.reqs, scoresOfApplication(app), trust, job.trustWeight), trust };
}

/** Quanto una persona è adatta a un'offerta in base alle competenze GIÀ verificate. */
export function fitOfPerson(job: Job, person: string, me: string): Fit & { trust: number | null } {
  const p = profileOf(person);
  const scores = Object.fromEntries(Object.entries(p.skills).map(([k, v]) => [k, v.score]));
  const trust = trustFor(person, me).score;
  return { ...computeFit(job.reqs, scores, trust, job.trustWeight), trust };
}

export const statusLabel = { submitted: 'Ricevuta', shortlist: 'Nei preferiti', invited: 'Nei preferiti', rejected: 'Non selezionato' } as const;
