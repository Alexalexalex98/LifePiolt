/** Ricerca nel workspace (modulo PURO): spezza i testi in pezzi, li ordina per parole in comune con la domanda e sceglie i migliori da dare all'assistente. */
export type Doc = { id: string; source: string; text: string };
export type Chunk = { docId: string; source: string; text: string };

const STOP = new Set('il lo la i gli le un uno una di a da in con su per tra fra e o ma che chi cosa come quale quali dove quando è sono ho hai ha del della dei delle nel nella al alla ai alle mi ti si ci non più molto the of to and for is are what how'.split(' '));
export const tokens = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

export function chunkDocs(docs: Doc[], size = 1100): Chunk[] {
  const out: Chunk[] = [];
  for (const d of docs) {
    const paras = d.text.split(/\n+/).filter((p) => p.trim());
    let cur = '';
    for (const p of paras) {
      if (cur && cur.length + p.length > size) { out.push({ docId: d.id, source: d.source, text: cur }); cur = ''; }
      cur += `${cur ? '\n' : ''}${p}`;
      while (cur.length > size * 1.6) { out.push({ docId: d.id, source: d.source, text: cur.slice(0, size) }); cur = cur.slice(size); }
    }
    if (cur.trim()) out.push({ docId: d.id, source: d.source, text: cur });
  }
  return out;
}

/** Punteggio: parole della domanda trovate nel pezzo (con peso maggiore alle più rare) + bonus se compaiono nel nome della fonte. */
export function rank(question: string, chunks: Chunk[], top = 8): Chunk[] {
  const q = [...new Set(tokens(question))];
  if (!q.length) return chunks.slice(0, top);
  const bags = chunks.map((c) => new Set(tokens(`${c.source} ${c.text}`)));
  const df = new Map<string, number>(); for (const w of q) df.set(w, bags.filter((b) => b.has(w)).length);
  const score = (i: number) => q.reduce((a, w) => a + (bags[i]!.has(w) ? 1 + Math.log(1 + chunks.length / (1 + (df.get(w) ?? 0))) : 0) + (tokens(chunks[i]!.source).includes(w) ? 1.5 : 0), 0);
  return chunks.map((c, i) => ({ c, s: score(i) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, top).map((x) => x.c);
}

export function contextFor(question: string, docs: Doc[], maxChars = 14000): { text: string; sources: string[] } {
  const picked = rank(question, chunkDocs(docs), 14);
  let used = 0; const parts: string[] = []; const sources: string[] = [];
  for (const c of picked) {
    if (used + c.text.length > maxChars) break;
    parts.push(`### ${c.source}\n${c.text}`); used += c.text.length;
    if (!sources.includes(c.source)) sources.push(c.source);
  }
  return { text: parts.join('\n\n'), sources };
}

export const WORKSPACE_PROMPT = (ctx: string, q: string) => `Sei l'assistente di LifeWorkspace, lo spazio di lavoro dell'utente. Sei SEPARATO da Theia: non conosci la sua vita privata, solo i documenti qui sotto.
Rispondi alla domanda usando SOLO questi documenti. Cita tra parentesi il nome della fonte da cui prendi ogni informazione. Se la risposta non c'è, dillo chiaramente e non inventare. Rispondi in italiano, in modo chiaro e breve.

DOCUMENTI:
${ctx || '(nessun documento corrisponde)'}

DOMANDA: ${q}`;
