/** Ricerca nel workspace (modulo PURO, nessun alias '@/'): cerca in tutto quello che il telefono ha ricevuto dal server, quindi solo in ciò che la persona può vedere. */
export type SearchItem = { kind: 'page' | 'task' | 'client' | 'deal' | 'meeting' | 'message' | 'person' | 'doc'; id: string; title: string; text: string; tab: string; sub?: string };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const words = (q: string): string[] => norm(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
/** Tutte le parole devono comparire (nel titolo valgono di più); i risultati migliori per primi. */
export function searchItems(q: string, items: SearchItem[], limit = 30): (SearchItem & { score: number; snippet: string })[] {
  const w = words(q); if (!w.length) return [];
  const out: (SearchItem & { score: number; snippet: string })[] = [];
  for (const it of items) {
    const t = norm(it.title); const x = norm(it.text); let score = 0; let ok = true;
    for (const k of w) { const inT = t.includes(k); const inX = x.includes(k); if (!inT && !inX) { ok = false; break; } score += (inT ? 3 : 0) + (inX ? 1 : 0) + (t.startsWith(k) ? 1 : 0); }
    if (!ok) continue;
    const at = x.indexOf(w[0]!); const snippet = at < 0 ? '' : it.text.slice(Math.max(0, at - 30), at + 90).replace(/\s+/g, ' ').trim();
    out.push({ ...it, score, snippet });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
export const KIND_LABEL: Record<SearchItem['kind'], string> = { page: 'Pagina', task: 'Task', client: 'Cliente', deal: 'Trattativa', meeting: 'Riunione', message: 'Messaggio', person: 'Persona', doc: 'Documento' };
