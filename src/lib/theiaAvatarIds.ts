/**
 * Le facce di Theia per campo: come un esperto che cambia vestito (camice per la salute, occhiali e salvadanaio per la finanza…).
 * Qui solo i nomi e le regole (modulo PURO); le immagini sono in theiaAvatars.ts.
 */
export const AVATAR_IDS = ['salute', 'alimentazione', 'fitness', 'mente', 'finanza', 'fisco', 'diritto', 'lavoro', 'casa', 'viaggi', 'famiglia', 'auto', 'animali', 'studio', 'tecnologia', 'business', 'scienza', 'pratiche', 'sicurezza', 'ambiente'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

/** Le sezioni della chat (argomenti) → il campo la cui faccia mostrare. Le sezioni senza un campo (Generale, Piano, Musica…) restano con la Theia di sempre. */
const TOPIC_AVATAR: Record<string, AvatarId> = {
  Salute: 'salute', Mente: 'mente', Fitness: 'fitness', Cucina: 'alimentazione', Finanze: 'finanza', Legale: 'diritto', Lavoro: 'lavoro',
  Casa: 'casa', Viaggi: 'viaggi', Studio: 'studio', Tecnologia: 'tecnologia',
};

export const isAvatarId = (s: unknown): s is AvatarId => typeof s === 'string' && (AVATAR_IDS as readonly string[]).includes(s);

/** La faccia per un messaggio: prima il campo con cui ha risposto l'esperta, poi la sezione della chat. */
export function avatarFor(topic: string | undefined, domain: string | undefined): AvatarId | null {
  if (isAvatarId(domain)) return domain;
  return (topic && TOPIC_AVATAR[topic]) || null;
}
