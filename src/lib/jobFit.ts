import { computeFit, type Fit } from '@/lib/hiring';
import { trustFor } from '@/lib/trust';
import { profileOf, type Application, type Job } from '@/store/jobs';

/** Adeguatezza di una candidatura inviata a un'offerta. */
export function fitOfApplication(job: Job, app: Application, me: string): Fit & { trust: number | null } {
  const trust = trustFor(app.candidate, me).score;
  return { ...computeFit(job.reqs, app.result.skillScores, trust, job.trustWeight), trust };
}

/** Quanto una persona è adatta a un'offerta in base alle competenze GIÀ verificate. */
export function fitOfPerson(job: Job, person: string, me: string): Fit & { trust: number | null } {
  const p = profileOf(person);
  const scores = Object.fromEntries(Object.entries(p.skills).map(([k, v]) => [k, v.score]));
  const trust = trustFor(person, me).score;
  return { ...computeFit(job.reqs, scores, trust, job.trustWeight), trust };
}

export const statusLabel = { submitted: 'Ricevuta', shortlist: 'Nei preferiti', invited: 'Invitato al colloquio', rejected: 'Non selezionato' } as const;
