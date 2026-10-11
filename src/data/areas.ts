/**
 * "Cosa ti interessa di più?": scelte generiche dell'onboarding (saltabile). Servono SOLO a mostrare prima le aree scelte
 * (guida, funzione del giorno); non nascondono nulla. LOGICA PURA, nessun import con alias.
 */
export type AreaDef = { id: string; label: string; /** gruppi della guida (features.ts) da mostrare per primi */ groups: string[] };

export const AREA_CATALOG: AreaDef[] = [
  { id: 'giornate', label: 'Organizzare le giornate', groups: ['oggi', 'piano', 'assistente'] },
  { id: 'salute', label: 'Salute e sport', groups: ['salute'] },
  { id: 'soldi', label: 'Soldi e bollette', groups: ['finanze'] },
  { id: 'viaggi', label: 'Viaggi', groups: ['vita'] },
  { id: 'studio', label: 'Studio e lavoro', groups: ['piano', 'vita'] },
  { id: 'famiglia', label: 'Famiglia', groups: ['chat', 'vita'] },
  { id: 'persone', label: 'Conoscere persone', groups: ['network', 'chat'] },
  { id: 'investire', label: 'Investire e fare impresa', groups: ['finanze', 'network'] },
];

/** Gruppi della guida preferiti per le aree scelte (vuoto se non ne ha scelte). */
export function preferredGroups(areas: string[] | undefined | null): string[] {
  if (!areas?.length) return [];
  const out: string[] = [];
  for (const a of AREA_CATALOG) if (areas.includes(a.id)) for (const g of a.groups) if (!out.includes(g)) out.push(g);
  return out;
}
