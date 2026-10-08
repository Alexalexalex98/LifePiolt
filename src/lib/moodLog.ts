export type MoodEntryLike = { date: string; mood: string; day?: string };

/** Logica pura: toglie le voci di `day` e, se `mood` non è null, ne mette una sola in testa (sostituisce, non aggiunge). */
export function replaceTodayMood<T extends MoodEntryLike>(moods: T[], mood: string | null, day: string, date: string): MoodEntryLike[] {
  const rest = moods.filter((m) => m.day !== day);
  return mood == null ? rest : [{ date, mood, day }, ...rest];
}
