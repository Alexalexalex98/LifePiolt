/** Ricerca di un centro e stato rispetto al programma LifePass (modulo PURO). */
import type { Gym } from './data.ts';

export type Invite = { id: string; name: string; ts: number; status: 'invitato' | 'rifiutato' };
export type RequestLike = { name: string; status: 'in verifica' | 'approvata' };
export type GymStanding =
  | { kind: 'convenzionato'; gyms: Gym[] }
  | { kind: 'in-verifica'; name: string }
  | { kind: 'invitato'; invite: Invite }
  | { kind: 'rifiutato'; invite: Invite }
  | { kind: 'non-convenzionato' };

export const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const same = (a: string, b: string) => { const x = normName(a), y = normName(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

/** Cerca per nome, città o servizio tra i centri del programma. */
export function findGyms(q: string, gyms: Gym[]): Gym[] {
  const words = normName(q).split(' ').filter(Boolean);
  if (!words.length) return gyms;
  return gyms.filter((g) => { const hay = normName(`${g.name} ${g.city} ${g.address} ${g.services.join(' ')} ${g.kind}`); return words.every((w) => hay.includes(w)); });
}

/** Cosa dire di un centro cercato: nel programma, in verifica, invitato (in attesa), invitato ma non ha aderito, oppure non convenzionato. */
export function gymStanding(q: string, gyms: Gym[], requests: RequestLike[], invites: Invite[]): GymStanding {
  const found = findGyms(q, gyms);
  if (found.length) return { kind: 'convenzionato', gyms: found };
  const req = requests.find((r) => r.status === 'in verifica' && same(r.name, q));
  if (req) return { kind: 'in-verifica', name: req.name };
  const inv = invites.find((i) => same(i.name, q));
  if (inv) return inv.status === 'rifiutato' ? { kind: 'rifiutato', invite: inv } : { kind: 'invitato', invite: inv };
  return { kind: 'non-convenzionato' };
}
