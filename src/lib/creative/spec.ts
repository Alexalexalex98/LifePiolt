/**
 * Le creazioni dell'utente sono DATI, non codice: una scheda è un elenco di blocchi che l'app sa già disegnare.
 * Modulo PURO (si prova con node:test). Tutto ciò che arriva dall'AI passa da `cleanSpec`: tipi sconosciuti, testi troppo lunghi o troppi blocchi vengono scartati.
 */
export type Block =
  | { t: 'heading'; text: string }
  | { t: 'text'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'stat'; label: string; value: string; hint?: string }
  | { t: 'progress'; label: string; pct: number }
  | { t: 'button'; label: string; message: string }
  | { t: 'note'; text: string }
  | { t: 'divider' };
export type Spec = { title: string; blocks: Block[] };

export const MAX_BLOCKS = 40;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function cleanSpec(raw: unknown): Spec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = str(o.title, 60);
  const src = Array.isArray(o.blocks) ? o.blocks.slice(0, MAX_BLOCKS) : [];
  const blocks: Block[] = [];
  for (const b of src) {
    if (!b || typeof b !== 'object') continue;
    const x = b as Record<string, unknown>;
    switch (x.t) {
      case 'heading': { const text = str(x.text, 80); if (text) blocks.push({ t: 'heading', text }); break; }
      case 'text': { const text = str(x.text, 400); if (text) blocks.push({ t: 'text', text }); break; }
      case 'note': { const text = str(x.text, 240); if (text) blocks.push({ t: 'note', text }); break; }
      case 'list': { const items = Array.isArray(x.items) ? x.items.map((i) => str(i, 100)).filter(Boolean).slice(0, 20) : []; if (items.length) blocks.push({ t: 'list', items }); break; }
      case 'stat': { const label = str(x.label, 40), value = str(x.value, 30); if (label && value) blocks.push({ t: 'stat', label, value, ...(str(x.hint, 80) ? { hint: str(x.hint, 80) } : {}) }); break; }
      case 'progress': { const label = str(x.label, 60); const pct = Number(x.pct); if (label && Number.isFinite(pct)) blocks.push({ t: 'progress', label, pct: Math.max(0, Math.min(100, Math.round(pct))) }); break; }
      case 'button': { const label = str(x.label, 40); if (label) blocks.push({ t: 'button', label, message: str(x.message, 120) || label }); break; }
      case 'divider': blocks.push({ t: 'divider' }); break;
      default: break;
    }
  }
  if (!title && !blocks.length) return null;
  return { title: title || 'Nuova scheda', blocks };
}

/** Dalla risposta dell'AI: il testo da mostrare e, se c'è, la scheda tra [[SCHEDA {...}]] (o in un blocco ```json). */
export function parseBuilderReply(reply: string): { text: string; spec: Spec | null } {
  let spec: Spec | null = null;
  let text = reply;
  const m = /\[\[\s*SCHEDA\s*([\s\S]*?)\]\]/i.exec(reply) ?? /```(?:json)?\s*([\s\S]*?)```/i.exec(reply);
  if (m) {
    try { spec = cleanSpec(JSON.parse(m[1]!.trim())); } catch { spec = null; }
    text = reply.replace(m[0], '').trim();
  }
  return { text, spec };
}

export const BUILDER_PROMPT = `Sei l'assistente creativo di LifePilot. L'utente descrive un'idea per una nuova schermata dell'app: tu la trasformi in una SCHEDA DEMO fatta solo di blocchi. Non scrivi codice e non prometti che funzioni davvero: è un'anteprima da far vedere al team.
Rispondi con 1-3 frasi in italiano, positive e concrete (cosa hai creato, cosa potrebbe fare nella versione vera), poi, se hai creato o modificato la scheda, aggiungi una riga: [[SCHEDA {"title":"...","blocks":[...]}]]
Blocchi ammessi (JSON): {"t":"heading","text"} {"t":"text","text"} {"t":"list","items":[..]} {"t":"stat","label","value","hint"} {"t":"progress","label","pct":0-100} {"t":"button","label","message"} {"t":"note","text"} {"t":"divider"}.
Usa dati di esempio chiaramente inventati. Rifiuta con gentilezza idee dannose, illegali, ingannevoli o che violano la privacy di altri, e proponi un'alternativa. Se manca un dettaglio importante fai una sola domanda breve.`;
