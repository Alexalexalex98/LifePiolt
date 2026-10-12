import { useChat } from '@/store/chat';
import { useFin } from '@/store/finance';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';

import { buildDocs } from './docs';
import { SearchEngine } from './engine';
import { openMemoryDb } from './memdb';

/**
 * Indice di ricerca: si sottoscrive agli store dall'esterno (gli store non sanno nulla della ricerca)
 * e si riallinea con debounce. L'indice e' in memoria: si ricostruisce all'avvio.
 */
export const searchEngine = new SearchEngine({
  getDocs: () => buildDocs({ life: useLife.getState() as never, network: useNet.getState() as never, chat: useChat.getState() as never, finance: useFin.getState() as never }),
  openMemoryDb,
});

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function startSearchSync() {
  if (started) return;
  started = true;
  const dirty = () => {
    searchEngine.markDirty();
    // finche' nessuno ha mai cercato non costruisco nulla: l'indice si crea alla prima ricerca
    if (searchEngine.kind === 'closed') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void searchEngine.reindex().catch(() => undefined); }, 4000);
  };
  // si ignora il primo evento: l'indice si costruisce alla prima ricerca (o in background dopo l'avvio)
  for (const s of [useLife, useNet, useChat, useFin]) s.subscribe(dirty);
}

export function resetSearch() { void searchEngine.clear(); }
