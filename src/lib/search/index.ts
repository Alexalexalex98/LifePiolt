import type { SearchHit, SearchOptions } from './types';
import { searchEngine, startSearchSync } from './sync';

export * from './types';
export { searchEngine, resetSearch, startSearchSync } from './sync';

/** Ricerca globale: BM25 su FTS5 (telefono) o in memoria (web / Expo Go senza FTS5). */
export async function searchAll(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  startSearchSync();
  return searchEngine.searchAll(query, opts);
}
