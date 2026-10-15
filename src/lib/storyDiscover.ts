/** Persone che compaiono nel recap di «Per te» anche se non le segui: hanno ricevuto o donato un LifePoint con te, o scrivono cose simili a quelle che ti piacciono. */
export type DiscoverInput = {
  me: string;
  following: string[];
  dailyHistory?: { to: string | null }[];
  donorsLog?: Record<string, { from: string }[]>;
  likedAuthors: string[];
  swipedYesAuthors: string[];
};
export function discoverAuthors(i: DiscoverInput): string[] {
  const out = new Set<string>();
  (i.dailyHistory ?? []).forEach((h) => { if (h.to) out.add(h.to); });
  (i.donorsLog?.[i.me] ?? []).forEach((d) => out.add(d.from));
  i.likedAuthors.forEach((a) => out.add(a));
  i.swipedYesAuthors.forEach((a) => out.add(a));
  out.delete(i.me); out.delete('Tu');
  return [...out].filter((a) => !i.following.includes(a));
}
/** Chi si vede nel recap: «Seguiti» solo chi segui; «Per te» anche chi è stato scoperto. */
export const recapAuthors = (following: string[], discovered: string[], mode: 'Per te' | 'Seguiti'): string[] => (mode === 'Seguiti' ? following : [...following, ...discovered]);
